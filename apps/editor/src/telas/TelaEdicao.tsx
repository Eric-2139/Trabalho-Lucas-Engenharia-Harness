/**
 * Edição (modulos-editor.md §3 e §5, contrato telas.ts · PropsTelaEdicao; RF-03, RF-04, RF-10).
 * Abre a fase (`abrirFase`), valida o documento e cria o store e o salvamento; mostra AbasParedes, BarraFerramentas,
 * CanvasParede (só a parede ativa, palco 16:9), BibliotecaObjetos e PainelPropriedades.
 * Salvamento (RF-10, ADR-002): toda mudança do documento chama `marcarAlterado`; trocar de aba e o botão salvar chamam
 * `salvarAgora`. Em `conflito`, "Recarregar a fase" lê a fase de novo, `store.carregar` e cria um salvamento novo com a
 * revisão lida; a alteração local é descartada. Ao desmontar e no `pagehide` da janela, grava a alteração pendente
 * (PEND-021); quando `sessaoRenovada` muda (novo login depois de um 401), também (PEND-020).
 * Publicar (RF-12): grava a alteração pendente e chama `publicarFase`; o 422 mostra as posições da senha sem enigma
 * num bloco com o título ROTULOS_EDITOR.posicoesSemEnigma; outra recusa mostra só a mensagem em role="alert".
 * Alterações não publicadas (RF-13): o aviso vem de `abrirFase`; depois de cada PUT aceito numa fase publicada, a
 * fase é lida de novo para atualizar o aviso.
 * Testar (RF-11): grava a alteração pendente, pede `jogoTeste` e mostra o ModoTestar (motor do player com o
 * `verificadorTeste`); a recusa aparece em role="alert" e a tela fica na edição. Sair volta à edição sem mudar o store.
 * Exportar (RF-14): grava a alteração pendente, pede `exportarFase` e baixa o Blob sem alteração; a recusa aparece em
 * role="alert" e nada é baixado.
 * Resolução (RNF-01, ADR-006): abaixo de 1280x720 de janela (`precisaAvisoResolucao`), mostra
 * ROTULOS_EDITOR.avisoResolucao sem bloquear a edição.
 * O jsdom não faz layout: o palco usa o tamanho da janela, como na TelaJogo (PEND-019).
 */
import { referenciasDeAsset, validarFase } from '@math-scape/schema';
import { criarVerificadorHttp, precisaAvisoResolucao } from '@math-scape/player';
import type { Verificador } from '@math-scape/player/contrato';
import { CATALOGO, type Fase, type FaseJogo, type RefImagem } from '@math-scape/schema/contrato';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from 'zustand';
import type { ClienteApiEditor, EstadoSalvamento, Relogio, Salvamento } from '../../contrato/salvamento.ts';
import type { StoreEditor } from '../../contrato/store.ts';
import type { PropsTelaEdicao } from '../../contrato/telas.ts';
import { ROTULOS_EDITOR } from '../../contrato/telas.ts';
import { AbasParedes } from '../componentes/AbasParedes.tsx';
import { BarraFerramentas } from '../componentes/BarraFerramentas.tsx';
import { BibliotecaObjetos } from '../componentes/BibliotecaObjetos.tsx';
import { CanvasParede } from '../componentes/CanvasParede.tsx';
import { PainelPropriedades } from '../componentes/PainelPropriedades.tsx';
import { atalhoTeclado } from '../atalhos.ts';
import { criarSalvamento } from '../salvamento.ts';
import { criarStoreEditor } from '../store/index.ts';
import { ModoTestar } from './ModoTestar.tsx';

/** Tamanho da janela, atualizado no `resize`. */
function useJanela() {
  const [janela, definirJanela] = useState(() => ({ largura: window.innerWidth, altura: window.innerHeight }));
  useEffect(() => {
    const aoRedimensionar = () => definirJanela({ largura: window.innerWidth, altura: window.innerHeight });
    window.addEventListener('resize', aoRedimensionar);
    return () => window.removeEventListener('resize', aoRedimensionar);
  }, []);
  return janela;
}

/** Estado atual do salvamento, atualizado por `assinar`. */
function useEstadoSalvamento(salvamento: Salvamento): EstadoSalvamento {
  const [estado, definirEstado] = useState<EstadoSalvamento>(() => salvamento.estado());
  useEffect(() => {
    definirEstado(salvamento.estado());
    return salvamento.assinar(definirEstado);
  }, [salvamento]);
  return estado;
}

