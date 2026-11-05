/** ClienteApiJogo (RF-13, modulos-player.md §2): leitura das fases publicadas. Nunca rejeita (LAC-038). */
import type { FaseJogo, FasePublicadaResumo } from '@math-scape/schema/contrato';
import type { CriarClienteApiJogo } from '../contrato/index.ts';
import { fetchPadrao, requisitar } from './http.ts';

export const criarClienteApiJogo: CriarClienteApiJogo = (baseUrlApi, fetch) => {
  const f = fetchPadrao(fetch);
  return {
    listarPublicadas: () => requisitar<FasePublicadaResumo[]>(f, `${baseUrlApi}/publicadas`, { method: 'GET' }),
    obterJogo: (id) => requisitar<FaseJogo>(f, `${baseUrlApi}/publicadas/${encodeURIComponent(id)}/jogo`, { method: 'GET' }),
  };
};
