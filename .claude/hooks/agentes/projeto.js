'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { violacao } = require('../../lib/cadeia');
const { estaDentroDe, lerArquivoSeExistir } = require('../../lib/contexto');
const { lerEstado, salvarEstado } = require('../../lib/estado');
const { validarLacuna } = require('../../lib/esquemas');
const { encontrarTermos, normalizar } = require('../../lib/texto');
const { CAMINHOS, lerBaseline, lerJsonsDoDiretorio, lerMatrizRastreabilidade, idPeloNomeDoArquivo } = require('../../lib/artefatos');
const { escritaSomenteEm, artefatoSomentePorWrite } = require('./comum');

const AGENTE = 'projeto';

function config(ctx) {
  return ctx.config.projeto;
}

function hashDoBaseline(raiz) {
  return crypto.createHash('sha256').update(lerArquivoSeExistir(raiz, CAMINHOS.baseline) ?? '').digest('hex');
}

/**
 * P2 — a análise roda contra uma versão fixa. O hash é fixado na primeira
 * chamada; se mudar, tudo é bloqueado. Uma matriz construída sobre duas
 * versões diferentes é pior que nenhuma, porque parece consistente.
 */
function baselineCongelado(ctx) {
  const atual = hashDoBaseline(ctx.raiz);
  const congelado = lerEstado(ctx.raiz, AGENTE, 'baseline', null);
  if (!congelado) {
    salvarEstado(ctx.raiz, AGENTE, 'baseline', { hash: atual, versao: lerBaseline(ctx.raiz).versao });
    return null;
  }
  if (congelado.hash === atual) return null;
  return violacao('P2', 'o baseline de requisitos mudou durante a análise. Aborte e reinicie a verificação do zero.');
}

function ehEscritaDeLacuna(ctx) {
  return ctx.ferramenta === 'Write' && estaDentroDe(ctx.caminho, CAMINHOS.lacunas);
}

function interpretarLacuna(ctx) {
  try {
    return JSON.parse(ctx.entradaFerramenta.content);
  } catch {
    return null;
  }
}

/** P1 — detecta e propõe; nunca grava decisão. Toda lacuna nasce rascunho com dono humano. */
function lacunaComEsquemaValido(ctx) {
  if (!ehEscritaDeLacuna(ctx)) return null;
  if (fs.existsSync(path.join(ctx.raiz, ctx.caminho))) return violacao('P1', 'lacuna registrada é imutável; registre uma nova referenciando a anterior.');
  const lacuna = interpretarLacuna(ctx);
  const erros = lacuna ? validarLacuna(lacuna) : ['conteúdo não é JSON válido'];
  if (lacuna && idPeloNomeDoArquivo(ctx.caminho) !== lacuna.id) erros.push('o nome do arquivo deve ser <id>.json');
  const versao = lerBaseline(ctx.raiz).versao;
  if (lacuna && lacuna.versao_baseline !== versao) erros.push(`"versao_baseline" deve ser "${versao}" (versão congelada)`);
  return erros.length ? violacao('ESQUEMA', `lacuna inválida: ${erros.join('; ')}.`) : null;
}

/** P3 — ausência de documentação não é evidência de ausência de motivo. */
function componenteOrfaoNuncaRemovido(ctx) {
  if (!ehEscritaDeLacuna(ctx)) return null;
  const lacuna = interpretarLacuna(ctx);
  if (lacuna.tipo !== 'componente_sem_ancora') return null;
  const termos = encontrarTermos(`${lacuna.proposta || ''}\n${lacuna.justificativa}`, { remocao: config(ctx).termos_remocao });
  if (termos.length === 0) return null;
  return violacao('P3', `componente sem âncora só é sinalizado, nunca proposto para remoção (termo "${termos[0].termo}"). Registre a hipótese de requisito implícito e escale.`);
}

