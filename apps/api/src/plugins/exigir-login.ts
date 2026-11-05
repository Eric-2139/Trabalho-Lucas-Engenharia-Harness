/**
 * Pré-handler das rotas do criador (RF-01): sem sessão válida → 401.
 * Jogar fases publicadas não passa por aqui.
 */
import type { FastifyReply, FastifyRequest } from 'fastify';
import { responderErro } from '../erros.ts';

/** Hook async: devolver o `reply` já enviado interrompe o ciclo antes do handler. */
export async function exigirLogin(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply | undefined> {
  if (!request.usuario) return responderErro(reply, 401, 'Faça login para continuar.');
  return undefined;
}

/** Id do usuário logado; só chamar em rotas protegidas por `exigirLogin`. */
export function idDoUsuario(request: FastifyRequest): string {
  if (!request.usuario) throw new Error('rota protegida sem exigirLogin');
  return request.usuario.id;
}
