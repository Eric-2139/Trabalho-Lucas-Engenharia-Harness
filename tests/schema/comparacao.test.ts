/**
 * Módulo: respostaConfere e senhaConfere (packages/schema/contrato/funcoes.ts).
 * Requisito: RF-15 (aceita qualquer resposta cadastrada comparando só o número; porta abre só com a senha completa).
 * A revelação dos dígitos no jogo é do motor do Player e fica para a rodada do Player.
 */
import { respostaConfere, senhaConfere } from '@math-scape/schema';
import { describe, expect, test } from 'vitest';

describe('RF-15 · respostaConfere', () => {
  // @req RF-15 @tipo feliz
  test('test_RF15_resposta_A_resolve_enigma_com_A_e_B', () => {
    expect(respostaConfere('-15', [-15, 80])).toBe(true);
  });

  // @req RF-15 @tipo feliz
  test('test_RF15_resposta_B_resolve_enigma_com_A_e_B', () => {
    expect(respostaConfere('80', [-15, 80])).toBe(true);
  });

  // @req RF-15 @tipo borda
  test('test_RF15_aceita_80_com_espacos', () => {
    expect(respostaConfere(' 80 ', [80])).toBe(true);
  });

  // @req RF-15 @tipo borda
  test('test_RF15_aceita_080', () => {
    expect(respostaConfere('080', [80])).toBe(true);
  });

  // @req RF-15 @tipo borda
  test('test_RF15_aceita_80_virgula_0', () => {
    expect(respostaConfere('80,0', [80])).toBe(true);
  });

  // @req RF-15 @tipo borda
  test('test_RF15_aceita_80_com_unidade_analisando_so_o_numero', () => {
    expect(respostaConfere('80 graus', [80])).toBe(true);
  });

  // @req RF-15 @tipo borda
  test('test_RF15_aceita_decimal_com_virgula_ou_ponto', () => {
    expect(respostaConfere('0,5', [0.5])).toBe(true);
    expect(respostaConfere('0.5', [0.5])).toBe(true);
  });

  // @req RF-15 @tipo negativo
  test('test_RF15_recusa_oitenta_por_extenso', () => {
    expect(respostaConfere('oitenta', [80])).toBe(false);
  });

  // @req RF-15 @tipo negativo
  test('test_RF15_recusa_texto_sem_numero', () => {
    expect(respostaConfere('', [80])).toBe(false);
    expect(respostaConfere('   ', [80])).toBe(false);
    expect(respostaConfere('não sei', [80])).toBe(false);
  });

  // @req RF-15 @tipo negativo
  test('test_RF15_outra_resposta_nao_resolve', () => {
    expect(respostaConfere('90', [-15, 80])).toBe(false);
    expect(respostaConfere('15', [-15, 80])).toBe(false);
    expect(respostaConfere('8', [80])).toBe(false);
  });

  // @req RF-15 @tipo negativo
  test('test_RF15_recusa_texto_com_dois_numeros', () => {
    expect(respostaConfere('80 ou 90', [80, 90])).toBe(false);
  });
});

describe('RF-15 · senhaConfere', () => {
  // @req RF-15 @tipo feliz
  test('test_RF15_porta_abre_com_a_senha_completa_correta', () => {
    expect(senhaConfere('92139', '92139')).toBe(true);
  });

  // @req RF-15 @tipo borda
  test('test_RF15_senha_com_zero_a_esquerda_exige_o_zero', () => {
    expect(senhaConfere('0123', '0123')).toBe(true);
    expect(senhaConfere('123', '0123')).toBe(false);
  });

  // @req RF-15 @tipo borda
  test('test_RF15_senha_ignora_espacos_digitados', () => {
    expect(senhaConfere(' 9 2 1 3 9 ', '92139')).toBe(true);
  });

  // @req RF-15 @tipo negativo
  test('test_RF15_porta_nao_abre_com_senha_incompleta', () => {
    expect(senhaConfere('9213', '92139')).toBe(false);
    expect(senhaConfere('', '92139')).toBe(false);
  });

  // @req RF-15 @tipo negativo
  test('test_RF15_porta_nao_abre_com_senha_errada_ou_a_mais', () => {
    expect(senhaConfere('92138', '92139')).toBe(false);
    expect(senhaConfere('921390', '92139')).toBe(false);
  });
});
