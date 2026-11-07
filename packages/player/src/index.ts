/**
 * Ponto de entrada de `@math-scape/player`. Liga cada peça do contrato à
 * implementação (fase 4, agente 4).
 */
export * from '../contrato/index.ts';
export { criarPartida } from './motor.ts';
export { calcularPalco, paraPixels, precisaAvisoResolucao } from './palco.ts';
export { RenderizadorParede } from './RenderizadorParede.tsx';
export { estiloTema, razaoContraste, tema } from './tema.ts';
export { criarVerificadorHttp } from './verificador-http.ts';
