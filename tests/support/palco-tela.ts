/**
 * Apoio para os testes de tela que desenham com Konva (TelaJogo).
 *
 * Os testes não importam `konva` (não é dependência da raiz). Para clicar num objeto desenhado,
 * disparam no elemento do palco (`.konvajs-content`) a mesma sequência de eventos de um clique
 * real (pointerdown, mousedown, pointerup, mouseup) nas coordenadas em pixels do objeto. No jsdom,
 * `getBoundingClientRect` devolve zero, então clientX/clientY = coordenada no palco. O hit-test é o
 * do próprio Konva, sobre o canvas 2D do pacote `canvas` (ADR-016).
 *
 * As coordenadas vêm de `calcularPalco`/`paraPixels` do pacote (ADR-006: x/y é o canto superior
 * esquerdo; rotação em graus, sentido horário, em torno desse canto).
 */
import { calcularPalco, paraPixels } from '@math-scape/player';
import type { Retangulo } from '@math-scape/player/contrato';
import type { ObjetoJogo, ParedeJogo } from '@math-scape/schema/contrato';
import { act, fireEvent } from '@testing-library/react';

export interface Ponto {
  x: number;
  y: number;
}

/** Define o tamanho da janela do jsdom (innerWidth/innerHeight) e avisa com `resize`. */
export function definirJanela(largura: number, altura: number): void {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: largura });
  Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: altura });
  window.dispatchEvent(new Event('resize'));
}

/** Elemento do palco Konva (o que recebe os eventos de ponteiro). */
export function conteudoDoPalco(): HTMLElement {
  const el = document.querySelector<HTMLElement>('.konvajs-content');
  if (!el) throw new Error('A tela não tem palco Konva (.konvajs-content).');
  return el;
}

/** Retângulo 16:9 da sala dentro do palco desenhado (o palco pode ser o próprio retângulo ou o contêiner). */
export function palcoDaTela(): Retangulo {
  const el = conteudoDoPalco();
  const largura = Number.parseFloat(el.style.width);
  const altura = Number.parseFloat(el.style.height);
  if (!(largura > 0 && altura > 0)) {
    throw new Error(
      `Palco Konva sem tamanho (${el.style.width} × ${el.style.height}) numa janela de ${window.innerWidth}×${window.innerHeight}.`,
    );
  }
  return calcularPalco(largura, altura);
}

/** Espera o Konva desenhar (o batchDraw roda no próximo quadro de animação). */
export async function esperarDesenho(): Promise<void> {
  await act(async () => {
    await new Promise<void>((resolver) => {
      requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(() => resolver())));
    });
  });
}

/** Clique de mouse no ponto (x, y) do palco. */
export function clicarNoPalco(ponto: Ponto): void {
  const el = conteudoDoPalco();
  const base = { clientX: ponto.x, clientY: ponto.y, bubbles: true, cancelable: true, button: 0 };
  const ponteiro = { pointerId: 1, pointerType: 'mouse', isPrimary: true };
  fireEvent.pointerDown(el, { ...base, ...ponteiro, buttons: 1 });
  fireEvent.mouseDown(el, { ...base, buttons: 1 });
  fireEvent.pointerUp(el, { ...base, ...ponteiro, buttons: 0 });
  fireEvent.mouseUp(el, { ...base, buttons: 0 });
}

function radianos(graus: number): number {
  return (graus * Math.PI) / 180;
}

/** Ponto do objeto nas frações (fx, fy) da largura e da altura, já com a rotação em torno do canto. */
function pontoLocal(objeto: ObjetoJogo, fx: number, fy: number, palco: Retangulo): Ponto {
  const r = paraPixels(objeto, palco);
  const u = fx * r.largura;
  const v = fy * r.altura;
  const t = radianos(objeto.rotacao);
  return { x: r.x + u * Math.cos(t) - v * Math.sin(t), y: r.y + u * Math.sin(t) + v * Math.cos(t) };
}

function contem(objeto: ObjetoJogo, p: Ponto, palco: Retangulo): boolean {
  const r = paraPixels(objeto, palco);
  const t = -radianos(objeto.rotacao);
  const dx = p.x - r.x;
  const dy = p.y - r.y;
  const u = dx * Math.cos(t) - dy * Math.sin(t);
  const v = dx * Math.sin(t) + dy * Math.cos(t);
  return u >= 0 && u <= r.largura && v >= 0 && v <= r.altura;
}

/** Raio em pixels, em torno do canto superior direito de enigma com dica, onde o ícone de dica pode estar. */
const RAIO_ICONE_DICA = 64;

function pertoDoIconeDeDica(objeto: ObjetoJogo, p: Ponto, palco: Retangulo): boolean {
  if (objeto.interacao.tipo !== 'enigma' || objeto.interacao.dica === undefined) return false;
  const canto = pontoLocal(objeto, 1, 0, palco);
  return Math.abs(p.x - canto.x) < RAIO_ICONE_DICA && Math.abs(p.y - canto.y) < RAIO_ICONE_DICA;
}

/** Objetos na ordem de desenho: por `camada`, e na ordem do documento dentro da mesma camada. */
function ordemDeDesenho(parede: ParedeJogo): ObjetoJogo[] {
  return parede.objetos
    .map((objeto, indice) => ({ objeto, indice }))
    .sort((a, b) => a.objeto.camada - b.objeto.camada || a.indice - b.indice)
    .map(({ objeto }) => objeto);
}

const FRACOES = [0.5, 0.4, 0.6, 0.3, 0.7, 0.2, 0.8, 0.15, 0.85];

/**
 * Um ponto dentro do objeto que nenhum objeto desenhado depois cobre e longe dos ícones de dica.
 * É ali que o clique do jogador cai sobre esse objeto.
 */
export function pontoDoObjeto(parede: ParedeJogo, objetoId: string, palco: Retangulo): Ponto {
  const ordem = ordemDeDesenho(parede);
  const indice = ordem.findIndex((o) => o.id === objetoId);
  const alvo = ordem[indice];
  if (!alvo) throw new Error(`Objeto ${objetoId} não está na parede.`);
  const acima = ordem.slice(indice + 1);
  for (const fy of FRACOES) {
    for (const fx of FRACOES) {
      const p = pontoLocal(alvo, fx, fy, palco);
      if (acima.some((o) => contem(o, p, palco))) continue;
      if (parede.objetos.some((o) => pertoDoIconeDeDica(o, p, palco))) continue;
      return p;
    }
  }
  throw new Error(`Objeto ${objetoId} está todo coberto por outros objetos.`);
}

/** Clica no objeto da parede, na tela de jogo montada. */
export function clicarObjeto(parede: ParedeJogo, objetoId: string): void {
  clicarNoPalco(pontoDoObjeto(parede, objetoId, palcoDaTela()));
}

/** Texto com espaços e quebras de linha colapsados. */
export function normalizar(texto: string): string {
  return texto.replace(/\s+/g, ' ').trim();
}
