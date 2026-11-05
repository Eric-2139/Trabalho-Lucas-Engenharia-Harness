/**
 * Fábrica do servidor (modulos-api.md §1): registra plugins e rotas do contrato api.md.
 * As rotas não têm o prefixo `/api`: ele é retirado antes de chegar ao Fastify (ADR-017).
 * `app.close()` desconecta o Prisma.
 */
import cookie from '@fastify/cookie';
import multipart from '@fastify/multipart';
import Fastify from 'fastify';
import type { ConstruirApp } from '../contrato/index.ts';
import { criarBanco } from './banco.ts';
import type { Contexto } from './contexto.ts';
import { registrarTratamentoDeErros } from './erros.ts';
import { registrarSessao } from './plugins/sessao.ts';
import { registrarRotasAssets } from './rotas/assets.ts';
import { registrarRotasAuth } from './rotas/auth.ts';
import { registrarRotasFases } from './rotas/fases.ts';
import { registrarRotasPublicas } from './rotas/publicas.ts';
import { registrarRotaVerificar } from './rotas/verificar.ts';

export const construirApp: ConstruirApp = async (opcoes) => {
  const app = Fastify();
  const banco = criarBanco(opcoes.urlBanco);
  app.addHook('onClose', async () => {
    await banco.$disconnect();
  });

  registrarTratamentoDeErros(app);
  await app.register(cookie);
  // Upload de imagens (ADR-010): os limites de tamanho e de arquivos são passados na rota `POST /assets`.
  await app.register(multipart);
  const sessoes = registrarSessao(app, banco, opcoes.producao === true);
  // Preenchido pelo pré-handler `exigirDono` nas rotas `/fases/:id` (ADR-005).
  app.decorateRequest('fase', null);

  const ctx: Contexto = { banco, armazenamento: opcoes.armazenamento, sessoes };
  registrarRotasAuth(app, ctx);
  registrarRotasFases(app, ctx);
  registrarRotasPublicas(app, ctx);
  registrarRotaVerificar(app, ctx);
  registrarRotasAssets(app, ctx);

  await app.ready();
  return app;
};
