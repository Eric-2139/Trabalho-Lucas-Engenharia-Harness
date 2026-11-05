/**
 * Projeção de jogo na Api (modulos-api.md §2 "Projeções", RNF-04, ADR-003): o documento guardado
 * passa por `validarFase` e `projetarParaJogo`, e o resultado é conferido pelo `FaseJogo` estrito
 * antes de responder. Se algo fora do esperado aparecer, a rota falha (500) em vez de vazar
 * `respostas`, `senha` ou `revela`.
 */
import { type Fase, FaseJogo, projetarParaJogo, validarFase } from '@math-scape/schema';

/** Documento guardado no banco como `Fase`; documento fora do schema é erro interno. */
export function faseGuardada(documento: unknown): Fase {
  const resultado = validarFase(documento);
  if (!resultado.ok) throw new Error('documento guardado fora do schema da fase');
  return resultado.fase;
}

export function projecaoDeJogo(documento: unknown): FaseJogo {
  return FaseJogo.parse(projetarParaJogo(faseGuardada(documento)));
}
