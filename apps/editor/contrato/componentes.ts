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
 * Tipo do dado do arraste da biblioteca até o palco (RF-04, LAC-045). O `dataTransfer` leva a `RefImagem` do item
 * neste tipo; o palco só aceita o arraste que o tiver.
 */
export const TIPO_ARRASTE_BIBLIOTECA = 'application/x-math-scape-ref';

/**
 * RF-04, RF-06 (LAC-029): três seções. "Objetos" (catálogo, categoria 'objeto'), "Fundos" (catálogo, categoria
 * 'fundo', mais "sem fundo") e "Minhas imagens" (uploads). Cada imagem enviada pode ser usada como objeto ou como
 * fundo da parede ativa. Clique ou Enter num item chama `aoEscolher` (o objeto nasce no centro da parede).
 * Arraste (LAC-045, Eric em 06/11/2026): cada botão da seção "Objetos" é `draggable`; no `dragstart`, grava a
 * `RefImagem` do sprite (`sprite:<id>`) no `dataTransfer` com o tipo TIPO_ARRASTE_BIBLIOTECA. Quem recebe é o
 * CanvasParede (`aoSoltar`); a biblioteca não chama `aoEscolher` no arraste.
 */
export interface PropsBibliotecaObjetos {
  catalogo: readonly SpriteCatalogo[];
  /**
   * Referências `asset:<uuid>` já usadas na fase mais as enviadas nesta sessão, sem repetição.
   * LAC-043 (Eric em 06/11/2026, opção a): `referenciasDeAsset` do schema devolve uuids puros (a Api os usa); a
   * Edição converte cada um em `asset:<uuid>` antes de montar esta lista.
   */
  imagensEnviadas: readonly RefImagem[];
  /** objeto → store.adicionarObjeto('decoracao', ref, id); fundo → store.definirFundo(paredeAtiva, ref); `null` = sem fundo. */
  aoEscolher: (ref: RefImagem | null, destino: 'objeto' | 'fundo') => void;
  /** POST /assets; sucesso acrescenta a referência a `imagensEnviadas`; recusa mostra a mensagem da Api. */
  aoEnviarImagem: (arquivo: File) => void;
}

/**
 * RF-07, RF-08, ADR-011: edita num rascunho local; só chama `aoAplicar` com valores válidos e mostra o erro dos inválidos.
 * RF-05 (LAC-044, Eric em 06/11/2026): com objeto selecionado, o painel mostra também 4 botões, com os nomes de
 * ROTULOS_EDITOR: `trazerParaFrente` → store.mudarCamada(id, 'frente'); `enviarParaTras` → store.mudarCamada(id, 'tras');
 * `duplicarObjeto` → store.duplicarObjeto(id, gerarId()) e, se aceito, store.selecionar(novoId);
 * `excluirObjeto` → store.excluirObjeto(id) (a seleção some e o painel volta a Propriedades da fase).
 * A recusa do store (ex.: já na frente de todos) aparece em `role="alert"` com `erros[0].mensagem`.
 * Sem objeto selecionado, nenhum dos 4 aparece.
 */
export interface PropsPainelPropriedades {
  objeto: Objeto | null;
  /** Sem objeto selecionado: painel Propriedades da fase (título e senha). */
  fase: Pick<Fase, 'titulo' | 'senha'>;
  store: StoreEditor;
  /** Id da cópia ao duplicar; padrão `crypto.randomUUID` (modulos-editor.md §2). Os testes passam ids fixos. */
  gerarId?: () => string;
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

/**
 * RF-05, ADR-007: palco Konva da parede ativa; arraste vive no nó e só chega ao store no fim do gesto.
 * O Stage tem o tamanho recebido (`larguraConteiner` × `alturaConteiner`), que a Edição mede no elemento que contém o
 * palco (LAC-046), e a parede é o maior 16:9 centralizado dentro dele (`calcularPalco`).
 * RF-04 (LAC-045): o Stage fica dentro de um elemento com `role="region"` e nome ROTULOS_EDITOR.palco, que aceita o
 * arraste da biblioteca: `dragover` com o tipo TIPO_ARRASTE_BIBLIOTECA chama `preventDefault`; no `drop`, lê a
 * `RefImagem` e chama `aoSoltar(ref, posicao)`, com o ponto convertido para frações da parede (0..1) pelo palco 16:9
 * e limitado a 0..1. Arraste sem esse tipo é ignorado.
 */
export interface PropsCanvasParede {
  store: StoreEditor;
  baseUrlApi: string;
  larguraConteiner: number;
  alturaConteiner: number;
  /** Item da biblioteca solto no palco; a Edição chama store.adicionarObjeto('decoracao', ref, gerarId(), posicao). */
  aoSoltar?: (ref: RefImagem, posicao: { x: number; y: number }) => void;
}
