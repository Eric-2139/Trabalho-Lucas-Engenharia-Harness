/**
 * Palco 16:9 comum a Editor e Player (ADR-006, RF-03, RNF-01, RNF-02).
 */
import type { CalcularPalco, ParaPixels, PrecisaAvisoResolucao } from '../contrato/index.ts';

const PROPORCAO_LARGURA = 16;
const PROPORCAO_ALTURA = 9;
const LARGURA_MINIMA = 1280;
const ALTURA_MINIMA = 720;

/** Maior retângulo 16:9 que cabe no contêiner, centralizado. */
export const calcularPalco: CalcularPalco = (larguraConteiner, alturaConteiner) => {
  const limitadoPelaLargura = larguraConteiner * PROPORCAO_ALTURA <= alturaConteiner * PROPORCAO_LARGURA;
  const largura = limitadoPelaLargura ? larguraConteiner : (alturaConteiner * PROPORCAO_LARGURA) / PROPORCAO_ALTURA;
  const altura = limitadoPelaLargura ? (larguraConteiner * PROPORCAO_ALTURA) / PROPORCAO_LARGURA : alturaConteiner;
  return {
    x: (larguraConteiner - largura) / 2,
    y: (alturaConteiner - altura) / 2,
    largura,
    altura,
  };
};

/** Coordenadas relativas (0..1) do documento → pixels do palco. */
export const paraPixels: ParaPixels = (objeto, palco) => ({
  x: palco.x + objeto.x * palco.largura,
  y: palco.y + objeto.y * palco.altura,
  largura: objeto.largura * palco.largura,
  altura: objeto.altura * palco.altura,
});

/** RNF-01: janela menor que 1280×720 em qualquer dimensão mostra aviso (não bloqueia). */
export const precisaAvisoResolucao: PrecisaAvisoResolucao = (larguraJanela, alturaJanela) =>
  larguraJanela < LARGURA_MINIMA || alturaJanela < ALTURA_MINIMA;
