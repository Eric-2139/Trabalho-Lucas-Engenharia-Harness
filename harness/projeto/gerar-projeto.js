'use strict';
/**
 * Gerador do projeto (arquiteto). Uso: node harness/projeto/gerar-projeto.js
 *
 * A matriz M abaixo é a fonte única de rastreabilidade requisito → componente → decisão.
 * O gerador confere a consistência e, só se tudo fechar, escreve:
 * - harness/projeto/componentes/*.json (decisões derivadas da matriz);
 * - o cabeçalho "Decisões:" dos contratos e das especificações de módulos (fase 3);
 * - o cabeçalho "Requisitos:" das ADRs e as tabelas do Documento de Arquitetura;
 * - harness/matriz/rastreabilidade.json.
 * Criado na fase 2 (LAC-017, 022, 025, 026), versionado e estendido na fase 3.
 */
const fs = require('fs');
const path = require('path');
const RAIZ = path.resolve(__dirname, '..', '..');
const escrever = (rel, obj) => { const d = path.join(RAIZ, rel); fs.mkdirSync(path.dirname(d), { recursive: true }); fs.writeFileSync(d, `${JSON.stringify(obj, null, 2)}\n`); };

// ADR-015 e ADR-016 são decisões de processo (testabilidade no harness): sem requisito, fora da matriz, valem para todos os componentes.
const ADRS_PROCESSO = ['ADR-015', 'ADR-016'];

// arquivos_previstos = escopo de escrita do agente 4; contrato/ e configurações ficam fora (ADR-015).
const componentes = [
  { id: 'SchemaFase', descricao: 'Schema Zod da fase, tipos, validação de jogabilidade, projeção de jogo e fase original migrada', camada: 'dominio_compartilhado',
    arquivos_previstos: ['packages/schema/src/**', 'fases-exemplo/**'], contrato: 'harness/projeto/contratos/schema.md',
    especificacao: 'harness/projeto/programa/modulos-schema.md', codigo_contrato: ['packages/schema/contrato/', 'packages/schema/biblioteca/'] },
  { id: 'Editor', descricao: 'App do criador: login, minhas fases, canvas das 5 paredes, biblioteca, propriedades, desfazer/refazer, salvamento, modo testar, exportar/importar, conta', camada: 'apresentacao',
    arquivos_previstos: ['apps/editor/src/**', 'apps/editor/index.html', 'apps/editor/public/**'], contrato: 'harness/projeto/contratos/editor.md',
    especificacao: 'harness/projeto/programa/modulos-editor.md', codigo_contrato: ['apps/editor/contrato/'] },
  { id: 'Player', descricao: 'Motor de interações reutilizável e app público (inicial, Escolher Fase, jogo)', camada: 'apresentacao',
    arquivos_previstos: ['packages/player/src/**', 'apps/player/src/**', 'apps/player/index.html', 'apps/player/public/**'], contrato: 'harness/projeto/contratos/player.md',
    especificacao: 'harness/projeto/programa/modulos-player.md', codigo_contrato: ['packages/player/contrato/', 'packages/player/recursos/', 'apps/player/contrato/'] },
  { id: 'Api', descricao: 'Fastify: contas e sessão, CRUD de fases, publicar, exportar/importar, upload, verificação de respostas', camada: 'servico',
    arquivos_previstos: ['apps/api/src/**'], contrato: 'harness/projeto/contratos/api.md',
    especificacao: 'harness/projeto/programa/modulos-api.md', codigo_contrato: ['apps/api/contrato/'] },
  { id: 'Banco', descricao: 'PostgreSQL via Prisma: esquema, migrations e seed da fase original', camada: 'dados',
    arquivos_previstos: ['apps/api/prisma/**'], contrato: 'harness/projeto/contratos/banco.md',
    especificacao: 'harness/projeto/programa/modulos-banco.md', codigo_contrato: [] },
];

