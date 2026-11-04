#!/usr/bin/env node
'use strict';

/**
 * Escopo da rodada — agente de testes.
 * Uso: node .claude/ferramentas/definir-escopo.js RF-07 RF-08   (sem ids = todos os requisitos OK)
 *
 * Na fase 4 o agente 3 roda por requisito, logo antes do agente 4. Sem escopo, a
 * parada cobraria os 28 requisitos em toda rodada: cada rodada parcial teria a
 * parada negada até o limite e terminaria "incompleto", empurrando o agente a
 * escrever testes que ninguém pediu. O escopo é gravado uma vez por execução
 * (não dá para encolhê-lo no fim, para escapar da cobertura) e vai para o relatório.
 */
const { parseArgs } = require('node:util');
const { raizProjeto } = require('../lib/contexto');
const { lerEstado, salvarEstado } = require('../lib/estado');
const { lerBaseline } = require('../lib/artefatos');

function recusar(motivo) {
  process.stderr.write(`[harness] ${motivo}\n`);
  process.exit(2);
}

function principal() {
  const { positionals: ids } = parseArgs({ allowPositionals: true, options: {} });
  const raiz = raizProjeto({});
  if (lerEstado(raiz, 'testes', 'escopo', null)) recusar('o escopo desta execução já foi definido; um escopo por execução.');

  const baseline = lerBaseline(raiz).requisitos;
  const desconhecidos = ids.filter((id) => !baseline.some((req) => req.id === id));
  if (desconhecidos.length > 0) recusar(`${desconhecidos.join(', ')} não está no baseline aprovado.`);

  const requisitos = ids.length > 0 ? [...new Set(ids)] : baseline.filter((req) => req.status === 'OK').map((req) => req.id);
  salvarEstado(raiz, 'testes', 'escopo', { requisitos, todos: ids.length === 0 });

  const naoOk = baseline.filter((req) => requisitos.includes(req.id) && req.status !== 'OK');
  process.stdout.write([
    `Escopo da rodada: ${ids.length === 0 ? `todos os ${requisitos.length} requisitos OK` : requisitos.join(', ')}`,
    'A parada cobra feliz, borda e negativo (ou devolução ao agente 1) só destes requisitos.',
    ...naoOk.map((req) => `${req.id} está ${req.status}: sem teste; devolva com pendência "devolucao_criterio".`),
  ].join('\n'));
  process.stdout.write('\n');
}

try {
  principal();
} catch (erro) {
  process.stderr.write(`definir-escopo: ${erro.stack || erro.message}\n`);
  process.exit(1);
}
