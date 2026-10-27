'use strict';

const { violacao } = require('../../lib/cadeia');
const { estaDentroDe, estaDentroDeAlgum, ehEscrita, lerArquivoSeExistir, lerJsonSeExistir } = require('../../lib/contexto');
const { lerEstado, salvarEstado } = require('../../lib/estado');
const { validarDiagnostico } = require('../../lib/esquemas');
const { CAMINHOS, lerJsonsDoDiretorio, idPeloNomeDoArquivo } = require('../../lib/artefatos');
const { escritaSomenteEm, artefatoSomentePorWrite, bashSomenteComandos } = require('./comum');

const AGENTE = 'manutencao';
const MILISSEGUNDOS_POR_MINUTO = 60_000;
const STATUS_COM_EVIDENCIA = ['confirmada_parcial', 'confirmada', 'descartada'];
const ESCRITAS_DE_ESCALADA = [CAMINHOS.diagnosticos, CAMINHOS.pendencias];

function config(ctx) {
  return ctx.config.manutencao;
}

function ehEscritaDeDiagnostico(ctx) {
  return ctx.ferramenta === 'Write' && estaDentroDe(ctx.caminho, CAMINHOS.diagnosticos);
}

function interpretarDiagnostico(ctx) {
  try {
    return JSON.parse(ctx.entradaFerramenta.content);
  } catch {
    return null;
  }
}

/** P4 — incidente grave tem teto de tempo; depois dele só resta escalar com o que tiver. */
function disjuntorPorSeveridade(ctx) {
  const execucao = lerEstado(ctx.raiz, AGENTE, 'execucao', null);
  if (!execucao) return null;
  const chamado = lerEstado(ctx.raiz, AGENTE, 'chamado', null);
  // Antes de ler o chamado a severidade é desconhecida: assume-se a mais restritiva.
  const severidade = (chamado && chamado.severidade) || config(ctx).severidade_padrao;
  const tetoMinutos = config(ctx).teto_minutos_por_severidade[severidade] ?? config(ctx).teto_minutos_por_severidade[config(ctx).severidade_padrao];
  const decorridoMinutos = (Date.now() - Date.parse(execucao.inicio)) / MILISSEGUNDOS_POR_MINUTO;
  if (decorridoMinutos <= tetoMinutos) return null;
  if (ehEscrita(ctx) && estaDentroDeAlgum(ctx.caminho, ESCRITAS_DE_ESCALADA)) return null;
  return violacao('P4', `teto de ${tetoMinutos} min para severidade "${severidade}" atingido. Escale agora: grave o diagnóstico com classificacao "escalada" ou abra pendência com o que tiver.`);
}

/** P2 — log bruto nunca entra no contexto; só a saída mascarada de buscar-log. */
function mascaramentoAntesDoContexto(ctx) {
  const brutos = `${config(ctx).diretorio_logs_brutos.replace(/\/$/, '')}/`;
  if (ctx.ferramenta === 'Read' && estaDentroDe(ctx.caminho, brutos)) {
    return violacao('P2', 'log bruto contém dado pessoal. Use node .claude/ferramentas/buscar-log.js, que entrega o log mascarado.');
  }
  if (ctx.ferramenta === 'Grep') {
    const alvo = ctx.caminho || '.';
    // Buscar num diretório ancestral também varreria os logs brutos.
    const ancestralDosBrutos = alvo === '.' || brutos.startsWith(`${alvo.replace(/\/$/, '')}/`);
    if (estaDentroDe(alvo, brutos) || ancestralDosBrutos) {
      return violacao('P2', `Grep que alcança ${brutos} é bloqueado. Informe "path" específico (ex.: src/ ou ${CAMINHOS.chamados}).`);
    }
  }
  return null;
}

function linhaExiste(conteudo, numeroLinha) {
  return conteudo !== null && numeroLinha >= 1 && numeroLinha <= conteudo.split(/\r?\n/).length;
}