// [req, componente, decisão|null]
const M = [
  ['RF-01', 'Api', 'ADR-004'], ['RF-01', 'Editor', 'ADR-004'], ['RF-01', 'Banco', 'ADR-004'],
  ['RF-02', 'Api', 'ADR-005'], ['RF-02', 'Editor', 'ADR-008'], ['RF-02', 'Banco', 'ADR-002'],
  ['RF-03', 'Editor', 'ADR-006'],
  ['RF-04', 'Editor', 'ADR-012'], ['RF-04', 'SchemaFase', 'ADR-012'],
  ['RF-05', 'Editor', 'ADR-007'], ['RF-05', 'SchemaFase', 'ADR-001'],
  ['RF-06', 'Api', 'ADR-010'], ['RF-06', 'Editor', 'ADR-010'],
  ['RF-07', 'SchemaFase', 'ADR-001'],
  ['RF-08', 'SchemaFase', 'ADR-001'], ['RF-08', 'Editor', 'ADR-001'],
  ['RF-09', 'Editor', 'ADR-008'],
  ['RF-10', 'Editor', 'ADR-002'], ['RF-10', 'Editor', 'ADR-011'], ['RF-10', 'SchemaFase', 'ADR-011'], ['RF-10', 'Api', 'ADR-002'],
  ['RF-11', 'Editor', 'ADR-009'], ['RF-11', 'Player', 'ADR-009'], ['RF-11', 'Api', 'ADR-003'],
  ['RF-11', 'Editor', 'ADR-003'], ['RNF-04', 'Editor', 'ADR-003'], ['RF-18', 'Player', 'ADR-012'], // LAC-024
  ['RF-02', 'SchemaFase', 'ADR-002'], ['RF-10', 'Api', 'ADR-011'], // LAC-026 (citadas no corpo dos contratos)
  ['RF-12', 'SchemaFase', 'ADR-001'], ['RF-12', 'Api', 'ADR-001'], ['RF-12', 'Editor', 'ADR-001'],
  ['RF-13', 'Api', 'ADR-002'], ['RF-13', 'Player', null], ['RF-13', 'Banco', 'ADR-002'],
  ['RF-14', 'Api', 'ADR-005'], ['RF-14', 'Api', 'ADR-013'], ['RF-14', 'SchemaFase', 'ADR-013'], ['RF-14', 'SchemaFase', 'ADR-001'], ['RF-14', 'Editor', null],
  ['RF-15', 'Player', 'ADR-009'], ['RF-15', 'Api', 'ADR-003'],
  ['RF-16', 'Player', 'ADR-009'], ['RF-16', 'SchemaFase', 'ADR-001'],
  ['RF-17', 'Player', 'ADR-009'], ['RF-17', 'SchemaFase', 'ADR-001'],
  ['RF-18', 'SchemaFase', 'ADR-001'], ['RF-18', 'SchemaFase', 'ADR-012'], ['RF-18', 'Banco', null],
  ['RF-19', 'Api', 'ADR-004'], ['RF-19', 'Banco', 'ADR-004'], ['RF-19', 'Editor', null],
  ['RNF-01', 'Editor', 'ADR-006'], ['RNF-01', 'Player', 'ADR-006'],
  ['RNF-02', 'SchemaFase', 'ADR-006'], ['RNF-02', 'Editor', 'ADR-006'], ['RNF-02', 'Player', 'ADR-006'],
  ['RNF-03', 'Editor', 'ADR-007'],
  ['RNF-04', 'Api', 'ADR-003'], ['RNF-04', 'Player', 'ADR-003'], ['RNF-04', 'SchemaFase', 'ADR-003'],
  ['RNF-05', 'Api', 'ADR-004'], ['RNF-05', 'Banco', 'ADR-004'],
  ['RNF-06', 'Api', 'ADR-004'], ['RNF-06', 'Banco', 'ADR-004'],
  ['RNF-07', 'Editor', 'ADR-014'], ['RNF-07', 'Player', 'ADR-014'],
  ['RNF-08', 'Editor', 'ADR-011'],
  ['RNF-09', 'SchemaFase', 'ADR-001'], ['RNF-09', 'Api', 'ADR-001'],
  // segunda rodada (LAC-017): todo requisito citado no cabeçalho de uma ADR tem o par na matriz
  ['RF-19', 'Api', 'ADR-005'], ['RF-19', 'Api', 'ADR-013'], ['RNF-09', 'Api', 'ADR-013'],
  ['RNF-09', 'Editor', 'ADR-011'], ['RF-05', 'Editor', 'ADR-011'], ['RF-08', 'Editor', 'ADR-011'],
  ['RF-06', 'SchemaFase', 'ADR-012'], ['RF-06', 'Banco', 'ADR-010'], ['RF-19', 'Api', 'ADR-010'], ['RF-14', 'Editor', 'ADR-013'],
  // terceira rodada (LAC-018..022)
  ['RF-18', 'Player', 'ADR-009'], ['RF-18', 'Api', 'ADR-003'],
  ['RF-13', 'Editor', 'ADR-002'], ['RF-15', 'SchemaFase', 'ADR-003'],
  // fase 3 (Projeto do Programa): ADR-017, Api no mesmo site dos apps
  ['RF-01', 'Editor', 'ADR-017'], ['RF-01', 'Api', 'ADR-017'], ['RNF-05', 'Api', 'ADR-017'], ['RF-13', 'Player', 'ADR-017'],
];

