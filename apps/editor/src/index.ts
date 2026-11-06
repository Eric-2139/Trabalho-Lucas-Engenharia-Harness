/**
 * Superfície testável do editor: store, salvamento, cliente HTTP, atalhos e componentes.
 * A implementação (fase 4, agente 4) substitui cada stub mantendo o tipo do contrato.
 * O app em si (main.tsx, rotas, telas) também fica em src/.
 */
import type {
  PropsTelaConta,
  PropsTelaEdicao,
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
export { BarraFerramentas } from './componentes/BarraFerramentas.tsx';
export { TelaEntrar } from './telas/TelaEntrar.tsx';
export { MinhasFases } from './telas/MinhasFases.tsx';

export function TelaConta(_props: PropsTelaConta): never {
  return naoImplementado('TelaConta');
}
export function TelaEdicao(_props: PropsTelaEdicao): never {
  return naoImplementado('TelaEdicao');
}