function evidenciaVerificavel(ctx, evidencia) {
  const separador = evidencia.referencia.lastIndexOf(':');
  const arquivo = evidencia.referencia.slice(0, separador);
  const linha = Number(evidencia.referencia.slice(separador + 1));
  const caminho = evidencia.tipo === 'log' ? `${config(ctx).diretorio_logs_brutos.replace(/\/$/, '')}/${arquivo}` : arquivo;
  return linhaExiste(lerArquivoSeExistir(ctx.raiz, caminho), linha);
}

/** P3 — hipótese sem citação verificável é especulação e não sustenta classificação. */
function hipoteseExigeEvidencia(ctx) {
  if (!ehEscritaDeDiagnostico(ctx)) return null;
  const diag = interpretarDiagnostico(ctx);
  const erros = diag ? validarDiagnostico(diag) : ['conteúdo não é JSON válido'];
  if (erros.length) return violacao('ESQUEMA', `diagnóstico inválido: ${erros.join('; ')}.`);
  if (idPeloNomeDoArquivo(ctx.caminho) !== diag.chamado_id) return violacao('ESQUEMA', 'o nome do arquivo deve ser <chamado_id>.json.');

  for (const hipotese of diag.hipoteses) {
    if (STATUS_COM_EVIDENCIA.includes(hipotese.status) && hipotese.evidencias.length === 0) {
      return violacao('P3', `hipótese "${hipotese.enunciado}" está ${hipotese.status} sem evidência; sem citação ela é "especulacao".`);
    }
    const invalida = hipotese.evidencias.find((e) => !evidenciaVerificavel(ctx, e));
    if (invalida) return violacao('P3', `evidência "${invalida.referencia}" não aponta para linha existente (log: relativo a ${config(ctx).diretorio_logs_brutos}; código: relativo à raiz).`);
  }
  const confirmadas = diag.hipoteses.filter((h) => ['confirmada', 'confirmada_parcial'].includes(h.status));
  if (diag.classificacao !== 'escalada' && confirmadas.length === 0) {
    return violacao('P3', 'classificação final exige ao menos uma hipótese confirmada com evidência; sem isso, classifique como "escalada".');
  }
  const descartadas = diag.hipoteses.filter((h) => h.status === 'descartada').length;
  if (descartadas >= config(ctx).hipoteses_descartadas_max && confirmadas.length === 0 && !diag.destino.startsWith('escalada')) {
    return violacao('P3', `${descartadas} hipóteses descartadas: encerre com escalada fundamentada.`);
  }
  return null;
}

/** P5 — similaridade textual não fecha duplicata; exige a mesma causa raiz confirmada. */
function duplicataExigeMesmaCausa(ctx) {
  if (!ehEscritaDeDiagnostico(ctx)) return null;
  const diag = interpretarDiagnostico(ctx);
  if (diag.classificacao !== 'duplicata') return null;
  if (!diag.duplicata_de || !diag.causa_raiz_id) {
    return violacao('P5', 'duplicata exige "duplicata_de" e "causa_raiz_id".');
  }
  const original = lerJsonSeExistir(ctx.raiz, `${CAMINHOS.diagnosticos}${diag.duplicata_de}.json`);
  if (!original || original.causa_raiz_id !== diag.causa_raiz_id) {
    return violacao('P5', `o chamado ${diag.duplicata_de} tem causa raiz "${original ? original.causa_raiz_id : 'sem diagnóstico'}", diferente de "${diag.causa_raiz_id}". Mesma descrição, causa diferente não é duplicata.`);
  }
  return null;
}

