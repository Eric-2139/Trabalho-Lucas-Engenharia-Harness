/** Superfície testável do app do jogador (fase 4, agente 4). */
import type { CriarClienteApiJogo, PropsEscolherFase, PropsTelaJogo } from '../contrato/index.ts';

export * from '../contrato/index.ts';

function naoImplementado(nome: string): never {
  throw new Error(`${nome}: não implementado (fase 4)`);
}

export const criarClienteApiJogo: CriarClienteApiJogo = () => naoImplementado('criarClienteApiJogo');
export function EscolherFase(_props: PropsEscolherFase): never {
  return naoImplementado('EscolherFase');
}
export function TelaJogo(_props: PropsTelaJogo): never {
  return naoImplementado('TelaJogo');
}
