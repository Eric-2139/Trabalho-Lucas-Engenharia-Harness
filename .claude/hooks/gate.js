#!/usr/bin/env node
'use strict';

/**
 * PreToolUse — o "gate de políticas" da Figura 2. Uso: node gate.js <agente>
 * O modelo já decidiu a ação; aqui o código decide se ela pode acontecer.
 */
const { lerEntrada, montarContexto } = require('../lib/contexto');
const { executarCadeia } = require('../lib/cadeia');
const { garantirExecucao } = require('../lib/estado');
const { registrarDecisao } = require('../lib/registro');
const { verificarOrcamento } = require('../lib/orcamento');
const { VERIFICACOES_COMUNS } = require('./agentes/comum');
const { carregarAgente } = require('./agentes');
const { bloquear, falhaInterna } = require('./saida');

function principal() {
  const agente = process.argv[2];
  const modulo = carregarAgente(agente);
  const ctx = montarContexto(agente, lerEntrada());
  garantirExecucao(ctx.raiz, agente, ctx.idExecucao);

  const violacao = executarCadeia([verificarOrcamento, ...VERIFICACOES_COMUNS, ...modulo.verificacoes], ctx);
  if (violacao) {
    registrarDecisao(ctx, { acao: 'bloqueado', ...violacao });
    bloquear(violacao);
  }
  if (modulo.aoPermitir) modulo.aoPermitir(ctx);
  process.exit(0);
}

try {
  principal();
} catch (erro) {
  falhaInterna(erro);
}
