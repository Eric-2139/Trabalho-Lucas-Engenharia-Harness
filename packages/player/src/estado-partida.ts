/**
 * EstadoPartida (modulos-player.md §1, RF-15): guarda o estado da partida e avisa os assinantes.
 * O estado é imutável: cada mudança troca o objeto, então `obter` devolve a mesma referência
 * enquanto nada muda (o que o `useSyncExternalStore` exige).
 */
import type { ParedeId } from '@math-scape/schema/contrato';
import type { EstadoPartida } from '../contrato/index.ts';

type Ouvinte = (estado: EstadoPartida) => void;

export interface ArmazemPartida {
  obter(): EstadoPartida;
  /** Aplica a mudança; avisa os assinantes uma vez, e só se algo mudou. */
  atualizar(mudanca: (atual: EstadoPartida) => EstadoPartida): void;
  assinar(ouvinte: Ouvinte): () => void;
}

export function estadoInicial(parede: ParedeId = 'frente'): EstadoPartida {
  return { paredeAtiva: parede, digitosRevelados: {}, enigmasResolvidos: [], concluida: false };
}

function iguais(a: EstadoPartida, b: EstadoPartida): boolean {
  if (a.paredeAtiva !== b.paredeAtiva || a.concluida !== b.concluida) return false;
  if (a.enigmasResolvidos.length !== b.enigmasResolvidos.length) return false;
  if (a.enigmasResolvidos.some((id, i) => b.enigmasResolvidos[i] !== id)) return false;
  const posicoesA = Object.keys(a.digitosRevelados);
  const posicoesB = Object.keys(b.digitosRevelados);
  if (posicoesA.length !== posicoesB.length) return false;
  return posicoesA.every((p) => a.digitosRevelados[Number(p)] === b.digitosRevelados[Number(p)]);
}

export function criarArmazemPartida(inicial: EstadoPartida = estadoInicial()): ArmazemPartida {
  let atual = inicial;
  const ouvintes = new Set<Ouvinte>();
  return {
    obter: () => atual,
    atualizar(mudanca) {
      const proximo = mudanca(atual);
      if (iguais(atual, proximo)) return;
      atual = proximo;
      for (const ouvinte of [...ouvintes]) ouvinte(atual);
    },
    assinar(ouvinte) {
      ouvintes.add(ouvinte);
      return () => {
        ouvintes.delete(ouvinte);
      };
    },
  };
}
