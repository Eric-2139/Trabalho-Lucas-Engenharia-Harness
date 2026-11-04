/** Marca de função ainda não implementada: o teste falha com mensagem clara em vez de "undefined is not a function". */
export function naoImplementado(nome: string): never {
  throw new Error(`${nome}: não implementado (fase 4)`);
}
