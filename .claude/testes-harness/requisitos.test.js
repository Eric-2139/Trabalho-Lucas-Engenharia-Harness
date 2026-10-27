'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { criarProjeto, escrever, ler, existe, gate, pos, parada, caminhoAbsoluto } = require('./apoio');

const DOCUMENTO = [
  'Especificação — gestão de clientes',
  'o sistema deve responder rápido às consultas de cliente',
  'o operador pode excluir registros de cliente',
  'relatórios devem ser exportados em PDF',
].join('\n');

function projeto() {
  return criarProjeto({ 'harness/entrada/especificacao.md': DOCUMENTO });
}

function requisito(sobrescrever = {}) {
  return {
    id: 'RF-07',
    texto: 'Relatórios são exportados em PDF.',
    categoria: 'funcional',
    subcategoria: null,
    criterio_aceitacao: 'Ao exportar, o arquivo gerado é um PDF válido.',
    trecho_fonte: 'relatórios devem ser exportados em PDF',
    status: 'OK',
    ...sobrescrever,
  };
}

function gravarRequisito(raiz, req) {
  return gate(raiz, 'requisitos', 'Write', {
    file_path: caminhoAbsoluto(raiz, `harness/rascunho/requisitos/${req.id}.json`),
    content: JSON.stringify(req),
  });
}

test('P1: escrita fora do rascunho é bloqueada', () => {
  const raiz = projeto();
  const r = gate(raiz, 'requisitos', 'Write', { file_path: caminhoAbsoluto(raiz, 'src/app.js'), content: 'x' });
  assert.equal(r.codigo, 2);
  assert.match(r.stderr, /P1/);
});

test('H1: baseline é protegido mesmo com caminho relativo', () => {
  const raiz = projeto();
  const r = gate(raiz, 'requisitos', 'Write', { file_path: 'harness/baseline/requisitos.json', content: '{}' });
  assert.equal(r.codigo, 2);
  assert.match(r.stderr, /H1/);
});

test('requisito válido com fonte literal é permitido', () => {
  assert.equal(gravarRequisito(projeto(), requisito()).codigo, 0);
});

test('P2: trecho_fonte que não está no documento é bloqueado', () => {
  const r = gravarRequisito(projeto(), requisito({ trecho_fonte: 'p95 abaixo de 2s' }));
  assert.equal(r.codigo, 2);
  assert.match(r.stderr, /P2/);
});

test('P2: AMBIGUO com critério preenchido (precedente usado como fonte) é bloqueado', () => {
  const r = gravarRequisito(projeto(), requisito({
    id: 'RNF-01', categoria: 'nao_funcional', subcategoria: 'desempenho',
    trecho_fonte: 'responder rápido às consultas de cliente', status: 'AMBIGUO', criterio_aceitacao: 'p95 < 2s',
  }));
  assert.equal(r.codigo, 2);
  assert.match(r.stderr, /P2/);
});

test('P4: requisito com dado pessoal e operação destrutiva não fecha como OK', () => {
  const raiz = projeto();
  const critico = requisito({ id: 'RF-04', texto: 'O operador pode excluir registros de cliente.', trecho_fonte: 'o operador pode excluir registros de cliente' });
  const bloqueado = gravarRequisito(raiz, critico);
  assert.equal(bloqueado.codigo, 2);
  assert.match(bloqueado.stderr, /P4/);
  assert.equal(gravarRequisito(raiz, { ...critico, status: 'OK_PENDENTE_REVISAO' }).codigo, 0);
});

test('P5: regravar o mesmo id guarda a versão anterior no histórico', () => {
  const raiz = projeto();
  escrever(raiz, 'harness/rascunho/requisitos/RF-07.json', JSON.stringify(requisito()));
  assert.equal(gravarRequisito(raiz, requisito({ texto: 'versão 2' })).codigo, 0);
  assert.ok(existe(raiz, 'harness/rascunho/historico/RF-07.v1.json'));
});

test('leitura do documento exige limit e é sequencial', () => {
  const raiz = projeto();
  const documento = caminhoAbsoluto(raiz, 'harness/entrada/especificacao.md');
  assert.equal(gate(raiz, 'requisitos', 'Read', { file_path: documento }).codigo, 2, 'sem limit');
  assert.equal(gate(raiz, 'requisitos', 'Read', { file_path: documento, offset: 3, limit: 2 }).codigo, 2, 'pulando trecho');
  assert.equal(gate(raiz, 'requisitos', 'Read', { file_path: documento, offset: 1, limit: 2 }).codigo, 0);
});

