/**
 * Ponto de entrada de `@math-scape/player`. Liga cada peça do contrato à
 * implementação (fase 4, agente 4).
 */
import type { PropsRenderizadorParede } from '../contrato/index.ts';

export * from '../contrato/index.ts';
export { criarPartida } from './motor.ts';
export { calcularPalco, paraPixels, precisaAvisoResolucao } from './palco.ts';
export { razaoContraste, tema } from './tema.ts';
export { criarVerificadorHttp } from './verificador-http.ts';

function naoImplementado(nome: string): never {
  throw new Error(`${nome}: não implementado (fase 4)`);
}

export function RenderizadorParede(_props: PropsRenderizadorParede): never {
  return naoImplementado('RenderizadorParede');
}
