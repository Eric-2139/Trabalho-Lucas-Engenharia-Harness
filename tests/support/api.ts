/**
 * Apoio aos testes de integração da Api (contrato harness/projeto/contratos/api.md):
 * pessoas sintéticas, login devolvendo o cookie `sid` e chamadas às rotas de fases.
 * Sem asserções: falha de preparo lança erro com a resposta, para o caso ficar vermelho
 * com a causa à vista.
 */
import type { construirApp } from '@math-scape/api';
import { NOME_COOKIE_SESSAO } from '@math-scape/api/contrato';

export type App = Awaited<ReturnType<typeof construirApp>>;
export type Resposta = Awaited<ReturnType<App['inject']>>;

export interface Pessoa {
  nome: string;
  email: string;
  senha: string;
}

export const PESSOA_A: Pessoa = { nome: 'Pessoa Sintética A', email: 'pessoa.a@exemplo.test', senha: 'senha-sintetica-a-01' };
export const PESSOA_B: Pessoa = { nome: 'Pessoa Sintética B', email: 'pessoa.b@exemplo.test', senha: 'senha-sintetica-b-02' };

function falhaDePreparo(etapa: string, res: Resposta): Error {
  return new Error(`preparo do teste falhou em ${etapa}: HTTP ${res.statusCode} ${res.body}`);
}

/** Cadastra e faz login; devolve o valor do cookie de sessão. */
export async function entrar(app: App, pessoa: Pessoa): Promise<string> {
  const cadastro = await app.inject({ method: 'POST', url: '/auth/cadastro', payload: { ...pessoa } });
  if (cadastro.statusCode !== 201) throw falhaDePreparo('cadastro', cadastro);
  const login = await app.inject({ method: 'POST', url: '/auth/login', payload: { email: pessoa.email, senha: pessoa.senha } });
  if (login.statusCode !== 204) throw falhaDePreparo('login', login);
  const bruto = login.headers['set-cookie'];
  const linhas = bruto === undefined ? [] : Array.isArray(bruto) ? bruto.map(String) : [String(bruto)];
  const linha = linhas.find((l) => l.trim().startsWith(`${NOME_COOKIE_SESSAO}=`));
  if (!linha) throw falhaDePreparo('login (sem cookie de sessão)', login);
  const par = linha.split(';')[0] ?? '';
  return par.slice(par.indexOf('=') + 1).trim();
}

export function comSessao(sid: string): Record<string, string> {
  return { [NOME_COOKIE_SESSAO]: sid };
}

function sessao(sid: string | undefined) {
  return sid === undefined ? {} : { cookies: comSessao(sid) };
}

// ----- rotas do criador (contrato api.md §Fases do criador) -----

export function listarFases(app: App, sid: string | undefined): Promise<Resposta> {
  return app.inject({ method: 'GET', url: '/fases', ...sessao(sid) });
}

export function criarFase(app: App, sid: string | undefined, titulo: unknown): Promise<Resposta> {
  return app.inject({ method: 'POST', url: '/fases', ...sessao(sid), payload: { titulo } as Record<string, unknown> });
}

export function abrirFase(app: App, sid: string | undefined, id: string): Promise<Resposta> {
  return app.inject({ method: 'GET', url: `/fases/${id}`, ...sessao(sid) });
}

export function salvarFase(app: App, sid: string | undefined, id: string, corpo: unknown): Promise<Resposta> {
  return app.inject({ method: 'PUT', url: `/fases/${id}`, ...sessao(sid), payload: corpo as Record<string, unknown> });
}

export function renomearFase(app: App, sid: string | undefined, id: string, titulo: unknown): Promise<Resposta> {
  return app.inject({ method: 'PATCH', url: `/fases/${id}`, ...sessao(sid), payload: { titulo } as Record<string, unknown> });
}

export function excluirFase(app: App, sid: string | undefined, id: string): Promise<Resposta> {
  return app.inject({ method: 'DELETE', url: `/fases/${id}`, ...sessao(sid) });
}

export function duplicarFase(app: App, sid: string | undefined, id: string): Promise<Resposta> {
  return app.inject({ method: 'POST', url: `/fases/${id}/duplicar`, ...sessao(sid) });
}

export function publicarFase(app: App, sid: string | undefined, id: string): Promise<Resposta> {
  return app.inject({ method: 'POST', url: `/fases/${id}/publicar`, ...sessao(sid) });
}

export function exportarFase(app: App, sid: string | undefined, id: string): Promise<Resposta> {
  return app.inject({ method: 'GET', url: `/fases/${id}/exportar`, ...sessao(sid) });
}

export function importarFase(app: App, sid: string | undefined, envelope: unknown): Promise<Resposta> {
  return app.inject({ method: 'POST', url: '/fases/importar', ...sessao(sid), payload: envelope as Record<string, unknown> });
}

// ----- rotas públicas (contrato api.md §Jogo) -----

export function listarPublicadas(app: App): Promise<Resposta> {
  return app.inject({ method: 'GET', url: '/publicadas' });
}

export function jogoPublicado(app: App, id: string): Promise<Resposta> {
  return app.inject({ method: 'GET', url: `/publicadas/${id}/jogo` });
}

// ----- preparo composto -----

/** Cria a fase e grava o documento dado; devolve id e revisão atual. Lança se alguma etapa falhar. */
export async function criarComDocumento(
  app: App,
  sid: string,
  documento: { titulo: string },
): Promise<{ id: string; revisao: number }> {
  const criada = await criarFase(app, sid, documento.titulo);
  if (criada.statusCode !== 201) throw falhaDePreparo('criar fase', criada);
  const { id, revisao } = criada.json() as { id: string; revisao: number };
  const salva = await salvarFase(app, sid, id, { revisao, documento });
  if (salva.statusCode !== 200) throw falhaDePreparo('salvar fase', salva);
  return { id, revisao: (salva.json() as { revisao: number }).revisao };
}

/** Cria, grava o documento e publica. Lança se alguma etapa falhar. */
export async function criarEPublicar(
  app: App,
  sid: string,
  documento: { titulo: string },
): Promise<{ id: string; revisao: number }> {
  const fase = await criarComDocumento(app, sid, documento);
  const publicada = await publicarFase(app, sid, fase.id);
  if (publicada.statusCode !== 200) throw falhaDePreparo('publicar fase', publicada);
  return fase;
}
