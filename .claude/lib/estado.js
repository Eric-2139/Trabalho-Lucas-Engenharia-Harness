'use strict';

const fs = require('node:fs');
const path = require('node:path');

/**
 * Estado que sobrevive entre passos. Cada agente tem seu diretório em
 * harness/estado/<agente>/ e cada aspecto (orçamento, cursor, tarefa...) um
 * arquivo próprio, para que escritores diferentes nunca disputem o mesmo JSON.
 */
function caminhoEstado(raiz, agente, nome) {
  return path.join(raiz, 'harness', 'estado', agente, `${nome}.json`);
}

function lerEstado(raiz, agente, nome, padrao) {
  try {
    return JSON.parse(fs.readFileSync(caminhoEstado(raiz, agente, nome), 'utf8'));
  } catch {
    return structuredClone(padrao);
  }
}

// Escrita via arquivo temporário + rename: um hook interrompido não deixa JSON pela metade.
function salvarEstado(raiz, agente, nome, valor) {
  const destino = caminhoEstado(raiz, agente, nome);
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  const temporario = `${destino}.${process.pid}.tmp`;
  fs.writeFileSync(temporario, JSON.stringify(valor, null, 2));
  fs.renameSync(temporario, destino);
}

function limparEstado(raiz, agente) {
  fs.rmSync(path.join(raiz, 'harness', 'estado', agente), { recursive: true, force: true });
}

/**
 * Garante que o estado pertence à execução corrente. O SubagentStart já
 * reinicia o estado; esta verificação cobre versões do Claude Code em que o
 * evento não dispara e o id da execução muda sem aviso.
 */
function garantirExecucao(raiz, agente, idExecucao) {
  const execucao = lerEstado(raiz, agente, 'execucao', null);
  if (execucao && (execucao.id === idExecucao || idExecucao === 'desconhecida')) return execucao;
  if (execucao && execucao.id !== 'desconhecida') limparEstado(raiz, agente);
  const nova = { id: idExecucao, inicio: new Date().toISOString(), bloqueios_parada: 0 };
  salvarEstado(raiz, agente, 'execucao', nova);
  return nova;
}

module.exports = { lerEstado, salvarEstado, limparEstado, garantirExecucao };
