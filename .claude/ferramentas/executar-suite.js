#!/usr/bin/env node
'use strict';

/**
 * executar_suite / rodar_testes — agentes de testes e de codificação.
 * Uso: node .claude/ferramentas/executar-suite.js --agente <testes|codificacao>
 *
 * Única forma de rodar a suíte (o Bash dos agentes só aceita este comando).
 * Por isso aqui ficam as garantias que dependem do resultado da execução:
 * isolamento (testes P1), trava de asserção após vermelho (testes P2),
 * disjuntor de ambiente, teto de tentativas (codificação P5) e reversão
 * automática por regressão (codificação P3).
 */
const fs = require('node:fs');
const path = require('node:path');
const { parseArgs } = require('node:util');
const { raizProjeto, carregarConfig } = require('../lib/contexto');
const { lerEstado, salvarEstado } = require('../lib/estado');
const { motivoSemIsolamento, executarSuite, executarComando } = require('../lib/suite');
const { pertenceAoRequisito } = require('../lib/junit');

const LINHAS_DE_SAIDA_EXIBIDAS = 60;

function recusar(motivo) {
  process.stderr.write(`[harness] ${motivo}\n`);
  process.exit(2);
}

function exibirSaida(saida) {
  const linhas = saida.trimEnd().split(/\r?\n/);
  process.stdout.write(`${linhas.slice(-LINHAS_DE_SAIDA_EXIBIDAS).join('\n')}\n`);
}

function registrarSituacaoCompartilhada(raiz, execucao) {
  // Estado fora do diretório do agente: sobrevive entre execuções, para que a trava de asserção valha na próxima sessão.
  if (execucao.situacao === 'ambiente') return;
  salvarEstado(raiz, 'compartilhado', 'suite', { vermelha: execucao.situacao === 'vermelha', codigo: execucao.codigo, quando: new Date().toISOString() });
}

function executarParaTestes(raiz, config) {
  const ambiente = lerEstado(raiz, 'testes', 'ambiente', { falhas_consecutivas: 0 });
  if (ambiente.falhas_consecutivas >= config.testes.falhas_ambiente_max) {
    recusar(`ambiente de execução falhou ${ambiente.falhas_consecutivas} vezes seguidas. Encerre com relatório parcial.`);
  }
  const execucao = executarSuite(raiz, config.execucao_testes);
  registrarSituacaoCompartilhada(raiz, execucao);
  ambiente.falhas_consecutivas = execucao.situacao === 'ambiente' ? ambiente.falhas_consecutivas + 1 : 0;
  salvarEstado(raiz, 'testes', 'ambiente', ambiente);

  exibirSaida(execucao.saida);
  const avisos = {
    verde: 'SUÍTE VERDE.',
    vermelha: 'SUÍTE VERMELHA. Asserções existentes estão travadas (P2): reporte a falha e escale como "defeito_codigo" se o defeito for real.',
    ambiente: `FALHA DE AMBIENTE (código ${execucao.codigo}); ${ambiente.falhas_consecutivas} de ${config.testes.falhas_ambiente_max}.`,
  };
  process.stdout.write(`[harness] ${avisos[execucao.situacao]}\n`);
  process.exit(execucao.situacao === 'verde' ? 0 : 1);
}

/** P3 — restaura o conteúdo anterior a cada arquivo alterado no ciclo (null = arquivo novo, apagar). */
function reverterAlteracoes(raiz, alteracoes) {
  for (const [arquivo, original] of Object.entries(alteracoes)) {
    const destino = path.join(raiz, arquivo);
    if (original === null) fs.rmSync(destino, { force: true });
    else fs.writeFileSync(destino, original);
  }
}

