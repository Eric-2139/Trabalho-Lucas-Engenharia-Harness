'use strict';

const fs = require('node:fs');
const path = require('node:path');

const TAMANHO_MAXIMO_RESUMO = 300;

// O log guarda um resumo da entrada: conteúdo integral de arquivos incharia o
// log sem acrescentar auditabilidade (o arquivo em si já está versionado).
function resumirEntrada(entradaFerramenta) {
  const resumo = {};
  for (const [chave, valor] of Object.entries(entradaFerramenta || {})) {
    const texto = typeof valor === 'string' ? valor : JSON.stringify(valor);
    resumo[chave] = texto.length > TAMANHO_MAXIMO_RESUMO ? `${texto.slice(0, TAMANHO_MAXIMO_RESUMO)}…` : texto;
  }
  return resumo;
}

/**
 * log_decisoes[]: entrada, decisão, política aplicada, ação. Uma linha por
 * chamada de ferramenta — é o que torna cada passo auditável e reversível.
 */
function registrarDecisao(ctx, { acao, politica = null, motivo = null }) {
  const linha = {
    quando: new Date().toISOString(),
    agente: ctx.agente,
    execucao: ctx.idExecucao,
    evento: ctx.entrada.hook_event_name || null,
    ferramenta: ctx.ferramenta || null,
    entrada: resumirEntrada(ctx.entradaFerramenta),
    politica,
    acao,
    motivo,
  };
  const destino = path.join(ctx.raiz, 'harness', 'log_decisoes.jsonl');
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.appendFileSync(destino, `${JSON.stringify(linha)}\n`);
}

module.exports = { registrarDecisao };
