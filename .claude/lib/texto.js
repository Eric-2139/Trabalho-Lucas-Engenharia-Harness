'use strict';

/** Minúsculas e sem acento: as listas de termos do config ficam independentes de grafia. */
function normalizar(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

function normalizarEspacos(texto) {
  return normalizar(texto).replace(/\s+/g, ' ').trim();
}

function escaparRegex(texto) {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Procura termos por palavra inteira. Devolve [{ categoria, termo }].
 * É deliberadamente uma lista em código: o roteamento por severidade não pode
 * depender do julgamento do modelo (P4 do agente de requisitos).
 */
function encontrarTermos(texto, termosPorCategoria) {
  const alvo = normalizar(texto);
  const encontrados = [];
  for (const [categoria, termos] of Object.entries(termosPorCategoria)) {
    for (const termo of termos) {
      const padrao = new RegExp(`(^|[^a-z0-9])${escaparRegex(normalizar(termo))}($|[^a-z0-9])`);
      if (padrao.test(alvo)) encontrados.push({ categoria, termo });
    }
  }
  return encontrados;
}

function contemTrecho(documento, trecho) {
  const trechoNormalizado = normalizarEspacos(trecho);
  return trechoNormalizado.length > 0 && normalizarEspacos(documento).includes(trechoNormalizado);
}

const PREFIXO_SEM_CAIXA = '(?i)';

/**
 * Compila um padrão vindo do config. O JavaScript não aceita o modificador
 * inline "(?i)" das regex de outras linguagens; aqui ele vira a flag "i".
 */
function compilarPadrao(padrao) {
  return padrao.startsWith(PREFIXO_SEM_CAIXA)
    ? new RegExp(padrao.slice(PREFIXO_SEM_CAIXA.length), 'im')
    : new RegExp(padrao, 'm');
}

/** Primeiro padrão (regex em texto) que casa com o conteúdo, ou null. */
function primeiroPadraoQueCasa(conteudo, padroes) {
  return padroes.find((padrao) => compilarPadrao(padrao).test(conteudo)) ?? null;
}

module.exports = { normalizar, normalizarEspacos, encontrarTermos, contemTrecho, primeiroPadraoQueCasa };