function gerarIdPadrao(): string {
  return crypto.randomUUID();
}

/** Campo de texto com foco: input de texto, textarea, select ou conteúdo editável (RF-09). */
function emCampoDeTexto(alvo: EventTarget | null): boolean {
  if (!(alvo instanceof HTMLElement)) return false;
  if (alvo.isContentEditable) return true;
  if (alvo instanceof HTMLTextAreaElement || alvo instanceof HTMLSelectElement) return true;
  if (!(alvo instanceof HTMLInputElement)) return false;
  return !['button', 'checkbox', 'radio', 'submit', 'reset', 'file', 'image', 'range', 'color'].includes(alvo.type);
}

function semRepeticao(refs: readonly RefImagem[]): RefImagem[] {
  return [...new Set(refs)];
}

interface PropsEdicao {
  store: StoreEditor;
  salvamento: Salvamento;
  cliente: ClienteApiEditor;
  faseId: string;
  baseUrlApi: string;
  gerarId: () => string;
  alteracoesNaoPublicadas: boolean;
  aoRecarregar: () => void;
  aoPublicado: () => void;
  verificadorTeste: Verificador;
}

/** Recusa da publicação: a mensagem da Api e, no 422, as posições da senha sem enigma (RF-12). */
interface RecusaNaTela {
  erro: string;
  posicoes: number[];
}

