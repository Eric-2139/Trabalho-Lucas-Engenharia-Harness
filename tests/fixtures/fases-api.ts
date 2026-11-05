/**
 * Documentos de fase sintéticos para os testes da Api. Montados com os construtores de
 * tests/fixtures/fases.ts (regras de packages/schema/contrato/fase.ts), nunca copiados de
 * fases-exemplo/. Ids e uuids fixos, sem aleatoriedade.
 */
import type { Fase } from '@math-scape/schema/contrato';
import { DATA_URL_PNG, UUID_ASSET, enigma, fala, fase, faseValida, objeto, porta } from './fases.ts';

export { DATA_URL_PNG, UUID_ASSET };

/** Fase válida e jogável (senha 92139, todas as posições ligadas a enigmas, com porta). */
export function documentoJogavel(titulo: string): Fase {
  return { ...faseValida(), titulo };
}

/** RF-12: senha 92139 com enigmas revelando [1] e [3, 4]: as posições 2 e 5 ficam sem enigma. */
export function documentoComPosicoesSemEnigma(titulo: string): Fase {
  return {
    ...fase('92139', {
      frente: [porta('porta-1'), enigma('enigma-um', [1], [12])],
      fundo: [enigma('enigma-tres-quatro', [3, 4], [34])],
    }),
    titulo,
  };
}

/** RF-12: fase sem porta, senha de 4 dígitos, todas as posições ligadas a enigmas. */
export function documentoSemPorta(titulo: string): Fase {
  return {
    ...fase('4821', {
      direita: [enigma('enigma-a', [1, 2], [21]), fala('fala-a', 'Você: não há porta aqui.')],
      teto: [enigma('enigma-b', [3, 4], [43])],
    }),
    titulo,
  };
}

/** Fase jogável com um objeto que usa imagem própria (`asset:<UUID_ASSET>`). */
export function documentoComImagemPropria(titulo: string): Fase {
  const documento = documentoJogavel(titulo);
  documento.paredes.direita.objetos.push(objeto('quadro-proprio', { tipo: 'decoracao' }, `asset:${UUID_ASSET}`));
  return documento;
}

/** Envelope de exportação (ADR-013) para a fase e as imagens dadas. */
export function envelope(faseDoc: unknown, imagens: Record<string, string> = {}): Record<string, unknown> {
  return { formato: 'math-scape-fase', versao: 1, fase: faseDoc, imagens };
}