// LAC-022: as decisões de cada componente são derivadas da matriz (fonte única)
for (const c of componentes) c.decisoes = [...new Set(M.filter(([, id, d]) => id === c.id && d).map(([, , d]) => d))].sort();

const baseline = JSON.parse(fs.readFileSync(path.join(RAIZ, 'harness/baseline/requisitos.json'), 'utf8'));
const criticas = ['seguranca', 'desempenho', 'disponibilidade'];
const erros = [];
const ids = new Set(baseline.requisitos.map((r) => r.id));
const compIds = new Set(componentes.map((c) => c.id));
for (const [r, c, d] of M) {
  if (!ids.has(r)) erros.push(`${r} não está no baseline`);
  if (!compIds.has(c)) erros.push(`componente ${c} inexistente`);
  if (d && !fs.existsSync(path.join(RAIZ, 'harness/projeto/decisoes', `${d}.md`))) erros.push(`${d} sem arquivo`);
}
for (const r of baseline.requisitos) {
  if (!M.some(([id]) => id === r.id)) erros.push(`${r.id} sem componente`);
  if (r.categoria === 'nao_funcional' && criticas.includes(r.subcategoria) && !M.some(([id, , d]) => id === r.id && d)) erros.push(`${r.id} crítico sem decisão`);
}
for (const c of componentes) if (!M.some(([, id]) => id === c.id)) erros.push(`${c.id} sem requisito`);
const dirAdr = path.join(RAIZ, 'harness/projeto/decisoes');
const arquivosAdr = fs.readdirSync(dirAdr).filter((f) => /^ADR-\d{3}\.md$/.test(f));
for (const f of arquivosAdr) {
  const adr = f.replace('.md', '');
  const cabecalho = fs.readFileSync(path.join(dirAdr, f), 'utf8').match(/Requisitos: (.*)/)[1];
  if (ADRS_PROCESSO.includes(adr)) {
    if (!cabecalho.startsWith('nenhum')) erros.push(`${adr} é decisão de processo e deve dizer "Requisitos: nenhum (...)"`);
    if (M.some(([, , d]) => d === adr)) erros.push(`${adr} é decisão de processo e não entra na matriz`);
    continue;
  }
  if (!M.some(([, , d]) => d === adr)) erros.push(`${adr} sem nenhum mapeamento na matriz (ADR órfã)`);
  for (const r of cabecalho.split(', ')) if (!M.some(([id, , d]) => id === r && d === adr)) erros.push(`${adr} cita ${r} sem mapeamento`);
}
for (const c of componentes) for (const d of c.decisoes) if (!M.some(([, id, dd]) => id === c.id && dd === d)) erros.push(`${c.id} cita ${d} sem mapeamento`);
// LAC-026: toda ADR citada no corpo de um contrato precisa estar entre as decisões do componente (vindas da matriz).
// Fase 3: a mesma regra vale para a especificação de módulos, que pode citar também as decisões de processo.
const CABECALHO_DECISOES = /^Decisões: [^\n]*$/m;
for (const c of componentes) {
  const corpo = fs.readFileSync(path.join(RAIZ, c.contrato), 'utf8').replace(/^Decisões: [^.]*\./m, '');
  for (const adr of new Set(corpo.match(/ADR-\d{3}/g) || [])) {
    if (!c.decisoes.includes(adr)) erros.push(`${c.contrato} cita ${adr}, que não está na matriz para ${c.id}`);
  }
  const especificacao = fs.readFileSync(path.join(RAIZ, c.especificacao), 'utf8');
  if (!CABECALHO_DECISOES.test(especificacao)) erros.push(`${c.especificacao} sem linha "Decisões:"`);
  for (const adr of new Set(especificacao.replace(CABECALHO_DECISOES, '').match(/ADR-\d{3}/g) || [])) {
    if (!c.decisoes.includes(adr) && !ADRS_PROCESSO.includes(adr)) erros.push(`${c.especificacao} cita ${adr}, que não está na matriz para ${c.id}`);
  }
}
// Fase 3: o escopo de cada componente precisa bater com o que o gate do agente 3 trata como contrato e como implementação.
const configHarness = JSON.parse(fs.readFileSync(path.join(RAIZ, 'harness/config.json'), 'utf8'));
for (const c of componentes) {
  for (const dir of c.codigo_contrato) {
    if (!fs.existsSync(path.join(RAIZ, dir))) erros.push(`${c.id}: pasta de contrato ${dir} não existe`);
    if (!configHarness.testes.caminhos_contrato.includes(dir)) erros.push(`${c.id}: ${dir} fora de testes.caminhos_contrato no config`);
  }
  for (const glob of c.arquivos_previstos.filter((g) => /\/(src|prisma)\/\*\*$/.test(g))) {
    const prefixo = glob.replace(/\*\*$/, '');
    if (!configHarness.testes.caminhos_implementacao_bloqueados.includes(prefixo)) erros.push(`${c.id}: ${prefixo} fora de testes.caminhos_implementacao_bloqueados no config`);
  }
}
if (erros.length) { console.error(erros.join('\n')); process.exit(1); }

