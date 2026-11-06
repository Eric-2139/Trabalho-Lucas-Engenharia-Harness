/**
 * Cliente HTTP falso das telas de conta e de fases do Editor (apps/editor/contrato/salvamento.ts ·
 * ClienteApiEditor, ResultadoHttp). Nunca usa a rede: cada método é um `vi.fn` que devolve
 * `ResultadoHttp` e, por padrão, imita a Api sobre uma lista de fases em memória
 * (criar, renomear, duplicar, excluir e importar alteram a lista; `listarFases` devolve uma cópia).
 * Os testes trocam a resposta de uma chamada com `mockResolvedValueOnce(recusa(...))`.
 *
 * Dados sintéticos gerados com semente fixa (mulberry32), nunca derivados de dado real.
 * Sem asserções: só preparo.
 */
import type { ClienteApiEditor, ResultadoHttp } from '@math-scape/app-editor/contrato';
import type { ResumoFase } from '@math-scape/schema/contrato';
import { type Mock, vi } from 'vitest';
import { documentoJogavel } from '../fixtures/fases-api.ts';

/** Mensagem do cliente HTTP quando não há resposta (contrato de ResultadoHttp, LAC-038). */
export const ERRO_REDE = 'Não foi possível falar com o servidor. Tente de novo.';

/** Pessoa sintética para login e cadastro. */
export const PESSOA_SINTETICA = {
  nome: 'Pessoa Sintética C',
  email: 'pessoa.c@exemplo.test',
  senha: 'senha-sintetica-c-03',
} as const;

export function ok<T>(valor: T): ResultadoHttp<T> {
  return { ok: true, valor };
}

export function recusa(status: number, erro: string): { ok: false; status: number; erro: string } {
  return { ok: false, status, erro };
}

/** Gerador pseudoaleatório determinístico (mulberry32). */
export function geradorComSemente(semente: number): () => number {
  let estado = semente >>> 0;
  return () => {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const LUGARES = ['Sala', 'Corredor', 'Biblioteca', 'Laboratório', 'Pátio', 'Sótão'] as const;
const TEMAS = ['das frações', 'dos primos', 'das potências', 'dos ângulos', 'das médias', 'dos múltiplos'] as const;

/**
 * `quantidade` resumos de fase com títulos distintos (o número de ordem entra no título), ids
 * `fase-s<semente>-<n>`, todos não publicados e com datas fixas a partir de 01/01/2026.
 */
export function resumosSinteticos(semente: number, quantidade: number): ResumoFase[] {
  const sortear = geradorComSemente(semente);
  const resumos: ResumoFase[] = [];
  for (let i = 0; i < quantidade; i++) {
    const lugar = LUGARES[Math.floor(sortear() * LUGARES.length)] ?? LUGARES[0];
    const tema = TEMAS[Math.floor(sortear() * TEMAS.length)] ?? TEMAS[0];
    resumos.push({
      id: `fase-s${semente}-${i + 1}`,
      titulo: `${lugar} ${tema} ${i + 1}`,
      publicada: false,
      atualizadaEm: new Date(Date.UTC(2026, 0, 1 + i)).toISOString(),
    });
  }
  return resumos;
}

type MetodosTelas =
  | 'cadastrar'
  | 'entrar'
  | 'excluirConta'
  | 'listarFases'
  | 'criarFase'
  | 'renomearFase'
  | 'duplicarFase'
  | 'excluirFase'
  | 'importarFase';

export type ClienteTelasFalso = { [K in MetodosTelas]: Mock<ClienteApiEditor[K]> } & {
  /** Fases do criador no "servidor" falso, na ordem em que a Api as devolveria. */
  readonly fases: ResumoFase[];
};

const DATA_FIXA = '2026-02-01T00:00:00.000Z';
const NAO_ENCONTRADA = 'Fase não encontrada.';

/** Cliente falso com as fases iniciais dadas (copiadas: o teste pode reutilizar a lista original). */
export function criarClienteTelasFalso(opcoes: { fases?: ResumoFase[] } = {}): ClienteTelasFalso {
  const fases: ResumoFase[] = (opcoes.fases ?? []).map((f) => ({ ...f }));
  let contador = 0;
  const indice = (id: string) => fases.findIndex((f) => f.id === id);

  return {
    fases,
    cadastrar: vi.fn<ClienteApiEditor['cadastrar']>(async () => ok({ id: 'pessoa-sintetica-c' })),
    entrar: vi.fn<ClienteApiEditor['entrar']>(async () => ok(undefined)),
    excluirConta: vi.fn<ClienteApiEditor['excluirConta']>(async () => ok(undefined)),
    listarFases: vi.fn<ClienteApiEditor['listarFases']>(async () => ok(fases.map((f) => ({ ...f })))),
    criarFase: vi.fn<ClienteApiEditor['criarFase']>(async (titulo) => {
      contador += 1;
      const id = `fase-criada-${contador}`;
      fases.push({ id, titulo, publicada: false, atualizadaEm: DATA_FIXA });
      return ok({ id, revisao: 1, documento: documentoJogavel(titulo) });
    }),
    renomearFase: vi.fn<ClienteApiEditor['renomearFase']>(async (id, titulo) => {
      const fase = fases[indice(id)];
      if (!fase) return recusa(404, NAO_ENCONTRADA);
      fase.titulo = titulo;
      return ok({ revisao: 2 });
    }),
    duplicarFase: vi.fn<ClienteApiEditor['duplicarFase']>(async (id) => {
      const fase = fases[indice(id)];
      if (!fase) return recusa(404, NAO_ENCONTRADA);
      contador += 1;
      const novoId = `fase-copia-${contador}`;
      fases.push({ id: novoId, titulo: `${fase.titulo} (cópia)`, publicada: false, atualizadaEm: DATA_FIXA });
      return ok({ id: novoId });
    }),
    excluirFase: vi.fn<ClienteApiEditor['excluirFase']>(async (id) => {
      const i = indice(id);
      if (i < 0) return recusa(404, NAO_ENCONTRADA);
      fases.splice(i, 1);
      return ok(undefined);
    }),
    importarFase: vi.fn<ClienteApiEditor['importarFase']>(async () => {
      contador += 1;
      const id = `fase-importada-${contador}`;
      fases.push({ id, titulo: `Fase importada ${contador}`, publicada: false, atualizadaEm: DATA_FIXA });
      return ok({ id });
    }),
  };
}

/** Promessa resolvida pelo teste, para observar a tela antes da resposta da Api. */
export function adiado<T>(): { promessa: Promise<T>; resolver: (valor: T) => void } {
  let resolver: (valor: T) => void = () => undefined;
  const promessa = new Promise<T>((r) => {
    resolver = r;
  });
  return { promessa, resolver };
}

/** Lê o conteúdo de um Blob/File do jsdom como texto. */
export function lerTexto(arquivo: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(String(leitor.result));
    leitor.onerror = () => reject(leitor.error);
    leitor.readAsText(arquivo);
  });
}

/** Textos dos elementos com role="alert" na tela (recusas da Api, contrato telas.ts). */
export function textosDosAlertas(raiz: Document = document): string[] {
  return Array.from(raiz.querySelectorAll('[role="alert"]')).map((el) => el.textContent ?? '');
}
