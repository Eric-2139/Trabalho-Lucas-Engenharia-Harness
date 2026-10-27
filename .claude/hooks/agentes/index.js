'use strict';

/**
 * Registro dos agentes (Strategy): cada módulo expõe a mesma interface —
 *   verificacoes: lista de verificações do gate (PreToolUse)
 *   aoPermitir(ctx): efeito determinístico logo antes da ferramenta rodar
 *   aposExecutar(ctx): atualização de estado após sucesso (PostToolUse)
 *   avaliarParada(ctx): { pendencias, resultado, metricas } para o Stop
 */
const AGENTES = {
  requisitos: () => require('./requisitos'),
  manutencao: () => require('./manutencao'),
  testes: () => require('./testes'),
  codificacao: () => require('./codificacao'),
  projeto: () => require('./projeto'),
};

function carregarAgente(nome) {
  if (!AGENTES[nome]) throw new Error(`agente desconhecido: "${nome}"`);
  return AGENTES[nome]();
}

module.exports = { AGENTES_CONHECIDOS: Object.keys(AGENTES), carregarAgente };
