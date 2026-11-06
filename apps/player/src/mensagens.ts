/** Textos da interface do app do jogador, em português (ADR-014, RNF-07). */
export const mensagens = {
  inicial: {
    titulo: 'Math Scape',
    apresentacao:
      'Um jogo de fuga com enigmas de matemática: resolva os enigmas de cada sala para descobrir a senha da porta.',
    linkFases: 'Escolher fase',
    linkEditor: 'Criar fases no editor',
  },
  navegacao: {
    carregando: 'Carregando…',
    voltarInicio: 'Voltar ao início',
    voltarFases: 'Voltar para Escolher fase',
    paginaNaoEncontrada: 'Página não encontrada.',
  },
  escolherFase: {
    titulo: 'Escolher fase',
    rotuloLista: 'Fases publicadas',
    nenhumaFase: 'Nenhuma fase publicada ainda.',
  },
  jogo: {
    rotuloParedes: 'Paredes da sala',
    paredes: {
      frente: 'Frente',
      direita: 'Direita',
      fundo: 'Fundo',
      esquerda: 'Esquerda',
      teto: 'Teto',
    },
    avisoResolucao: 'Sua janela é menor que 1280x720: o jogo pode ficar apertado.',
    /** Controle de dica (RF-17): numerado quando a parede tem mais de um enigma com dica. */
    verDica: (numero: number, total: number) => (total > 1 ? `Ver dica ${numero}` : 'Ver dica'),
    /** Campo único de resposta ou senha (RF-15, PEND-012). */
    rotuloResposta: 'Sua resposta',
    rotuloSenha: 'Senha da porta',
    botaoResponder: 'Responder',
    /** Dígitos já revelados, em ordem de posição; os que faltam aparecem como "_". */
    senhaRevelada: (casas: readonly string[]) => `Senha da porta: ${casas.join(' ')}`,
    fimDeJogo: 'A porta abriu! Você escapou da sala.',
  },
  http: {
    semRede: 'Não foi possível falar com o servidor. Tente de novo.',
  },
} as const;
