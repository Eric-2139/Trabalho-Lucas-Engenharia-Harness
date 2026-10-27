'use strict';

/**
 * Convenção agnóstica de linguagem para rastrear teste → requisito: um
 * comentário por caso de teste, no formato
 *     @req RF-04 @tipo negativo
 * O harness (e não o modelo) deriva a matriz requisito→teste dessas marcas.
 */
const TIPOS_CASO = ['feliz', 'borda', 'negativo'];
const PADRAO_ANOTACAO = /@req\s+((?:RF|RNF)-\d{2,})\s+@tipo\s+(feliz|borda|negativo)\b/g;

function extrairAnotacoes(conteudo) {
  return [...String(conteudo).matchAll(PADRAO_ANOTACAO)].map(([, reqId, tipo]) => ({ reqId, tipo }));
}

function coberturaVazia() {
  return Object.fromEntries(TIPOS_CASO.map((tipo) => [tipo, 0]));
}

/** Monta { reqId: { feliz, borda, negativo, arquivos[] } } a partir de [{ arquivo, conteudo }]. */
function montarMatrizRequisitoTeste(arquivosDeTeste) {
  const requisitos = {};
  for (const { arquivo, conteudo } of arquivosDeTeste) {
    for (const { reqId, tipo } of extrairAnotacoes(conteudo)) {
      requisitos[reqId] = requisitos[reqId] || { ...coberturaVazia(), arquivos: [] };
      requisitos[reqId][tipo] += 1;
      if (!requisitos[reqId].arquivos.includes(arquivo)) requisitos[reqId].arquivos.push(arquivo);
    }
  }
  return requisitos;
}

function coberturaCompleta(cobertura) {
  return Boolean(cobertura) && TIPOS_CASO.every((tipo) => cobertura[tipo] > 0);
}

module.exports = { TIPOS_CASO, extrairAnotacoes, montarMatrizRequisitoTeste, coberturaCompleta };
