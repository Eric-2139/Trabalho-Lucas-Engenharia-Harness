'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { violacao } = require('../../lib/cadeia');
const { ehEscrita, ehLeitura, estaDentroDeAlgum, conteudoResultante, lerArquivoSeExistir, listarArquivos } = require('../../lib/contexto');
const { lerEstado } = require('../../lib/estado');
const { primeiroPadraoQueCasa } = require('../../lib/texto');
const { extrairAnotacoes, montarMatrizRequisitoTeste, coberturaCompleta } = require('../../lib/anotacoes');
const { CAMINHOS, lerBaseline, lerPendencias } = require('../../lib/artefatos');
const { escritaSomenteEm, bashSomenteComandos } = require('./comum');

const AGENTE = 'testes';
const COMANDO_SUITE = 'node .claude/ferramentas/executar-suite.js --agente testes';

function config(ctx) {
  return ctx.config.testes;
}

function ehEscritaDeTeste(ctx) {
  return ehEscrita(ctx)
    && estaDentroDeAlgum(ctx.caminho, ctx.config.diretorios_testes)
    && !estaDentroDeAlgum(ctx.caminho, config(ctx).diretorios_suporte);
}

/** ler_assinatura: quem lê a implementação testa o que o código faz, não o que deveria fazer. */
function somenteContratoNaoImplementacao(ctx) {
  if (!ehLeitura(ctx) || !estaDentroDeAlgum(ctx.caminho || '.', config(ctx).caminhos_implementacao_bloqueados)) return null;
  return violacao('CONTRATO', `"${ctx.caminho}" é implementação. Este agente lê só o contrato público (${config(ctx).caminhos_contrato.join(', ') || 'ver config'}) e o requisito.`);
}

/** P3 — todo caso aponta para requisito OK do baseline; comportamento fora do critério vira devolução. */
function naoInventaRequisito(ctx) {
  if (!ehEscritaDeTeste(ctx)) return null;
  const anotacoes = extrairAnotacoes(conteudoResultante(ctx));
  if (anotacoes.length === 0) {
    return violacao('P3', 'arquivo de teste sem anotação "@req <ID> @tipo <feliz|borda|negativo>". Teste sem requisito é teste inventado.');
  }
  const requisitos = new Map(lerBaseline(ctx.raiz).requisitos.map((req) => [req.id, req]));
  for (const { reqId } of anotacoes) {
    const req = requisitos.get(reqId);
    if (!req) return violacao('P3', `${reqId} não existe no baseline aprovado.`);
    if (req.status !== 'OK') {
      return violacao('P3', `${reqId} está ${req.status} no baseline: sem critério verificável não há teste. Devolva ao agente 1 com pendência "devolucao_criterio".`);
    }
  }
  return null;
}

/** P4 — aleatoriedade sem semente, relógio sem injeção e espera por tempo são bloqueados. */
function determinismoForcado(ctx) {
  if (!ehEscritaDeTeste(ctx)) return null;
  const padrao = primeiroPadraoQueCasa(conteudoResultante(ctx), config(ctx).padroes_nao_deterministicos);
  if (!padrao) return null;
  return violacao('P4', `construção não determinística detectada (/${padrao}/). Use semente fixa, relógio injetado ou fake de tempo.`);
}

function linhasDeAssercao(conteudo, padroes) {
  return String(conteudo ?? '')
    .split(/\r?\n/)
    .map((linha) => linha.trim())
    .filter((linha) => padroes.some((padrao) => new RegExp(padrao, 'i').test(linha)));
}

/**
 * P2 — depois de uma execução vermelha, asserção existente não muda. O
 * caminho de menor resistência para "suíte verde" é enfraquecer o alvo;
 * a comparação de diferença fecha esse caminho. Adicionar casos continua livre.
 */
