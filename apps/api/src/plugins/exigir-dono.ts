/**
 * Pré-handler das rotas `/fases/:id` do criador (ADR-005, RF-02, RF-14): carrega a fase e
 * confere o dono. Outro dono ou fase inexistente → 404 (não revela rascunhos alheios).
 * Deve vir depois de `exigirLogin`. Põe a fase em `request.fase`.
 */
import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Banco } from '../banco.ts';
import { responderErro } from '../erros.ts';

export interface FaseCarregada {
  id: string;
  donoId: string;
  titulo: string;
  documento: unknown;
  documentoPublicado: unknown;
  publicadaEm: Date | null;
  revisao: number;
}

declare module 'fastify' {
  interface FastifyRequest {
    fase: FaseCarregada | null;
  }
}

const MENSAGEM_NAO_ENCONTRADA = 'Fase não encontrada.';
/** A coluna `id` é uuid: qualquer outro formato não existe (e não deve chegar ao banco). */
const PADRAO_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function idDaRota(request: FastifyRequest): string | undefined {
  const params = request.params;
  if (typeof params !== 'object' || params === null || !('id' in params)) return undefined;
  const { id } = params;
  return typeof id === 'string' ? id : undefined;
}

export function criarExigirDono(banco: Banco) {
  return async function exigirDono(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply | undefined> {
    const id = idDaRota(request);
    const usuario = request.usuario;
    if (!usuario || id === undefined || !PADRAO_ID.test(id)) return responderErro(reply, 404, MENSAGEM_NAO_ENCONTRADA);
    const fase = await banco.fase.findUnique({
      where: { id },
      select: {
        id: true,
        donoId: true,
        titulo: true,
        documento: true,
        documentoPublicado: true,
        publicadaEm: true,
        revisao: true,
      },
    });
    if (!fase || fase.donoId !== usuario.id) return responderErro(reply, 404, MENSAGEM_NAO_ENCONTRADA);
    request.fase = fase;
    return undefined;
  };
}

/** Fase carregada por `exigirDono`; só chamar em rotas protegidas por ele. */
export function faseDoPedido(request: FastifyRequest): FaseCarregada {
  if (!request.fase) throw new Error('rota protegida sem exigirDono');
  return request.fase;
}
