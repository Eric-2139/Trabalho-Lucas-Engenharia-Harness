/**
 * AbasParedes (modulos-editor.md §4, RF-03, RNF-07, PEND-017): 5 botões nativos com role="tab", na ordem de
 * PAREDES. A ativa tem aria-selected="true" e é a única alcançada pelo Tab; as setas movem o foco para a aba
 * vizinha e Enter/Espaço (clique nativo do botão) chamam `aoTrocar`.
 */
import { PAREDES, type ParedeId } from '@math-scape/schema/contrato';
import { type KeyboardEvent, useRef } from 'react';
import type { PropsAbasParedes } from '../../contrato/index.ts';

const NOMES_PAREDES: Record<ParedeId, string> = {
  frente: 'Frente',
  direita: 'Direita',
  fundo: 'Fundo',
  esquerda: 'Esquerda',
  teto: 'Teto',
};

export function AbasParedes({ paredeAtiva, aoTrocar }: PropsAbasParedes) {
  const botoes = useRef<(HTMLButtonElement | null)[]>([]);

  function aoTeclar(evento: KeyboardEvent<HTMLButtonElement>, indice: number): void {
    const passo = evento.key === 'ArrowRight' ? 1 : evento.key === 'ArrowLeft' ? -1 : 0;
    if (passo === 0) return;
    evento.preventDefault();
    const vizinho = (indice + passo + PAREDES.length) % PAREDES.length;
    botoes.current[vizinho]?.focus();
  }

  return (
    <div role="tablist" aria-label="Paredes">
      {PAREDES.map((parede, indice) => {
        const ativa = parede === paredeAtiva;
        return (
          <button
            key={parede}
            ref={(el) => {
              botoes.current[indice] = el;
            }}
            type="button"
            role="tab"
            aria-selected={ativa}
            tabIndex={ativa ? 0 : -1}
            onClick={() => aoTrocar(parede)}
            onKeyDown={(evento) => aoTeclar(evento, indice)}
          >
            {NOMES_PAREDES[parede]}
          </button>
        );
      })}
    </div>
  );
}