test('P3: estouro do teto de iterações bloqueia com pedido de relatório parcial', () => {
  const raiz = projeto();
  escrever(raiz, 'harness/estado/requisitos/execucao.json', JSON.stringify({ id: 'execucao-de-teste', inicio: new Date().toISOString(), bloqueios_parada: 0 }));
  escrever(raiz, 'harness/estado/requisitos/orcamento.json', JSON.stringify({ iteracoes: 40, falhas_consecutivas: {}, esgotado: null }));
  const r = gate(raiz, 'requisitos', 'Glob', { pattern: '*' });
  assert.equal(r.codigo, 2);
  assert.match(r.stderr, /ORCAMENTO/);
});

test('P3: três falhas consecutivas da mesma ferramenta disparam o disjuntor', () => {
  const raiz = projeto();
  for (let i = 0; i < 3; i += 1) pos(raiz, 'requisitos', 'Grep', { pattern: 'x' }, true);
  const r = gate(raiz, 'requisitos', 'Grep', { pattern: 'x' });
  assert.equal(r.codigo, 2);
  assert.match(r.stderr, /disjuntor/);
});

test('parada: nega enquanto o documento não foi lido até o fim; permite e grava relatório depois', () => {
  const raiz = projeto();
  const documento = caminhoAbsoluto(raiz, 'harness/entrada/especificacao.md');
  pos(raiz, 'requisitos', 'Read', { file_path: documento, offset: 1, limit: 2 });
  const negada = parada(raiz, 'requisitos');
  assert.equal(negada.codigo, 2);
  assert.match(negada.stderr, /linha 2 de 4/);

  pos(raiz, 'requisitos', 'Read', { file_path: documento, offset: 3, limit: 2 });
  escrever(raiz, 'harness/rascunho/requisitos/RF-07.json', JSON.stringify(requisito()));
  const permitida = parada(raiz, 'requisitos');
  assert.equal(permitida.codigo, 0, permitida.stderr);
  const log = ler(raiz, 'harness/log_decisoes.jsonl');
  assert.match(log, /"acao":"encerrado"/);
});

test('parada: requisito AMBIGUO sem pendência impede o encerramento', () => {
  const raiz = projeto();
  pos(raiz, 'requisitos', 'Read', { file_path: caminhoAbsoluto(raiz, 'harness/entrada/especificacao.md'), offset: 1, limit: 80 });
  escrever(raiz, 'harness/rascunho/requisitos/RNF-01.json', JSON.stringify(requisito({
    id: 'RNF-01', categoria: 'nao_funcional', subcategoria: 'desempenho',
    trecho_fonte: 'responder rápido às consultas de cliente', status: 'AMBIGUO', criterio_aceitacao: '',
  })));
  const r = parada(raiz, 'requisitos');
  assert.equal(r.codigo, 2);
  assert.match(r.stderr, /RNF-01 está AMBIGUO sem pendência/);
});

test('pendência: agente_origem errado e status respondida são bloqueados', () => {
  const raiz = projeto();
  const pendencia = { id: 'PEND-001', tipo: 'ambiguidade', agente_origem: 'testes', req_ids: ['RNF-01'], pergunta: 'p95?', opcoes: ['<2s', '<500ms'], status: 'respondida' };
  const r = gate(raiz, 'requisitos', 'Write', { file_path: caminhoAbsoluto(raiz, 'harness/pendencias/PEND-001.json'), content: JSON.stringify(pendencia) });
  assert.equal(r.codigo, 2);
  assert.match(r.stderr, /agente_origem/);
  assert.match(r.stderr, /status/);
});

test('fail-closed: config corrompido bloqueia em vez de liberar', () => {
  const raiz = projeto();
  escrever(raiz, 'harness/config.json', '{ quebrado');
  const r = gate(raiz, 'requisitos', 'Glob', { pattern: '*' });
  assert.equal(r.codigo, 2);
  assert.match(r.stderr, /FALHA_INTERNA/);
});