function executarParaCodificacao(raiz, config) {
  const tarefa = lerEstado(raiz, 'codificacao', 'tarefa', null);
  if (!tarefa) recusar('nenhuma tarefa iniciada: node .claude/ferramentas/iniciar-tarefa.js --requisito <ID>');
  if (tarefa.tentativas >= config.codificacao.teto_tentativas) {
    recusar(`teto de ${config.codificacao.teto_tentativas} ciclos editar-testar atingido. Escale com a diferença parcial e o histórico de falhas.`);
  }

  const houveEdicao = Object.keys(tarefa.alteracoes_pendentes).length > 0;
  if (houveEdicao) tarefa.tentativas += 1;

  const execucao = executarSuite(raiz, config.execucao_testes);
  registrarSituacaoCompartilhada(raiz, execucao);
  if (!execucao.resultados) recusar(`relatório JUnit não encontrado em ${config.execucao_testes.relatorio_junit}; sem ele não há baseline_verde nem detecção de regressão.`);

  const regressao = tarefa.baseline_verde.filter((id) => execucao.resultados.get(id) === 'falhou');
  const testesDoRequisito = [...execucao.resultados.keys()].filter((id) => pertenceAoRequisito(id, tarefa.requisito_alvo));
  const requisitoVerde = testesDoRequisito.length > 0 && testesDoRequisito.every((id) => execucao.resultados.get(id) === 'passou');

  let revertido = false;
  if (regressao.length > 0 && houveEdicao) {
    reverterAlteracoes(raiz, tarefa.alteracoes_pendentes);
    tarefa.reversoes = (tarefa.reversoes || 0) + 1;
    revertido = true;
  } else {
    tarefa.arquivos_tocados = [...new Set([...(tarefa.arquivos_tocados || []), ...Object.keys(tarefa.alteracoes_pendentes)])];
  }
  tarefa.alteracoes_pendentes = {};

  const comandoAnalise = config.codificacao.comando_analise;
  const analise = comandoAnalise && !revertido ? executarComando(raiz, comandoAnalise, config.execucao_testes.timeout_segundos) : null;
  tarefa.ultimo_resultado = {
    quando: new Date().toISOString(),
    requisito_verde: requisitoVerde && !revertido,
    testes_do_requisito: testesDoRequisito.length,
    regressao,
    revertido,
    // Sem comando de análise configurado não há o que exigir; após reversão, a análise não roda e não conta como ok.
    analise_ok: analise ? analise.codigo === 0 : !comandoAnalise,
  };
  salvarEstado(raiz, 'codificacao', 'tarefa', tarefa);

  exibirSaida(execucao.saida);
  if (analise) exibirSaida(analise.saida);
  const r = tarefa.ultimo_resultado;
  if (revertido) {
    process.stdout.write(`[harness · P3] REGRESSÃO em ${regressao.length} teste(s) do baseline_verde: ${regressao.join(', ')}. A última diferença foi REVERTIDA automaticamente. Registre o acoplamento como achado para o agente 5.\n`);
  }
  if (testesDoRequisito.length === 0) {
    process.stdout.write(`[harness] nenhum teste com o id ${tarefa.requisito_alvo} no nome foi encontrado no relatório JUnit.\n`);
  }
  process.stdout.write(`[harness] ciclo ${tarefa.tentativas}/${config.codificacao.teto_tentativas} · requisito ${r.requisito_verde ? 'VERDE' : 'VERMELHO'} · análise ${r.analise_ok ? 'ok' : 'com problemas'}\n`);
  process.exit(r.requisito_verde && r.analise_ok ? 0 : 1);
}

function principal() {
  const { values: args } = parseArgs({ options: { agente: { type: 'string' } } });
  const raiz = raizProjeto({});
  const config = carregarConfig(raiz);
  if (!config.execucao_testes.comando) recusar('execucao_testes.comando não configurado em harness/config.json.');
  const semIsolamento = motivoSemIsolamento(config.execucao_testes);
  if (semIsolamento) recusar(semIsolamento);

  if (args.agente === 'testes') executarParaTestes(raiz, config);
  else if (args.agente === 'codificacao') executarParaCodificacao(raiz, config);
  else recusar('informe --agente testes ou --agente codificacao');
}

try {
  principal();
} catch (erro) {
  process.stderr.write(`executar-suite: ${erro.stack || erro.message}\n`);
  process.exit(1);
}
