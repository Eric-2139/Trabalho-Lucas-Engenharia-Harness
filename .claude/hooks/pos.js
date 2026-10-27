#!/usr/bin/env node
'use strict';

/**
 * PostToolUse / PostToolUseFailure — "atualiza estado: grava e registra o log".
 * Uso: node pos.js <agente>
 */
const { lerEntrada, montarContexto } = require('../lib/contexto');
const { registrarDecisao } = require('../lib/registro');
const { registrarResultado } = require('../lib/orcamento');
const { carregarAgente } = require('./agentes');

function principal() {
  const agente = process.argv[2];
  const modulo = carregarAgente(agente);
  const entrada = lerEntrada();
  const ctx = montarContexto(agente, entrada);
  const falhou = entrada.hook_event_name === 'PostToolUseFailure';

  registrarResultado(ctx, falhou);
  if (!falhou && modulo.aposExecutar) modulo.aposExecutar(ctx);
  registrarDecisao(ctx, { acao: falhou ? 'falhou' : 'executado', motivo: falhou ? String(entrada.error || '') || null : null });
}

try {
  principal();
} catch (erro) {
  // Pós-execução não pode desfazer a ferramenta; o erro é reportado sem bloquear.
  process.stderr.write(`[harness · pos] falha ao atualizar estado: ${erro && erro.stack ? erro.stack : erro}\n`);
  process.exit(1);
}
