/**
 * Apoio para o arraste nativo (HTML5) da biblioteca até o palco (RF-04, LAC-045).
 *
 * O jsdom não tem `DragEvent` nem `DataTransfer`. Aqui o evento é criado com `createEvent` do Testing Library
 * (um `Event` com bubbles e cancelable) e recebe, por `Object.defineProperty`, um `dataTransfer` falso e as
 * coordenadas `clientX`/`clientY`. No jsdom, `getBoundingClientRect` devolve zero, então clientX/clientY =
 * pixel no palco. Sem asserções: só preparo e disparo.
 */
import { createEvent, fireEvent } from '@testing-library/react';

export interface DataTransferFalso {
  readonly types: string[];
  readonly dados: Map<string, string>;
  dropEffect: string;
  effectAllowed: string;
  setData(tipo: string, valor: string): void;
  getData(tipo: string): string;
  clearData(tipo?: string): void;
  setDragImage(): void;
}

/** DataTransfer em memória, opcionalmente já com dados (o que a origem do arraste teria gravado). */
export function criarDataTransfer(iniciais: Record<string, string> = {}): DataTransferFalso {
  const dados = new Map<string, string>(Object.entries(iniciais));
  const transferencia: DataTransferFalso = {
    get types() {
      return [...dados.keys()];
    },
    dados,
    dropEffect: 'none',
    effectAllowed: 'all',
    setData(tipo, valor) {
      dados.set(tipo, String(valor));
    },
    getData(tipo) {
      return dados.get(tipo) ?? '';
    },
    clearData(tipo) {
      if (tipo === undefined) dados.clear();
      else dados.delete(tipo);
    },
    setDragImage() {
      // sem imagem de arraste no jsdom
    },
  };
  return transferencia;
}

type TipoArraste = 'dragStart' | 'dragEnd' | 'dragEnter' | 'dragOver' | 'dragLeave' | 'drop';

export interface Disparo {
  /** true se algum ouvinte chamou preventDefault. */
  cancelado: boolean;
}

/** Dispara um evento de arraste no elemento, com o dataTransfer e o ponto dados. */
export function dispararArraste(
  el: Element,
  tipo: TipoArraste,
  dataTransfer: DataTransferFalso,
  ponto: { x: number; y: number } = { x: 0, y: 0 },
): Disparo {
  const evento = createEvent[tipo](el, { bubbles: true, cancelable: true });
  Object.defineProperty(evento, 'dataTransfer', { configurable: true, value: dataTransfer });
  Object.defineProperty(evento, 'clientX', { configurable: true, value: ponto.x });
  Object.defineProperty(evento, 'clientY', { configurable: true, value: ponto.y });
  Object.defineProperty(evento, 'pageX', { configurable: true, value: ponto.x });
  Object.defineProperty(evento, 'pageY', { configurable: true, value: ponto.y });
  Object.defineProperty(evento, 'offsetX', { configurable: true, value: ponto.x });
  Object.defineProperty(evento, 'offsetY', { configurable: true, value: ponto.y });
  // fireEvent do Testing Library já envolve o disparo em act().
  fireEvent(el, evento);
  return { cancelado: evento.defaultPrevented };
}

/** Arraste completo que termina num ponto do palco: dragenter, dragover e drop. */
export function soltarEm(el: Element, dataTransfer: DataTransferFalso, ponto: { x: number; y: number }): void {
  dispararArraste(el, 'dragEnter', dataTransfer, ponto);
  dispararArraste(el, 'dragOver', dataTransfer, ponto);
  dispararArraste(el, 'drop', dataTransfer, ponto);
}
