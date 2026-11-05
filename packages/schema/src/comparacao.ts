/**
 * RF-15, PEND-008, ADR-003: comparação da resposta do enigma (só o número) e da senha da porta
 * (sequência exata de dígitos).
 */

const NUMERO = /-?\d+(?:[.,]\d+)?/g;

export function respostaConfere(digitada: string, cadastradas: number[]): boolean {
  const numeros = digitada.match(NUMERO);
  if (numeros === null || numeros.length !== 1) return false;
  const valor = Number(numeros[0].replace(',', '.'));
  return cadastradas.some((resposta) => resposta === valor);
}

export function senhaConfere(digitada: string, senha: string): boolean {
  return digitada.replace(/\s/g, '') === senha;
}
