/**
 * Apoio para os testes do CanvasParede (editor): pontos em objetos do documento e arraste real no palco Konva.
 *
 * Reaproveita tests/support/palco-tela.ts (clique, palco desenhado, espera do desenho). O arraste dispara no
 * elemento do palco (`.konvajs-content`) a mesma sequência de um arraste de mouse: pointerdown/mousedown no
 * ponto inicial, pointermove/mousemove nos pontos intermediários e pointerup/mouseup no ponto final. Os eventos
 * sobem até `window`, onde o Konva acompanha o arraste e dispara `dragend` (ADR-007). No jsdom,
 * `getBoundingClientRect` devolve zero, então clientX/clientY = coordenada no palco. Sem teste por pixel (ADR-016).
 */
import { paraPixels } from '@math-scape/player';
import type { Retangulo } from '@math-scape/player/contrato';
import type { Objeto } from '@math-scape/schema/contrato';
import { fireEvent } from '@testing-library/react';
import { conteudoDoPalco, type Ponto } from './palco-tela.ts';

type Caixa = Pick<Objeto, 'x' | 'y' | 'largura' | 'altura'>;

/** Ponto nas frações (fx, fy) da largura e da altura de um objeto sem rotação, no palco dado. */
export function pontoNoObjeto(objeto: Caixa, fx: number, fy: number, palco: Retangulo): Ponto {
  const r = paraPixels(objeto, palco);
  return { x: r.x + fx * r.largura, y: r.y + fy * r.altura };
}

/** true se o ponto cai dentro do retângulo (sem rotação). */
export function dentro(r: Retangulo, p: Ponto): boolean {
  return p.x >= r.x && p.x <= r.x + r.largura && p.y >= r.y && p.y <= r.y + r.altura;
}

/** Arraste de mouse de `de` até `para`, em `passos` movimentos intermediários iguais. */
export function arrastarNoPalco(de: Ponto, para: Ponto, passos = 1): void {
  const el = conteudoDoPalco();
  const ponteiro = { pointerId: 1, pointerType: 'mouse', isPrimary: true };
  const em = (p: Ponto, buttons: number) => ({
    clientX: p.x,
    clientY: p.y,
    bubbles: true,
    cancelable: true,
    button: 0,
    buttons,
  });

  fireEvent.pointerDown(el, { ...em(de, 1), ...ponteiro });
  fireEvent.mouseDown(el, em(de, 1));
  for (let i = 1; i <= passos; i++) {
    const p = { x: de.x + ((para.x - de.x) * i) / passos, y: de.y + ((para.y - de.y) * i) / passos };
    fireEvent.pointerMove(el, { ...em(p, 1), ...ponteiro });
    fireEvent.mouseMove(el, em(p, 1));
  }
  fireEvent.pointerUp(el, { ...em(para, 0), ...ponteiro });
  fireEvent.mouseUp(el, em(para, 0));
}
