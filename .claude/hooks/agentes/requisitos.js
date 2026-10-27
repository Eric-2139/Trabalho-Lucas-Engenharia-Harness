'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { violacao } = require('../../lib/cadeia');
const { estaDentroDe, lerArquivoSeExistir } = require('../../lib/contexto');
const { lerEstado, salvarEstado } = require('../../lib/estado');
const { validarRequisito, STATUS_REQUISITO } = require('../../lib/esquemas');
const { encontrarTermos, contemTrecho } = require('../../lib/texto');
const { CAMINHOS, lerJsonsDoDiretorio, lerPendencias, idPeloNomeDoArquivo } = require('../../lib/artefatos');
const { escritaSomenteEm, artefatoSomentePorWrite } = require('./comum');

const AGENTE = 'requisitos';
const CURSOR_INICIAL = { linha: 0 };
const PRIMEIRA_LINHA = 1;
const STATUS_QUE_EXIGEM_PENDENCIA = ['AMBIGUO', 'CONFLITO', 'OK_PENDENTE_REVISAO'];

function config(ctx) {
  return ctx.config.requisitos;
}

function ehEscritaDeRequisito(ctx) {
  return ctx.ferramenta === 'Write' && estaDentroDe(ctx.caminho, CAMINHOS.rascunhoRequisitos);
}

function contarLinhas(texto) {
  return texto === null ? 0 : texto.split(/\r?\n/).length;
}

/** Percepção paginada: um trecho limitado por iteração, sem pular adiante do cursor. */
function leituraPaginada(ctx) {
  if (ctx.ferramenta !== 'Read' || !estaDentroDe(ctx.caminho, config(ctx).documento_fonte)) return null;
  const { offset, limit } = ctx.entradaFerramenta;
  const maximo = config(ctx).trecho_max_linhas;
  if (!Number.isInteger(limit) || limit > maximo) {
    return violacao('LEITURA', `leia o documento fonte em trechos: informe "limit" de no máximo ${maximo} linhas.`);
  }
  const cursor = lerEstado(ctx.raiz, AGENTE, 'cursor', CURSOR_INICIAL);
  const inicio = Number.isInteger(offset) ? offset : PRIMEIRA_LINHA;
  if (inicio > cursor.linha + 1) {
    return violacao('LEITURA', `leitura sequencial: o próximo trecho começa na linha ${cursor.linha + 1}, não na ${inicio}.`);
  }
  return null;
}

function interpretarRequisito(ctx) {
  try {
    return JSON.parse(ctx.entradaFerramenta.content);
  } catch {
    return null;
  }
}

function requisitoComEsquemaValido(ctx) {
  if (!ehEscritaDeRequisito(ctx)) return null;
  const req = interpretarRequisito(ctx);
  const erros = req ? validarRequisito(req) : ['conteúdo não é JSON válido'];
  if (req && idPeloNomeDoArquivo(ctx.caminho) !== req.id) erros.push('o nome do arquivo deve ser <id>.json');
  return erros.length ? violacao('ESQUEMA', `requisito inválido: ${erros.join('; ')}.`) : null;
}

/** P2 — critério só com fonte do documento atual; precedente de outro projeto não é fonte. */
function antialucinacaoPorFonte(ctx) {
  if (!ehEscritaDeRequisito(ctx)) return null;
  const req = interpretarRequisito(ctx);
  const documento = lerArquivoSeExistir(ctx.raiz, config(ctx).documento_fonte) ?? '';
  if (!contemTrecho(documento, req.trecho_fonte)) {
    return violacao('P2', `"trecho_fonte" não aparece literalmente em ${config(ctx).documento_fonte}. Cite o texto exato do documento atual.`);
  }
  if (req.status === 'AMBIGUO' && req.criterio_aceitacao.trim() !== '') {
    return violacao('P2', 'requisito AMBIGUO não pode ter critério de aceitação: sem métrica na fonte, o critério seria inventado. Deixe vazio e abra pendência.');
  }
  if (['OK', 'OK_PENDENTE_REVISAO'].includes(req.status) && req.criterio_aceitacao.trim() === '') {
    return violacao('P2', 'requisito sem critério de aceitação verificável não pode ser OK; use AMBIGUO e abra pendência.');
  }
  return null;
}

/** P4 — roteamento por lista de termos em código, não por confiança do modelo. */
function humanoObrigatorioPorSeveridade(ctx) {
  if (!ehEscritaDeRequisito(ctx)) return null;
  const req = interpretarRequisito(ctx);
  if (req.status !== 'OK') return null;
  const termos = encontrarTermos(`${req.texto}\n${req.trecho_fonte}`, config(ctx).termos_criticos);
  if (termos.length === 0) return null;
  const categorias = [...new Set(termos.map((t) => t.categoria))].join(', ');
  return violacao('P4', `o requisito toca categoria crítica (${categorias}) e nunca fecha sozinho. Use status OK_PENDENTE_REVISAO e abra pendência do tipo "revisao_critica".`);
}

