/**
 * Propriedades dos componentes React do editor (especificação em
 * harness/projeto/programa/modulos-editor.md). Textos de interface em português (RNF-07).
 */
import type { Fase, Objeto, ParedeId, RefImagem, SpriteCatalogo } from '@math-scape/schema/contrato';
import type { EstadoSalvamento } from './salvamento.ts';
import type { StoreEditor } from './store.ts';

/** RF-03: 5 abas na ordem frente, direita, fundo, esquerda, teto; a ativa tem aria-selected. */
export interface PropsAbasParedes {
  paredeAtiva: ParedeId;
  aoTrocar: (parede: ParedeId) => void;
}

/**
 * RF-04, RF-06 (LAC-029): três seções. "Objetos" (catálogo, categoria 'objeto'), "Fundos" (catálogo, categoria
 * 'fundo', mais "sem fundo") e "Minhas imagens" (uploads). Cada imagem enviada pode ser usada como objeto ou como
 * fundo da parede ativa. Arrastar ou Enter num item chama `aoEscolher`.
 */
export interface PropsBibliotecaObjetos {
  catalogo: readonly SpriteCatalogo[];
  /** Referências `asset:` já usadas na fase (referenciasDeAsset) mais as enviadas nesta sessão, sem repetição. */
  imagensEnviadas: readonly RefImagem[];
  /** objeto → store.adicionarObjeto('decoracao', ref, id); fundo → store.definirFundo(paredeAtiva, ref); `null` = sem fundo. */
  aoEscolher: (ref: RefImagem | null, destino: 'objeto' | 'fundo') => void;
  /** POST /assets; sucesso acrescenta a referência a `imagensEnviadas`; recusa mostra a mensagem da Api. */
  aoEnviarImagem: (arquivo: File) => void;
}

/** RF-07, RF-08, ADR-011: edita num rascunho local; só chama `aoAplicar` com valores válidos e mostra o erro dos inválidos. */
export interface PropsPainelPropriedades {
  objeto: Objeto | null;
  /** Sem objeto selecionado: painel Propriedades da fase (título e senha). */
  fase: Pick<Fase, 'titulo' | 'senha'>;
  store: StoreEditor;
}

/** RNF-07: barra operável por teclado (botões nativos, foco visível). */
export interface PropsBarraFerramentas {
  estadoSalvamento: EstadoSalvamento;
  podeDesfazer: boolean;
  podeRefazer: boolean;
  alteracoesNaoPublicadas: boolean;
  aoDesfazer: () => void;
  aoRefazer: () => void;
  aoSalvar: () => void;
  aoTestar: () => void;
  aoPublicar: () => void;
  aoExportar: () => void;
}

/** RF-05, ADR-007: palco Konva da parede ativa; arraste vive no nó e só chega ao store no fim do gesto. */
export interface PropsCanvasParede {
  store: StoreEditor;
  baseUrlApi: string;
  larguraConteiner: number;
  alturaConteiner: number;
}
