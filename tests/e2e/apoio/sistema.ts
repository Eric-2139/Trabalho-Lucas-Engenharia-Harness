/**
 * Apoio dos testes de sistema: preparo pela Api e clique em objetos do palco Konva.
 * O palco é um canvas: não há elemento por objeto, então o clique usa a geometria do documento da fase.
 * Dados sintéticos: e-mails em exemplo.test, senhas descartáveis.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { type APIRequestContext, type Page, request as fabricaRequest, expect } from '@playwright/test';

export const EDITOR = 'http://localhost:5173';
export const PLAYER = 'http://localhost:5174';
export const LEGADO = 'http://localhost:5175';
const API = `${PLAYER}/api`;

export type Parede = 'frente' | 'direita' | 'fundo' | 'esquerda' | 'teto';
export interface ObjetoFase {
  id: string;
  x: number;
  y: number;
  largura: number;
  altura: number;
  imagem?: string;
  rotacao?: number;
  camada?: number;
  interacao: Record<string, unknown>;
}
export interface Fase {
  versaoSchema: number;
  titulo: string;
  senha: string | null;
  paredes: Record<Parede, { fundo: string | null; objetos: ObjetoFase[] }>;
}

export const lerEscola = (): Fase =>
  JSON.parse(readFileSync(resolve(import.meta.dirname, '../../../fases-exemplo/escola-01.json'), 'utf8'));

/** Marca única sem relógio nem sorteio: processo do worker + contador. O banco nasce vazio a cada execução do contêiner. */
let contador = 0;
export function marca(): string {
  contador += 1;
  return `${process.pid}-${contador}`;
}

export function pessoaNova(): { nome: string; email: string; senha: string } {
  const m = marca();
  return { nome: `Pessoa Sintética ${m}`, email: `pessoa-${m}@exemplo.test`, senha: `senha-sintetica-${m}` };
}

/** Conta nova com sessão própria, separada do navegador do teste. */
export async function contaNaApi(): Promise<{ api: APIRequestContext; pessoa: ReturnType<typeof pessoaNova> }> {
  const pessoa = pessoaNova();
  const api = await fabricaRequest.newContext();
  const cadastro = await api.post(`${API}/auth/cadastro`, { data: pessoa });
  expect(cadastro.status(), await cadastro.text()).toBe(201);
  const login = await api.post(`${API}/auth/login`, { data: { email: pessoa.email, senha: pessoa.senha } });
  expect(login.status()).toBe(204);
  return { api, pessoa };
}

export async function importarFase(api: APIRequestContext, fase: Fase): Promise<string> {
  const r = await api.post(`${API}/fases/importar`, { data: { formato: 'math-scape-fase', versao: 1, fase, imagens: {} } });
  expect(r.status(), await r.text()).toBe(201);
  return ((await r.json()) as { id: string }).id;
}

export async function publicarFase(api: APIRequestContext, id: string): Promise<void> {
  const r = await api.post(`${API}/fases/${id}/publicar`);
  expect(r.status(), await r.text()).toBe(200);
}

/** Fase publicada por uma conta própria. Cada caso usa a sua, porque o limite de tentativas é por fase e IP. */
export async function publicarEscola(titulo?: string): Promise<{ id: string; fase: Fase; api: APIRequestContext }> {
  const fase = lerEscola();
  if (titulo) fase.titulo = titulo;
  const { api } = await contaNaApi();
  const id = await importarFase(api, fase);
  await publicarFase(api, id);
  return { id, fase, api };
}

/** Sessão da conta no navegador do teste, pela tela de login. */
export async function entrarNoEditor(page: Page, pessoa: { email: string; senha: string }): Promise<void> {
  await page.goto(EDITOR);
  const form = page.getByRole('form', { name: 'Entrar' });
  await form.getByLabel('E-mail').fill(pessoa.email);
  await form.getByLabel('Senha').fill(pessoa.senha);
  await form.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('button', { name: 'Nova fase' })).toBeVisible();
}

