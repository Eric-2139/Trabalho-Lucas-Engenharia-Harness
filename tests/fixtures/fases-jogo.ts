/**
 * Projeções de jogo (FaseJogo) sintéticas para os testes do Player.
 * Montadas à mão a partir de packages/schema/contrato/fase.ts (sem respostas, senha nem revela),
 * sem depender de projetarParaJogo e sem copiar fases-exemplo/. Ids fixos, sem aleatoriedade.
 */
import type {
  DigitoRevelado,
  FaseJogo,
  InteracaoJogo,
  ObjetoJogo,
  ParedeJogo,
  RespostaVerificarEnigma,
  RespostaVerificarPorta,
} from '@math-scape/schema/contrato';
import type { Limitado, Verificador } from '@math-scape/player/contrato';
import { vi } from 'vitest';

export type NomeParedeJogo = 'frente' | 'direita' | 'fundo' | 'esquerda' | 'teto';

export function objetoJogo(id: string, interacao: InteracaoJogo, imagem = 'sprite:quadro'): ObjetoJogo {
  return { id, imagem, x: 0.25, y: 0.3, largura: 0.1, altura: 0.2, rotacao: 0, camada: 0, interacao };
}

export const decoracaoJogo = (id: string): ObjetoJogo => objetoJogo(id, { tipo: 'decoracao' }, 'sprite:lampada');
export const falaJogo = (id: string, texto: string): ObjetoJogo => objetoJogo(id, { tipo: 'fala', texto }, 'sprite:relogio');
export const portaJogo = (id = 'porta-1'): ObjetoJogo => objetoJogo(id, { tipo: 'porta' }, 'sprite:porta');
export function enigmaJogo(id: string, pergunta: string, dica?: string): ObjetoJogo {
  return objetoJogo(id, dica === undefined ? { tipo: 'enigma', pergunta } : { tipo: 'enigma', pergunta, dica });
}

/** FaseJogo com os objetos dados por parede; paredes omitidas ficam vazias. */
export function faseJogo(
  objetos: Partial<Record<NomeParedeJogo, ObjetoJogo[]>> = {},
  tamanhoSenha = 5,
): FaseJogo {
  const parede = (nome: NomeParedeJogo): ParedeJogo => ({ fundo: null, objetos: objetos[nome] ?? [] });
  return {
    versaoSchema: 1,
    titulo: 'Fase sintética do player',
    tamanhoSenha,
    paredes: {
      frente: parede('frente'),
      direita: parede('direita'),
      fundo: parede('fundo'),
      esquerda: parede('esquerda'),
      teto: parede('teto'),
    },
  };
}

export const PERGUNTA_FRENTE = 'Quanto é 7 x 8 + 4?';
export const DICA_FRENTE = 'Faça a multiplicação antes da soma.';
export const PERGUNTA_SEM_DICA = 'Quanto é 9 x 9?';
export const PERGUNTA_DIREITA = 'Quanto é 100 - 37?';
export const FALA_DIREITA = 'Você: a janela está emperrada.';
export const FALA_FRENTE = 'Você: o relógio parou às três.';

/**
 * Fase completa para o motor:
 * - frente: porta-1, enigma-frente (com dica), enigma-sem-dica, decoracao-frente, fala-frente;
 * - direita: fala-direita, enigma-direita (com dica), decoracao-direita;
 * - demais paredes vazias.
 */
export function faseMotor(): FaseJogo {
  return faseJogo({
    frente: [
      portaJogo('porta-1'),
      enigmaJogo('enigma-frente', PERGUNTA_FRENTE, DICA_FRENTE),
      enigmaJogo('enigma-sem-dica', PERGUNTA_SEM_DICA),
      decoracaoJogo('decoracao-frente'),
      falaJogo('fala-frente', FALA_FRENTE),
    ],
    direita: [
      falaJogo('fala-direita', FALA_DIREITA),
      enigmaJogo('enigma-direita', PERGUNTA_DIREITA, 'Conte de dez em dez.'),
      decoracaoJogo('decoracao-direita'),
    ],
  });
}

type RespostaEnigma = RespostaVerificarEnigma | Limitado;
type RespostaPorta = RespostaVerificarPorta | Limitado;

/** Verificador falso: devolve sempre as respostas dadas e registra as chamadas. */
export function verificadorFalso(opcoes: {
  enigma?: RespostaEnigma | Error;
  porta?: RespostaPorta | Error;
}) {
  const enigma = vi.fn(async (_objetoId: string, _resposta: string): Promise<RespostaEnigma> => {
    const r = opcoes.enigma ?? { correto: false, digitos: [] };
    if (r instanceof Error) throw r;
    return r;
  });
  const porta = vi.fn(async (_objetoId: string, _senha: string): Promise<RespostaPorta> => {
    const r = opcoes.porta ?? { aberta: false };
    if (r instanceof Error) throw r;
    return r;
  });
  const verificador: Verificador = { enigma, porta };
  return { verificador, enigma, porta };
}

/** Verificador que responde enigma com a função dada (por objeto e resposta). */
export function verificadorPorFuncao(
  responderEnigma: (objetoId: string, resposta: string) => RespostaEnigma,
  responderPorta: (objetoId: string, senha: string) => RespostaPorta = () => ({ aberta: false }),
) {
  const enigma = vi.fn(async (objetoId: string, resposta: string) => responderEnigma(objetoId, resposta));
  const porta = vi.fn(async (objetoId: string, senha: string) => responderPorta(objetoId, senha));
  const verificador: Verificador = { enigma, porta };
  return { verificador, enigma, porta };
}

export const acerto = (...digitos: DigitoRevelado[]): RespostaVerificarEnigma => ({ correto: true, digitos });
export const erro = (): RespostaVerificarEnigma => ({ correto: false, digitos: [] });
