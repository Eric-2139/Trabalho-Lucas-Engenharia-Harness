/**
 * Rotas públicas do jogo (contratos/api.md §Jogo): sem login (RF-01).
 * A lista de Escolher Fase (título da versão publicada, ADR-002, sem dado do autor) e a
 * projeção de jogo da versão publicada (RNF-04: sem senha, respostas nem revela).
 */
import type { FasePublicadaResumo } from '@math-scape/schema';
import type { FastifyInstance } from 'fastify';
import type { Contexto } from '../contexto.ts';
import { responderErro } from '../erros.ts';
import { projecaoDeJogo } from '../projecao.ts';

const MENSAGEM_NAO_ENCONTRADA = 'Fase não encontrada.';
/** A coluna `id` é uuid: qualquer outro formato não existe (e não deve chegar ao banco). */
const PADRAO_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function tituloPublicado(documento: unknown): string {
  if (typeof documento === 'object' && documento !== null && 'titulo' in documento) {
    const { titulo } = documento;
    if (typeof titulo === 'string') return titulo;
  }
  return '';
}

export function registrarRotasPublicas(app: FastifyInstance, ctx: Contexto): void {
  const { banco } = ctx;

  app.get('/publicadas', async () => {
    const fases = await banco.fase.findMany({
      where: { publicadaEm: { not: null } },
      select: { id: true, documentoPublicado: true },
      orderBy: [{ publicadaEm: 'desc' }, { id: 'asc' }],
    });
    return fases.map((f): FasePublicadaResumo => ({ id: f.id, titulo: tituloPublicado(f.documentoPublicado) }));
  });

  app.get<{ Params: { id: string } }>('/publicadas/:id/jogo', async (request, reply) => {
    const { id } = request.params;
    if (!PADRAO_ID.test(id)) return responderErro(reply, 404, MENSAGEM_NAO_ENCONTRADA);
    // Só a versão publicada (ADR-002); fase excluída ou nunca publicada → 404.
    const fase = await banco.fase.findFirst({
      where: { id, publicadaEm: { not: null } },
      select: { documentoPublicado: true },
    });
    if (!fase || fase.documentoPublicado === null) return responderErro(reply, 404, MENSAGEM_NAO_ENCONTRADA);
    return projecaoDeJogo(fase.documentoPublicado);
  });
}
