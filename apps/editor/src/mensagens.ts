/**
 * Textos do app do criador que não estão em ROTULOS_EDITOR (modulos-editor.md §1, RNF-07): navegação, sessão e
 * estados de carga do ponto de entrada. Os nomes acessíveis das telas continuam em ROTULOS_EDITOR (contrato telas.ts).
 */
export const mensagens = {
  app: {
    titulo: 'Math Scape — Editor',
  },
  navegacao: {
    rotulo: 'Navegação do editor',
    minhasFases: 'Minhas fases',
    conta: 'Conta',
    sair: 'Sair',
    carregando: 'Carregando…',
    paginaNaoEncontrada: 'Página não encontrada.',
    voltarMinhasFases: 'Voltar para Minhas fases',
  },
  sessao: {
    /** Login por cima da tela atual, depois de um 401 durante o uso (RF-01). */
    rotuloLogin: 'Entrar no editor',
    sessaoExpirada: 'Sua sessão terminou. Entre de novo: a alteração em andamento continua guardada nesta tela.',
  },
} as const;
