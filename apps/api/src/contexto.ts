/** Dependências compartilhadas pelas rotas, montadas uma vez em `construirApp`. */
import type { Armazenamento } from '../contrato/index.ts';
import type { Banco } from './banco.ts';
import type { Sessoes } from './plugins/sessao.ts';

export interface Contexto {
  banco: Banco;
  armazenamento: Armazenamento;
  sessoes: Sessoes;
}
