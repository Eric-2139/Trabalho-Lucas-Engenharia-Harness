/**
 * Módulo: Tema (packages/player/contrato/palco.ts · Tema, RazaoContraste; modulos-player.md §1, ADR-014).
 * Requisito: RNF-07 — contraste mínimo de 4,5:1 (WCAG 2.1 AA) nos pares texto/fundo da interface.
 * Os valores esperados de razaoContraste vêm da fórmula WCAG 2.1 (luminância relativa sRGB),
 * calculados à mão para pares conhecidos; não dependem da implementação.
 */
import { razaoContraste, tema } from '@math-scape/player';
import { describe, expect, test } from 'vitest';

const HEX = /^#[0-9a-fA-F]{6}$/;

describe('RNF-07 · razaoContraste (WCAG 2.1)', () => {
  // @req RNF-07 @tipo feliz
  test('test_RNF07_preto_sobre_branco_da_21', () => {
    expect(razaoContraste('#000000', '#ffffff')).toBeCloseTo(21, 5);
  });

  // @req RNF-07 @tipo feliz
  test('test_RNF07_azul_puro_sobre_branco_da_8_59', () => {
    // L(#0000ff) = 0,0722 → (1 + 0,05) / (0,0722 + 0,05) = 8,592
    expect(razaoContraste('#0000ff', '#ffffff')).toBeCloseTo(8.592, 2);
  });

  // @req RNF-07 @tipo borda
  test('test_RNF07_cores_iguais_dao_1', () => {
    expect(razaoContraste('#3a7bd5', '#3a7bd5')).toBeCloseTo(1, 5);
    expect(razaoContraste('#ffffff', '#ffffff')).toBeCloseTo(1, 5);
  });

  // @req RNF-07 @tipo borda
  test('test_RNF07_razao_nao_depende_da_ordem_das_cores', () => {
    expect(razaoContraste('#ffffff', '#000000')).toBeCloseTo(21, 5);
    expect(razaoContraste('#ffffff', '#767676')).toBeCloseTo(razaoContraste('#767676', '#ffffff'), 10);
  });

  // @req RNF-07 @tipo borda
  test('test_RNF07_cinza_767676_sobre_branco_passa_no_limite_de_4_5', () => {
    // L(#767676) = 0,18116 → 1,05 / 0,23116 = 4,542
    const razao = razaoContraste('#767676', '#ffffff');
    expect(razao).toBeCloseTo(4.542, 2);
    expect(razao).toBeGreaterThanOrEqual(4.5);
  });

  // @req RNF-07 @tipo negativo
  test('test_RNF07_cinza_777777_sobre_branco_fica_abaixo_de_4_5', () => {
    // L(#777777) = 0,18447 → 1,05 / 0,23447 = 4,478: um tom acima do limite já reprova.
    const razao = razaoContraste('#777777', '#ffffff');
    expect(razao).toBeCloseTo(4.478, 2);
    expect(razao).toBeLessThan(4.5);
  });
});

describe('RNF-07 · tema', () => {
  // @req RNF-07 @tipo feliz
  test('test_RNF07_todo_par_de_contraste_do_tema_tem_ao_menos_4_5', () => {
    expect(tema.paresDeContraste.length).toBeGreaterThan(0);
    for (const [texto, fundo] of tema.paresDeContraste) {
      expect(razaoContraste(texto, fundo), `${texto} sobre ${fundo}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  // @req RNF-07 @tipo borda
  test('test_RNF07_cores_do_tema_e_dos_pares_estao_em_hexadecimal_rrggbb', () => {
    for (const [nome, cor] of Object.entries(tema.cores)) {
      expect(cor, `tema.cores.${nome}`).toMatch(HEX);
    }
    for (const [texto, fundo] of tema.paresDeContraste) {
      expect(texto).toMatch(HEX);
      expect(fundo).toMatch(HEX);
    }
  });

  // @req RNF-07 @tipo negativo
  test('test_RNF07_nenhum_par_do_tema_usa_texto_igual_ao_fundo', () => {
    for (const [texto, fundo] of tema.paresDeContraste) {
      expect(texto.toLowerCase(), `par ${texto}/${fundo}`).not.toBe(fundo.toLowerCase());
    }
  });
});
