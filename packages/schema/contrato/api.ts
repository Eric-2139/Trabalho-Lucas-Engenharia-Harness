/**
 * Corpos e respostas da Api (contrato api.md), compartilhados por Api, Editor e Player.
 * Ficam no pacote de schema pelo mesmo motivo da fase: escritos uma vez, usados dos dois lados.
 *
 * Corpos de pedido usam z.object (não estrito): campos extras são descartados,
 * que é o comportamento exigido no cadastro (RNF-06).
 */
import { z } from 'zod';
import { LIMITES, ParedeId } from './fase.ts';

export const CorpoCadastro = z.object({
  nome: z.string().trim().min(1, 'informe o nome').max(100),
  email: z.email('e-mail inválido').max(254),
  /** Política de senha não está no baseline: só não vazia e com teto para o hash (ver modulos-api.md). */
  senha: z.string().min(1, 'informe a senha').max(128),
});
export type CorpoCadastro = z.infer<typeof CorpoCadastro>;

export const CorpoLogin = z.object({ email: z.string().min(1), senha: z.string().min(1).max(128) });
export type CorpoLogin = z.infer<typeof CorpoLogin>;

export const CorpoExcluirConta = z.object({ confirmar: z.literal(true, 'confirme a exclusão da conta') });

const titulo = z
  .string()
  .max(LIMITES.tituloMax)
  .refine((t) => t.trim().length > 0, 'o título não pode ficar vazio');
export const CorpoCriarFase = z.object({ titulo });
export const CorpoRenomearFase = z.object({ titulo });

/** O documento é validado à parte por `validarFase`, para devolver os erros por campo. */
export const CorpoSalvarFase = z.object({ revisao: z.number().int().min(0), documento: z.unknown() });

export const CorpoVerificar = z.object({
  objetoId: z.string().min(1).max(LIMITES.idObjetoMax),
  resposta: z.string().max(200),
});
export type CorpoVerificar = z.infer<typeof CorpoVerificar>;

// ----- Respostas -----
export interface UsuarioCriado {
  id: string;
  nome: string;
  email: string;
}
export interface ResumoFase {
  id: string;
  titulo: string;
  publicada: boolean;
  atualizadaEm: string;
}
export interface FaseDoDono {
  id: string;
  revisao: number;
  documento: unknown;
  publicada: boolean;
  alteracoesNaoPublicadas: boolean;
}
export interface FasePublicadaResumo {
  id: string;
  titulo: string;
}
export interface DigitoRevelado {
  posicao: number;
  valor: string;
}
export type RespostaVerificarEnigma = { correto: boolean; digitos: DigitoRevelado[] };
export type RespostaVerificarPorta = { aberta: boolean };
export interface RespostaLimite {
  tentarEmSegundos: number;
}
export interface RespostaErro {
  erro: string;
  detalhes?: unknown;
}
export interface AssetCriado {
  id: string;
  ref: `asset:${string}`;
  url: string;
}
/** Corpo do 422 de POST /fases/:id/publicar (LAC-039): segue o formato de erro da Api e acrescenta as posições. */
export interface RecusaPublicacao extends RespostaErro {
  /** Sempre "A fase não pode ser publicada: há posições da senha sem enigma." */
  erro: string;
  /** Posições (1-based, crescentes) sem enigma, como em validarJogabilidade. */
  posicoesSemEnigma: number[];
}

/** Parede ativa em rotas e telas; reexportada por conveniência. */
export { ParedeId };
