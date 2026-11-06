/**
 * Palco 16:9 comum a Editor e Player (ADR-006, RNF-01, RNF-02) e tema visual (ADR-014, RNF-07).
 */
import type { ParedeJogo } from '@math-scape/schema/contrato';

export interface Retangulo {
  x: number;
  y: number;
  largura: number;
  altura: number;
}

/**
 * Maior retângulo 16:9 que cabe no contêiner, centralizado. 1280×720 → { 0, 0, 1280, 720 }.
 * O contêiner é o elemento que contém o palco, não a janela (LAC-046): a tela reserva o espaço dos demais elementos.
 */
export type CalcularPalco = (larguraConteiner: number, alturaConteiner: number) => Retangulo;

/** Coordenadas relativas (0..1) do documento → pixels do palco. */
export type ParaPixels = (
  objeto: { x: number; y: number; largura: number; altura: number },
  palco: Retangulo,
) => Retangulo;

/** RNF-01: true quando a janela é menor que 1280×720 em qualquer dimensão (mostra aviso, não bloqueia). */
export type PrecisaAvisoResolucao = (larguraJanela: number, alturaJanela: number) => boolean;

/** Tokens do tema (ADR-014). Cores em hexadecimal "#rrggbb". */
export interface Tema {
  cores: {
    fundo: string;
    superficie: string;
    texto: string;
    textoSuave: string;
    primaria: string;
    textoSobrePrimaria: string;
    erro: string;
    sucesso: string;
    foco: string;
  };
  /** Pares [texto, fundo] que a interface usa; cada um precisa de contraste ≥ 4,5:1 (RNF-07). */
  paresDeContraste: [texto: string, fundo: string][];
  fonte: { familia: string; tamanhoBase: string };
  foco: { largura: string; estilo: string };
}

/** Razão de contraste WCAG 2.1 entre duas cores "#rrggbb" (1 a 21). */
export type RazaoContraste = (cor1: string, cor2: string) => number;

/** Propriedades do componente React que desenha uma parede no palco (Konva). */
export interface PropsRenderizadorParede {
  parede: ParedeJogo;
  palco: Retangulo;
  baseUrlApi: string;
  /** Chamado ao clicar num objeto que não é decoração. */
  aoClicar: (objetoId: string) => void;
  /** Clique no ícone de dica, desenhado só junto de enigma com dica (RF-17). */
  aoVerDica?: (objetoId: string) => void;
}
