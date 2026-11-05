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

/**
 * RNF-04: fase jogável com valores secretos fáceis de procurar no JSON serializado.
 * Senha 86420; enigma-segredo (respostas 271828 ou 161803, com dica, revela [1, 2, 3]);
 * enigma-segredo-dois (resposta 314159, sem dica, revela [4, 5]); porta; fala; decoração.
 * Nenhum outro campo contém esses números.
 */
export const SEGREDOS = { senha: '86420', respostas: ['271828', '161803', '314159'] } as const;
export const DICA_SEGREDO = 'Pense numa constante famosa.';

export function documentoComSegredos(titulo: string): Fase {
  return {
    ...fase('86420', {
      frente: [
        porta('porta-1'),
        objeto('enigma-segredo', {
          tipo: 'enigma',
          pergunta: 'Qual constante sintética abre o cofre?',
          respostas: [271828, 161803],
          dica: DICA_SEGREDO,
          revela: [1, 2, 3],
        }),
      ],
      direita: [fala('fala-segredo', 'Você: a sala parece vazia.')],
      teto: [
        objeto('enigma-segredo-dois', {
          tipo: 'enigma',
          pergunta: 'Qual a outra constante sintética?',
          respostas: [314159],
          revela: [4, 5],
        }),
        objeto('lampada-segredo', { tipo: 'decoracao' }, 'sprite:lampada'),
      ],
    }),
    titulo,
  };
}

/** Fase jogável que usa as imagens próprias dadas: uma como fundo da parede direita e outra num objeto. */
export function documentoComImagens(titulo: string, uuidFundo: string, uuidObjeto: string): Fase {
  const documento = documentoJogavel(titulo);
  documento.paredes.direita.fundo = `asset:${uuidFundo}`;
  documento.paredes.direita.objetos.push(objeto('quadro-proprio', { tipo: 'decoracao' }, `asset:${uuidObjeto}`));
  return documento;
}

/** Envelope de exportação (ADR-013) para a fase e as imagens dadas. */
export function envelope(faseDoc: unknown, imagens: Record<string, string> = {}): Record<string, unknown> {
  return { formato: 'math-scape-fase', versao: 1, fase: faseDoc, imagens };
}
