#!/usr/bin/env node
'use strict';

/**
 * buscar_log(servico, janela, filtro) — agente de manutenção.
 * Uso: node .claude/ferramentas/buscar-log.js --servico <nome> [--inicio ISO] [--fim ISO] [--filtro texto]
 *
 * Única porta de entrada do log no contexto do modelo. Toda linha passa pelo
 * mascaramento (P2) e sai com referência "arquivo:linha" para citação (P3).
 */
const path = require('node:path');
const { parseArgs } = require('node:util');
const { raizProjeto, carregarConfig, listarArquivos, lerArquivoSeExistir } = require('../lib/contexto');
const { lerEstado, salvarEstado } = require('../lib/estado');
const { mascarar } = require('../lib/mascaramento');

const PADRAO_CARIMBO = /^(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2})/;

function principal() {
  const { values: args } = parseArgs({
    options: { servico: { type: 'string' }, inicio: { type: 'string' }, fim: { type: 'string' }, filtro: { type: 'string' } },
  });
  if (!args.servico) throw new Error('informe --servico');

  const raiz = raizProjeto({});
  const config = carregarConfig(raiz).manutencao;
  const brutos = config.diretorio_logs_brutos.replace(/\/$/, '');
  const chave = JSON.stringify([args.servico, args.inicio || null, args.fim || null, args.filtro || null]);
  const consultas = lerEstado(raiz, 'manutencao', 'logs_consultados', []);
  if (consultas.includes(chave)) {
    process.stdout.write('Consulta idêntica já realizada nesta execução; reutilize o resultado anterior ou mude a janela/filtro.\n');
    return;
  }

  const inicio = args.inicio ? Date.parse(args.inicio) : -Infinity;
  const fim = args.fim ? Date.parse(args.fim) : Infinity;
  const filtro = (args.filtro || '').toLowerCase();
  const arquivos = listarArquivos(raiz, brutos).filter((a) => path.posix.basename(a).startsWith(args.servico) && a.endsWith('.log'));
  const saida = [];

  for (const arquivo of arquivos) {
    const linhas = (lerArquivoSeExistir(raiz, arquivo) || '').split(/\r?\n/);
    linhas.forEach((linha, indice) => {
      const carimbo = PADRAO_CARIMBO.exec(linha);
      const instante = carimbo ? Date.parse(carimbo[1]) : NaN;
      const naJanela = Number.isNaN(instante) ? !args.inicio && !args.fim : instante >= inicio && instante <= fim;
      if (naJanela && (!filtro || linha.toLowerCase().includes(filtro))) {
        saida.push(`${path.posix.relative(brutos, arquivo)}:${indice + 1} | ${mascarar(linha)}`);
      }
    });
  }

  salvarEstado(raiz, 'manutencao', 'logs_consultados', [...consultas, chave]);
  const limite = config.linhas_log_max;
  process.stdout.write(saida.slice(0, limite).join('\n') || '(nenhuma linha na janela/filtro)');
  process.stdout.write(saida.length > limite ? `\n… ${saida.length - limite} linhas omitidas; estreite a janela ou o filtro.\n` : '\n');
}

try {
  principal();
} catch (erro) {
  process.stderr.write(`buscar-log: ${erro.message}\n`);
  process.exit(1);
}
