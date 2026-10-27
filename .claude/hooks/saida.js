'use strict';

// Exit 2 é o único código que o Claude Code trata como bloqueio; o stderr vira feedback ao modelo.
const CODIGO_BLOQUEIO = 2;

function bloquear({ politica, motivo }) {
  process.stderr.write(`[harness · ${politica}] ${motivo}\n`);
  process.exit(CODIGO_BLOQUEIO);
}

/**
 * Fail-closed: se o próprio gate quebrar, a ação é bloqueada. Um erro comum
 * (exit 1) deixaria a ferramenta executar sem nenhuma política aplicada.
 */
function falhaInterna(erro) {
  process.stderr.write(`[harness · FALHA_INTERNA] o gate falhou e bloqueou a ação por segurança: ${erro && erro.stack ? erro.stack : erro}\n`);
  process.exit(CODIGO_BLOQUEIO);
}

module.exports = { bloquear, falhaInterna };
