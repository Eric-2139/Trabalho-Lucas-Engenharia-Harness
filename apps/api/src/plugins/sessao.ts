/**
 * Sessão (ADR-004, RF-01, RNF-05): token opaco de 32 bytes no cookie `sid`
 * (HttpOnly, SameSite=Lax, Path=/, Secure em produção). O banco guarda só o SHA-256 do token.
 * Decora `request.usuario` com o dono da sessão, ou null.
 */
import { createHash, randomBytes } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { NOME_COOKIE_SESSAO } from '../../contrato/index.ts';
import type { Banco } from '../banco.ts';

export interface UsuarioSessao {
  id: string;
  nome: string;
  email: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    usuario: UsuarioSessao | null;
  }
}

/** Expiração ainda em aberto na ADR-004: 7 dias até haver decisão (modulos-api.md §3). */
const DURACAO_SESSAO_SEGUNDOS = 7 * 24 * 60 * 60;

export interface Sessoes {
  /** Cria a sessão no banco e responde com o cookie `sid`. */
  criar(reply: FastifyReply, usuarioId: string): Promise<void>;
  /** Apaga a sessão do pedido (se houver) e limpa o cookie. */
  encerrar(request: FastifyRequest, reply: FastifyReply): Promise<void>;
  /** Só limpa o cookie (as sessões já foram apagadas, ex.: exclusão de conta). */
  limparCookie(reply: FastifyReply): void;
}

function hashDoToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Registra o decorador e o hook de leitura da sessão na instância raiz (sem encapsular),
 * para valer em todas as rotas.
 */
export function registrarSessao(app: FastifyInstance, banco: Banco, producao: boolean): Sessoes {
  const opcoesCookie = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: producao,
    path: '/',
  };

  app.decorateRequest('usuario', null);

  app.addHook('onRequest', async (request) => {
    request.usuario = null;
    const token = request.cookies[NOME_COOKIE_SESSAO];
    if (!token) return;
    const sessao = await banco.sessao.findUnique({
      where: { idHash: hashDoToken(token) },
      select: { expiraEm: true, usuario: { select: { id: true, nome: true, email: true } } },
    });
    if (!sessao || sessao.expiraEm.getTime() <= Date.now()) return;
    request.usuario = sessao.usuario;
  });

  return {
    async criar(reply, usuarioId) {
      const token = randomBytes(32).toString('base64url');
      await banco.sessao.create({
        data: {
          idHash: hashDoToken(token),
          usuarioId,
          expiraEm: new Date(Date.now() + DURACAO_SESSAO_SEGUNDOS * 1000),
        },
      });
      reply.setCookie(NOME_COOKIE_SESSAO, token, { ...opcoesCookie, maxAge: DURACAO_SESSAO_SEGUNDOS });
    },
    async encerrar(request, reply) {
      const token = request.cookies[NOME_COOKIE_SESSAO];
      if (token) await banco.sessao.deleteMany({ where: { idHash: hashDoToken(token) } });
      reply.clearCookie(NOME_COOKIE_SESSAO, opcoesCookie);
    },
    limparCookie(reply) {
      reply.clearCookie(NOME_COOKIE_SESSAO, opcoesCookie);
    },
  };
}
