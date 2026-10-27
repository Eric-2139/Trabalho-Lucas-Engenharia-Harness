'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { criarProjeto, escrever, gate, pos, parada, ferramenta, caminhoAbsoluto } = require('./apoio');

const LOG_BRUTO = [
  '2026-09-10T14:00:01 INFO consulta cliente=Maria email=maria@ex.com',
  '2026-09-10T14:00:05 ERROR timeout ao chamar servico-enriquecimento apos 30000ms',
  '2026-09-10T14:00:06 INFO memoria heap=41%',
].join('\n');

function projeto() {
  return criarProjeto({
    'harness/chamados/5507.json': { id: '5507', severidade: 'media', texto: 'a tela de consulta de cliente trava e depois dá erro' },
    'harness/diagnosticos/4412.json': { chamado_id: '4412', causa_raiz_id: 'indice-ausente-clientes' },
    'harness/logs/brutos/consulta-cliente.log': LOG_BRUTO,
    'src/ConsultaCliente.php': '<?php\n$http->get($url); // sem timeout\n',
  });
}

function diagnostico(sobrescrever = {}) {
  return {
    chamado_id: '5507',
    componente: 'ConsultaCliente',
    classificacao: 'desvio_requisito',
    destino: 'escalada_produto',
    requisito_origem: 'RNF-01',
    causa_raiz_id: 'timeout-ausente-enriquecimento',
    hipoteses: [
      { enunciado: 'dependência externa lenta', status: 'confirmada_parcial', evidencias: [{ tipo: 'log', referencia: 'consulta-cliente.log:2' }] },
      { enunciado: 'exaustão de memória', status: 'descartada', evidencias: [{ tipo: 'log', referencia: 'consulta-cliente.log:3' }] },
    ],
    ...sobrescrever,
  };
}

function gravar(raiz, diag) {
  return gate(raiz, 'manutencao', 'Write', { file_path: caminhoAbsoluto(raiz, `harness/diagnosticos/${diag.chamado_id}.json`), content: JSON.stringify(diag) });
}

test('P1: comando fora da lista (reiniciar serviço) é bloqueado; buscar-log é permitido', () => {
  const raiz = projeto();
  assert.equal(gate(raiz, 'manutencao', 'Bash', { command: 'systemctl restart consulta' }).codigo, 2);
  assert.equal(gate(raiz, 'manutencao', 'Bash', { command: 'node .claude/ferramentas/buscar-log.js --servico consulta-cliente; rm -rf /' }).codigo, 2, 'encadeamento');
  assert.equal(gate(raiz, 'manutencao', 'Bash', { command: 'node .claude/ferramentas/buscar-log.js --servico consulta-cliente' }).codigo, 0);
});

test('P1: escrita em código é bloqueada; proposta só como .patch', () => {
  const raiz = projeto();
  assert.equal(gate(raiz, 'manutencao', 'Edit', { file_path: caminhoAbsoluto(raiz, 'src/ConsultaCliente.php'), old_string: 'a', new_string: 'b' }).codigo, 2);
  assert.equal(gate(raiz, 'manutencao', 'Write', { file_path: caminhoAbsoluto(raiz, 'harness/propostas/5507.php'), content: 'x' }).codigo, 2);
  assert.equal(gate(raiz, 'manutencao', 'Write', { file_path: caminhoAbsoluto(raiz, 'harness/propostas/5507.patch'), content: 'diff' }).codigo, 0);
});

test('P2: log bruto não entra no contexto por Read nem por Grep amplo', () => {
  const raiz = projeto();
  assert.equal(gate(raiz, 'manutencao', 'Read', { file_path: caminhoAbsoluto(raiz, 'harness/logs/brutos/consulta-cliente.log') }).codigo, 2);
  assert.equal(gate(raiz, 'manutencao', 'Grep', { pattern: 'timeout' }).codigo, 2, 'Grep sem path varre tudo');
  assert.equal(gate(raiz, 'manutencao', 'Grep', { pattern: 'timeout', path: 'harness' }).codigo, 2, 'ancestral dos brutos');
  assert.equal(gate(raiz, 'manutencao', 'Grep', { pattern: 'timeout', path: 'src' }).codigo, 0);
});

test('P2: buscar-log entrega linhas mascaradas com referência arquivo:linha', () => {
  const r = ferramenta(projeto(), 'buscar-log', ['--servico', 'consulta-cliente', '--inicio', '2026-09-10T14:00:00', '--fim', '2026-09-10T14:00:10']);
  assert.equal(r.codigo, 0, r.stderr);
  assert.doesNotMatch(r.stdout, /maria@ex\.com|Maria/);
  assert.match(r.stdout, /consulta-cliente\.log:2 \| .*timeout/);
});

test('P3: diagnóstico com evidência verificável é permitido', () => {
  assert.equal(gravar(projeto(), diagnostico()).codigo, 0);
});

test('P3: evidência que aponta para linha inexistente é bloqueada', () => {
  const diag = diagnostico();
  diag.hipoteses[0].evidencias[0].referencia = 'consulta-cliente.log:999';
  const r = gravar(projeto(), diag);
  assert.equal(r.codigo, 2);
  assert.match(r.stderr, /P3/);
});

test('P3: classificação final sem hipótese confirmada é bloqueada', () => {
  const r = gravar(projeto(), diagnostico({
    classificacao: 'bug_codigo', destino: 'correcao_proposta',
    hipoteses: [{ enunciado: 'palpite', status: 'especulacao', evidencias: [] }],
  }));
  assert.equal(r.codigo, 2);
  assert.match(r.stderr, /P3/);
});

test('P5: mesma descrição com causa diferente não fecha como duplicata', () => {
  const r = gravar(projeto(), diagnostico({ classificacao: 'duplicata', destino: 'fechado_duplicata', duplicata_de: '4412' }));
  assert.equal(r.codigo, 2);
  assert.match(r.stderr, /P5/);
});

test('roteamento: desvio de requisito não pode ir para a equipe de desenvolvimento', () => {
  const r = gravar(projeto(), diagnostico({ destino: 'escalada_desenvolvimento' }));
  assert.equal(r.codigo, 2);
  assert.match(r.stderr, /escalada_produto/);
});

test('P4: após o teto da severidade só é possível escalar', () => {
  const raiz = projeto();
  const haUmaHora = new Date(Date.now() - 60 * 60_000).toISOString();
  escrever(raiz, 'harness/estado/manutencao/execucao.json', JSON.stringify({ id: 'execucao-de-teste', inicio: haUmaHora, bloqueios_parada: 0 }));
  pos(raiz, 'manutencao', 'Read', { file_path: caminhoAbsoluto(raiz, 'harness/chamados/5507.json') });
  const r = gate(raiz, 'manutencao', 'Grep', { pattern: 'x', path: 'src' });
  assert.equal(r.codigo, 2);
  assert.match(r.stderr, /teto de 20 min/);
  assert.equal(gravar(raiz, diagnostico({ classificacao: 'escalada', destino: 'escalada_desenvolvimento' })).codigo, 0);
});

test('parada: exige diagnóstico ou escalada do chamado lido', () => {
  const raiz = projeto();
  pos(raiz, 'manutencao', 'Read', { file_path: caminhoAbsoluto(raiz, 'harness/chamados/5507.json') });
  assert.equal(parada(raiz, 'manutencao').codigo, 2);
  escrever(raiz, 'harness/diagnosticos/5507.json', JSON.stringify(diagnostico()));
  assert.equal(parada(raiz, 'manutencao').codigo, 0);
});
