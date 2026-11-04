/** Superfície testável da Api (fase 4, agente 4). O processo do servidor fica em src/servidor.ts. */
import type { ConstruirApp, CriarArmazenamentoEmDisco, DetectarTipoImagem } from '../contrato/index.ts';

export * from '../contrato/index.ts';

function naoImplementado(nome: string): never {
  throw new Error(`${nome}: não implementado (fase 4)`);
}

export const construirApp: ConstruirApp = async () => naoImplementado('construirApp');
export const criarArmazenamentoEmDisco: CriarArmazenamentoEmDisco = () => naoImplementado('criarArmazenamentoEmDisco');
export const detectarTipoImagem: DetectarTipoImagem = () => naoImplementado('detectarTipoImagem');
