'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { violacao } = require('../../lib/cadeia');
const { ehEscrita, estaDentroDeAlgum, estaForaDoProjeto } = require('../../lib/contexto');
const { validarPendencia } = require('../../lib/esquemas');
const { CAMINHOS, idPeloNomeDoArquivo } = require('../../lib/artefatos');

/**
 * Verificações que valem para os cinco agentes. Protegem o próprio harness:
 * um agente que pudesse editar seus hooks ou o config teria políticas
 * opcionais, e política opcional não é política.
 */
function protegerHarness(ctx) {
  if (!ehEscrita(ctx)) return null;
  if (estaDentroDeAlgum(ctx.caminho, ctx.config.comum.caminhos_protegidos)) {
    return violacao('H1', `"${ctx.caminho}" pertence ao harness (código, config, baseline, estado ou log) e não pode ser escrito por agente.`);
  }
  return null;
}

function impedirEscritaForaDoProjeto(ctx) {
  if (ehEscrita(ctx) && estaForaDoProjeto(ctx.caminho)) {
    return violacao('H2', `escrita fora do projeto bloqueada: "${ctx.caminho}".`);
  }
  return null;
}

/**
 * Fábrica: escrita só nos prefixos listados (P1 de cada agente, com texto
 * próprio). "prefixos" pode ser lista fixa ou função do contexto (vindo do config).
 */
function escritaSomenteEm(politica, prefixosOuFuncao, explicacao) {
  return (ctx) => {
    const prefixos = typeof prefixosOuFuncao === 'function' ? prefixosOuFuncao(ctx) : prefixosOuFuncao;
    if (!ehEscrita(ctx) || estaDentroDeAlgum(ctx.caminho, prefixos)) return null;
    return violacao(politica, `${explicacao} Permitido apenas: ${prefixos.join(', ')}. Tentativa: "${ctx.caminho}".`);
  };
}

/**
 * Artefatos estruturados (JSON) só podem ser gravados com Write do objeto
 * completo — com Edit parcial o gate não conseguiria validar o esquema final.
 */
function artefatoSomentePorWrite(politica, prefixos) {
  return (ctx) => {
    if (!['Edit', 'MultiEdit'].includes(ctx.ferramenta) || !estaDentroDeAlgum(ctx.caminho, prefixos)) return null;
    return violacao(politica, 'artefatos estruturados são gravados com Write do objeto JSON completo, para que o esquema seja validado.');
  };
}

const METACARACTERES_SHELL = /[;&|<>`$\n\r]/;

/**
 * Lista de permissão de Bash. Lista de bloqueio seria contornável; aqui só
 * passa o que foi explicitamente oferecido, sem encadeamento de comandos.
 */
function bashSomenteComandos(politica, obterComandosPermitidos) {
  return (ctx) => {
    if (ctx.ferramenta !== 'Bash') return null;
    const comando = String(ctx.entradaFerramenta.command || '').trim();
    const permitidos = obterComandosPermitidos(ctx).filter(Boolean);
    const aceito = permitidos.some((permitido) => {
      if (comando === permitido) return true;
      if (!comando.startsWith(`${permitido} `)) return false;
      return !METACARACTERES_SHELL.test(comando.slice(permitido.length));
    });
    if (aceito) return null;
    return violacao(politica, `comando fora da lista de permissão deste agente. Permitidos: ${permitidos.join(' | ') || '(nenhum configurado)'}.`);
  };
}

/** Pendências são append-only e validadas por esquema (ferramenta abrir_pendencia). */
function pendenciaValida(ctx) {
  if (ctx.ferramenta !== 'Write' || !estaDentroDeAlgum(ctx.caminho, [CAMINHOS.pendencias])) return null;
  if (fs.existsSync(path.join(ctx.raiz, ctx.caminho))) {
    return violacao('H3', 'pendência já existe e é imutável para agentes; abra uma nova pendência referenciando a anterior.');
  }
  let pendencia;
  try {
    pendencia = JSON.parse(ctx.entradaFerramenta.content);
  } catch {
    return violacao('H3', 'a pendência não é JSON válido.');
  }
  const erros = validarPendencia(pendencia);
  if (pendencia && pendencia.agente_origem !== ctx.agente) erros.push(`"agente_origem" deve ser "${ctx.agente}"`);
  if (pendencia && idPeloNomeDoArquivo(ctx.caminho) !== pendencia.id) erros.push('o nome do arquivo deve ser <id>.json');
  return erros.length ? violacao('H3', `pendência inválida: ${erros.join('; ')}.`) : null;
}

const VERIFICACOES_COMUNS = [impedirEscritaForaDoProjeto, protegerHarness, pendenciaValida];

module.exports = {
  VERIFICACOES_COMUNS,
  escritaSomenteEm,
  artefatoSomentePorWrite,
  bashSomenteComandos,
};
