/** Superfície testável da Api (fase 4, agente 4). O processo do servidor fica em src/servidor.ts. */
import type { ConstruirApp, CriarArmazenamentoEmDisco, DetectarTipoImagem } from '../contrato/index.ts';
import { construirApp as construirAppImpl } from './app.ts';
import { criarArmazenamentoEmDisco as criarArmazenamentoEmDiscoImpl } from './armazenamento/disco.ts';
import { detectarTipoImagem as detectarTipoImagemImpl } from './imagens.ts';

export * from '../contrato/index.ts';

export const construirApp: ConstruirApp = construirAppImpl;
export const criarArmazenamentoEmDisco: CriarArmazenamentoEmDisco = criarArmazenamentoEmDiscoImpl;
export const detectarTipoImagem: DetectarTipoImagem = detectarTipoImagemImpl;
