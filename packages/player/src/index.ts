/**
 * Ponto de entrada de `@math-scape/player`. Liga cada peça do contrato à
 * implementação (fase 4, agente 4).
 */
import type { PropsRenderizadorParede, RazaoContraste, Tema } from '../contrato/index.ts';

export * from '../contrato/index.ts';
export { criarPartida } from './motor.ts';
export { calcularPalco, paraPixels, precisaAvisoResolucao } from './palco.ts';
export { criarVerificadorHttp } from './verificador-http.ts';

function naoImplementado(nome: string): never {
  throw new Error(`${nome}: não implementado (fase 4)`);
}

export const razaoContraste: RazaoContraste = () => naoImplementado('razaoContraste');
/** Fica em src/tema.ts na implementação (ADR-014). */
export const tema: Tema = new Proxy({} as Tema, { get: () => naoImplementado('tema') });
export function RenderizadorParede(_props: PropsRenderizadorParede): never {
  return naoImplementado('RenderizadorParede');
}
