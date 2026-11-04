'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { criarProjeto, escrever, ler, existe, gate, ferramenta, caminhoAbsoluto } = require('./apoio');

/**
 * Suíte falsa: lê src/senha.txt e src/util.txt e escreve um JUnit.
 * - RF09 passa quando senha.txt contém "8";
 * - o teste de importação (baseline_verde) quebra se util.txt contiver "quebrado".
 */
const SUITE_FALSA = `
const fs = require('fs');
const senha = fs.readFileSync('src/senha.txt', 'utf8');
const util = fs.readFileSync('src/util.txt', 'utf8');
const caso = (nome, ok) => '<testcase classname="T" name="' + nome + '">' + (ok ? '' : '<failure/>') + '</testcase>';
fs.mkdirSync('harness/estado', { recursive: true });
fs.writeFileSync('harness/estado/junit.xml', '<testsuite>' + caso('test_RF09_rejeita_7', senha.includes('8')) + caso('test_importacao', !util.includes('quebrado')) + '</testsuite>');
process.exit(senha.includes('8') && !util.includes('quebrado') ? 0 : 1);
`;

function projeto() {
  return criarProjeto(
    {
      'harness/baseline/requisitos.json': { versao: '1', requisitos: [{ id: 'RF-09', status: 'OK', texto: 'senha mínima', criterio_aceitacao: '7 rejeita, 8 aceita' }] },
      'harness/matriz/rastreabilidade.json': { versao_baseline: '1', mapeamentos: [{ req_id: 'RF-09', componente_id: 'AuthService', decisao_id: null }] },
      'harness/projeto/componentes/AuthService.json': { id: 'AuthService', arquivos_previstos: ['src/*.txt'] },
      'src/senha.txt': 'minimo=7',
      'src/util.txt': 'ok',
      'suite-falsa.js': SUITE_FALSA,
    },
    // Isola o teste do produto: suíte falsa e nenhuma análise estática (a do produto roda num contêiner que este projeto temporário não tem).
    (config) => ({
      ...config,
      execucao_testes: { ...config.execucao_testes, comando: 'node suite-falsa.js', exigir_conteiner_sem_rede: false },
      codificacao: { ...config.codificacao, comando_analise: '' },
    }),
  );
}

function editar(raiz, arquivo, conteudo) {
  const r = gate(raiz, 'codificacao', 'Write', { file_path: caminhoAbsoluto(raiz, arquivo), content: conteudo });
  if (r.codigo === 0) escrever(raiz, arquivo, conteudo); // simula a ferramenta executando após o gate
  return r;
}

test('sem tarefa iniciada, edição é bloqueada', () => {
  const r = editar(projeto(), 'src/senha.txt', 'minimo=8');
  assert.equal(r.codigo, 2);
  assert.match(r.stderr, /iniciar-tarefa/);
});

test('iniciar-tarefa grava baseline_verde e escopo a partir dos artefatos', () => {
  const raiz = projeto();
  const r = ferramenta(raiz, 'iniciar-tarefa', ['--requisito', 'RF-09']);
  assert.equal(r.codigo, 0, r.stderr);
  const tarefa = JSON.parse(ler(raiz, 'harness/estado/codificacao/tarefa.json'));
  assert.deepEqual(tarefa.baseline_verde, ['T::test_importacao']);
  assert.deepEqual(tarefa.arquivos_previstos, ['src/*.txt']);
});

test('P1/P2/P4: fora do escopo, na suíte, em manifesto ou com segredo é bloqueado', () => {
  const raiz = projeto();
  ferramenta(raiz, 'iniciar-tarefa', ['--requisito', 'RF-09']);
  assert.match(editar(raiz, 'src/outro/modulo.js', 'x').stderr, /P1/);
  assert.match(editar(raiz, 'tests/SenhaTest.php', 'x').stderr, /P2/);
  assert.match(editar(raiz, 'package.json', '{}').stderr, /P1/);
  assert.match(editar(raiz, 'src/senha.txt', 'api_key = "abcdef123456"').stderr, /P4/);
});

test('P3: regressão no baseline_verde é revertida automaticamente pelo harness', () => {
  const raiz = projeto();
  ferramenta(raiz, 'iniciar-tarefa', ['--requisito', 'RF-09']);
  assert.equal(editar(raiz, 'src/senha.txt', 'minimo=8').codigo, 0);
  assert.equal(editar(raiz, 'src/util.txt', 'quebrado').codigo, 0);

  const r = ferramenta(raiz, 'executar-suite', ['--agente', 'codificacao']);
  assert.equal(r.codigo, 0, 'reversão é resultado da ferramenta, não falha');
  assert.match(r.stdout, /REVERTIDA/);
  assert.equal(ler(raiz, 'src/util.txt'), 'ok', 'arquivo compartilhado restaurado');
  assert.equal(ler(raiz, 'src/senha.txt'), 'minimo=7', 'a diferença inteira do ciclo é revertida');
});

