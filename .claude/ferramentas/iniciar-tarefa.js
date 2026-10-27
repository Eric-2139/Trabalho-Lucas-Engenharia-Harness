#!/usr/bin/env node
'use strict';

/**
 * ler_projeto(componente) + início do ciclo — agente de codificação.
 * Uso: node .claude/ferramentas/iniciar-tarefa.js --requisito RF-09
 *
 * Fixa, a partir de artefatos e não da leitura do modelo: o requisito-alvo,
 * os arquivos previstos no projeto do componente (escopo da P1) e o
 * baseline_verde — o conjunto de testes que já passavam antes de começar,
 * sem o qual "quebrei algo" e "já estava quebrado" são indistinguíveis.
 */
const { parseArgs } = require('node:util');
const { raizProjeto, carregarConfig, lerJsonSeExistir } = require('../lib/contexto');
const { lerEstado, salvarEstado } = require('../lib/estado');
const { executarSuite, motivoSemIsolamento } = require('../lib/suite');
const { pertenceAoRequisito } = require('../lib/junit');
const { CAMINHOS, requisitoDoBaseline, lerMatrizRastreabilidade } = require('../lib/artefatos');

function recusar(motivo) {
  process.stderr.write(`[harness] ${motivo}\n`);
  process.exit(2);
}

function principal() {
  const { values: args } = parseArgs({ options: { requisito: { type: 'string' } } });
  const raiz = raizProjeto({});
  const config = carregarConfig(raiz);
  if (!args.requisito) recusar('informe --requisito <ID>');
  if (lerEstado(raiz, 'codificacao', 'tarefa', null)) recusar('já existe uma tarefa nesta execução; um requisito por execução.');

  const requisito = requisitoDoBaseline(raiz, args.requisito);
  if (!requisito) recusar(`${args.requisito} não está no baseline aprovado.`);
  if (requisito.status !== 'OK') recusar(`${args.requisito} está ${requisito.status}: só requisito detalhado e aprovado entra em codificação.`);

  const idsComponentes = lerMatrizRastreabilidade(raiz).mapeamentos.filter((m) => m.req_id === args.requisito).map((m) => m.componente_id);
  const componentes = idsComponentes.map((id) => lerJsonSeExistir(raiz, `${CAMINHOS.componentes}${id}.json`)).filter(Boolean);
  const arquivosPrevistos = [...new Set(componentes.flatMap((c) => c.arquivos_previstos || []))];
  if (arquivosPrevistos.length === 0) {
    recusar(`projeto do componente insuficiente para ${args.requisito}: nenhum arquivo previsto na matriz/componentes. Abra pendência do tipo "arquitetura".`);
  }

  if (!config.execucao_testes.comando) recusar('execucao_testes.comando não configurado em harness/config.json.');
  const semIsolamento = motivoSemIsolamento(config.execucao_testes);
  if (semIsolamento) recusar(semIsolamento);
  const execucao = executarSuite(raiz, config.execucao_testes);
  if (!execucao.resultados) recusar(`relatório JUnit não encontrado em ${config.execucao_testes.relatorio_junit}.`);
  const baselineVerde = [...execucao.resultados].filter(([, situacao]) => situacao === 'passou').map(([id]) => id);
  const testesDoRequisito = [...execucao.resultados.keys()].filter((id) => pertenceAoRequisito(id, args.requisito));

  salvarEstado(raiz, 'codificacao', 'tarefa', {
    requisito_alvo: args.requisito,
    criterio: requisito.criterio_aceitacao,
    componentes: idsComponentes,
    arquivos_previstos: arquivosPrevistos,
    baseline_verde: baselineVerde,
    tentativas: 0,
    reversoes: 0,
    arquivos_tocados: [],
    alteracoes_pendentes: {},
    ultimo_resultado: null,
  });

  process.stdout.write([
    `Tarefa iniciada: ${args.requisito} — ${requisito.texto}`,
    `Critério de aceitação: ${requisito.criterio_aceitacao}`,
    `Componentes: ${idsComponentes.join(', ')}`,
    `Decisões de arquitetura: ${componentes.flatMap((c) => c.decisoes || []).join(', ') || '(nenhuma registrada)'}`,
    `Arquivos previstos (escopo de escrita): ${arquivosPrevistos.join(', ')}`,
    `baseline_verde: ${baselineVerde.length} testes passando antes de começar`,
    `Testes do requisito no relatório: ${testesDoRequisito.length} (${testesDoRequisito.filter((id) => execucao.resultados.get(id) === 'falhou').length} vermelhos)`,
    `Teto: ${config.codificacao.teto_tentativas} ciclos editar-testar.`,
  ].join('\n'));
  process.stdout.write('\n');
}

try {
  principal();
} catch (erro) {
  process.stderr.write(`iniciar-tarefa: ${erro.stack || erro.message}\n`);
  process.exit(1);
}
