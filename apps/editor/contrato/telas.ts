/**
 * Telas do editor (modulos-editor.md §5). Cada tela recebe o cliente HTTP (e, na Edição, o relógio)
 * por propriedade, para os testes injetarem fakes. Textos de interface em português (RNF-07).
 *
 * Confirmações (excluir fase publicada, excluir conta) são um diálogo no DOM com `role="alertdialog"` e os
 * botões ROTULOS_EDITOR.confirmar / ROTULOS_EDITOR.cancelar, nunca `window.confirm`.
 * Recusas da Api aparecem como texto na tela (o `erro` do ResultadoHttp), num elemento com `role="alert"`.
 */
import type { Verificador } from '@math-scape/player/contrato';
import type { ClienteApiEditor, EstadoSalvamento, Relogio } from './salvamento.ts';

/** Nomes acessíveis dos controles e textos fixos que os testes procuram. */
export const ROTULOS_EDITOR = {
  // Login e cadastro (RF-01, RNF-06): campos com <label>.
  nome: 'Nome',
  email: 'E-mail',
  senha: 'Senha',
  entrar: 'Entrar',
  cadastrar: 'Cadastrar',

  // Minhas fases (RF-02, RF-14): um item por fase, com o título e os botões abaixo.
  novaFase: 'Nova fase',
  abrir: 'Abrir',
  renomear: 'Renomear',
  duplicar: 'Duplicar',
  excluir: 'Excluir',
  importar: 'Importar fase',
  /** Campo do novo título ao renomear ou criar. */
  titulo: 'Título',
  /** Fase publicada na lista. */
  publicada: 'Publicada',

  // Conta (RF-19).
  excluirConta: 'Excluir conta',

  // Diálogo de confirmação.
  confirmar: 'Confirmar',
  cancelar: 'Cancelar',

  // Barra de ferramentas (RF-09 a RF-14, RNF-07).
  desfazer: 'Desfazer',
  refazer: 'Refazer',
  salvar: 'Salvar',
  testar: 'Testar',
  publicar: 'Publicar',
  publicarDeNovo: 'Publicar de novo',
  exportar: 'Exportar',
  alteracoesNaoPublicadas: 'Alterações não publicadas',
  estadoSalvamento: {
    salvo: 'Salvo',
    pendente: 'Alterações pendentes',
    salvando: 'Salvando…',
    conflito: 'Conflito: a fase foi alterada em outro lugar',
    erro: 'Erro ao salvar',
  } satisfies Record<EstadoSalvamento, string>,

  /** Em conflito (409): lê a fase de novo (abrirFase), descarta a alteração local e recomeça o salvamento (ADR-002). */
  recarregarFase: 'Recarregar a fase',

  // Painel de propriedades (RF-07, RF-08, PEND-007).
  propriedadesDaFase: 'Propriedades da fase',
  tipo: 'Tipo',
  texto: 'Texto',
  pergunta: 'Pergunta',
  respostas: 'Respostas',
  dica: 'Dica',
  aplicar: 'Aplicar',

  // Biblioteca (RF-04, RF-06, LAC-029).
  objetos: 'Objetos',
  fundos: 'Fundos',
  minhasImagens: 'Minhas imagens',
  semFundo: 'Sem fundo',
  enviarImagem: 'Enviar imagem',
  usarComoObjeto: 'Usar como objeto',
  usarComoFundo: 'Usar como fundo',

  // Publicação recusada (RF-12): título da lista de posições sem enigma.
  posicoesSemEnigma: 'Posições da senha sem enigma',

  // Modo testar (RF-11).
  sairDoTeste: 'Sair do teste',

  // Aviso abaixo de 1280x720 (RNF-01): contém "1280x720"; não bloqueia a edição.
  avisoResolucao: 'Tela menor que 1280x720: algumas partes podem não caber.',
} as const;

/** RF-01, RNF-06: formulários nativos de entrar (e-mail, senha) e cadastrar (nome, e-mail, senha). */
export interface PropsTelaEntrar {
  cliente: Pick<ClienteApiEditor, 'entrar' | 'cadastrar'>;
  /** Login aceito, ou cadastro aceito seguido de login aceito. Recusa só mostra o erro. */
  aoEntrar: () => void;
}

/**
 * RF-02, RF-14: lista as fases do criador (`listarFases` ao montar) e permite criar, abrir, renomear,
 * duplicar, excluir (fase publicada pede confirmação) e importar. Depois de cada ação aceita, a lista é lida de novo.
 */
export interface PropsMinhasFases {
  cliente: Pick<
    ClienteApiEditor,
    'listarFases' | 'criarFase' | 'renomearFase' | 'duplicarFase' | 'excluirFase' | 'importarFase'
  >;
  aoAbrir: (faseId: string) => void;
}

/** RF-19: excluir a própria conta pede confirmação; cancelar não chama a Api. */
export interface PropsTelaConta {
  cliente: Pick<ClienteApiEditor, 'excluirConta'>;
  /** Conta excluída (204): o app volta ao login. */
  aoExcluirConta: () => void;
}

/**
 * Edição (RF-03 a RF-14, RNF-01, RNF-07): abre a fase (`abrirFase`), cria o store e o salvamento e mostra
 * AbasParedes, CanvasParede, BibliotecaObjetos, PainelPropriedades e BarraFerramentas.
 * - Ctrl+Z / Ctrl+Y por `atalhoTeclado`, ignorados com o foco num campo de texto (RF-09).
 * - Publicar: 422 mostra a lista ROTULOS_EDITOR.posicoesSemEnigma (RF-12); em fase publicada com rascunho diferente,
 *   mostra ROTULOS_EDITOR.alteracoesNaoPublicadas e ROTULOS_EDITOR.publicarDeNovo (RF-13, PEND-005).
 * - Testar: `salvarAgora`, `jogoTeste` e o motor do packages/player; ROTULOS_EDITOR.sairDoTeste volta à edição
 *   com o documento igual ao de antes (RF-11).
 * - Exportar baixa o envelope de `exportarFase` (RF-14).
 * - Ao desmontar (sair da rota) com alteração pendente, chama `salvarAgora` antes de `parar` (PEND-021); o app também grava
 *   no `pagehide` da janela.
 * - Salvamento em `conflito`: o automático não grava mais; ROTULOS_EDITOR.recarregarFase chama `abrirFase`, `store.carregar`
 *   e cria um salvamento novo com a revisão lida (ADR-002: duas abas não se sobrescrevem em silêncio).
 */
export interface PropsTelaEdicao {
  faseId: string;
  cliente: ClienteApiEditor;
  relogio: Relogio;
  baseUrlApi: string;
  /** Id dos objetos novos; padrão `crypto.randomUUID` (modulos-editor.md §2). Os testes passam ids fixos. */
  gerarId?: () => string;
  /** Modo testar: padrão `criarVerificadorHttp({ baseUrlApi, faseId, modo: 'teste' })`. */
  verificadorTeste?: Verificador;
  /** Voltar a Minhas fases. */
  aoSair: () => void;
  /**
   * PEND-020: contador que o app incrementa a cada login aceito depois de um 401 (`aoNaoAutenticado`). Quando o valor muda,
   * a Edição chama `salvarAgora`, e a alteração guardada em memória é gravada sem outra ação do criador.
   */
  sessaoRenovada?: number;
}
