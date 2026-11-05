/**
 * Rotas do criador (contratos/api.md §Fases do criador): exigem sessão (RF-01).
 * Por ora: listar e criar. As demais (abrir, salvar, publicar, …) entram com os seus requisitos.
 */
import { CorpoCriarFase, faseInicial, type ResumoFase } from '@math-scape/schema';
import type { FastifyInstance } from 'fastify';
import { paraJson } from '../banco.ts';
import type { Contexto } from '../contexto.ts';
import { responderCorpoInvalido } from '../erros.ts';
import { exigirLogin, idDoUsuario } from '../plugins/exigir-login.ts';

export function registrarRotasFases(app: FastifyInstance, ctx: Contexto): void {
  const { banco } = ctx;

  app.get('/fases', { preHandler: exigirLogin }, async (request) => {
    const fases = await banco.fase.findMany({
      where: { donoId: idDoUsuario(request) },
      select: { id: true, titulo: true, publicadaEm: true, atualizadaEm: true },
      orderBy: [{ atualizadaEm: 'desc' }, { id: 'asc' }],
    });
    return fases.map(
      (f): ResumoFase => ({
        id: f.id,
        titulo: f.titulo,
        publicada: f.publicadaEm !== null,
        atualizadaEm: f.atualizadaEm.toISOString(),
      }),
    );
  });

  app.post('/fases', { preHandler: exigirLogin }, async (request, reply) => {
    // Título vazio → 400 antes de montar a fase (modulos-api.md §2).
    const corpo = CorpoCriarFase.safeParse(request.body);
    if (!corpo.success) return responderCorpoInvalido(reply, corpo.error.issues);
    const documento = faseInicial(corpo.data.titulo);
    const fase = await banco.fase.create({
      data: { donoId: idDoUsuario(request), titulo: documento.titulo, documento: paraJson(documento), revisao: 0 },
      select: { id: true, revisao: true },
    });
    return reply.code(201).send({ id: fase.id, revisao: fase.revisao, documento });
  });
}
