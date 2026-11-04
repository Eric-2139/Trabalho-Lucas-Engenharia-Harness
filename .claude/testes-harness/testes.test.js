'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { criarProjeto, escrever, ler, gate, pos, parada, ferramenta, caminhoAbsoluto } = require('./apoio');

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
  assert.equal(gate(raiz, 'testes', 'Bash', { command: 'node .claude/ferramentas/definir-escopo.js RF-09' }).codigo, 0);
  assert.equal(gate(raiz, 'testes', 'Bash', { command: 'node .claude/ferramentas/definir-escopo.js RF-09; rm -rf tests' }).codigo, 2);
});

/** Dois requisitos OK: RF-09 coberto pelos três tipos, RF-10 sem nenhum teste. */
function projetoComDoisRequisitos() {
  const raiz = criarProjeto({
    'harness/baseline/requisitos.json': {
      versao: '1',
      requisitos: [
        { id: 'RF-09', status: 'OK', criterio_aceitacao: '7 rejeita, 8 aceita' },
        { id: 'RF-10', status: 'OK', criterio_aceitacao: 'grava em até 30 s' },
      ],
    },
    'harness/estado/testes/execucao.json': { id: 'execucao-de-teste', inicio: '2026-01-01T00:00:00.000Z', bloqueios_parada: 0 },
  });
  const conteudo = `${TESTE_VALIDO}\n// @req RF-09 @tipo negativo\ntest_RF09_rejeita_vazia() { assertFalse(valida("")); }`;
  escrever(raiz, 'tests/SenhaTest.php', conteudo);
  pos(raiz, 'testes', 'Write', { file_path: caminhoAbsoluto(raiz, 'tests/SenhaTest.php'), content: conteudo });
  return raiz;
}

test('parada: sem escopo, requisito OK sem os três tipos nega a parada', () => {
  const r = parada(projetoComDoisRequisitos(), 'testes');
  assert.equal(r.codigo, 2);
  assert.match(r.stderr, /RF-10/);
});

test('parada: com escopo, só os requisitos da rodada são cobrados', () => {
  const raiz = projetoComDoisRequisitos();
  assert.equal(ferramenta(raiz, 'definir-escopo', ['RF-09']).codigo, 0);
  const r = parada(raiz, 'testes');
  assert.equal(r.codigo, 0, r.stderr);
  const relatorio = JSON.parse(ler(raiz, `harness/relatorios/${fs.readdirSync(caminhoAbsoluto(raiz, 'harness/relatorios'))[0]}`));
  assert.equal(relatorio.resultado, 'sucesso');
  assert.deepEqual(relatorio.metricas.escopo, ['RF-09']);
});

test('escopo: id fora do baseline e segunda definição na mesma execução são recusados', () => {
  const raiz = projetoComDoisRequisitos();
  assert.equal(ferramenta(raiz, 'definir-escopo', ['RF-99']).codigo, 2);
  assert.equal(ferramenta(raiz, 'definir-escopo', ['RF-09', 'RF-10']).codigo, 0);
  const encolher = ferramenta(raiz, 'definir-escopo', ['RF-09']);
  assert.equal(encolher.codigo, 2);
  assert.match(encolher.stderr, /um escopo por execução/);
});