/** P5 — id repetido versiona em vez de duplicar: guarda a versão anterior no histórico. */
function versionarRequisitoExistente(ctx) {
  if (!ehEscritaDeRequisito(ctx)) return;
  const atual = lerArquivoSeExistir(ctx.raiz, ctx.caminho);
  if (atual === null) return;
  const id = idPeloNomeDoArquivo(ctx.caminho);
  const diretorio = path.join(ctx.raiz, CAMINHOS.historicoRequisitos);
  fs.mkdirSync(diretorio, { recursive: true });
  const versao = fs.readdirSync(diretorio).filter((nome) => nome.startsWith(`${id}.v`)).length + 1;
  fs.writeFileSync(path.join(diretorio, `${id}.v${versao}.json`), atual);
}

/** Atualiza doc_cursor após cada leitura bem-sucedida do documento fonte. */
function avancarCursor(ctx) {
  if (ctx.ferramenta !== 'Read' || !estaDentroDe(ctx.caminho, config(ctx).documento_fonte)) return;
  const { offset, limit } = ctx.entradaFerramenta;
  const totalLinhas = contarLinhas(lerArquivoSeExistir(ctx.raiz, config(ctx).documento_fonte));
  const ultimaLida = Math.min((Number.isInteger(offset) ? offset : PRIMEIRA_LINHA) + limit - 1, totalLinhas);
  const cursor = lerEstado(ctx.raiz, AGENTE, 'cursor', CURSOR_INICIAL);
  salvarEstado(ctx.raiz, AGENTE, 'cursor', { linha: Math.max(cursor.linha, ultimaLida) });
}

function lerRequisitosDoRascunho(raiz) {
  return lerJsonsDoDiretorio(raiz, CAMINHOS.rascunhoRequisitos);
}

function verificarVinculos(requisitos, pendencias) {
  const falhas = [];
  const porId = new Map(requisitos.map((req) => [req.id, req]));
  for (const req of requisitos) {
    const temPendencia = pendencias.some((p) => p.agente_origem === AGENTE && (p.req_ids || []).includes(req.id));
    if (STATUS_QUE_EXIGEM_PENDENCIA.includes(req.status) && !temPendencia) {
      falhas.push(`${req.id} está ${req.status} sem pendência aberta que o referencie`);
    }
    for (const outroId of req.conflita_com || []) {
      const outro = porId.get(outroId);
      if (!outro || outro.status !== 'CONFLITO') falhas.push(`${req.id} conflita com ${outroId}, que também deve estar CONFLITO`);
    }
  }
  return falhas;
}

/** Sucesso: cursor no fim e todo requisito com esquema válido e status definido. */
function avaliarParada(ctx) {
  const pendenciasDeParada = [];
  const totalLinhas = contarLinhas(lerArquivoSeExistir(ctx.raiz, config(ctx).documento_fonte));
  const cursor = lerEstado(ctx.raiz, AGENTE, 'cursor', CURSOR_INICIAL);
  if (totalLinhas === 0) pendenciasDeParada.push(`documento fonte ausente ou vazio: ${config(ctx).documento_fonte}`);
  else if (cursor.linha < totalLinhas) pendenciasDeParada.push(`documento lido até a linha ${cursor.linha} de ${totalLinhas}`);

  const arquivos = lerRequisitosDoRascunho(ctx.raiz);
  const requisitos = [];
  for (const { arquivo, conteudo } of arquivos) {
    const erros = conteudo ? validarRequisito(conteudo) : ['JSON inválido'];
    if (erros.length) pendenciasDeParada.push(`${arquivo}: ${erros.join('; ')}`);
    else requisitos.push(conteudo);
  }
  pendenciasDeParada.push(...verificarVinculos(requisitos, lerPendencias(ctx.raiz)));

  const porStatus = Object.fromEntries(STATUS_REQUISITO.map((s) => [s, requisitos.filter((r) => r.status === s).length]));
  const taxaAmbiguidade = requisitos.length ? porStatus.AMBIGUO / requisitos.length : 0;
  const acimaDoLimiar = taxaAmbiguidade > config(ctx).limiar_ambiguidade;
  return {
    pendencias: pendenciasDeParada,
    // Acima do limiar o documento de entrada é ruim demais para valer o gasto: falha controlada.
    resultado: acimaDoLimiar ? 'falha_controlada' : 'sucesso',
    metricas: {
      total_requisitos: requisitos.length,
      por_status: porStatus,
      taxa_ambiguidade: Number(taxaAmbiguidade.toFixed(3)),
      limiar_ambiguidade: config(ctx).limiar_ambiguidade,
      nao_fechados: requisitos.length - porStatus.OK,
    },
  };
}

module.exports = {
  verificacoes: [
    escritaSomenteEm('P1', [CAMINHOS.rascunhoRequisitos, CAMINHOS.pendencias], 'escrita confinada à área de rascunho; baseline aprovado é imutável.'),
    artefatoSomentePorWrite('ESQUEMA', [CAMINHOS.rascunhoRequisitos]),
    leituraPaginada,
    requisitoComEsquemaValido,
    antialucinacaoPorFonte,
    humanoObrigatorioPorSeveridade,
  ],
  aoPermitir: versionarRequisitoExistente,
  aposExecutar: avancarCursor,
  avaliarParada,
};
