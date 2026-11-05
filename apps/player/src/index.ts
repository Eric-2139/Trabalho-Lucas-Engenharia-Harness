/** Superfície testável do app do jogador (fase 4, agente 4). */
import type { CriarClienteApiJogo } from '../contrato/index.ts';
import { criarClienteApiJogo as criarClienteApiJogoImpl } from './cliente-api.ts';

export * from '../contrato/index.ts';
export { EscolherFase } from './telas/EscolherFase.tsx';
export { TelaJogo } from './telas/TelaJogo.tsx';

export const criarClienteApiJogo: CriarClienteApiJogo = criarClienteApiJogoImpl;