function assercaoImutavelAposVermelho(ctx) {
  if (!ehEscritaDeTeste(ctx)) return null;
  const suite = lerEstado(ctx.raiz, 'compartilhado', 'suite', { vermelha: false });
  if (!suite.vermelha) return null;
  const padroes = config(ctx).padroes_assercao;
  const antes = linhasDeAssercao(lerArquivoSeExistir(ctx.raiz, ctx.caminho), padroes);
  const depois = new Set(linhasDeAssercao(conteudoResultante(ctx), padroes));
  const alterada = antes.find((linha) => !depois.has(linha));
  if (!alterada) return null;
  return violacao('P2', `a suíte está vermelha e esta escrita altera a asserção "${alterada}". Reporte a falha e escale (pendência "defeito_codigo"); não ajuste o teste para passar.`);
}

/** registrar_teste: a matriz requisito→teste é derivada pelo harness, nunca escrita pelo modelo. */
function atualizarMatrizRequisitoTeste(ctx) {
  if (!ehEscritaDeTeste(ctx)) return;
  const arquivos = ctx.config.diretorios_testes
    .flatMap((diretorio) => listarArquivos(ctx.raiz, diretorio))
    .map((arquivo) => ({ arquivo, conteudo: lerArquivoSeExistir(ctx.raiz, arquivo) }));
  const matriz = { gerado_em: new Date().toISOString(), requisitos: montarMatrizRequisitoTeste(arquivos) };
  const destino = path.join(ctx.raiz, CAMINHOS.matrizRequisitoTeste);
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.writeFileSync(destino, JSON.stringify(matriz, null, 2));
}

function avaliarParada(ctx) {
  const matriz = (JSON.parse(lerArquivoSeExistir(ctx.raiz, CAMINHOS.matrizRequisitoTeste) || '{}').requisitos) || {};
  const baseline = lerBaseline(ctx.raiz).requisitos;
  const elegiveis = baseline.filter((req) => req.status === 'OK');
  const devolvidos = new Set(
    lerPendencias(ctx.raiz)
      .filter((p) => p.agente_origem === AGENTE && p.tipo === 'devolucao_criterio')
      .flatMap((p) => p.req_ids),
  );
  const semCobertura = elegiveis.filter((req) => !coberturaCompleta(matriz[req.id]) && !devolvidos.has(req.id));
  const ambiente = lerEstado(ctx.raiz, AGENTE, 'ambiente', { falhas_consecutivas: 0 });
  const semCriterio = baseline.filter((req) => req.status !== 'OK').length + devolvidos.size;
  const taxaSemCriterio = baseline.length ? semCriterio / baseline.length : 0;

  let resultado = 'sucesso';
  if (ambiente.falhas_consecutivas >= config(ctx).falhas_ambiente_max || taxaSemCriterio > config(ctx).limiar_sem_criterio) resultado = 'falha_controlada';
  else if (devolvidos.size > 0) resultado = 'escalado';

  return {
    pendencias: semCobertura.map((req) => `${req.id} sem os três tipos de caso (feliz, borda, negativo) e sem devolução ao agente 1`),
    resultado,
    metricas: {
      requisitos_elegiveis: elegiveis.length,
      cobertos_completamente: elegiveis.filter((req) => coberturaCompleta(matriz[req.id])).length,
      devolvidos_ao_agente_1: [...devolvidos],
      taxa_sem_criterio: Number(taxaSemCriterio.toFixed(3)),
      razao_negativo_por_feliz: Object.fromEntries(Object.entries(matriz).map(([id, c]) => [id, c.feliz ? Number((c.negativo / c.feliz).toFixed(2)) : null])),
    },
  };
}

module.exports = {
  verificacoes: [
    bashSomenteComandos('P1', () => [COMANDO_SUITE]),
    escritaSomenteEm('P1', (ctx) => [...ctx.config.diretorios_testes, CAMINHOS.pendencias], 'este agente escreve apenas testes e pendências.'),
    somenteContratoNaoImplementacao,
    naoInventaRequisito,
    determinismoForcado,
    assercaoImutavelAposVermelho,
  ],
  aposExecutar: atualizarMatrizRequisitoTeste,
  avaliarParada,
};
