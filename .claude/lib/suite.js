'use strict';

const { spawnSync } = require('node:child_process');
const { lerArquivoSeExistir } = require('./contexto');
const { interpretarJunit } = require('./junit');

const MILISSEGUNDOS_POR_SEGUNDO = 1000;
const CODIGO_VERDE = 0;

/**
 * P1 do agente de testes — isolamento obrigatório. Com a exigência ligada,
 * a suíte só roda em contêiner efêmero (--rm) e sem rede (--network none).
 */
function motivoSemIsolamento(execucaoTestes) {
  if (!execucaoTestes.exigir_conteiner_sem_rede) return null;
  const comando = execucaoTestes.comando;
  const conteiner = /^(docker|podman)\s+run\b/.test(comando);
  const efemero = /\s--rm\b/.test(comando);
  const semRede = /\s--network[= ]none\b/.test(comando);
  if (conteiner && efemero && semRede) return null;
  return 'o comando de testes deve rodar em contêiner efêmero e sem rede ("docker run --rm --network none ..."). Ajuste harness/config.json → execucao_testes.comando.';
}

function executarComando(raiz, comando, timeoutSegundos) {
  const resultado = spawnSync(comando, { cwd: raiz, shell: true, encoding: 'utf8', timeout: timeoutSegundos * MILISSEGUNDOS_POR_SEGUNDO });
  return {
    codigo: resultado.status === null ? -1 : resultado.status,
    saida: `${resultado.stdout || ''}${resultado.stderr || ''}${resultado.error ? `\n${resultado.error.message}` : ''}`,
  };
}

/** 'verde' | 'vermelha' | 'ambiente' — só código de saída conhecido conta como falha de teste. */
function classificarExecucao(codigo, execucaoTestes) {
  if (codigo === CODIGO_VERDE) return 'verde';
  return execucaoTestes.codigos_saida_vermelho.includes(codigo) ? 'vermelha' : 'ambiente';
}

function executarSuite(raiz, execucaoTestes) {
  const { codigo, saida } = executarComando(raiz, execucaoTestes.comando, execucaoTestes.timeout_segundos);
  const xml = execucaoTestes.relatorio_junit ? lerArquivoSeExistir(raiz, execucaoTestes.relatorio_junit) : null;
  return {
    codigo,
    saida,
    situacao: classificarExecucao(codigo, execucaoTestes),
    resultados: xml ? interpretarJunit(xml) : null,
  };
}

module.exports = { motivoSemIsolamento, executarComando, executarSuite };
