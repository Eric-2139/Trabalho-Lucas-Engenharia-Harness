#!/usr/bin/env node
'use strict';

/**
 * Stop do subagente (vira SubagentStop) — o losango "parou?" da Figura 2.
 * Uso: node parada.js <agente>
 *
 * Se o critério de conclusão não foi atingido, devolve o agente ao loop com a
 * lista do que falta. Depois de N devoluções, ou com o orçamento esgotado,
 * deixa parar e registra "falha controlada" — um agente preso para sempre no
 * Stop seria um orçamento sem teto.
 */
const fs = require('node:fs');
const path = require('node:path');
const { lerEntrada, montarContexto } = require('../lib/contexto');
const { garantirExecucao, salvarEstado } = require('../lib/estado');
const { registrarDecisao } = require('../lib/registro');
const { orcamentoEsgotado } = require('../lib/orcamento');
const { CAMINHOS } = require('../lib/artefatos');
const { carregarAgente } = require('./agentes');
const { bloquear } = require('./saida');

function gravarRelatorio(ctx, relatorio) {
  const carimbo = relatorio.fim.replace(/[:.]/g, '-');
  const destino = path.join(ctx.raiz, CAMINHOS.relatorios, `${ctx.agente}-${carimbo}.json`);
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.writeFileSync(destino, JSON.stringify(relatorio, null, 2));
  return destino;
}

/**
 * Bloqueios por política nesta execução, lidos do log de decisões. Mede o
 * quanto o gate precisou intervir (ex.: P1 do agente 4 = diff fora do escopo).
 */
function contarBloqueiosPorPolitica(ctx, idExecucao) {
  const log = path.join(ctx.raiz, 'harness', 'log_decisoes.jsonl');
  if (!fs.existsSync(log)) return {};
  return fs.readFileSync(log, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((linha) => JSON.parse(linha))
    .filter((r) => r.agente === ctx.agente && r.execucao === idExecucao && r.acao === 'bloqueado')
    .reduce((contagem, r) => ({ ...contagem, [r.politica]: (contagem[r.politica] || 0) + 1 }), {});
}

function principal() {
  const agente = process.argv[2];
  const modulo = carregarAgente(agente);
  const ctx = montarContexto(agente, lerEntrada());
  const execucao = garantirExecucao(ctx.raiz, agente, ctx.idExecucao);
  const avaliacao = modulo.avaliarParada(ctx);
  const esgotado = orcamentoEsgotado(ctx);
  const limiteDevolucoes = ctx.config.comum.bloqueios_parada_max;

  if (avaliacao.pendencias.length > 0 && !esgotado && execucao.bloqueios_parada < limiteDevolucoes) {
    salvarEstado(ctx.raiz, agente, 'execucao', { ...execucao, bloqueios_parada: execucao.bloqueios_parada + 1 });
    const motivo = `critério de conclusão não atingido (devolução ${execucao.bloqueios_parada + 1} de ${limiteDevolucoes}):\n- ${avaliacao.pendencias.join('\n- ')}\nResolva ou escale abrindo pendência.`;
    registrarDecisao(ctx, { acao: 'parada_negada', politica: 'PARADA', motivo });
    bloquear({ politica: 'PARADA', motivo });
  }

  let resultado = avaliacao.resultado;
  if (esgotado) resultado = 'falha_controlada';
  else if (avaliacao.pendencias.length > 0) resultado = 'incompleto';

  const relatorio = {
    agente,
    execucao: execucao.id,
    inicio: execucao.inicio,
    fim: new Date().toISOString(),
    resultado,
    motivo_orcamento: esgotado,
    criterios_nao_atendidos: avaliacao.pendencias,
    metricas: avaliacao.metricas,
    bloqueios_por_politica: contarBloqueiosPorPolitica(ctx, ctx.idExecucao),
  };
  const destino = gravarRelatorio(ctx, relatorio);
  registrarDecisao(ctx, { acao: 'encerrado', politica: 'PARADA', motivo: `${resultado} — relatório em ${path.relative(ctx.raiz, destino)}` });
}

try {
  principal();
} catch (erro) {
  // Na parada, falhar fechado prenderia o agente em loop; o erro é exposto e a parada segue.
  process.stderr.write(`[harness · parada] falha ao avaliar critério de conclusão: ${erro && erro.stack ? erro.stack : erro}\n`);
  process.exit(1);
}
