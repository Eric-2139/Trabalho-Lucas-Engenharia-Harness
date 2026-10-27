'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { mascarar } = require('../lib/mascaramento');
const { interpretarJunit, pertenceAoRequisito } = require('../lib/junit');
const { casaAlgumGlob } = require('../lib/glob');
const { encontrarTermos, contemTrecho, primeiroPadraoQueCasa } = require('../lib/texto');
const { extrairAnotacoes, montarMatrizRequisitoTeste } = require('../lib/anotacoes');
const { validarRequisito } = require('../lib/esquemas');

test('mascaramento remove e-mail, CPF, telefone e campos identificadores', () => {
  const linha = '2026-09-01T10:00:00 cliente=Maria email=maria@ex.com cpf=123.456.789-09 tel (11) 91234-5678';
  const mascarada = mascarar(linha);
  assert.doesNotMatch(mascarada, /maria@ex\.com|123\.456\.789-09|91234-5678|Maria/);
  assert.match(mascarada, /^2026-09-01T10:00:00/, 'o carimbo de tempo precisa sobreviver para correlação');
});

test('JUnit: distingue passou, falhou e pulado', () => {
  const xml = `<testsuite>
    <testcase classname="Auth" name="test_RF09_aceita_8"/>
    <testcase classname="Auth" name="test_RF09_rejeita_7"><failure>esperado</failure></testcase>
    <testcase classname="Export" name="test_RF07_pdf"><skipped/></testcase>
  </testsuite>`;
  const resultados = interpretarJunit(xml);
  assert.equal(resultados.get('Auth::test_RF09_aceita_8'), 'passou');
  assert.equal(resultados.get('Auth::test_RF09_rejeita_7'), 'falhou');
  assert.equal(resultados.get('Export::test_RF07_pdf'), 'pulado');
});

test('pertenceAoRequisito não confunde RF-09 com RF-091', () => {
  assert.ok(pertenceAoRequisito('Auth::test_RF09_x', 'RF-09'));
  assert.ok(pertenceAoRequisito('Auth::rf_09_x', 'RF-09'));
  assert.ok(!pertenceAoRequisito('Auth::test_RF091_x', 'RF-09'));
});

test('glob: ** atravessa diretórios e * não', () => {
  assert.ok(casaAlgumGlob('src/auth/service/Login.php', ['src/auth/**']));
  assert.ok(!casaAlgumGlob('src/auth/service/Login.php', ['src/auth/*']));
  assert.ok(casaAlgumGlob('src/shared/password.ts', ['src/shared/password.*']));
});

test('termos críticos casam por palavra inteira e ignoram acento', () => {
  assert.equal(encontrarTermos('O operador pode EXCLUIR registros de cliente', { destrutiva: ['excluir'] }).length, 1);
  assert.equal(encontrarTermos('Autenticação por senha', { auth: ['autenticacao'] }).length, 1);
  assert.equal(encontrarTermos('relogin automático', { auth: ['login'] }).length, 0);
});

test('contemTrecho tolera quebra de linha e caixa', () => {
  assert.ok(contemTrecho('O sistema deve\n  responder RÁPIDO às consultas', 'responder rápido às consultas'));
  assert.ok(!contemTrecho('O sistema deve responder', 'p95 abaixo de 2s'));
});

test('padrão com (?i) do config vira regex sem distinção de caixa', () => {
  assert.ok(primeiroPadraoQueCasa('PASSWORD = "supersecreta"', ["(?i)password\\s*=\\s*\"[^\"]{6,}\""]));
});

test('matriz requisito→teste conta os três tipos de caso', () => {
  const conteudo = '// @req RF-09 @tipo feliz\n// @req RF-09 @tipo borda\n# @req RF-09 @tipo negativo\n';
  assert.equal(extrairAnotacoes(conteudo).length, 3);
  const matriz = montarMatrizRequisitoTeste([{ arquivo: 'tests/a.test', conteudo }]);
  assert.deepEqual(matriz['RF-09'], { feliz: 1, borda: 1, negativo: 1, arquivos: ['tests/a.test'] });
});

test('esquema: CONFLITO exige conflita_com e RNF exige subcategoria', () => {
  const base = { id: 'RNF-01', texto: 't', categoria: 'nao_funcional', trecho_fonte: 't', criterio_aceitacao: '', status: 'CONFLITO' };
  const erros = validarRequisito(base);
  assert.ok(erros.some((e) => e.includes('conflita_com')));
  assert.ok(erros.some((e) => e.includes('subcategoria')));
});
