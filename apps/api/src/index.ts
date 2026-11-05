/** Superfície testável da Api (fase 4, agente 4). O processo do servidor fica em src/servidor.ts. */
import type { ConstruirApp, CriarArmazenamentoEmDisco, DetectarTipoImagem } from '../contrato/index.ts';
import { construirApp as construirAppImpl } from './app.ts';

export * from '../contrato/index.ts';

function naoImplementado(nome: string): never {
  throw new Error(`${nome}: não implementado (fase 4)`);
}

export const construirApp: ConstruirApp = construirAppImpl;
export const criarArmazenamentoEmDisco: CriarArmazenamentoEmDisco = () => naoImplementado('criarArmazenamentoEmDisco');
export const detectarTipoImagem: DetectarTipoImagem = () => naoImplementado('detectarTipoImagem');
