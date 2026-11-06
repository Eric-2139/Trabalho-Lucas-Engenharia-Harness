/**
 * TelaInicial (modulos-player.md §2): apresentação, com links para Escolher Fase e para o editor.
 * Links nativos: Tab percorre, Enter abre. O link interno é tratado pelo roteador do main.tsx.
 */
import type { MouseEvent } from 'react';
import { mensagens } from '../mensagens.ts';

export interface PropsTelaInicial {
  /** Endereço do editor (outra origem no dev). */
  urlEditor: string;
  /** Clique em link interno: o roteador decide se navega sem recarregar. */
  aoClicarLink: (evento: MouseEvent<HTMLAnchorElement>) => void;
}

export function TelaInicial({ urlEditor, aoClicarLink }: PropsTelaInicial) {
  const textos = mensagens.inicial;
  return (
    <main>
      <h1>{textos.titulo}</h1>
      <p>{textos.apresentacao}</p>
      <ul>
        <li>
          <a href="/fases" onClick={aoClicarLink}>
            {textos.linkFases}
          </a>
        </li>
        <li>
          <a href={urlEditor}>{textos.linkEditor}</a>
        </li>
      </ul>
    </main>
  );
}
