/**
 * Rotas públicas do jogo (contratos/api.md §Jogo): sem login (RF-01).
 * Por ora: a lista de Escolher Fase. O título vem da versão publicada (ADR-002), sem dado do autor.
 */
import type { FasePublicadaResumo } from '@math-scape/schema';
import type { FastifyInstance } from 'fastify';
import type { Contexto } from '../contexto.ts';

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
}
