'use strict';

const { violacao } = require('./cadeia');
const { lerEstado, salvarEstado } = require('./estado');

const ORCAMENTO_INICIAL = { iteracoes: 0, falhas_consecutivas: {}, esgotado: null };

function configDoAgente(ctx) {
  return ctx.config[ctx.agente] || {};
}

/**
 * Teto de iterações e disjuntor por ferramenta. Roda como primeiro elo do
 * gate: uma iteração conta mesmo que outra política bloqueie a chamada,
 * porque o custo (tokens, tempo) já foi pago.
 */
function verificarOrcamento(ctx) {
  const { teto_iteracoes: teto, falhas_consecutivas_max: maxFalhas } = configDoAgente(ctx);
  const orcamento = lerEstado(ctx.raiz, ctx.agente, 'orcamento', ORCAMENTO_INICIAL);
  orcamento.iteracoes += 1;

  if (Number.isInteger(teto) && orcamento.iteracoes > teto) {
    orcamento.esgotado = orcamento.esgotado || `teto de ${teto} iterações atingido`;
  }
  const falhasDaFerramenta = orcamento.falhas_consecutivas[ctx.ferramenta] || 0;
  if (Number.isInteger(maxFalhas) && falhasDaFerramenta >= maxFalhas) {
    orcamento.esgotado = orcamento.esgotado || `disjuntor: ${falhasDaFerramenta} falhas consecutivas de ${ctx.ferramenta}`;
  }
  salvarEstado(ctx.raiz, ctx.agente, 'orcamento', orcamento);

  if (!orcamento.esgotado) return null;
  return violacao('ORCAMENTO', `${orcamento.esgotado}. Encerre agora com relatório parcial: resuma o que foi feito e o que ficou pendente.`);
}

/** Só falha real da ferramenta alimenta o disjuntor; bloqueio de política é feedback, não falha. */
function registrarResultado(ctx, falhou) {
  const orcamento = lerEstado(ctx.raiz, ctx.agente, 'orcamento', ORCAMENTO_INICIAL);
  orcamento.falhas_consecutivas[ctx.ferramenta] = falhou ? (orcamento.falhas_consecutivas[ctx.ferramenta] || 0) + 1 : 0;
  salvarEstado(ctx.raiz, ctx.agente, 'orcamento', orcamento);
}

function orcamentoEsgotado(ctx) {
  return lerEstado(ctx.raiz, ctx.agente, 'orcamento', ORCAMENTO_INICIAL).esgotado;
}

module.exports = { verificarOrcamento, registrarResultado, orcamentoEsgotado };
