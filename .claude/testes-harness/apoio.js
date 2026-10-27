'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const RAIZ_REAL = path.resolve(__dirname, '..', '..');
const DIRETORIO_HOOKS = path.join(RAIZ_REAL, '.claude', 'hooks');
const DIRETORIO_FERRAMENTAS = path.join(RAIZ_REAL, '.claude', 'ferramentas');
const ID_EXECUCAO_TESTE = 'execucao-de-teste';

/**
 * Cria um projeto temporário com o config real (opcionalmente ajustado) e os
 * arquivos informados. Os testes rodam os hooks reais contra esse projeto.
 */
function criarProjeto(arquivos = {}, ajustarConfig = (config) => config) {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'harness-'));
  const config = JSON.parse(fs.readFileSync(path.join(RAIZ_REAL, 'harness', 'config.json'), 'utf8'));
  escrever(raiz, 'harness/config.json', JSON.stringify(ajustarConfig(config), null, 2));
  for (const [relativo, conteudo] of Object.entries(arquivos)) {
    escrever(raiz, relativo, typeof conteudo === 'string' ? conteudo : JSON.stringify(conteudo, null, 2));
  }
  return raiz;
}

function escrever(raiz, relativo, conteudo) {
  const destino = path.join(raiz, relativo);
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.writeFileSync(destino, conteudo);
}

function ler(raiz, relativo) {
  return fs.readFileSync(path.join(raiz, relativo), 'utf8');
}

function existe(raiz, relativo) {
  return fs.existsSync(path.join(raiz, relativo));
}

function executarNode(script, argumentos, raiz, entrada) {
  const resultado = spawnSync(process.execPath, [script, ...argumentos], {
    cwd: raiz,
    input: entrada === undefined ? '' : JSON.stringify(entrada),
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: raiz },
  });
  return { codigo: resultado.status, stdout: resultado.stdout, stderr: resultado.stderr };
}

/** Simula o PreToolUse de um agente. */
function gate(raiz, agente, ferramenta, entradaFerramenta) {
  return executarNode(path.join(DIRETORIO_HOOKS, 'gate.js'), [agente], raiz, {
    session_id: ID_EXECUCAO_TESTE,
    hook_event_name: 'PreToolUse',
    tool_name: ferramenta,
    tool_input: entradaFerramenta,
    cwd: raiz,
  });
}

/** Simula o PostToolUse (ou PostToolUseFailure) de um agente. */
function pos(raiz, agente, ferramenta, entradaFerramenta, falhou = false) {
  return executarNode(path.join(DIRETORIO_HOOKS, 'pos.js'), [agente], raiz, {
    session_id: ID_EXECUCAO_TESTE,
    hook_event_name: falhou ? 'PostToolUseFailure' : 'PostToolUse',
    tool_name: ferramenta,
    tool_input: entradaFerramenta,
    cwd: raiz,
  });
}

function parada(raiz, agente) {
  return executarNode(path.join(DIRETORIO_HOOKS, 'parada.js'), [agente], raiz, {
    session_id: ID_EXECUCAO_TESTE,
    hook_event_name: 'SubagentStop',
    stop_hook_active: false,
    cwd: raiz,
  });
}

function ferramenta(raiz, nome, argumentos) {
  return executarNode(path.join(DIRETORIO_FERRAMENTAS, `${nome}.js`), argumentos, raiz);
}

function caminhoAbsoluto(raiz, relativo) {
  return path.join(raiz, relativo);
}

module.exports = { criarProjeto, escrever, ler, existe, gate, pos, parada, ferramenta, caminhoAbsoluto };
