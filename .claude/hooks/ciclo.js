#!/usr/bin/env node
'use strict';

/**
 * SubagentStart — cada execução de agente começa com estado limpo
 * (cursor, orçamento, hipóteses...). Estado herdado de execução anterior
 * faria o orçamento de uma sessão consumir o da seguinte.
 */
const { lerEntrada, raizProjeto } = require('../lib/contexto');
const { limparEstado, salvarEstado } = require('../lib/estado');
const { AGENTES_CONHECIDOS } = require('./agentes');

try {
  const entrada = lerEntrada();
  const agente = entrada.agent_type;
  if (AGENTES_CONHECIDOS.includes(agente)) {
    const raiz = raizProjeto(entrada);
    limparEstado(raiz, agente);
    salvarEstado(raiz, agente, 'execucao', {
      id: entrada.agent_id || entrada.session_id || 'desconhecida',
      inicio: new Date().toISOString(),
      bloqueios_parada: 0,
    });
  }
} catch (erro) {
  process.stderr.write(`[harness · ciclo] falha ao reiniciar estado: ${erro && erro.stack ? erro.stack : erro}\n`);
  process.exit(1);
}
