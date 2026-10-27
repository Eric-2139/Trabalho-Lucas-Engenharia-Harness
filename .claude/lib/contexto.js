'use strict';

const fs = require('node:fs');
const path = require('node:path');

const FERRAMENTAS_ESCRITA = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit']);
const FERRAMENTAS_LEITURA = new Set(['Read', 'Grep', 'Glob']);

function lerEntrada() {
  const bruto = fs.readFileSync(0, 'utf8');
  return bruto.trim() ? JSON.parse(bruto) : {};
}

// No Git Bash a variável pode chegar como /c/Users/...; o Node no Windows precisa de C:/Users/...
function converterCaminhoGitBash(caminho) {
  const unidade = /^\/([a-zA-Z])\/(.*)$/.exec(caminho);
  if (process.platform === 'win32' && unidade) {
    return `${unidade[1].toUpperCase()}:/${unidade[2]}`;
  }
  return caminho;
}

function raizProjeto(entrada) {
  const candidata = process.env.CLAUDE_PROJECT_DIR || (entrada && entrada.cwd) || process.cwd();
  return path.resolve(converterCaminhoGitBash(candidata));
}

/**
 * Converte qualquer caminho recebido da ferramenta em caminho relativo à raiz,
 * sempre com "/" — as políticas comparam prefixos e não podem depender do SO.
 */
function paraRelativo(raiz, caminho) {
  if (caminho === undefined || caminho === null || caminho === '') return null;
  const absoluto = path.resolve(raiz, converterCaminhoGitBash(String(caminho)));
  const relativo = path.relative(raiz, absoluto).split(path.sep).join('/');
  return relativo === '' ? '.' : relativo;
}

function normalizarParaComparacao(caminho) {
  return process.platform === 'win32' ? caminho.toLowerCase() : caminho;
}

/** Prefixos terminados em "/" representam diretórios; os demais, arquivos exatos. */
function estaDentroDe(caminhoRelativo, prefixo) {
  if (caminhoRelativo === null) return false;
  const alvo = normalizarParaComparacao(caminhoRelativo);
  const base = normalizarParaComparacao(prefixo);
  if (base.endsWith('/')) return alvo === base.slice(0, -1) || alvo.startsWith(base);
  return alvo === base;
}

function estaDentroDeAlgum(caminhoRelativo, prefixos) {
  return prefixos.some((prefixo) => estaDentroDe(caminhoRelativo, prefixo));
}

function estaForaDoProjeto(caminhoRelativo) {
  return caminhoRelativo !== null && (caminhoRelativo === '..' || caminhoRelativo.startsWith('../') || path.isAbsolute(caminhoRelativo));
}

function carregarConfig(raiz) {
  return JSON.parse(fs.readFileSync(path.join(raiz, 'harness', 'config.json'), 'utf8'));
}

function montarContexto(agente, entrada) {
  const raiz = raizProjeto(entrada);
  const entradaFerramenta = entrada.tool_input || {};
  const alvo = entradaFerramenta.file_path || entradaFerramenta.notebook_path || entradaFerramenta.path || null;
  return {
    agente,
    entrada,
    raiz,
    config: carregarConfig(raiz),
    ferramenta: entrada.tool_name || '',
    entradaFerramenta,
    caminho: paraRelativo(raiz, alvo),
    idExecucao: entrada.agent_id || entrada.session_id || 'desconhecida',
  };
}

function ehEscrita(ctx) {
  return FERRAMENTAS_ESCRITA.has(ctx.ferramenta);
}

function ehLeitura(ctx) {
  return FERRAMENTAS_LEITURA.has(ctx.ferramenta);
}

function lerArquivoSeExistir(raiz, caminhoRelativo) {
  try {
    return fs.readFileSync(path.join(raiz, caminhoRelativo), 'utf8');
  } catch {
    return null;
  }
}

function lerJsonSeExistir(raiz, caminhoRelativo) {
  const conteudo = lerArquivoSeExistir(raiz, caminhoRelativo);
  if (conteudo === null) return null;
  try {
    return JSON.parse(conteudo);
  } catch {
    return null;
  }
}

/** Lista arquivos (relativos à raiz) de um diretório, recursivamente. */
function listarArquivos(raiz, diretorioRelativo) {
  const base = path.join(raiz, diretorioRelativo);
  if (!fs.existsSync(base)) return [];
  const encontrados = [];
  for (const item of fs.readdirSync(base, { withFileTypes: true })) {
    const relativo = `${diretorioRelativo.replace(/\/$/, '')}/${item.name}`;
    if (item.isDirectory()) encontrados.push(...listarArquivos(raiz, relativo));
    else encontrados.push(relativo);
  }
  return encontrados;
}

/**
 * Reconstrói o conteúdo que o arquivo terá depois da escrita. As políticas
 * precisam avaliar o resultado final, não só o trecho enviado pelo modelo.
 */
function conteudoResultante(ctx) {
  const t = ctx.entradaFerramenta;
  if (ctx.ferramenta === 'Write') return t.content ?? '';
  const atual = lerArquivoSeExistir(ctx.raiz, ctx.caminho) ?? '';
  const edicoes = ctx.ferramenta === 'MultiEdit' ? t.edits || [] : [t];
  return edicoes.reduce((texto, edicao) => {
    if (edicao.old_string === undefined) return texto;
    return edicao.replace_all
      ? texto.split(edicao.old_string).join(edicao.new_string ?? '')
      : texto.replace(edicao.old_string, () => edicao.new_string ?? '');
  }, atual);
}

/** Apenas o texto novo introduzido pela escrita (usado em varreduras de segredo). */
function textoIntroduzido(ctx) {
  const t = ctx.entradaFerramenta;
  if (ctx.ferramenta === 'Write') return t.content ?? '';
  if (ctx.ferramenta === 'MultiEdit') return (t.edits || []).map((e) => e.new_string ?? '').join('\n');
  return t.new_string ?? t.new_source ?? '';
}

module.exports = {
  lerEntrada,
  raizProjeto,
  paraRelativo,
  estaDentroDe,
  estaDentroDeAlgum,
  estaForaDoProjeto,
  carregarConfig,
  montarContexto,
  ehEscrita,
  ehLeitura,
  lerArquivoSeExistir,
  lerJsonSeExistir,
  listarArquivos,
  conteudoResultante,
  textoIntroduzido,
};
