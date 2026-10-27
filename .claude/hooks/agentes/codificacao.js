'use strict';

const path = require('node:path');
const { violacao } = require('../../lib/cadeia');
const { ehEscrita, estaDentroDe, estaDentroDeAlgum, lerArquivoSeExistir, textoIntroduzido } = require('../../lib/contexto');
const { lerEstado, salvarEstado } = require('../../lib/estado');
const { casaAlgumGlob } = require('../../lib/glob');
const { primeiroPadraoQueCasa } = require('../../lib/texto');
const { CAMINHOS, pendenciasDoAgenteDesde } = require('../../lib/artefatos');
const { bashSomenteComandos } = require('./comum');

const AGENTE = 'codificacao';
const FERRAMENTA_SUITE = 'node .claude/ferramentas/executar-suite.js --agente codificacao';
const FERRAMENTA_INICIAR = 'node .claude/ferramentas/iniciar-tarefa.js';
const COMANDOS_GIT_LEITURA = ['git diff', 'git status'];

function config(ctx) {
  return ctx.config.codificacao;
}

function lerTarefa(ctx) {
  return lerEstado(ctx.raiz, AGENTE, 'tarefa', null);
}

/** Escritas de código; abrir pendência (escalada) é sempre permitido. */
function ehEscritaDeCodigo(ctx) {
  return ehEscrita(ctx) && !estaDentroDe(ctx.caminho, CAMINHOS.pendencias);
}

function exigeTarefaIniciada(ctx) {
  if (!ehEscritaDeCodigo(ctx) || lerTarefa(ctx)) return null;
  return violacao('TAREFA', `inicie a tarefa antes de editar: ${FERRAMENTA_INICIAR} --requisito <ID>. Ela carrega o projeto do componente e grava o baseline_verde.`);
}

/** P2 — quem escreve teste é o agente 3; este agente não define o alvo que ele mesmo verifica. */
function suiteImutavel(ctx) {
  if (!ehEscrita(ctx) || !estaDentroDeAlgum(ctx.caminho, ctx.config.diretorios_testes)) return null;
  return violacao('P2', 'a suíte é imutável para o agente de codificação. Se o teste conflita com o projeto, escale ao agente 5 e ao arquiteto.');
}

function semNovaDependencia(ctx) {
  if (!ehEscritaDeCodigo(ctx) || !config(ctx).manifestos_dependencia.includes(path.posix.basename(ctx.caminho))) return null;
  return violacao('P1', 'nova dependência exige decisão de arquitetura. Abra pendência do tipo "arquitetura" descrevendo necessidade e opções.');
}

/** P1 — só arquivos declarados no projeto do componente; fora disso é pendência, não edição silenciosa. */
function escopoDeArquivoFechado(ctx) {
  const tarefa = lerTarefa(ctx);
  if (!ehEscritaDeCodigo(ctx) || !tarefa || casaAlgumGlob(ctx.caminho, tarefa.arquivos_previstos)) return null;
  return violacao('P1', `"${ctx.caminho}" está fora do escopo previsto para ${tarefa.requisito_alvo} (${tarefa.arquivos_previstos.join(', ')}). Abra pendência de arquitetura.`);
}

/** P4 — varredura de segredos antes de qualquer escrita. */
function nenhumSegredoEmCodigo(ctx) {
  if (!ehEscritaDeCodigo(ctx)) return null;
  const padrao = primeiroPadraoQueCasa(textoIntroduzido(ctx), config(ctx).padroes_segredo);
  return padrao ? violacao('P4', `possível segredo no código (/${padrao}/). Use variável de ambiente ou cofre de segredos.`) : null;
}

/** P5 — quem não converge em N ciclos passa a fazer alterações cada vez mais amplas. */
function tetoDeTentativas(ctx) {
  const tarefa = lerTarefa(ctx);
  if (!ehEscritaDeCodigo(ctx) || !tarefa || tarefa.tentativas < config(ctx).teto_tentativas) return null;
  return violacao('P5', `${tarefa.tentativas} ciclos editar-testar consumidos (teto ${config(ctx).teto_tentativas}). Escale com a diferença parcial e o histórico de falhas.`);
}

/**
 * Guarda o conteúdo original de cada arquivo antes da primeira edição do
 * ciclo. É o que permite ao harness (P3) reverter exatamente a última
 * diferença, sem depender de git nem do modelo perceber a regressão.
 */
function guardarSnapshot(ctx) {
  const tarefa = lerTarefa(ctx);
  if (!ehEscritaDeCodigo(ctx) || !tarefa || ctx.caminho in tarefa.alteracoes_pendentes) return;
  tarefa.alteracoes_pendentes[ctx.caminho] = lerArquivoSeExistir(ctx.raiz, ctx.caminho);
  salvarEstado(ctx.raiz, AGENTE, 'tarefa', tarefa);
}

function avaliarParada(ctx) {
  const tarefa = lerTarefa(ctx);
  const execucao = lerEstado(ctx.raiz, AGENTE, 'execucao', { inicio: new Date(0).toISOString() });
  const escalou = pendenciasDoAgenteDesde(ctx.raiz, AGENTE, execucao.inicio).length > 0;
  if (!tarefa) {
    return { pendencias: escalou ? [] : ['nenhuma tarefa iniciada e nenhuma pendência aberta'], resultado: 'escalado', metricas: {} };
  }
  const ultimo = tarefa.ultimo_resultado;
  const verde = Boolean(ultimo && ultimo.requisito_verde && ultimo.regressao.length === 0 && ultimo.analise_ok);
  const esgotou = tarefa.tentativas >= config(ctx).teto_tentativas;

  let resultado = 'sucesso';
  if (!verde) resultado = esgotou ? 'falha_controlada' : 'escalado';
  const pendencias = verde || esgotou || escalou ? [] : [`${tarefa.requisito_alvo}: suíte do requisito não está verde com análise limpa e sem regressão. Continue ou escale.`];

  return {
    pendencias,
    resultado,
    metricas: {
      requisito: tarefa.requisito_alvo,
      ciclos_editar_testar: tarefa.tentativas,
      reversoes_por_regressao: tarefa.reversoes || 0,
      arquivos_tocados: tarefa.arquivos_tocados || [],
    },
  };
}

module.exports = {
  verificacoes: [
    bashSomenteComandos('P1', (ctx) => [FERRAMENTA_SUITE, FERRAMENTA_INICIAR, ...COMANDOS_GIT_LEITURA, config(ctx).comando_analise]),
    suiteImutavel,
    exigeTarefaIniciada,
    semNovaDependencia,
    escopoDeArquivoFechado,
    nenhumSegredoEmCodigo,
    tetoDeTentativas,
  ],
  aoPermitir: guardarSnapshot,
  avaliarParada,
};