/** Desvio de requisito muda o destino: sai da equipe de desenvolvimento e vai para o produto. */
function roteamentoPorClassificacao(ctx) {
  if (!ehEscritaDeDiagnostico(ctx)) return null;
  const diag = interpretarDiagnostico(ctx);
  if (diag.classificacao === 'desvio_requisito' && diag.destino !== 'escalada_produto') {
    return violacao('ROTEAMENTO', 'desvio de requisito é escalado ao dono do produto: destino deve ser "escalada_produto".');
  }
  if (diag.classificacao === 'desvio_requisito' && !diag.requisito_origem) {
    return violacao('ROTEAMENTO', 'desvio de requisito exige "requisito_origem" (consulte a matriz de rastreabilidade).');
  }
  return null;
}

/** P1 — correção nunca é aplicada: vira arquivo .patch para revisão humana. */
function propostaSomenteComoPatch(ctx) {
  if (!ehEscrita(ctx) || !estaDentroDe(ctx.caminho, CAMINHOS.propostas)) return null;
  return /\.(patch|diff)$/.test(ctx.caminho) ? null : violacao('P1', 'correção proposta deve ser um arquivo .patch ou .diff para revisão humana.');
}

/** Ao ler o chamado, fixa a severidade que define o teto de tempo (P4). */
function registrarChamadoLido(ctx) {
  if (ctx.ferramenta !== 'Read' || !estaDentroDe(ctx.caminho, CAMINHOS.chamados)) return;
  if (lerEstado(ctx.raiz, AGENTE, 'chamado', null)) return;
  const chamado = lerJsonSeExistir(ctx.raiz, ctx.caminho);
  if (!chamado) return;
  salvarEstado(ctx.raiz, AGENTE, 'chamado', { id: chamado.id || idPeloNomeDoArquivo(ctx.caminho), severidade: chamado.severidade || config(ctx).severidade_padrao });
}

function avaliarParada(ctx) {
  const chamado = lerEstado(ctx.raiz, AGENTE, 'chamado', null);
  if (!chamado) return { pendencias: [`nenhum chamado foi lido em ${CAMINHOS.chamados}`], resultado: 'incompleto', metricas: {} };

  const diag = lerJsonSeExistir(ctx.raiz, `${CAMINHOS.diagnosticos}${chamado.id}.json`);
  const escalouPorPendencia = lerJsonsDoDiretorio(ctx.raiz, CAMINHOS.pendencias).some(
    ({ conteudo }) => conteudo && conteudo.agente_origem === AGENTE && conteudo.chamado_id === chamado.id,
  );
  const pendencias = diag || escalouPorPendencia ? [] : [`chamado ${chamado.id} sem diagnóstico em ${CAMINHOS.diagnosticos} nem pendência de escalada`];
  const execucao = lerEstado(ctx.raiz, AGENTE, 'execucao', { inicio: new Date().toISOString() });
  return {
    pendencias,
    resultado: diag && diag.classificacao !== 'escalada' ? 'sucesso' : 'escalado',
    metricas: {
      chamado: chamado.id,
      severidade: chamado.severidade,
      classificacao: diag ? diag.classificacao : null,
      destino: diag ? diag.destino : null,
      minutos_ate_diagnostico: Number(((Date.now() - Date.parse(execucao.inicio)) / MILISSEGUNDOS_POR_MINUTO).toFixed(1)),
    },
  };
}

module.exports = {
  verificacoes: [
    disjuntorPorSeveridade,
    bashSomenteComandos('P1', (ctx) => config(ctx).comandos_permitidos),
    escritaSomenteEm('P1', [CAMINHOS.diagnosticos, CAMINHOS.pendencias, CAMINHOS.propostas], 'produção e código são somente leitura para este agente.'),
    artefatoSomentePorWrite('ESQUEMA', [CAMINHOS.diagnosticos]),
    propostaSomenteComoPatch,
    mascaramentoAntesDoContexto,
    hipoteseExigeEvidencia,
    duplicataExigeMesmaCausa,
    roteamentoPorClassificacao,
  ],
  aposExecutar: registrarChamadoLido,
  avaliarParada,
};
