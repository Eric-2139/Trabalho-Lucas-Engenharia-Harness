/**
 * Superfície testável do editor: store, salvamento, cliente HTTP, atalhos e componentes.
 * A implementação (fase 4, agente 4) substitui cada stub mantendo o tipo do contrato.
 * O app em si (main.tsx, rotas, telas) também fica em src/.
 */
import type {
  PropsBarraFerramentas,
  PropsMinhasFases,
  PropsTelaConta,
  PropsTelaEdicao,
  PropsTelaEntrar,
} from '../contrato/index.ts';

export * from '../contrato/index.ts';

function naoImplementado(nome: string): never {
  throw new Error(`${nome}: não implementado (fase 4)`);
}

export { criarStoreEditor } from './store/index.ts';
export { atalhoTeclado } from './atalhos.ts';
export { criarSalvamento } from './salvamento.ts';
export { criarClienteApiEditor } from './cliente-api.ts';
export { AbasParedes } from './componentes/AbasParedes.tsx';
export { CanvasParede } from './componentes/CanvasParede.tsx';
export { BibliotecaObjetos } from './componentes/BibliotecaObjetos.tsx';
export { PainelPropriedades } from './componentes/PainelPropriedades.tsx';

export function BarraFerramentas(_props: PropsBarraFerramentas): never {
  return naoImplementado('BarraFerramentas');
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
