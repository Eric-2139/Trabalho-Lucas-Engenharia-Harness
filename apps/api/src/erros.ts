/**
 * Formato de erro da Api (contratos/api.md): `{ erro, detalhes? }`.
 * Erros de validação de corpo trazem `detalhes = ErroValidacao[]`.
 */
import type { ErroValidacao, RespostaErro } from '@math-scape/schema';
import type { FastifyInstance, FastifyReply } from 'fastify';

interface ProblemaZod {
  path: readonly PropertyKey[];
  message: string;
}

/** Converte as issues do Zod para o formato `ErroValidacao` do contrato. */
export function errosDeValidacao(problemas: readonly ProblemaZod[]): ErroValidacao[] {
  return problemas.map((p) => ({
    caminho: p.path.filter((parte): parte is string | number => typeof parte !== 'symbol'),
    mensagem: p.message,
  }));
}

export function responderErro(reply: FastifyReply, status: number, erro: string, detalhes?: unknown): FastifyReply {
  const corpo: RespostaErro = detalhes === undefined ? { erro } : { erro, detalhes };
  return reply.code(status).send(corpo);
}

export function responderCorpoInvalido(reply: FastifyReply, problemas: readonly ProblemaZod[]): FastifyReply {
  return responderErro(reply, 400, 'Dados inválidos.', errosDeValidacao(problemas));
}

/** Erros não tratados: 4xx do próprio Fastify mantêm o código; o resto vira 500 sem detalhes internos. */
export function registrarTratamentoDeErros(app: FastifyInstance): void {
  app.setErrorHandler((erro, request, reply) => {
    const status = typeof erro === 'object' && erro !== null && 'statusCode' in erro ? Number(erro.statusCode) : 500;
    if (status >= 400 && status < 500) {
      const mensagem = erro instanceof Error ? erro.message : 'Pedido inválido.';
      return responderErro(reply, status, mensagem);
    }
    request.log.error(erro);
    return responderErro(reply, 500, 'Erro interno.');
  });
  app.setNotFoundHandler((_request, reply) => responderErro(reply, 404, 'Não encontrado.'));
}
