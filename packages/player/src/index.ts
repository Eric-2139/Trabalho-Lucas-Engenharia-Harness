/**
 * Ponto de entrada de `@math-scape/player`. Liga cada peça do contrato à
 * implementação (fase 4, agente 4).
 */
import type {
  CalcularPalco,
  CriarPartida,
  CriarVerificadorHttp,
  ParaPixels,
  PrecisaAvisoResolucao,
  PropsRenderizadorParede,
  RazaoContraste,
  Tema,
} from '../contrato/index.ts';

export * from '../contrato/index.ts';

function naoImplementado(nome: string): never {
  throw new Error(`${nome}: não implementado (fase 4)`);
}

export const criarPartida: CriarPartida = () => naoImplementado('criarPartida');
export const criarVerificadorHttp: CriarVerificadorHttp = () => naoImplementado('criarVerificadorHttp');
export const calcularPalco: CalcularPalco = () => naoImplementado('calcularPalco');
export const paraPixels: ParaPixels = () => naoImplementado('paraPixels');
export const precisaAvisoResolucao: PrecisaAvisoResolucao = () => naoImplementado('precisaAvisoResolucao');
export const razaoContraste: RazaoContraste = () => naoImplementado('razaoContraste');
/** Fica em src/tema.ts na implementação (ADR-014). */
export const tema: Tema = new Proxy({} as Tema, { get: () => naoImplementado('tema') });
export function RenderizadorParede(_props: PropsRenderizadorParede): never {
  return naoImplementado('RenderizadorParede');
}
