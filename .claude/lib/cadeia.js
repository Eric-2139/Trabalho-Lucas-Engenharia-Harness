'use strict';

/**
 * Gate de políticas como cadeia de verificações puras. Cada verificação
 * recebe o contexto e devolve null (segue) ou { politica, motivo } (bloqueia).
 * A primeira violação encerra a cadeia: o modelo recebe um motivo por vez,
 * o que mantém o log auditável linha a linha.
 */
function executarCadeia(verificacoes, ctx) {
  for (const verificacao of verificacoes) {
    const violacao = verificacao(ctx);
    if (violacao) return violacao;
  }
  return null;
}

function violacao(politica, motivo) {
  return { politica, motivo };
}

module.exports = { executarCadeia, violacao };
