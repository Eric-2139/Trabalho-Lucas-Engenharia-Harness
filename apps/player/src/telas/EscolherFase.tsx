/**
 * Escolher Fase (RF-13, RNF-07, ADR-014): um botão nativo por fase, na ordem recebida.
 * Tab percorre na ordem natural, Enter abre; o foco visível vem do estilo :focus-visible do tema.
 */
import type { PropsEscolherFase } from '../../contrato/index.ts';
import { mensagens } from '../mensagens.ts';

export function EscolherFase({ fases, aoAbrir }: PropsEscolherFase) {
  const textos = mensagens.escolherFase;
  return (
    <main>
      <h1>{textos.titulo}</h1>
      {fases.length === 0 ? (
        <p>{textos.nenhumaFase}</p>
      ) : (
        <ul aria-label={textos.rotuloLista}>
          {fases.map((fase) => (
            <li key={fase.id}>
              <button type="button" onClick={() => aoAbrir(fase.id)}>
                {fase.titulo}
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
