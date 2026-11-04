/**
 * Api (contrato api.md): fábrica do servidor Fastify e dependências injetáveis.
 * Os testes de integração sobem o app com `construirApp` e usam `app.inject`, contra
 * o PostgreSQL do contêiner de testes (ADR-016).
 */
import type { FastifyInstance } from 'fastify';

export type TipoImagem = 'image/png' | 'image/jpeg' | 'image/webp';

/** ADR-010: disco no MVP, S3 depois, sem mudar as rotas. */
export interface Armazenamento {
  gravar(id: string, bytes: Uint8Array, mime: TipoImagem): Promise<void>;
  ler(id: string): Promise<{ bytes: Uint8Array; mime: TipoImagem } | null>;
  apagar(id: string): Promise<void>;
}

export interface OpcoesApp {
  /** postgresql://… ; nos testes vem de DATABASE_URL do contêiner. */
  urlBanco: string;
  armazenamento: Armazenamento;
  /** true em produção: cookie com Secure (ADR-004). */
  producao?: boolean;
}

/** Sobe o app com todas as rotas do contrato api.md. `app.close()` fecha também a conexão com o banco. */
export type ConstruirApp = (opcoes: OpcoesApp) => Promise<FastifyInstance>;

/** Implementação em disco (ADR-010). */
export type CriarArmazenamentoEmDisco = (diretorio: string) => Armazenamento;

/** ADR-010: tipo pela assinatura dos bytes iniciais, não pela extensão. Fora de PNG/JPG/WebP → null. */
export type DetectarTipoImagem = (bytes: Uint8Array) => TipoImagem | null;

export const NOME_COOKIE_SESSAO = 'sid';

/** ADR-003: limites de `POST /fases/:id/verificar`, por IP e por fase, separados por tipo. */
export const LIMITES_VERIFICAR = {
  enigma: { maximo: 300, janelaSegundos: 60 },
  porta: { maximo: 30, janelaSegundos: 600 },
} as const;

/** ADR-010, ADR-013: tamanhos máximos de corpo. */
export const LIMITES_CORPO = {
  asset: 5 * 1024 * 1024,
  importar: 50 * 1024 * 1024,
} as const;

/** Prefixo comum das rotas quando servidas no mesmo site dos apps (ADR-017). As rotas do contrato não o incluem. */
export const PREFIXO_PUBLICO = '/api';
