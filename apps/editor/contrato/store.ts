/**
 * Store do editor (contrato editor.md): Zustand + zundo.
 * ADR-011: toda ação calcula o documento resultante e só o aplica se `validarFase` aceitar.
 * ADR-008: o histórico (desfazer/refazer) cobre só `documento`; um passo por ação.
 */
import type { ErroValidacao, Fase, Interacao, ParedeId, RefImagem, TipoInteracao } from '@math-scape/schema/contrato';
import type { StoreApi } from 'zustand';

/**
 * Resultado das ações que alteram o documento. Recusa = nada muda e nenhum passo de histórico.
 * - Recusa do schema: `erros` são os de `validarFase` (caminho dentro da fase).
 * - Recusas que não vêm do schema (LAC-037) têm exatamente um erro:
 *   objeto inexistente → { caminho: ['objetoId'], mensagem: 'O objeto "<id>" não existe nesta fase.' };
 *   mudarCamada no extremo → { caminho: ['camada'], mensagem: 'O objeto já está na frente de todos.' | 'O objeto já está atrás de todos.' };
 *   alterarPropriedadesFase encurtando a senha → { caminho: ['senha'], mensagem: 'Ajuste os enigmas que revelam posições que deixariam de existir.' }, com `enigmasAfetados`.
 */
export type ResultadoAcao =
  | { ok: true }
  | {
      ok: false;
      erros: ErroValidacao[];
      /** Encurtar a senha: ids dos enigmas que revelam posições que deixariam de existir. */
      enigmasAfetados?: string[];
    };

export interface Geometria {
  x: number;
  y: number;
  largura: number;
  altura: number;
  rotacao: number;
}

export interface EstadoEditor {
  documento: Fase;
  paredeAtiva: ParedeId;
  selecionado: string | null;

  trocarParede(parede: ParedeId): void;
  selecionar(objetoId: string | null): void;

  /** Biblioteca (RF-04): insere `objetoPadrao(tipo, imagem, id)` na parede ativa, na camada mais alta, e o seleciona. */
  adicionarObjeto(tipo: TipoInteracao, imagem: RefImagem, id: string): ResultadoAcao;
  /** Fim de um arraste ou transformação (ADR-007): um passo de histórico. Valores fora de 0..1 são limitados; rotação normalizada para [0, 360). */
  alterarGeometria(objetoId: string, geometria: Partial<Geometria>): ResultadoAcao;
  /**
   * RF-05 (LAC-032): renumera as camadas da parede de 0 a n-1 na ordem visual atual (camada, depois posição na lista)
   * e troca o objeto com o vizinho de cima ('frente') ou de baixo ('tras'). Assim a sobreposição sempre muda, mesmo
   * com camadas empatadas. Já no extremo: recusa com o erro definido em ResultadoAcao ("O objeto já está na frente de todos." / "O objeto já está atrás de todos."), sem passo de histórico.
   */
  mudarCamada(objetoId: string, direcao: 'frente' | 'tras'): ResultadoAcao;
  /** RF-05: cópia na mesma parede, deslocada, com o novo id. */
  duplicarObjeto(objetoId: string, novoId: string): ResultadoAcao;
  excluirObjeto(objetoId: string): ResultadoAcao;
  /** Painel de propriedades (RF-07, RF-08): troca tipo ou campos da interação. */
  alterarInteracao(objetoId: string, interacao: Interacao): ResultadoAcao;
  alterarImagem(objetoId: string, imagem: RefImagem): ResultadoAcao;
  definirFundo(parede: ParedeId, imagem: RefImagem | null): ResultadoAcao;
  /** Propriedades da fase (PEND-007): título e senha. Encurtar a senha recusa com `enigmasAfetados`. */
  alterarPropriedadesFase(propriedades: { titulo?: string; senha?: string }): ResultadoAcao;
  /** Documento novo vindo do servidor (abrir fase, renomear): substitui e limpa o histórico. */
  carregar(documento: Fase): void;

  desfazer(): void;
  refazer(): void;
  podeDesfazer(): boolean;
  podeRefazer(): boolean;
}

export type StoreEditor = StoreApi<EstadoEditor>;

/** Cria um store novo para a fase aberta. Começa na parede da frente, sem seleção, histórico vazio. */
export type CriarStoreEditor = (documento: Fase) => StoreEditor;

/** RF-09: Ctrl+Z → 'desfazer'; Ctrl+Y → 'refazer' (Cmd no macOS); qualquer outra tecla → null. */
export type AtalhoTeclado = (evento: {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
}) => 'desfazer' | 'refazer' | null;
