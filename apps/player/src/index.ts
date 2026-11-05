/** Superfície testável do app do jogador (fase 4, agente 4). */
import type { CriarClienteApiJogo, PropsTelaJogo } from '../contrato/index.ts';

export * from '../contrato/index.ts';
export { EscolherFase } from './telas/EscolherFase.tsx';

function naoImplementado(nome: string): never {
  throw new Error(`${nome}: não implementado (fase 4)`);
}

export const criarClienteApiJogo: CriarClienteApiJogo = () => naoImplementado('criarClienteApiJogo');
export function TelaJogo(_props: PropsTelaJogo): never {
  return naoImplementado('TelaJogo');
}
