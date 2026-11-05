/** Textos da interface do app do jogador, em português (ADR-014, RNF-07). */
export const mensagens = {
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
  },
  http: {
    semRede: 'Não foi possível falar com o servidor. Tente de novo.',
  },
} as const;
