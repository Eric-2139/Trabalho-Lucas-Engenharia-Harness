/**
 * Superfície testável do editor: store, salvamento, cliente HTTP, atalhos e componentes.
 * A implementação (fase 4, agente 4) substitui cada stub mantendo o tipo do contrato.
 * O app em si (main.tsx, rotas, telas) também fica em src/.
 */
import type {
  AtalhoTeclado,
  CriarClienteApiEditor,
  CriarSalvamento,
  CriarStoreEditor,
  PropsAbasParedes,
  PropsBarraFerramentas,
  PropsBibliotecaObjetos,
  PropsCanvasParede,
  PropsMinhasFases,
  PropsPainelPropriedades,
  PropsTelaConta,
  PropsTelaEdicao,
  PropsTelaEntrar,
} from '../contrato/index.ts';

export * from '../contrato/index.ts';

function naoImplementado(nome: string): never {
  throw new Error(`${nome}: não implementado (fase 4)`);
}

export const criarStoreEditor: CriarStoreEditor = () => naoImplementado('criarStoreEditor');
export const atalhoTeclado: AtalhoTeclado = () => naoImplementado('atalhoTeclado');
export const criarSalvamento: CriarSalvamento = () => naoImplementado('criarSalvamento');
export const criarClienteApiEditor: CriarClienteApiEditor = () => naoImplementado('criarClienteApiEditor');

export function AbasParedes(_props: PropsAbasParedes): never {
  return naoImplementado('AbasParedes');
}
export function BibliotecaObjetos(_props: PropsBibliotecaObjetos): never {
  return naoImplementado('BibliotecaObjetos');
}
export function PainelPropriedades(_props: PropsPainelPropriedades): never {
  return naoImplementado('PainelPropriedades');
}
export function BarraFerramentas(_props: PropsBarraFerramentas): never {
  return naoImplementado('BarraFerramentas');
}
export function CanvasParede(_props: PropsCanvasParede): never {
  return naoImplementado('CanvasParede');
}
export function TelaEntrar(_props: PropsTelaEntrar): never {
  return naoImplementado('TelaEntrar');
}
export function MinhasFases(_props: PropsMinhasFases): never {
  return naoImplementado('MinhasFases');
}
export function TelaConta(_props: PropsTelaConta): never {
  return naoImplementado('TelaConta');
}
export function TelaEdicao(_props: PropsTelaEdicao): never {
  return naoImplementado('TelaEdicao');
}
