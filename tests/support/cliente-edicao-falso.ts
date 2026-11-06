/**
 * Cliente HTTP falso e COMPLETO da tela de Edição (apps/editor/contrato/salvamento.ts · ClienteApiEditor).
 * Nunca usa a rede: cada método é um `vi.fn` que devolve `ResultadoHttp` e imita a Api sobre UMA fase em memória
 * (contrato api.md e ADR-002):
 * - `abrirFase` devolve o documento, a revisão, `publicada` e `alteracoesNaoPublicadas` (rascunho ≠ versão publicada);
 * - `salvarFase` com a revisão atual grava e devolve a próxima revisão; com outra revisão devolve 409 (conflito);
 * - `publicarFase` publica o rascunho atual (a versão publicada passa a ser igual ao rascunho);
 * - `jogoTeste` devolve a projeção de jogo configurada; `exportarFase` devolve o envelope (ADR-013) como Blob;
 * - `enviarImagem` aceita e devolve um `AssetCriado` com uuid sintético sequencial.
 * As chamadas das outras telas vêm de `criarClienteTelasFalso`. Os testes trocam uma resposta com
 * `mockResolvedValueOnce(...)`. Dados sintéticos, sem aleatoriedade; sem asserções: só preparo.
 */
import type { ClienteApiEditor } from '@math-scape/app-editor/contrato';
import type { Fase, FaseJogo } from '@math-scape/schema/contrato';
import { type Mock, vi } from 'vitest';
import { envelope } from '../fixtures/fases-api.ts';
import { criarClienteTelasFalso, ok, recusa } from './cliente-editor-falso.ts';

export const ERRO_CONFLITO = 'A fase foi alterada em outro lugar. Recarregue para continuar.';
export const ERRO_NAO_ENCONTRADA = 'Fase não encontrada.';
export const DATA_PUBLICACAO = '2026-03-01T12:00:00.000Z';

/** uuid sintético (formato válido, minúsculo) de número `n`. */
export function uuidSintetico(n: number): string {
  return `5e1f0000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;
}

export interface ServidorFalso {
  readonly faseId: string;
  documento: Fase;
  revisao: number;
  publicada: boolean;
  /** Versão vista pelos jogadores (null enquanto não publicada). */
  publicado: Fase | null;
  /** Projeção devolvida por `jogoTeste`. */
  jogo: FaseJogo;
}

export type ClienteEdicaoFalso = { [K in keyof ClienteApiEditor]: Mock<ClienteApiEditor[K]> } & {
  readonly servidor: ServidorFalso;
  /** Outra aba grava a fase: o documento do servidor muda e a revisão avança (o próximo PUT desta tela dá 409). */
  gravarDeOutraAba(documento: Fase): void;
};

function igual(a: Fase | null, b: Fase): boolean {
  return a !== null && JSON.stringify(a) === JSON.stringify(b);
}

function projecaoVazia(titulo: string): FaseJogo {
  const parede = { fundo: null, objetos: [] };
  return {
    versaoSchema: 1,
    titulo,
    tamanhoSenha: 5,
    paredes: { frente: parede, direita: parede, fundo: parede, esquerda: parede, teto: parede },
  };
}

export function criarClienteEdicaoFalso(opcoes: {
  faseId: string;
  documento: Fase;
  revisao?: number | undefined;
  publicada?: boolean | undefined;
  /** Só vale com `publicada`: a versão publicada difere do rascunho. */
  alteracoesNaoPublicadas?: boolean | undefined;
  jogo?: FaseJogo | undefined;
}): ClienteEdicaoFalso {
  const documento = structuredClone(opcoes.documento);
  const publicada = opcoes.publicada ?? false;
  let publicado: Fase | null = null;
  if (publicada) {
    publicado = structuredClone(documento);
    if (opcoes.alteracoesNaoPublicadas) publicado.titulo = `${documento.titulo} (versão publicada)`;
  }
  const servidor: ServidorFalso = {
    faseId: opcoes.faseId,
    documento,
    revisao: opcoes.revisao ?? 1,
    publicada,
    publicado,
    jogo: opcoes.jogo ?? projecaoVazia(documento.titulo),
  };
  let imagens = 0;
  const telas = criarClienteTelasFalso();
  const outra = (id: string) => id !== servidor.faseId;

  return {
    servidor,
    gravarDeOutraAba(novo) {
      servidor.documento = structuredClone(novo);
      servidor.revisao += 1;
    },
    cadastrar: telas.cadastrar,
    entrar: telas.entrar,
    excluirConta: telas.excluirConta,
    listarFases: telas.listarFases,
    criarFase: telas.criarFase,
    renomearFase: telas.renomearFase,
    duplicarFase: telas.duplicarFase,
    excluirFase: telas.excluirFase,
    importarFase: telas.importarFase,
    sair: vi.fn<ClienteApiEditor['sair']>(async () => ok(undefined)),
    abrirFase: vi.fn<ClienteApiEditor['abrirFase']>(async (id) => {
      if (outra(id)) return recusa(404, ERRO_NAO_ENCONTRADA);
      return ok({
        id,
        revisao: servidor.revisao,
        documento: structuredClone(servidor.documento),
        publicada: servidor.publicada,
        alteracoesNaoPublicadas: servidor.publicada && !igual(servidor.publicado, servidor.documento),
      });
    }),
    salvarFase: vi.fn<ClienteApiEditor['salvarFase']>(async (id, revisao, doc) => {
      if (outra(id)) return recusa(404, ERRO_NAO_ENCONTRADA);
      if (revisao !== servidor.revisao) return recusa(409, ERRO_CONFLITO);
      servidor.documento = structuredClone(doc);
      servidor.revisao += 1;
      return ok({ revisao: servidor.revisao });
    }),
    publicarFase: vi.fn<ClienteApiEditor['publicarFase']>(async (id) => {
      if (outra(id)) return recusa(404, ERRO_NAO_ENCONTRADA);
      servidor.publicada = true;
      servidor.publicado = structuredClone(servidor.documento);
      return ok({ publicadaEm: DATA_PUBLICACAO });
    }),
    jogoTeste: vi.fn<ClienteApiEditor['jogoTeste']>(async (id) => {
      if (outra(id)) return recusa(404, ERRO_NAO_ENCONTRADA);
      return ok(structuredClone(servidor.jogo));
    }),
    exportarFase: vi.fn<ClienteApiEditor['exportarFase']>(async (id) => {
      if (outra(id)) return recusa(404, ERRO_NAO_ENCONTRADA);
      return ok(new Blob([JSON.stringify(envelope(servidor.documento))], { type: 'application/json' }));
    }),
    enviarImagem: vi.fn<ClienteApiEditor['enviarImagem']>(async () => {
      imagens += 1;
      const id = uuidSintetico(imagens);
      return ok({ id, ref: `asset:${id}` as const, url: `/api/assets/${id}` });
    }),
  };
}
