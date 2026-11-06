#!/usr/bin/env node
/**
 * Verificação depois de cada implantação (fase 8). Não deixa dado para trás: cria uma conta descartável,
 * importa e publica a Escola, joga a porta, confere o que não pode vazar e exclui a conta (RF-19 apaga a fase junto).
 *
 *   node infra/producao/verificar-implantacao.mjs https://mathscape.exemplo.com https://editor.mathscape.exemplo.com
 *
 * Teste local com a CA interna do Caddy: NODE_TLS_REJECT_UNAUTHORIZED=0 node ... https://localhost https://editor.localhost
 * Saída: 0 tudo certo · 1 alguma verificação falhou.
 */
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const [player, editor] = process.argv.slice(2).map((u) => u?.replace(/\/$/, ''));
if (!player || !editor) {
  console.error('uso: node verificar-implantacao.mjs <url do player> <url do editor>');
  process.exit(2);
}

let falhas = 0;
const ok = (condicao, texto, detalhe = '') => {
  console.log(`${condicao ? 'ok  ' : 'FALHOU'} ${texto}${!condicao && detalhe ? ` — ${detalhe}` : ''}`);
  if (!condicao) falhas += 1;
};

let cookie = '';
async function api(base, metodo, rota, corpo) {
  const r = await fetch(`${base}/api${rota}`, {
    method: metodo,
    headers: { ...(corpo ? { 'content-type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const texto = await r.text();
  return { status: r.status, headers: r.headers, texto, json: () => JSON.parse(texto) };
}

try {
  for (const [nome, url] of [['player', player], ['editor', editor]]) {
    const r = await fetch(`${url}/`);
    ok(r.status === 200 && (await r.text()).includes('<div id="raiz"'), `${nome} responde em ${url}`);
    ok(new URL(url).protocol === 'https:', `${nome} usa HTTPS`);
  }
  const rotaSpa = await fetch(`${editor}/fases/inexistente`);
  ok(rotaSpa.status === 200, 'rota interna do editor cai no index.html (recarregar não dá 404)');

  const m = randomBytes(6).toString('hex');
  const pessoa = { nome: `Verificação ${m}`, email: `verificacao-${m}@implantacao.invalid`, senha: randomBytes(18).toString('base64url') };
  ok((await api(editor, 'POST', '/auth/cadastro', pessoa)).status === 201, 'cadastro pelo editor (/api reescrito)');
  const login = await api(editor, 'POST', '/auth/login', { email: pessoa.email, senha: pessoa.senha });
  const setCookie = login.headers.get('set-cookie') ?? '';
  ok(login.status === 204, 'login');
  ok(/HttpOnly/i.test(setCookie) && /Secure/i.test(setCookie) && /SameSite=Lax/i.test(setCookie), 'cookie sid HttpOnly, Secure e SameSite=Lax (RNF-05)', setCookie);
  cookie = setCookie.split(';')[0];
  ok((await api(editor, 'GET', '/fases')).status === 200, 'sessão vale nas rotas seguintes do editor (ADR-017)');

  const fase = JSON.parse(readFileSync(resolve(import.meta.dirname, '../../fases-exemplo/escola-01.json'), 'utf8'));
  fase.titulo = `Verificação de implantação ${m}`;
  const imp = await api(editor, 'POST', '/fases/importar', { formato: 'math-scape-fase', versao: 1, fase, imagens: {} });
  ok(imp.status === 201, 'importar a Escola', imp.texto);
  const id = imp.json().id;
  ok((await api(editor, 'POST', `/fases/${id}/publicar`)).status === 200, 'publicar');

  const salvo = cookie;
  cookie = '';
  const lista = await api(player, 'GET', '/publicadas');
  ok(lista.json().some((f) => f.id === id), 'aparece em Escolher Fase sem login (RF-13)');
  const jogo = await api(player, 'GET', `/publicadas/${id}/jogo`);
  ok(jogo.status === 200, 'projeção de jogo');
  ok(!/92139|"respostas"|"revela"|"senha"\s*:\s*"/.test(jogo.texto), 'projeção sem senha nem respostas (RNF-04)');
  const porta = fase.paredes.frente.objetos.find((o) => o.interacao?.tipo === 'porta')
    ?? Object.values(fase.paredes).flatMap((p) => p.objetos).find((o) => o.interacao?.tipo === 'porta');
  const errada = await api(player, 'POST', `/fases/${id}/verificar`, { objetoId: porta.id, resposta: '00000' });
  ok(errada.status === 200 && errada.json().aberta === false, 'senha errada não abre');
  const certa = await api(player, 'POST', `/fases/${id}/verificar`, { objetoId: porta.id, resposta: fase.senha });
  ok(certa.status === 200 && certa.json().aberta === true, 'senha certa abre a porta');

  cookie = salvo;
  ok((await api(editor, 'DELETE', '/auth/conta', { confirmar: true })).status === 204, 'excluir a conta de verificação');
  cookie = '';
  ok(!(await api(player, 'GET', '/publicadas')).json().some((f) => f.id === id), 'a fase da verificação saiu de Escolher Fase');
} catch (erro) {
  ok(false, 'execução', erro instanceof Error ? erro.message : String(erro));
}

console.log(falhas ? `\n${falhas} verificação(ões) falharam.` : '\nImplantação verificada.');
process.exit(falhas ? 1 : 0);