export function palco(larguraStage: number, alturaStage: number) {
  const limitadoPelaLargura = larguraStage * 9 <= alturaStage * 16;
  const largura = limitadoPelaLargura ? larguraStage : (alturaStage * 16) / 9;
  const altura = limitadoPelaLargura ? (larguraStage * 9) / 16 : alturaStage;
  return { x: (larguraStage - largura) / 2, y: (alturaStage - altura) / 2, largura, altura };
}

/** Pixel do objeto, relativo ao Stage. `fx` e `fy` escolhem o ponto dentro dele (padrão: centro). */
export async function pontoDoObjeto(page: Page, objeto: Pick<ObjetoFase, 'x' | 'y' | 'largura' | 'altura'>, fx = 0.5, fy = 0.5) {
  const caixa = await page.locator('.konvajs-content').first().boundingBox();
  if (!caixa) throw new Error('palco não encontrado');
  const p = palco(caixa.width, caixa.height);
  return { x: p.x + (objeto.x + objeto.largura * fx) * p.largura, y: p.y + (objeto.y + objeto.altura * fy) * p.altura };
}

export async function clicarObjeto(page: Page, objeto: Pick<ObjetoFase, 'x' | 'y' | 'largura' | 'altura'>, fx = 0.5, fy = 0.5) {
  const ponto = await pontoDoObjeto(page, objeto, fx, fy);
  await page.locator('.konvajs-content').first().click({ position: ponto });
}

export function objetoDe(fase: Fase, parede: Parede, id: string): ObjetoFase {
  const objeto = fase.paredes[parede].objetos.find((o) => o.id === id);
  if (!objeto) throw new Error(`objeto ${id} não existe na parede ${parede}`);
  return objeto;
}

/** Fase mínima válida para preparar casos: paredes vazias, sem porta. */
export function faseVazia(titulo: string, senha = '12345'): Fase {
  const parede = () => ({ fundo: null, objetos: [] as ObjetoFase[] });
  return { versaoSchema: 1, titulo, senha, paredes: { frente: parede(), direita: parede(), fundo: parede(), esquerda: parede(), teto: parede() } };
}

export function objetoSimples(id: string, x: number, y: number, interacao: Record<string, unknown> = { tipo: 'decoracao' }, camada = 0): ObjetoFase {
  return { id, imagem: 'sprite:janela', x, y, largura: 0.14, altura: 0.25, rotacao: 0, camada, interacao };
}

/** Documento gravado da fase, lido com a sessão do navegador do teste. */
export async function lerDocumento(page: Page, id: string): Promise<{ documento: Fase; publicada: boolean; alteracoesNaoPublicadas: boolean }> {
  const r = await page.request.get(`${EDITOR}/api/fases/${id}`);
  expect(r.status()).toBe(200);
  return r.json();
}

/** Conta nova, logada no navegador, com a fase aberta na Edição. */
export async function abrirNaEdicao(page: Page, fase: Fase) {
  const { api, pessoa } = await contaNaApi();
  const id = await importarFase(api, fase);
  await entrarNoEditor(page, pessoa);
  await page.goto(`${EDITOR}/fases/${id}`);
  await expect(page.getByRole('tab', { name: 'Frente' })).toBeVisible();
  return { id, api, pessoa };
}

/** Arrasta dentro do palco, em pixels relativos ao Stage. */
export async function arrastarNoPalco(page: Page, de: { x: number; y: number }, para: { x: number; y: number }, passos = 12): Promise<void> {
  const conteudo = page.locator('.konvajs-content').first();
  await conteudo.scrollIntoViewIfNeeded();
  const caixa = await conteudo.boundingBox();
  if (!caixa) throw new Error('palco não encontrado');
  await page.mouse.move(caixa.x + de.x, caixa.y + de.y);
  await page.mouse.down();
  await page.mouse.move(caixa.x + para.x, caixa.y + para.y, { steps: passos });
  await page.mouse.up();
}