/** P4 — RNF crítico sem decisão é impedimento, não aviso. */
function rnfCriticoEhBloqueante(ctx) {
  if (!ehEscritaDeLacuna(ctx)) return null;
  const lacuna = interpretarLacuna(ctx);
  if (lacuna.tipo !== 'rnf_sem_decisao' || lacuna.bloqueante) return null;
  const criticas = config(ctx).categorias_rnf_criticas.map(normalizar);
  const requisitos = new Map(lerBaseline(ctx.raiz).requisitos.map((req) => [req.id, req]));
  const critico = lacuna.itens.find((id) => requisitos.has(id) && criticas.includes(normalizar(requisitos.get(id).subcategoria)));
  return critico ? violacao('P4', `${critico} é RNF crítico (${requisitos.get(critico).subcategoria}); a lacuna deve ter "bloqueante": true.`) : null;
}

/** Recalcula a consistência a partir dos artefatos: o critério de conclusão não depende do relato do modelo. */
function avaliarParada(ctx) {
  const requisitos = lerBaseline(ctx.raiz).requisitos;
  const { mapeamentos } = lerMatrizRastreabilidade(ctx.raiz);
  const componentes = lerJsonsDoDiretorio(ctx.raiz, CAMINHOS.componentes).map(({ arquivo, conteudo }) => (conteudo && conteudo.id) || idPeloNomeDoArquivo(arquivo));
  const lacunas = lerJsonsDoDiretorio(ctx.raiz, CAMINHOS.lacunas).map(({ conteudo }) => conteudo).filter(Boolean);
  const itensComLacuna = new Set(lacunas.flatMap((l) => l.itens));
  const criticas = config(ctx).categorias_rnf_criticas.map(normalizar);

  const reqsMapeados = new Set(mapeamentos.map((m) => m.req_id));
  const compsAncorados = new Set(mapeamentos.map((m) => m.componente_id));
  const rnfsCriticos = requisitos.filter((r) => r.categoria === 'nao_funcional' && criticas.includes(normalizar(r.subcategoria)));
  const comDecisao = new Set(mapeamentos.filter((m) => m.decisao_id).map((m) => m.req_id));

  const falhas = [
    ...requisitos.filter((r) => !reqsMapeados.has(r.id) && !itensComLacuna.has(r.id)).map((r) => `${r.id} sem componente e sem lacuna registrada`),
    ...componentes.filter((c) => !compsAncorados.has(c) && !itensComLacuna.has(c)).map((c) => `componente ${c} sem requisito e sem lacuna registrada`),
    ...rnfsCriticos.filter((r) => !comDecisao.has(r.id) && !itensComLacuna.has(r.id)).map((r) => `${r.id} (RNF crítico) sem decisão de arquitetura e sem lacuna`),
  ];
  const bloqueantes = lacunas.filter((l) => l.bloqueante).length;
  const rastreados = requisitos.filter((r) => reqsMapeados.has(r.id)).length;

  return {
    pendencias: falhas,
    resultado: bloqueantes > config(ctx).lacunas_bloqueantes_max ? 'falha_controlada' : bloqueantes > 0 ? 'escalado' : 'sucesso',
    metricas: {
      versao_baseline: lerBaseline(ctx.raiz).versao,
      requisitos_rastreados: `${rastreados} de ${requisitos.length}`,
      percentual_rastreado: requisitos.length ? Number((rastreados / requisitos.length).toFixed(3)) : 0,
      rnf_criticos_sem_decisao: rnfsCriticos.filter((r) => !comDecisao.has(r.id)).map((r) => r.id),
      lacunas_por_tipo: lacunas.reduce((acc, l) => ({ ...acc, [l.tipo]: (acc[l.tipo] || 0) + 1 }), {}),
      lacunas_bloqueantes: bloqueantes,
    },
  };
}

module.exports = {
  verificacoes: [
    baselineCongelado,
    escritaSomenteEm('P1', [CAMINHOS.lacunas], 'registrar_lacuna é a única escrita deste agente; artefato de projeto é somente leitura.'),
    artefatoSomentePorWrite('ESQUEMA', [CAMINHOS.lacunas]),
    lacunaComEsquemaValido,
    componenteOrfaoNuncaRemovido,
    rnfCriticoEhBloqueante,
  ],
  avaliarParada,
};
