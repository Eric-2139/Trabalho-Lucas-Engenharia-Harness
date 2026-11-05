/**
 * Relógio falso e determinístico para o Salvamento (apps/editor/contrato/salvamento.ts · Relogio).
 * O tempo só anda quando o teste chama `avancar`; nada depende do relógio do sistema.
 */
import type { Relogio } from '@math-scape/app-editor/contrato';

export interface RelogioFalso extends Relogio {
  /** Avança o tempo em `ms`, executando na ordem as tarefas que vencem até lá. */
  avancar(ms: number): void;
  /** Quantas tarefas ainda estão agendadas (não executadas nem canceladas). */
  agendados(): number;
}

interface Tarefa {
  quando: number;
  funcao: () => void;
}

export function criarRelogioFalso(inicio = 0): RelogioFalso {
  let atual = inicio;
  let proximoId = 0;
  const tarefas = new Map<number, Tarefa>();

  function proximaVencida(alvo: number): [number, Tarefa] | undefined {
    let escolhida: [number, Tarefa] | undefined;
    for (const [id, tarefa] of tarefas) {
      if (tarefa.quando > alvo) continue;
      if (!escolhida || tarefa.quando < escolhida[1].quando) escolhida = [id, tarefa];
    }
    return escolhida;
  }

  return {
    agora: () => atual,
    agendar(funcao, ms) {
      const id = proximoId++;
      tarefas.set(id, { quando: atual + Math.max(0, ms), funcao });
      return () => {
        tarefas.delete(id);
      };
    },
    avancar(ms) {
      const alvo = atual + ms;
      for (let vencida = proximaVencida(alvo); vencida; vencida = proximaVencida(alvo)) {
        tarefas.delete(vencida[0]);
        atual = vencida[1].quando;
        vencida[1].funcao();
      }
      atual = alvo;
    },
    agendados: () => tarefas.size,
  };
}

/** Deixa as promessas pendentes (respostas do cliente falso) se resolverem, sem esperar tempo real. */
export async function drenarPromessas(rodadas = 25): Promise<void> {
  for (let i = 0; i < rodadas; i++) await Promise.resolve();
}
