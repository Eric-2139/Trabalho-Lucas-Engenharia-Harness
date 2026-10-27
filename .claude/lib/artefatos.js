'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { lerJsonSeExistir, listarArquivos } = require('./contexto');

/** Local único de cada artefato do processo; hooks e ferramentas leem daqui. */
const CAMINHOS = Object.freeze({
  baseline: 'harness/baseline/requisitos.json',
  rascunhoRequisitos: 'harness/rascunho/requisitos/',
  historicoRequisitos: 'harness/rascunho/historico/',
  pendencias: 'harness/pendencias/',
  chamados: 'harness/chamados/',
  diagnosticos: 'harness/diagnosticos/',
  propostas: 'harness/propostas/',
  lacunas: 'harness/lacunas/',
  componentes: 'harness/projeto/componentes/',
  matrizRastreabilidade: 'harness/matriz/rastreabilidade.json',
  matrizRequisitoTeste: 'harness/matriz/requisito-teste.json',
  relatorios: 'harness/relatorios/',
});

function lerJsonsDoDiretorio(raiz, diretorio) {
  return listarArquivos(raiz, diretorio)
    .filter((arquivo) => arquivo.endsWith('.json'))
    .map((arquivo) => ({ arquivo, conteudo: lerJsonSeExistir(raiz, arquivo) }));
}

function lerBaseline(raiz) {
  const baseline = lerJsonSeExistir(raiz, CAMINHOS.baseline);
  return baseline && Array.isArray(baseline.requisitos) ? baseline : { versao: null, requisitos: [] };
}

function requisitoDoBaseline(raiz, reqId) {
  return lerBaseline(raiz).requisitos.find((req) => req.id === reqId) || null;
}

function lerPendencias(raiz) {
  return lerJsonsDoDiretorio(raiz, CAMINHOS.pendencias)
    .map(({ conteudo }) => conteudo)
    .filter(Boolean);
}

/** Pendências abertas por um agente a partir de um instante (escalada na execução corrente). */
function pendenciasDoAgenteDesde(raiz, agente, inicioIso) {
  const inicio = Date.parse(inicioIso);
  return lerJsonsDoDiretorio(raiz, CAMINHOS.pendencias)
    .filter(({ arquivo, conteudo }) => conteudo && conteudo.agente_origem === agente && fs.statSync(path.join(raiz, arquivo)).mtimeMs >= inicio)
    .map(({ conteudo }) => conteudo);
}

function lerMatrizRastreabilidade(raiz) {
  const matriz = lerJsonSeExistir(raiz, CAMINHOS.matrizRastreabilidade);
  return matriz && Array.isArray(matriz.mapeamentos) ? matriz : { versao_baseline: null, mapeamentos: [] };
}

/** "harness/pendencias/PEND-001.json" → "PEND-001" */
function idPeloNomeDoArquivo(caminhoRelativo) {
  return path.posix.basename(caminhoRelativo, '.json');
}

module.exports = {
  CAMINHOS,
  lerJsonsDoDiretorio,
  lerBaseline,
  requisitoDoBaseline,
  lerPendencias,
  pendenciasDoAgenteDesde,
  lerMatrizRastreabilidade,
  idPeloNomeDoArquivo,
};
