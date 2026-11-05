/**
 * Limite de tentativas de `POST /fases/:id/verificar` (modulos-api.md §1; ADR-003; RF-15).
 * Janela fixa por IP + fase + tipo (`LIMITES_VERIFICAR`): enigma 300 a cada 60 s, porta 30 a cada
 * 600 s. Excedeu → o chamador responde 429 `{ tentarEmSegundos }`. O modo testar não passa por aqui.
 * O estado vive em memória e é por instância (cada `construirApp` começa zerado).
 */
import { LIMITES_VERIFICAR } from '../../contrato/index.ts';

export type TipoVerificado = keyof typeof LIMITES_VERIFICAR;

export type ResultadoLimite = { permitido: true } | { permitido: false; tentarEmSegundos: number };

export interface LimiteVerificar {
  /** Conta uma tentativa; se a janela já está cheia, não conta e diz quanto falta para ela recomeçar. */
  consumir(ip: string, faseId: string, tipo: TipoVerificado): ResultadoLimite;
}

interface Janela {
  inicioMs: number;
  contagem: number;
}

/** Acima deste número de chaves, as janelas vencidas são descartadas antes de criar outra. */
const CHAVES_ANTES_DE_LIMPAR = 10_000;

export function criarLimiteVerificar(agora: () => number = Date.now): LimiteVerificar {
  const janelas = new Map<string, Janela>();

  function limparVencidas(instante: number): void {
    for (const [chave, janela] of janelas) {
      const tipo = chave.slice(0, chave.indexOf('|')) as TipoVerificado;
      if (instante - janela.inicioMs >= LIMITES_VERIFICAR[tipo].janelaSegundos * 1000) janelas.delete(chave);
    }
  }

  return {
    consumir(ip, faseId, tipo) {
      const { maximo, janelaSegundos } = LIMITES_VERIFICAR[tipo];
      const janelaMs = janelaSegundos * 1000;
      const instante = agora();
      const chave = `${tipo}|${faseId}|${ip}`;
      const atual = janelas.get(chave);

      if (!atual || instante - atual.inicioMs >= janelaMs) {
        if (!atual && janelas.size >= CHAVES_ANTES_DE_LIMPAR) limparVencidas(instante);
        janelas.set(chave, { inicioMs: instante, contagem: 1 });
        return { permitido: true };
      }
      if (atual.contagem < maximo) {
        atual.contagem += 1;
        return { permitido: true };
      }
      const restanteMs = atual.inicioMs + janelaMs - instante;
      return { permitido: false, tentarEmSegundos: Math.min(janelaSegundos, Math.max(1, Math.ceil(restanteMs / 1000))) };
    },
  };
}
