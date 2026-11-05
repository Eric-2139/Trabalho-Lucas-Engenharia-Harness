/**
 * RF-12, PEND-007: posições da senha (1-based, em ordem crescente) que nenhum enigma revela.
 * Não confere porta: fase sem porta é publicável.
 */
import { type Fase, PAREDES } from '../contrato/fase.ts';

export function validarJogabilidade(fase: Fase): { jogavel: boolean; posicoesSemEnigma: number[] } {
  const reveladas = new Set<number>();
  for (const parede of PAREDES) {
    for (const objeto of fase.paredes[parede].objetos) {
      if (objeto.interacao.tipo !== 'enigma') continue;
      for (const posicao of objeto.interacao.revela) {
        reveladas.add(posicao);
      }
    }
  }
  const posicoesSemEnigma: number[] = [];
  for (let posicao = 1; posicao <= fase.senha.length; posicao++) {
    if (!reveladas.has(posicao)) posicoesSemEnigma.push(posicao);
  }
  return { jogavel: posicoesSemEnigma.length === 0, posicoesSemEnigma };
}
