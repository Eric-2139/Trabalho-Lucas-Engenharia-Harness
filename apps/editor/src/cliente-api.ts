import type { RecusaPublicacao } from '@math-scape/schema/contrato';
import type { ClienteApiEditor, CriarClienteApiEditor, ResultadoHttp } from '../contrato/index.ts';

const MSG_REDE = 'Não foi possível falar com o servidor. Tente de novo.';

type Falha = { ok: false; status: number; erro: string; detalhes?: unknown };

interface Pedido {
  metodo?: string;
  json?: unknown;
  corpo?: BodyInit;
  tipoConteudo?: string;
  /** `entrar` e `cadastrar`: 401 é só resultado, sem `aoNaoAutenticado` (RF-01). */
  ignorar401?: boolean;
  blob?: boolean;
}

function ehObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

async function lerJson(resposta: Response): Promise<unknown> {
  const texto = await resposta.text();
  if (!texto) return undefined;
  return JSON.parse(texto);
}

/**
 * Cliente HTTP do editor (contrato api.md, LAC-038): nunca rejeita; envia o cookie de sessão (ADR-017).
 * 401 fora de `entrar` e `cadastrar` chama `aoNaoAutenticado` (RF-01).
 */
export const criarClienteApiEditor: CriarClienteApiEditor = (baseUrlApi, opcoes = {}) => {
  const buscar = opcoes.fetch ?? ((...args: Parameters<typeof fetch>) => globalThis.fetch(...args));
  const base = baseUrlApi.replace(/\/+$/, '');

  async function falha(resposta: Response): Promise<Falha> {
    const status = resposta.status;
    let corpo: unknown;
    try {
      corpo = await lerJson(resposta);
    } catch {
      corpo = undefined;
    }
    if (ehObjeto(corpo) && typeof corpo.erro === 'string') {
      const resultado: Falha = { ok: false, status, erro: corpo.erro };
      if (corpo.detalhes !== undefined) resultado.detalhes = corpo.detalhes;
      return resultado;
    }
    return { ok: false, status, erro: `Erro ${status} do servidor.` };
  }

  async function enviar(caminho: string, pedido: Pedido): Promise<Response | null> {
    const init: RequestInit = { method: pedido.metodo ?? 'GET', credentials: 'include' };
    if (pedido.json !== undefined) {
      init.headers = { 'content-type': 'application/json' };
      init.body = JSON.stringify(pedido.json);
    } else if (pedido.corpo !== undefined) {
      if (pedido.tipoConteudo) init.headers = { 'content-type': pedido.tipoConteudo };
      init.body = pedido.corpo;
    }
    try {
      return await buscar(`${base}${caminho}`, init);
    } catch {
      return null;
    }
  }

  async function requisitar<T>(caminho: string, pedido: Pedido = {}): Promise<ResultadoHttp<T>> {
    const resposta = await enviar(caminho, pedido);
    if (!resposta) return { ok: false, status: 0, erro: MSG_REDE };
    if (resposta.ok) {
      try {
        const valor = pedido.blob ? await resposta.blob() : await lerJson(resposta);
        return { ok: true, valor: valor as T };
      } catch {
        return { ok: false, status: resposta.status, erro: `Erro ${resposta.status} do servidor.` };
      }
    }
    if (resposta.status === 401 && !pedido.ignorar401) opcoes.aoNaoAutenticado?.();
    return falha(resposta);
  }

  const cliente: ClienteApiEditor = {
    cadastrar: (nome, email, senha) =>
      requisitar('/auth/cadastro', { metodo: 'POST', json: { nome, email, senha }, ignorar401: true }),
    entrar: (email, senha) => requisitar('/auth/login', { metodo: 'POST', json: { email, senha }, ignorar401: true }),
    sair: () => requisitar('/auth/logout', { metodo: 'POST' }),
    excluirConta: () => requisitar('/auth/conta', { metodo: 'DELETE', json: { confirmar: true } }),
    listarFases: () => requisitar('/fases'),
    criarFase: (titulo) => requisitar('/fases', { metodo: 'POST', json: { titulo } }),
    abrirFase: (id) => requisitar(`/fases/${encodeURIComponent(id)}`),
    salvarFase: (id, revisao, documento) =>
      requisitar(`/fases/${encodeURIComponent(id)}`, { metodo: 'PUT', json: { revisao, documento } }),
    renomearFase: (id, titulo) => requisitar(`/fases/${encodeURIComponent(id)}`, { metodo: 'PATCH', json: { titulo } }),
    excluirFase: (id) => requisitar(`/fases/${encodeURIComponent(id)}`, { metodo: 'DELETE' }),
    duplicarFase: (id) => requisitar(`/fases/${encodeURIComponent(id)}/duplicar`, { metodo: 'POST' }),
    async publicarFase(id) {
      const caminho = `/fases/${encodeURIComponent(id)}/publicar`;
      const resposta = await enviar(caminho, { metodo: 'POST' });
      if (!resposta) return { ok: false, status: 0, erro: MSG_REDE };
      if (resposta.status === 422) {
        let corpo: unknown;
        try {
          corpo = await lerJson(resposta.clone());
        } catch {
          corpo = undefined;
        }
        if (ehObjeto(corpo) && typeof corpo.erro === 'string' && Array.isArray(corpo.posicoesSemEnigma)) {
          return { ok: false, status: 422, recusa: corpo as unknown as RecusaPublicacao };
        }
        return falha(resposta);
      }
      if (resposta.ok) {
        try {
          return { ok: true, valor: (await lerJson(resposta)) as { publicadaEm: string } };
        } catch {
          return { ok: false, status: resposta.status, erro: `Erro ${resposta.status} do servidor.` };
        }
      }
      if (resposta.status === 401) opcoes.aoNaoAutenticado?.();
      return falha(resposta);
    },
    jogoTeste: (id) => requisitar(`/fases/${encodeURIComponent(id)}/jogo-teste`),
    exportarFase: (id) => requisitar(`/fases/${encodeURIComponent(id)}/exportar`, { blob: true }),
    importarFase: (arquivo) =>
      requisitar('/fases/importar', { metodo: 'POST', corpo: arquivo, tipoConteudo: arquivo.type || 'application/json' }),
    enviarImagem(arquivo) {
      const formulario = new FormData();
      formulario.append('arquivo', arquivo);
      return requisitar('/assets', { metodo: 'POST', corpo: formulario });
    },
  };
  return cliente;
};