test('P3: arquivo novo criado no ciclo é apagado na reversão', () => {
  const raiz = projeto();
  ferramenta(raiz, 'iniciar-tarefa', ['--requisito', 'RF-09']);
  editar(raiz, 'src/novo.txt', 'x');
  editar(raiz, 'src/util.txt', 'quebrado');
  ferramenta(raiz, 'executar-suite', ['--agente', 'codificacao']);
  assert.ok(!existe(raiz, 'src/novo.txt'));
});

test('ciclo verde encerra com sucesso na parada', () => {
  const raiz = projeto();
  ferramenta(raiz, 'iniciar-tarefa', ['--requisito', 'RF-09']);
  editar(raiz, 'src/senha.txt', 'minimo=8');
  const r = ferramenta(raiz, 'executar-suite', ['--agente', 'codificacao']);
  assert.equal(r.codigo, 0, r.stdout + r.stderr);
  const tarefa = JSON.parse(ler(raiz, 'harness/estado/codificacao/tarefa.json'));
  assert.equal(tarefa.tentativas, 1);
  assert.equal(tarefa.ultimo_resultado.requisito_verde, true);
});

test('P5: no teto de tentativas, edição e execução são bloqueadas', () => {
  const raiz = projeto();
  ferramenta(raiz, 'iniciar-tarefa', ['--requisito', 'RF-09']);
  const tarefa = JSON.parse(ler(raiz, 'harness/estado/codificacao/tarefa.json'));
  escrever(raiz, 'harness/estado/codificacao/tarefa.json', JSON.stringify({ ...tarefa, tentativas: 5 }));
  assert.match(editar(raiz, 'src/senha.txt', 'minimo=8').stderr, /P5/);
  assert.equal(ferramenta(raiz, 'executar-suite', ['--agente', 'codificacao']).codigo, 2);
});

test('disjuntor: suíte vermelha sai com 0 nos dois agentes; só falha de ambiente sai com 1', () => {
  // Saída ≠ 0 vira PostToolUseFailure e conta no disjuntor de 3 falhas: vermelho é resultado esperado, não falha.
  const raiz = projeto();
  ferramenta(raiz, 'iniciar-tarefa', ['--requisito', 'RF-09']);
  const codificacao = ferramenta(raiz, 'executar-suite', ['--agente', 'codificacao']);
  assert.equal(codificacao.codigo, 0, codificacao.stderr);
  assert.match(codificacao.stdout, /requisito VERMELHO/);
  const testes = ferramenta(raiz, 'executar-suite', ['--agente', 'testes']);
  assert.equal(testes.codigo, 0, testes.stderr);
  assert.match(testes.stdout, /SUÍTE VERMELHA/);

  const ambiente = criarProjeto({ 'ambiente-falso.js': 'process.exit(3);' }, (config) => ({
    ...config,
    execucao_testes: { ...config.execucao_testes, comando: 'node ambiente-falso.js', exigir_conteiner_sem_rede: false },
  }));
  const r = ferramenta(ambiente, 'executar-suite', ['--agente', 'testes']);
  assert.equal(r.codigo, 1);
  assert.match(r.stdout, /FALHA DE AMBIENTE/);
});

test('JUnit de execução anterior não é reaproveitado quando o ambiente falha', () => {
  const raiz = projeto();
  escrever(raiz, 'suite-falsa.js', 'process.exit(3);'); // ex.: imagem velha após mudar o lockfile
  escrever(raiz, 'harness/estado/junit.xml', '<testsuite><testcase classname="T" name="test_importacao"></testcase></testsuite>');
  const r = ferramenta(raiz, 'iniciar-tarefa', ['--requisito', 'RF-09']);
  assert.equal(r.codigo, 2);
  assert.match(r.stderr, /JUnit não encontrado/);
  assert.ok(!existe(raiz, 'harness/estado/codificacao/tarefa.json'), 'sem baseline_verde montado sobre resultado velho');
});

test('isolamento: comando de testes fora de contêiner sem rede é recusado quando exigido', () => {
  const raiz = criarProjeto({}, (config) => ({ ...config, execucao_testes: { ...config.execucao_testes, comando: 'npm test' } }));
  const r = ferramenta(raiz, 'executar-suite', ['--agente', 'testes']);
  assert.equal(r.codigo, 2);
  assert.match(r.stderr, /--network none/);
});
