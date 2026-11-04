/**
 * Módulo: validarJogabilidade (packages/schema/contrato/funcoes.ts).
 * Requisito: RF-12 (bloquear a publicação se algum dígito da senha não estiver ligado a um enigma, indicando quais).
 */
import { validarJogabilidade } from '@math-scape/schema';
import { describe, expect, test } from 'vitest';
import { decoracao, enigma, fala, fase, faseValida, porta } from '../fixtures/fases.ts';

describe('RF-12 · jogabilidade antes de publicar', () => {
  // @req RF-12 @tipo feliz
  test('test_RF12_todas_as_posicoes_ligadas_a_enigmas_e_jogavel', () => {
    expect(validarJogabilidade(faseValida())).toEqual({ jogavel: true, posicoesSemEnigma: [] });
  });

  // @req RF-12 @tipo feliz
  test('test_RF12_posicoes_ligadas_em_paredes_diferentes_e_jogavel', () => {
    const documento = fase('4821', {
      frente: [porta(), enigma('e-frente', [4])],
      direita: [enigma('e-direita', [2, 1])],
      teto: [enigma('e-teto', [3])],
    });
    expect(validarJogabilidade(documento)).toEqual({ jogavel: true, posicoesSemEnigma: [] });
  });

  // @req RF-12 @tipo borda
  test('test_RF12_senha_92139_com_posicoes_2_e_5_sem_enigma_indica_2_e_5', () => {
    const documento = fase('92139', {
      frente: [porta(), enigma('e-frente', [1])],
      fundo: [enigma('e-fundo', [3, 4])],
    });
    expect(validarJogabilidade(documento)).toEqual({ jogavel: false, posicoesSemEnigma: [2, 5] });
  });

  // @req RF-12 @tipo borda
  test('test_RF12_fase_sem_porta_com_posicoes_ligadas_e_jogavel', () => {
    const documento = fase('92139', {
      frente: [enigma('e-frente', [1, 2, 3])],
      teto: [enigma('e-teto', [4, 5])],
    });
    expect(validarJogabilidade(documento)).toEqual({ jogavel: true, posicoesSemEnigma: [] });
  });

  // @req RF-12 @tipo borda
  test('test_RF12_ultima_posicao_da_senha_de_8_digitos_sem_enigma', () => {
    const documento = fase('12345678', {
      frente: [porta(), enigma('e-frente', [1, 2, 3, 4])],
      esquerda: [enigma('e-esquerda', [5, 6, 7])],
    });
    expect(validarJogabilidade(documento)).toEqual({ jogavel: false, posicoesSemEnigma: [8] });
  });

  // @req RF-12 @tipo borda
  test('test_RF12_posicoes_sem_enigma_em_ordem_crescente', () => {
    const documento = fase('12345678', {
      teto: [enigma('e-teto', [8, 2])],
      frente: [enigma('e-frente', [5])],
    });
    expect(validarJogabilidade(documento)).toEqual({ jogavel: false, posicoesSemEnigma: [1, 3, 4, 6, 7] });
  });

  // @req RF-12 @tipo negativo
  test('test_RF12_fase_sem_enigma_indica_todas_as_posicoes', () => {
    const documento = fase('92139', {
      frente: [porta(), fala('fala-1', 'Você: nada aqui.')],
      teto: [decoracao('lampada-1')],
    });
    expect(validarJogabilidade(documento)).toEqual({ jogavel: false, posicoesSemEnigma: [1, 2, 3, 4, 5] });
  });

  // @req RF-12 @tipo negativo
  test('test_RF12_enigmas_sem_digito_nao_ligam_posicao', () => {
    const documento = fase('1234', {
      frente: [porta()],
      esquerda: [enigma('horas', [], [15]), enigma('minutos', [], [40])],
    });
    expect(validarJogabilidade(documento)).toEqual({ jogavel: false, posicoesSemEnigma: [1, 2, 3, 4] });
  });
});
