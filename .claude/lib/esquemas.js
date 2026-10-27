'use strict';

/**
 * Validação de esquema dos artefatos que os agentes escrevem. Cada função
 * devolve a lista de erros (vazia = válido). Os valores de status são ASCII
 * (AMBIGUO, não AMBÍGUO) para evitar divergência de normalização Unicode.
 */
const PADRAO_ID_REQUISITO = /^(RF|RNF)-\d{2,}$/;
const PADRAO_ID_PENDENCIA = /^PEND-\d{3,}$/;
const PADRAO_ID_LACUNA = /^LAC-\d{3,}$/;
const PADRAO_REFERENCIA_EVIDENCIA = /^[^:]+:\d+$/;

const STATUS_REQUISITO = ['OK', 'AMBIGUO', 'CONFLITO', 'OK_PENDENTE_REVISAO'];
const CATEGORIAS_REQUISITO = ['funcional', 'nao_funcional'];
const TIPOS_PENDENCIA = [
  'ambiguidade',
  'conflito',
  'revisao_critica',
  'devolucao_criterio',
  'arquitetura',
  'defeito_codigo',
  'desvio_requisito',
  'escalada',
];
const CLASSIFICACOES_DIAGNOSTICO = ['bug_codigo', 'desvio_requisito', 'erro_uso', 'duplicata', 'escalada'];
const DESTINOS_DIAGNOSTICO = ['correcao_proposta', 'escalada_desenvolvimento', 'escalada_produto', 'orientacao_usuario', 'fechado_duplicata'];
const STATUS_HIPOTESE = ['especulacao', 'confirmada_parcial', 'confirmada', 'descartada'];
const TIPOS_LACUNA = ['requisito_orfao', 'lacuna_parcial', 'componente_sem_ancora', 'rnf_sem_decisao', 'conflito_contrato'];

function textoPreenchido(valor) {
  return typeof valor === 'string' && valor.trim().length > 0;
}

function exigirTexto(objeto, campo, erros) {
  if (!textoPreenchido(objeto[campo])) erros.push(`campo "${campo}" obrigatório e não vazio`);
}

function exigirValor(objeto, campo, permitidos, erros) {
  if (!permitidos.includes(objeto[campo])) erros.push(`campo "${campo}" deve ser um de: ${permitidos.join(', ')}`);
}

function validarRequisito(req) {
  const erros = [];
  if (!req || typeof req !== 'object') return ['o requisito deve ser um objeto JSON'];
  if (!PADRAO_ID_REQUISITO.test(req.id || '')) erros.push('campo "id" deve seguir RF-NN ou RNF-NN');
  exigirTexto(req, 'texto', erros);
  exigirValor(req, 'categoria', CATEGORIAS_REQUISITO, erros);
  exigirTexto(req, 'trecho_fonte', erros);
  exigirValor(req, 'status', STATUS_REQUISITO, erros);
  if (typeof req.criterio_aceitacao !== 'string') erros.push('campo "criterio_aceitacao" deve ser texto (vazio quando AMBIGUO)');
  if (req.categoria === 'nao_funcional') exigirTexto(req, 'subcategoria', erros);
  if (req.status === 'CONFLITO' && !(Array.isArray(req.conflita_com) && req.conflita_com.length > 0)) {
    erros.push('status CONFLITO exige "conflita_com" com ao menos um id');
  }
  return erros;
}

function validarPendencia(pend) {
  const erros = [];
  if (!pend || typeof pend !== 'object') return ['a pendência deve ser um objeto JSON'];
  if (!PADRAO_ID_PENDENCIA.test(pend.id || '')) erros.push('campo "id" deve seguir PEND-NNN');
  exigirValor(pend, 'tipo', TIPOS_PENDENCIA, erros);
  exigirTexto(pend, 'agente_origem', erros);
  exigirTexto(pend, 'pergunta', erros);
  if (!Array.isArray(pend.req_ids)) erros.push('campo "req_ids" deve ser uma lista (pode ser vazia)');
  if (!Array.isArray(pend.opcoes)) erros.push('campo "opcoes" deve ser uma lista');
  if (['ambiguidade', 'conflito'].includes(pend.tipo) && Array.isArray(pend.opcoes) && pend.opcoes.length < 2) {
    erros.push('pendência de ambiguidade ou conflito deve oferecer ao menos 2 opções ao humano');
  }
  // Só o humano responde pendência; agente sempre cria como aberta.
  if (pend.status !== 'aberta') erros.push('campo "status" deve ser "aberta" (resposta é exclusiva do humano)');
  return erros;
}

function validarHipotese(hipotese, indice) {
  const erros = [];
  const rotulo = `hipoteses[${indice}]`;
  if (!textoPreenchido(hipotese.enunciado)) erros.push(`${rotulo}.enunciado obrigatório`);
  if (!STATUS_HIPOTESE.includes(hipotese.status)) erros.push(`${rotulo}.status deve ser um de: ${STATUS_HIPOTESE.join(', ')}`);
  if (!Array.isArray(hipotese.evidencias)) {
    erros.push(`${rotulo}.evidencias deve ser uma lista`);
    return erros;
  }
  hipotese.evidencias.forEach((evidencia, i) => {
    if (!['log', 'codigo'].includes(evidencia.tipo)) erros.push(`${rotulo}.evidencias[${i}].tipo deve ser "log" ou "codigo"`);
    if (!PADRAO_REFERENCIA_EVIDENCIA.test(evidencia.referencia || '')) {
      erros.push(`${rotulo}.evidencias[${i}].referencia deve ser "arquivo:linha"`);
    }
  });
  return erros;
}

function validarDiagnostico(diag) {
  const erros = [];
  if (!diag || typeof diag !== 'object') return ['o diagnóstico deve ser um objeto JSON'];
  exigirTexto(diag, 'chamado_id', erros);
  exigirTexto(diag, 'componente', erros);
  exigirValor(diag, 'classificacao', CLASSIFICACOES_DIAGNOSTICO, erros);
  exigirValor(diag, 'destino', DESTINOS_DIAGNOSTICO, erros);
  if (!Array.isArray(diag.hipoteses) || diag.hipoteses.length === 0) {
    erros.push('campo "hipoteses" deve ter ao menos uma hipótese');
  } else {
    diag.hipoteses.forEach((h, i) => erros.push(...validarHipotese(h || {}, i)));
  }
  return erros;
}

function validarLacuna(lacuna) {
  const erros = [];
  if (!lacuna || typeof lacuna !== 'object') return ['a lacuna deve ser um objeto JSON'];
  if (!PADRAO_ID_LACUNA.test(lacuna.id || '')) erros.push('campo "id" deve seguir LAC-NNN');
  exigirValor(lacuna, 'tipo', TIPOS_LACUNA, erros);
  if (!Array.isArray(lacuna.itens) || lacuna.itens.length === 0) erros.push('campo "itens" deve listar ao menos um requisito ou componente');
  exigirTexto(lacuna, 'justificativa', erros);
  exigirTexto(lacuna, 'versao_baseline', erros);
  exigirTexto(lacuna, 'dono_humano', erros);
  if (typeof lacuna.bloqueante !== 'boolean') erros.push('campo "bloqueante" deve ser true ou false');
  if (lacuna.status !== 'rascunho') erros.push('campo "status" deve ser "rascunho" (decisão aprovada é exclusiva do humano)');
  return erros;
}

module.exports = {
  STATUS_REQUISITO,
  validarRequisito,
  validarPendencia,
  validarDiagnostico,
  validarLacuna,
};
