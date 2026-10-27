'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { criarProjeto, escrever, gate, parada, caminhoAbsoluto } = require('./apoio');

const BASELINE = {
  versao: '2026-09-22.1',
  requisitos: [
    { id: 'RF-07', categoria: 'funcional', status: 'OK' },
    { id: 'RNF-01', categoria: 'nao_funcional', subcategoria: 'desempenho', status: 'AMBIGUO' },
  ],
};

function projeto() {
  return criarProjeto({
    'harness/baseline/requisitos.json': BASELINE,
    'harness/matriz/rastreabilidade.json': { versao_baseline: '2026-09-22.1', mapeamentos: [{ req_id: 'RF-07', componente_id: 'ExportService', decisao_id: null }] },
    'harness/projeto/componentes/ExportService.json': { id: 'ExportService', arquivos_previstos: ['src/export/**'] },
    'harness/projeto/componentes/AuditLogger.json': { id: 'AuditLogger', arquivos_previstos: ['src/audit/**'] },
  });
}

function lacuna(sobrescrever = {}) {
  return {
    id: 'LAC-001',
    tipo: 'componente_sem_ancora',
    itens: ['AuditLogger'],
    justificativa: 'Nenhum requisito de auditoria no baseline; hipótese de requisito implícito de conformidade.',
    proposta: 'confirmar com compliance qual requisito o AuditLogger atende',
    bloqueante: false,
    dono_humano: 'arquiteto',
    versao_baseline: '2026-09-22.1',
    status: 'rascunho',
    ...sobrescrever,
  };
}

function registrar(raiz, l) {
  return gate(raiz, 'projeto', 'Write', { file_path: caminhoAbsoluto(raiz, `harness/lacunas/${l.id}.json`), content: JSON.stringify(l) });
}

test('P1: escrita em artefato de projeto é bloqueada; lacuna válida é permitida', () => {
  const raiz = projeto();
  assert.equal(gate(raiz, 'projeto', 'Write', { file_path: caminhoAbsoluto(raiz, 'harness/projeto/componentes/Novo.json'), content: '{}' }).codigo, 2);
  assert.equal(registrar(raiz, lacuna()).codigo, 0);
});

test('P1: lacuna precisa nascer rascunho e com dono humano', () => {
  const r = registrar(projeto(), lacuna({ status: 'aprovada', dono_humano: '' }));
  assert.equal(r.codigo, 2);
  assert.match(r.stderr, /dono_humano/);
});

test('P3: componente sem âncora não pode ser proposto para remoção', () => {
  const r = registrar(projeto(), lacuna({ proposta: 'remover o AuditLogger, que não tem requisito' }));
  assert.equal(r.codigo, 2);
  assert.match(r.stderr, /P3/);
});

test('P4: RNF crítico sem decisão precisa ser bloqueante', () => {
  const raiz = projeto();
  const rnf = lacuna({ id: 'LAC-002', tipo: 'rnf_sem_decisao', itens: ['RNF-01'], proposta: 'aguardar PEND-001', pendencia_vinculada: 'PEND-001' });
  assert.match(registrar(raiz, rnf).stderr, /P4/);
  assert.equal(registrar(raiz, { ...rnf, bloqueante: true }).codigo, 0);
});

test('P2: baseline alterado durante a análise bloqueia tudo', () => {
  const raiz = projeto();
  assert.equal(gate(raiz, 'projeto', 'Read', { file_path: caminhoAbsoluto(raiz, 'harness/baseline/requisitos.json') }).codigo, 0);
  escrever(raiz, 'harness/baseline/requisitos.json', JSON.stringify({ ...BASELINE, versao: '2026-09-22.2' }));
  const r = gate(raiz, 'projeto', 'Read', { file_path: caminhoAbsoluto(raiz, 'harness/baseline/requisitos.json') });
  assert.equal(r.codigo, 2);
  assert.match(r.stderr, /P2/);
});

test('parada: recalcula a consistência e exige lacuna para tudo que não fecha', () => {
  const raiz = projeto();
  const negada = parada(raiz, 'projeto');
  assert.equal(negada.codigo, 2);
  assert.match(negada.stderr, /RNF-01/);
  assert.match(negada.stderr, /AuditLogger/);

  escrever(raiz, 'harness/lacunas/LAC-001.json', JSON.stringify(lacuna()));
  escrever(raiz, 'harness/lacunas/LAC-002.json', JSON.stringify(lacuna({ id: 'LAC-002', tipo: 'rnf_sem_decisao', itens: ['RNF-01'], bloqueante: true })));
  assert.equal(parada(raiz, 'projeto').codigo, 0);
});
