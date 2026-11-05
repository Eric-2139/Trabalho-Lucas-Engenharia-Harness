/**
 * Tema visual comum a Editor e Player (ADR-014, RNF-07): tokens de cor, tipografia e foco,
 * e a razão de contraste WCAG 2.1 usada para conferir cada par texto/fundo (≥ 4,5:1).
 */
import type { RazaoContraste, Tema } from '../contrato/index.ts';

const HEX_RRGGBB = /^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/;

/** Canal sRGB de 8 bits → valor linear (WCAG 2.1, luminância relativa). */
function canalLinear(canal8bits: number): number {
  const c = canal8bits / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminanciaRelativa(cor: string): number {
  const partes = HEX_RRGGBB.exec(cor);
  if (!partes) throw new Error(`Cor inválida: "${cor}". Use o formato #rrggbb.`);
  const [r, g, b] = [partes[1], partes[2], partes[3]].map((p) => canalLinear(Number.parseInt(p as string, 16))) as [
    number,
    number,
    number,
  ];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Razão de contraste WCAG 2.1 entre duas cores "#rrggbb" (1 a 21), independente da ordem. */
export const razaoContraste: RazaoContraste = (cor1, cor2) => {
  const l1 = luminanciaRelativa(cor1);
  const l2 = luminanciaRelativa(cor2);
  const clara = Math.max(l1, l2);
  const escura = Math.min(l1, l2);
  return (clara + 0.05) / (escura + 0.05);
};

const cores: Tema['cores'] = {
  fundo: '#ffffff',
  superficie: '#f3f4f6',
  texto: '#1a1a2e',
  textoSuave: '#4b5563',
  primaria: '#1d4ed8',
  textoSobrePrimaria: '#ffffff',
  erro: '#b91c1c',
  sucesso: '#166534',
  foco: '#1d4ed8',
};

export const tema: Tema = {
  cores,
  paresDeContraste: [
    [cores.texto, cores.fundo],
    [cores.texto, cores.superficie],
    [cores.textoSuave, cores.fundo],
    [cores.textoSuave, cores.superficie],
    [cores.textoSobrePrimaria, cores.primaria],
    [cores.primaria, cores.fundo],
    [cores.primaria, cores.superficie],
    [cores.erro, cores.fundo],
    [cores.erro, cores.superficie],
    [cores.sucesso, cores.fundo],
    [cores.sucesso, cores.superficie],
  ],
  fonte: { familia: 'system-ui, "Segoe UI", Roboto, Arial, sans-serif', tamanhoBase: '16px' },
  foco: { largura: '3px', estilo: 'solid' },
};
