'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { criarProjeto, escrever, ler, gate, pos, caminhoAbsoluto } = require('./apoio');

const BASELINE = {
  versao: '2026-09-22.1',
  requisitos: [
    { id: 'RF-09', status: 'OK', criterio_aceitacao: 'senha com 7 caracteres é rejeitada; com 8 é aceita' },
    { id: 'RNF-01', status: 'AMBIGUO', criterio_aceitacao: '' },
  ],
};

const TESTE_VALIDO = [
  '// @req RF-09 @tipo feliz',
  'test_RF09_aceita_8() { assertTrue(valida("12345678")); }',
  '// @req RF-09 @tipo borda',
  'test_RF09_rejeita_7() { assertFalse(valida("1234567")); }',
].join('\n');

function projeto(ajustar) {
  return criarProjeto({ 'harness/baseline/requisitos.json': BASELINE }, ajustar);
}

function escreverTeste(raiz, conteudo, arquivo = 'tests/SenhaTest.php') {
  return gate(raiz, 'testes', 'Write', { file_path: caminhoAbsoluto(raiz, arquivo), content: conteudo });
}

test('P3: teste anotado para requisito OK é permitido e a matriz é derivada pelo harness', () => {
  const raiz = projeto();
  assert.equal(escreverTeste(raiz, TESTE_VALIDO).codigo, 0);
  escrever(raiz, 'tests/SenhaTest.php', TESTE_VALIDO);
  pos(raiz, 'testes', 'Write', { file_path: caminhoAbsoluto(raiz, 'tests/SenhaTest.php'), content: TESTE_VALIDO });
  const matriz = JSON.parse(ler(raiz, 'harness/matriz/requisito-teste.json'));
  assert.equal(matriz.requisitos['RF-09'].feliz, 1);
  assert.equal(matriz.requisitos['RF-09'].borda, 1);
});

test('P3: teste sem anotação de requisito é bloqueado', () => {
  const r = escreverTeste(projeto(), 'test_x() { assertTrue(true); }');
  assert.equal(r.codigo, 2);
  assert.match(r.stderr, /P3/);
});

test('P3: teste para requisito AMBIGUO é bloqueado com orientação de devolução', () => {
  const r = escreverTeste(projeto(), '// @req RNF-01 @tipo feliz\ntest_RNF01() { assertTrue(tempo() < 2000); }');
  assert.equal(r.codigo, 2);
  assert.match(r.stderr, /devolucao_criterio/);
});

test('P4: aleatoriedade sem semente e relógio do sistema são bloqueados', () => {
  const raiz = projeto();
  assert.equal(escreverTeste(raiz, `${TESTE_VALIDO}\n$x = Math.random();`).codigo, 2);
  assert.equal(escreverTeste(raiz, `${TESTE_VALIDO}\n$agora = Date.now();`).codigo, 2);
});

test('P2: com a suíte vermelha, alterar asserção existente é bloqueado; adicionar caso é permitido', () => {
  const raiz = projeto();
  escrever(raiz, 'tests/SenhaTest.php', TESTE_VALIDO);
  escrever(raiz, 'harness/estado/compartilhado/suite.json', JSON.stringify({ vermelha: true }));
  const enfraquecer = gate(raiz, 'testes', 'Edit', {
    file_path: caminhoAbsoluto(raiz, 'tests/SenhaTest.php'),
    old_string: 'assertFalse(valida("1234567"))',
    new_string: 'assertTrue(valida("1234567"))',
  });
  assert.equal(enfraquecer.codigo, 2);
  assert.match(enfraquecer.stderr, /P2/);

  const adicionar = gate(raiz, 'testes', 'Edit', {
    file_path: caminhoAbsoluto(raiz, 'tests/SenhaTest.php'),
    old_string: 'test_RF09_rejeita_7() { assertFalse(valida("1234567")); }',
    new_string: 'test_RF09_rejeita_7() { assertFalse(valida("1234567")); }\n// @req RF-09 @tipo negativo\ntest_RF09_rejeita_vazia() { assertFalse(valida("")); }',
  });
  assert.equal(adicionar.codigo, 0, adicionar.stderr);
});

test('contrato: leitura da implementação é bloqueada quando configurada', () => {
  const raiz = projeto((config) => ({ ...config, testes: { ...config.testes, caminhos_implementacao_bloqueados: ['src/'] } }));
  assert.equal(gate(raiz, 'testes', 'Read', { file_path: caminhoAbsoluto(raiz, 'src/Senha.php') }).codigo, 2);
});

test('P1: só o comando de suíte do harness roda no Bash', () => {
  const raiz = projeto();
  assert.equal(gate(raiz, 'testes', 'Bash', { command: 'vendor/bin/phpunit' }).codigo, 2);
  assert.equal(gate(raiz, 'testes', 'Bash', { command: 'node .claude/ferramentas/executar-suite.js --agente testes' }).codigo, 0);
});
