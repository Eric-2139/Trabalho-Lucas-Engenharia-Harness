/**
 * Módulo: Palco (packages/player/contrato/palco.ts · calcularPalco, paraPixels; modulos-player.md §1).
 * Requisito: RNF-02 — em 1280x720, 1920x1080 e 2560x1440 a sala fica em 16:9 e os objetos
 * mantêm posição e tamanho relativos (coordenadas 0..1 do documento, ADR-006).
 */
import { calcularPalco, paraPixels, precisaAvisoResolucao } from '@math-scape/player';
import type { Retangulo } from '@math-scape/player/contrato';
import { describe, expect, test } from 'vitest';

const RESOLUCOES: [number, number][] = [
  [1280, 720],
  [1920, 1080],
  [2560, 1440],
];

/** Objeto sintético em coordenadas relativas (valores exatos em binário para evitar arredondamento). */
const OBJETO = { x: 0.5, y: 0.25, largura: 0.125, altura: 0.5 };

function relativo(pixels: Retangulo, palco: Retangulo) {
  return {
    x: (pixels.x - palco.x) / palco.largura,
    y: (pixels.y - palco.y) / palco.altura,
    largura: pixels.largura / palco.largura,
    altura: pixels.altura / palco.altura,
  };
}

describe('RNF-02 · calcularPalco', () => {
  // @req RNF-02 @tipo feliz
  test.each(RESOLUCOES)('test_RNF02_palco_em_%ix%i_ocupa_o_conteiner_inteiro_em_16_9', (largura, altura) => {
    const palco = calcularPalco(largura, altura);
    expect(palco).toEqual({ x: 0, y: 0, largura, altura });
    expect(palco.largura * 9).toBe(palco.altura * 16);
  });

  // @req RNF-02 @tipo borda
  test('test_RNF02_conteiner_mais_alto_que_16_9_centraliza_na_vertical', () => {
    expect(calcularPalco(1920, 1200)).toEqual({ x: 0, y: 60, largura: 1920, altura: 1080 });
  });

  // @req RNF-02 @tipo borda
  test('test_RNF02_conteiner_mais_largo_que_16_9_centraliza_na_horizontal', () => {
    expect(calcularPalco(2000, 900)).toEqual({ x: 200, y: 0, largura: 1600, altura: 900 });
  });

  // @req RNF-02 @tipo negativo
  test('test_RNF02_conteiner_quadrado_nao_estica_a_sala_para_fora_de_16_9', () => {
    const palco = calcularPalco(1600, 1600);
    expect(palco).not.toEqual({ x: 0, y: 0, largura: 1600, altura: 1600 });
    expect(palco).toEqual({ x: 0, y: 350, largura: 1600, altura: 900 });
    expect(palco.largura * 9).toBe(palco.altura * 16);
  });
});

describe('RNF-02 · paraPixels', () => {
  // @req RNF-02 @tipo feliz
  test.each(RESOLUCOES)('test_RNF02_objeto_mantem_posicao_e_tamanho_relativos_em_%ix%i', (largura, altura) => {
    const palco = calcularPalco(largura, altura);
    const pixels = paraPixels(OBJETO, palco);
    expect(pixels).toEqual({
      x: OBJETO.x * largura,
      y: OBJETO.y * altura,
      largura: OBJETO.largura * largura,
      altura: OBJETO.altura * altura,
    });
    expect(relativo(pixels, palco)).toEqual(OBJETO);
  });

  // @req RNF-02 @tipo feliz
  test('test_RNF02_mesmo_objeto_tem_a_mesma_proporcao_nas_tres_resolucoes', () => {
    const relativos = RESOLUCOES.map(([l, a]) => {
      const palco = calcularPalco(l, a);
      return relativo(paraPixels(OBJETO, palco), palco);
    });
    expect(relativos[1]).toEqual(relativos[0]);
    expect(relativos[2]).toEqual(relativos[0]);
  });

  // @req RNF-02 @tipo borda
  test.each(RESOLUCOES)('test_RNF02_limites_0_e_1_cobrem_exatamente_o_palco_em_%ix%i', (largura, altura) => {
    const palco = calcularPalco(largura, altura);
    expect(paraPixels({ x: 0, y: 0, largura: 1, altura: 1 }, palco)).toEqual(palco);
  });

  // @req RNF-02 @tipo borda
  test('test_RNF02_palco_centralizado_desloca_o_objeto_pela_origem_do_palco', () => {
    const palco = calcularPalco(1920, 1200); // { x: 0, y: 60, 1920 x 1080 }
    expect(paraPixels(OBJETO, palco)).toEqual({ x: 960, y: 60 + 270, largura: 240, altura: 540 });
  });

  // @req RNF-02 @tipo negativo
  test('test_RNF02_objeto_nao_usa_o_tamanho_do_conteiner_fora_de_16_9', () => {
    // Contêiner 1600x1600: a sala é 1600x900 a partir de y=350; o objeto não é medido pelos 1600 de altura.
    const palco = calcularPalco(1600, 1600);
    const pixels = paraPixels(OBJETO, palco);
    expect(pixels.altura).not.toBe(OBJETO.altura * 1600);
    expect(pixels).toEqual({ x: 800, y: 350 + 225, largura: 200, altura: 450 });
  });
});

/** RNF-01: abaixo de 1280x720 aparece um aviso; a 1280x720 ou mais, não (precisaAvisoResolucao, ADR-006). */
describe('RNF-01 · precisaAvisoResolucao', () => {
  // @req RNF-01 @tipo feliz
  test('test_RNF01_janela_1024x768_pede_aviso', () => {
    expect(precisaAvisoResolucao(1024, 768)).toBe(true);
  });

  // @req RNF-01 @tipo borda
  test('test_RNF01_janela_exatamente_1280x720_nao_pede_aviso', () => {
    expect(precisaAvisoResolucao(1280, 720)).toBe(false);
  });

  // @req RNF-01 @tipo borda
  test.each([
    [1279, 720],
    [1280, 719],
  ])('test_RNF01_janela_%ix%i_um_pixel_abaixo_pede_aviso', (largura, altura) => {
    expect(precisaAvisoResolucao(largura, altura)).toBe(true);
  });

  // @req RNF-01 @tipo borda
  test.each([
    [2000, 700],
    [1200, 1080],
  ])('test_RNF01_janela_%ix%i_menor_em_uma_so_dimensao_pede_aviso', (largura, altura) => {
    expect(precisaAvisoResolucao(largura, altura)).toBe(true);
  });

  // @req RNF-01 @tipo negativo
  test.each([
    [1920, 1080],
    [2560, 1440],
    [1281, 721],
  ])('test_RNF01_janela_%ix%i_acima_do_minimo_nao_pede_aviso', (largura, altura) => {
    expect(precisaAvisoResolucao(largura, altura)).toBe(false);
  });
});