for (const c of componentes) escrever(`harness/projeto/componentes/${c.id}.json`, c);

// Cabeçalho "Decisões:" dos contratos e coluna de decisões da seção 2 do Documento de Arquitetura seguem a mesma fonte.
const docArq = path.join(RAIZ, 'harness/projeto/arquitetura.md');
let linhasArq = fs.readFileSync(docArq, 'utf8').split('\n');
for (const c of componentes) {
  const lista = c.decisoes.join(', ');
  const arqContrato = path.join(RAIZ, c.contrato);
  fs.writeFileSync(arqContrato, fs.readFileSync(arqContrato, 'utf8').replace(/^Decisões: [^.]*\./m, `Decisões: ${lista}.`));
  const arqEspecificacao = path.join(RAIZ, c.especificacao);
  fs.writeFileSync(arqEspecificacao, fs.readFileSync(arqEspecificacao, 'utf8').replace(CABECALHO_DECISOES, `Decisões: ${lista}. Processo: ${ADRS_PROCESSO.join(', ')}.`));
  linhasArq = linhasArq.map((l) => {
    if (!l.startsWith('| `' + c.id + '` |')) return l;
    const celulas = l.split(' | ');
    celulas[celulas.length - 1] = `${lista} |`;
    return celulas.join(' | ');
  });
}
// LAC-025: o cabeçalho "Requisitos:" de cada ADR e a §9 do Documento de Arquitetura também saem da matriz.
// (A checagem acima já garantiu que tudo o que o autor da ADR citou está na matriz.)
const ordemReq = (a, b) => (a.startsWith('RNF') - b.startsWith('RNF')) || Number(a.split('-')[1]) - Number(b.split('-')[1]);
for (const f of arquivosAdr) {
  const adr = f.replace('.md', '');
  if (ADRS_PROCESSO.includes(adr)) continue;
  const reqsMatriz = [...new Set(M.filter(([, , d]) => d === adr).map(([r]) => r))].sort(ordemReq).join(', ');
  const arqAdr = path.join(dirAdr, f);
  fs.writeFileSync(arqAdr, fs.readFileSync(arqAdr, 'utf8').replace(/Requisitos: .*/, `Requisitos: ${reqsMatriz}`));
  linhasArq = linhasArq.map((l) => {
    if (!l.startsWith(`| ${adr} |`)) return l;
    const celulas = l.split(' | ');
    celulas[celulas.length - 1] = `${reqsMatriz} |`;
    return celulas.join(' | ');
  });
}
fs.writeFileSync(docArq, linhasArq.join('\n'));
escrever('harness/matriz/rastreabilidade.json', {
  versao_baseline: baseline.versao,
  atualizado_em: new Date().toISOString(),
  responsavel: 'Eric (arquiteto)',
  mapeamentos: M.map(([req_id, componente_id, decisao_id]) => ({ req_id, componente_id, decisao_id })),
});
console.log(`${componentes.length} componentes, ${M.length} mapeamentos, ${ids.size} requisitos cobertos`);
