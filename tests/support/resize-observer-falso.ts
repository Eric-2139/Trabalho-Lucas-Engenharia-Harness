/**
 * ResizeObserver falso para os testes de tela com palco medido no contêiner (LAC-046, Eric em 06/11/2026).
 *
 * O jsdom não faz layout nem tem ResizeObserver. Este falso devolve a medida configurada para qualquer elemento
 * observado (contentRect, borderBoxSize, contentBoxSize e devicePixelContentBoxSize): no `observe`, avisa na hora;
 * `redimensionarConteiner` muda a medida e avisa todos os observadores, como no redimensionamento real.
 * Sem tempo nem sorteio. Chame `restaurarResizeObserver` no afterEach.
 */
import { act } from '@testing-library/react';

export interface Medida {
  largura: number;
  altura: number;
}

type Callback = (entradas: unknown[], observador: unknown) => void;

const escopo = globalThis as unknown as Record<string, unknown>;
const janela = window as unknown as Record<string, unknown>;
const original = { global: escopo.ResizeObserver, janela: janela.ResizeObserver };

let medida: Medida = { largura: 900, altura: 500 };
let observadores: ResizeObserverFalso[] = [];

function entrada(alvo: Element, m: Medida) {
  const caixa = [{ inlineSize: m.largura, blockSize: m.altura }];
  return {
    target: alvo,
    contentRect: {
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      width: m.largura,
      height: m.altura,
      right: m.largura,
      bottom: m.altura,
      toJSON: () => ({}),
    },
    borderBoxSize: caixa,
    contentBoxSize: caixa,
    devicePixelContentBoxSize: caixa,
  };
}

class ResizeObserverFalso {
  readonly alvos: Element[] = [];
  readonly callback: Callback;
  constructor(callback: Callback) {
    this.callback = callback;
    observadores.push(this);
  }
  observe(alvo: Element): void {
    this.alvos.push(alvo);
    this.callback([entrada(alvo, medida)], this);
  }
  unobserve(alvo: Element): void {
    const i = this.alvos.indexOf(alvo);
    if (i >= 0) this.alvos.splice(i, 1);
  }
  disconnect(): void {
    this.alvos.length = 0;
  }
  notificar(): void {
    if (this.alvos.length > 0) this.callback(this.alvos.map((alvo) => entrada(alvo, medida)), this);
  }
}

function definir(chave: Record<string, unknown>, valor: unknown): void {
  if (valor === undefined) Reflect.deleteProperty(chave, 'ResizeObserver');
  else chave.ResizeObserver = valor;
}

/** Instala o falso no global e na janela; todo elemento observado mede `m`. */
export function instalarResizeObserverFalso(m: Medida): void {
  medida = m;
  observadores = [];
  definir(escopo, ResizeObserverFalso);
  definir(janela, ResizeObserverFalso);
}

/** Tira o ResizeObserver do ambiente (o caso "sem ResizeObserver", em que a janela é a reserva). */
export function removerResizeObserver(): void {
  observadores = [];
  definir(escopo, undefined);
  definir(janela, undefined);
}

/** Volta o ResizeObserver que o ambiente tinha antes deste módulo (no jsdom, nenhum). */
export function restaurarResizeObserver(): void {
  definir(escopo, original.global);
  definir(janela, original.janela);
  observadores = [];
}

/** O contêiner passa a medir `m` e os observadores avisam. Depois, espere o desenho (esperarDesenho). */
export function redimensionarConteiner(m: Medida): void {
  medida = m;
  act(() => {
    for (const observador of observadores) observador.notificar();
  });
}

/** Tamanho do Stage desenhado (estilo do `.konvajs-content`). */
export function tamanhoDoElemento(el: HTMLElement): Medida {
  return { largura: Number.parseFloat(el.style.width), altura: Number.parseFloat(el.style.height) };
}