function Edicao({
  store,
  salvamento,
  cliente,
  faseId,
  baseUrlApi,
  gerarId,
  alteracoesNaoPublicadas,
  aoRecarregar,
  aoPublicado,
  verificadorTeste,
}: PropsEdicao) {
  const janela = useJanela();
  const estadoSalvamento = useEstadoSalvamento(salvamento);
  const [enviadas, definirEnviadas] = useState<RefImagem[]>([]);
  const [erroEnvio, definirErroEnvio] = useState<string | null>(null);
  const [recusaPublicacao, definirRecusaPublicacao] = useState<RecusaNaTela | null>(null);
  // RF-11: projeção em teste (null fora do modo testar) e a recusa de `jogoTeste`.
  const [jogo, definirJogo] = useState<FaseJogo | null>(null);
  const [erroTeste, definirErroTeste] = useState<string | null>(null);
  // RF-14: recusa de `exportarFase`.
  const [erroExportar, definirErroExportar] = useState<string | null>(null);
  const testando = useRef(false);
  testando.current = jogo !== null;
  const documento = useStore(store, (estado) => estado.documento);
  const paredeAtiva = useStore(store, (estado) => estado.paredeAtiva);
  const objeto = useStore(store, (estado) =>
    estado.selecionado === null
      ? null
      : (estado.documento.paredes[estado.paredeAtiva].objetos.find((o) => o.id === estado.selecionado) ?? null),
  );

  // RF-09: Ctrl/Cmd+Z desfaz e Ctrl/Cmd+Y refaz, escutando no documento; com o foco num campo de texto não agem.
  useEffect(() => {
    const aoTeclar = (evento: KeyboardEvent) => {
      // Durante o modo testar, os atalhos não mexem no documento (RF-11).
      if (testando.current || emCampoDeTexto(evento.target)) return;
      const acao = atalhoTeclado(evento);
      if (acao === null) return;
      const estadoAtual = store.getState();
      // RF-05 (LAC-044): Delete/Backspace exclui o objeto selecionado; sem seleção, nada acontece.
      if (acao === 'excluir') {
        if (estadoAtual.selecionado === null) return;
        evento.preventDefault();
        estadoAtual.excluirObjeto(estadoAtual.selecionado);
        return;
      }
      evento.preventDefault();
      if (acao === 'desfazer') estadoAtual.desfazer();
      else estadoAtual.refazer();
    };
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [store]);

  // RF-10: toda mudança do documento marca o salvamento como pendente.
  useEffect(
    () =>
      store.subscribe((novo, anterior) => {
        if (novo.documento !== anterior.documento) salvamento.marcarAlterado();
      }),
    [store, salvamento],
  );

  const imagensEnviadas = semRepeticao([...(referenciasDeAsset(documento) as RefImagem[]), ...enviadas]);

  function escolher(ref: RefImagem | null, destino: 'objeto' | 'fundo'): void {
    const estado = store.getState();
    if (destino === 'fundo') {
      estado.definirFundo(estado.paredeAtiva, ref);
      return;
    }
    if (ref !== null) estado.adicionarObjeto('decoracao', ref, gerarId());
  }

  function enviarImagem(arquivo: File): void {
    void cliente.enviarImagem(arquivo).then((resposta) => {
      if (!resposta.ok) {
        definirErroEnvio(resposta.erro);
        return;
      }
      definirErroEnvio(null);
      definirEnviadas((atuais) => [...atuais, resposta.valor.ref]);
    });
  }

  // RF-12: publica o rascunho gravado. A alteração pendente é gravada antes; sem gravação aceita, não publica
  // (o indicador mostra o conflito ou o erro). 422 mostra as posições sem enigma; outra falha, só a mensagem.
  async function publicar(): Promise<void> {
    const estadoGravacao = await salvamento.salvarAgora();
    if (estadoGravacao === 'conflito' || estadoGravacao === 'erro') return;
    const resposta = await cliente.publicarFase(faseId);
    if (resposta.ok) {
      definirRecusaPublicacao(null);
      aoPublicado();
      return;
    }
    if ('recusa' in resposta) {
      definirRecusaPublicacao({ erro: resposta.recusa.erro, posicoes: [...resposta.recusa.posicoesSemEnigma] });
      return;
    }
    definirRecusaPublicacao({ erro: resposta.erro, posicoes: [] });
  }

  // RF-11: grava a alteração pendente (sem gravação aceita, não testa), pede a projeção de teste e joga com o motor
  // do player. O store não é tocado durante o teste: ao sair, o documento é o mesmo de antes.
  async function testar(): Promise<void> {
    const estadoGravacao = await salvamento.salvarAgora();
    if (estadoGravacao === 'conflito' || estadoGravacao === 'erro') return;
    const resposta = await cliente.jogoTeste(faseId);
    if (!resposta.ok) {
      definirErroTeste(resposta.erro);
      return;
    }
    definirErroTeste(null);
    definirJogo(resposta.valor);
  }

  // RF-14: grava a alteração pendente (sem gravação aceita, não exporta), pede o envelope e o entrega para download
  // sem alteração, por `URL.createObjectURL(Blob)` num `<a download>` (modulos-editor.md §5). A recusa aparece em
  // role="alert" e nada é baixado.
  async function exportar(): Promise<void> {
    const estadoGravacao = await salvamento.salvarAgora();
    if (estadoGravacao === 'conflito' || estadoGravacao === 'erro') return;
    const resposta = await cliente.exportarFase(faseId);
    if (!resposta.ok) {
      definirErroExportar(resposta.erro);
      return;
    }
    definirErroExportar(null);
    const url = URL.createObjectURL(resposta.valor);
    const link = document.createElement('a');
    link.href = url;
    link.download = `fase-${faseId}.json`;
    link.click();
    // Revogar depois do clique: revogar no mesmo passo pode cancelar o download em alguns navegadores.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  if (jogo !== null) {
    return (
      <ModoTestar fase={jogo} verificador={verificadorTeste} baseUrlApi={baseUrlApi} aoSair={() => definirJogo(null)} />
    );
  }

  const estado = store.getState();

  return (
    <main>
      {/* RNF-01 (ADR-006): abaixo de 1280x720 de janela, aviso que não bloqueia a edição. */}
      {precisaAvisoResolucao(janela.largura, janela.altura) ? <p>{ROTULOS_EDITOR.avisoResolucao}</p> : null}
      <AbasParedes
        paredeAtiva={paredeAtiva}
        aoTrocar={(parede) => {
          store.getState().trocarParede(parede);
          void salvamento.salvarAgora();
        }}
      />
      <BarraFerramentas
        estadoSalvamento={estadoSalvamento}
        podeDesfazer={estado.podeDesfazer()}
        podeRefazer={estado.podeRefazer()}
        alteracoesNaoPublicadas={alteracoesNaoPublicadas}
        aoDesfazer={() => store.getState().desfazer()}
        aoRefazer={() => store.getState().refazer()}
        aoSalvar={() => void salvamento.salvarAgora()}
        aoTestar={() => void testar()}
        aoPublicar={() => void publicar()}
        aoExportar={() => void exportar()}
      />
      {recusaPublicacao !== null ? (
        <section>
          <p role="alert">{recusaPublicacao.erro}</p>
          {/* Bloco só com o título e as posições: nenhum outro número aparece junto (modulos-editor.md §5). */}
          {recusaPublicacao.posicoes.length > 0 ? (
            <div>
              <h2>{ROTULOS_EDITOR.posicoesSemEnigma}</h2>
              <ul>
                {recusaPublicacao.posicoes.map((posicao) => (
                  <li key={posicao}>
                    {/* Posição sem enigma: leva a Propriedades da fase, onde está a senha (modulos-editor.md §5). */}
                    <button type="button" onClick={() => store.getState().selecionar(null)}>
                      {posicao}
                    </button>{' '}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}
      {erroTeste !== null ? <p role="alert">{erroTeste}</p> : null}
      {erroExportar !== null ? <p role="alert">{erroExportar}</p> : null}
      {estadoSalvamento === 'conflito' ? (
        <button type="button" onClick={aoRecarregar}>
          {ROTULOS_EDITOR.recarregarFase}
        </button>
      ) : null}
      <CanvasParede
        store={store}
        baseUrlApi={baseUrlApi}
        larguraConteiner={janela.largura}
        alturaConteiner={janela.altura}
        aoSoltar={(ref, posicao) => store.getState().adicionarObjeto('decoracao', ref, gerarId(), posicao)}
      />
      <BibliotecaObjetos
        catalogo={CATALOGO}
        imagensEnviadas={imagensEnviadas}
        aoEscolher={escolher}
        aoEnviarImagem={enviarImagem}
      />
      {erroEnvio !== null ? <p role="alert">{erroEnvio}</p> : null}
      <aside>
        <PainelPropriedades
          objeto={objeto}
          fase={{ titulo: documento.titulo, senha: documento.senha }}
          store={store}
          gerarId={gerarId}
        />
      </aside>
    </main>
  );
}

interface FaseAberta extends Aviso {
  documento: Fase;
  revisao: number;
}

/** O que a tela sabe da publicação: se a fase está publicada e se o rascunho difere da versão publicada (RF-13). */
interface Aviso {
  publicada: boolean;
  alteracoesNaoPublicadas: boolean;
}

/** Cria o salvamento; cada `PUT` aceito chama `aoGravado` (RF-13: o aviso de alterações é lido de novo). */
function novoSalvamento(
  faseId: string,
  revisao: number,
  store: StoreEditor,
  cliente: ClienteApiEditor,
  relogio: Relogio,
  aoGravado: () => void,
): Salvamento {
  return criarSalvamento({
    faseId,
    revisaoInicial: revisao,
    obterDocumento: () => store.getState().documento,
    cliente: {
      salvarFase: async (id, rev, documento) => {
        const resultado = await cliente.salvarFase(id, rev, documento);
        if (resultado.ok) aoGravado();
        return resultado;
      },
    },
    relogio,
  });
}

export function TelaEdicao({
  faseId,
  cliente,
  relogio,
  baseUrlApi,
  gerarId = gerarIdPadrao,
  verificadorTeste,
  sessaoRenovada = 0,
}: PropsTelaEdicao) {
  // RF-11: o modo testar confere as respostas no servidor com `modo=teste` (contrato telas.ts).
  const verificador = useMemo(
    () => verificadorTeste ?? criarVerificadorHttp({ baseUrlApi, faseId, modo: 'teste' }),
    [verificadorTeste, baseUrlApi, faseId],
  );
  const [aberta, definirAberta] = useState<{
    store: StoreEditor;
    salvamento: Salvamento;
  } | null>(null);
  const [erro, definirErro] = useState<string | null>(null);

  // RF-13 (contrato do editor, "Publicar"): o aviso vem de `GET /fases/:id`; depois de cada `PUT` aceito numa fase
  // publicada, a fase é lida de novo só para atualizar o aviso. Fica fora de `aberta` porque trocar `aberta` pararia
  // o salvamento agendado. A geração descarta leituras que chegam depois de uma publicação ou de uma nova abertura.
  const [aviso, definirAviso] = useState<Aviso>({ publicada: false, alteracoesNaoPublicadas: false });
  const publicadaAgora = useRef(false);
  const geracaoAviso = useRef(0);

  const atualizarAviso = useCallback((novo: Aviso) => {
    geracaoAviso.current += 1;
    publicadaAgora.current = novo.publicada;
    definirAviso(novo);
  }, []);

  const relerAviso = useCallback(() => {
    if (!publicadaAgora.current) return;
    const geracao = geracaoAviso.current;
    void cliente.abrirFase(faseId).then((resposta) => {
      if (!resposta.ok || geracao !== geracaoAviso.current) return;
      atualizarAviso({
        publicada: resposta.valor.publicada,
        alteracoesNaoPublicadas: resposta.valor.alteracoesNaoPublicadas,
      });
    });
  }, [cliente, faseId, atualizarAviso]);

  const ler = useCallback(async (): Promise<FaseAberta | null> => {
    const resposta = await cliente.abrirFase(faseId);
    if (!resposta.ok) {
      definirErro(resposta.erro);
      return null;
    }
    const validacao = validarFase(resposta.valor.documento);
    if (!validacao.ok) {
      definirErro(validacao.erros.map((e) => e.mensagem).join(' '));
      return null;
    }
    return {
      documento: validacao.fase,
      revisao: resposta.valor.revisao,
      publicada: resposta.valor.publicada,
      alteracoesNaoPublicadas: resposta.valor.alteracoesNaoPublicadas,
    };
  }, [cliente, faseId]);

  useEffect(() => {
    let ativo = true;
    void ler().then((fase) => {
      if (!ativo || fase === null) return;
      const store = criarStoreEditor(fase.documento);
      atualizarAviso({ publicada: fase.publicada, alteracoesNaoPublicadas: fase.alteracoesNaoPublicadas });
      definirAberta({
        store,
        salvamento: novoSalvamento(faseId, fase.revisao, store, cliente, relogio, relerAviso),
      });
    });
    return () => {
      ativo = false;
    };
  }, [ler, faseId, cliente, relogio, atualizarAviso, relerAviso]);

  // Fechar a fase (ou trocar de salvamento) para o agendamento.
  const salvamentoAtual = useRef<Salvamento | null>(null);
  useEffect(() => {
    if (aberta === null) return;
    const { salvamento } = aberta;
    salvamentoAtual.current = salvamento;
    return () => salvamento.parar();
  }, [aberta]);

  // PEND-021: ao desmontar (sair da rota) com alteração pendente, grava sem esperar antes de parar. Só na desmontagem:
  // trocar de salvamento (recarregar depois do conflito) descarta a alteração local.
  useEffect(
    () => () => {
      const salvamento = salvamentoAtual.current;
      if (salvamento === null) return;
      void salvamento.salvarAgora();
      salvamento.parar();
    },
    [],
  );

  // PEND-021: a janela sendo escondida (fechar a aba, navegar para fora) também grava a alteração pendente.
  useEffect(() => {
    if (aberta === null) return;
    const { salvamento } = aberta;
    const aoEsconder = () => void salvamento.salvarAgora();
    window.addEventListener('pagehide', aoEsconder);
    return () => window.removeEventListener('pagehide', aoEsconder);
  }, [aberta]);

  // PEND-020: o app incrementa `sessaoRenovada` a cada login aceito depois de um 401; quando o valor muda, grava a
  // alteração guardada em memória (sem pendência, `salvarAgora` não grava).
  const sessaoVista = useRef(sessaoRenovada);
  useEffect(() => {
    if (sessaoVista.current === sessaoRenovada) return;
    sessaoVista.current = sessaoRenovada;
    if (aberta !== null) void aberta.salvamento.salvarAgora();
  }, [sessaoRenovada, aberta]);

  const recarregar = useCallback(() => {
    if (aberta === null) return;
    const { store, salvamento } = aberta;
    void ler().then((fase) => {
      if (fase === null) return;
      salvamento.parar();
      store.getState().carregar(fase.documento);
      atualizarAviso({ publicada: fase.publicada, alteracoesNaoPublicadas: fase.alteracoesNaoPublicadas });
      definirAberta({
        store,
        salvamento: novoSalvamento(faseId, fase.revisao, store, cliente, relogio, relerAviso),
      });
    });
  }, [aberta, ler, faseId, cliente, relogio, atualizarAviso, relerAviso]);

  // Publicação aceita: a versão publicada passa a ser o rascunho, então não há alterações não publicadas até o
  // próximo `PUT` aceito (que relê o aviso).
  const publicado = useCallback(
    () => atualizarAviso({ publicada: true, alteracoesNaoPublicadas: false }),
    [atualizarAviso],
  );

  if (erro !== null) return <p role="alert">{erro}</p>;
  if (aberta === null) return <p>Abrindo a fase…</p>;
  return (
    <Edicao
      store={aberta.store}
      salvamento={aberta.salvamento}
      cliente={cliente}
      faseId={faseId}
      baseUrlApi={baseUrlApi}
      gerarId={gerarId}
      alteracoesNaoPublicadas={aviso.alteracoesNaoPublicadas}
      aoRecarregar={recarregar}
      aoPublicado={publicado}
      verificadorTeste={verificador}
    />
  );
}
