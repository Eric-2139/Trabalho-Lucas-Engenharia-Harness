/**
 * Motor do player (contrato player.md, ADR-009): MotorInteracoes + EstadoPartida.
 * Não depende de React: o app público e o modo testar do editor o envolvem em componentes.
 * Recebe só a projeção de jogo e nunca decide acerto sozinho (RNF-04).
 */
import type {
  DigitoRevelado,
  FaseJogo,
  ParedeId,
  RespostaVerificarEnigma,
  RespostaVerificarPorta,
} from '@math-scape/schema/contrato';

/** 429 da Api (ADR-003). */
export type Limitado = { limitado: true; tentarEmSegundos: number };

/** Quem confere as respostas: sempre a Api (modo jogo ou modo teste). Injetado no motor. */
export interface Verificador {
  enigma(objetoId: string, resposta: string): Promise<RespostaVerificarEnigma | Limitado>;
  porta(objetoId: string, senha: string): Promise<RespostaVerificarPorta | Limitado>;
}

/** Textos fixos do jogo, iguais aos do legado (RF-18). */
export const MENSAGENS = {
  respostaErrada: 'Resposta Errada!!',
  /**
   * Acerto (LAC-035). Sem dígitos (ex.: esquerda da Escola): "Resposta correta!". Com dígitos, em ordem de posição:
   * "Resposta correta! Dígito revelado: posição 4 = 3" ou "... Dígitos revelados: posição 1 = 9, posição 2 = 2".
   */
  respostaCorreta: (digitos: readonly DigitoRevelado[]) =>
    digitos.length === 0
      ? 'Resposta correta!'
      : `Resposta correta! ${digitos.length === 1 ? 'Dígito revelado' : 'Dígitos revelados'}: ${[...digitos]
          .sort((a, b) => a.posicao - b.posicao)
          .map((d) => `posição ${d.posicao} = ${d.valor}`)
          .join(', ')}`,
  senhaIncorreta: 'Senha incorreta!',
  limitado: (segundos: number) => `Muitas tentativas, aguarde ${segundos} s`,
  falhaDeRede: 'Não foi possível falar com o servidor. Tente de novo.',
  semPergunta: 'Este objeto não tem pergunta nem senha.',
} as const;

/** O que acontece ao clicar num objeto (RF-16). */
export type EventoClique =
  | { tipo: 'nenhum' } // decoração: nada muda
  | { tipo: 'fala'; texto: string }
  | { tipo: 'pedirResposta'; objetoId: string; pergunta: string }
  | { tipo: 'pedirSenha'; objetoId: string; tamanhoSenha: number };

export type ResultadoResposta =
  | { tipo: 'correto'; digitos: DigitoRevelado[]; mensagem: string }
  | { tipo: 'errado'; mensagem: string }
  | { tipo: 'aberta' }
  | { tipo: 'senhaIncorreta'; mensagem: string }
  | { tipo: 'limitado'; tentarEmSegundos: number; mensagem: string }
  | { tipo: 'falha'; mensagem: string };

export interface EstadoPartida {
  paredeAtiva: ParedeId;
  /** posição (1-based) → dígito revelado. Errar não apaga nada. */
  digitosRevelados: Record<number, string>;
  /** ids dos enigmas já acertados. */
  enigmasResolvidos: string[];
  /** true depois que a porta abriu. */
  concluida: boolean;
}

export interface Partida {
  estado(): EstadoPartida;
  /** Avisa a cada mudança de estado; devolve a função que cancela a assinatura. */
  assinar(ouvinte: (estado: EstadoPartida) => void): () => void;
  trocarParede(parede: ParedeId): void;
  /** Objeto inexistente na parede ativa → { tipo: 'nenhum' }. */
  /** Enigma já resolvido continua respondível, como no legado: acertar de novo repete a mensagem e não muda o estado. */
  clicar(objetoId: string): EventoClique;
  /** Texto da dica do enigma, ou null sem dica: sem dica não há ícone (RF-17). */
  dica(objetoId: string): string | null;
  /**
   * Enigma: verificador.enigma; porta: verificador.porta. Nunca rejeita (LAC-036):
   * - objeto inexistente na parede ativa, decoração ou fala → { tipo: 'falha', mensagem: MENSAGENS.semPergunta };
   * - verificador rejeitou (rede) → { tipo: 'falha', mensagem: MENSAGENS.falhaDeRede }.
   * Em nenhum dos dois casos o estado muda.
   */
  responder(objetoId: string, texto: string): Promise<ResultadoResposta>;
}

/** A partida começa na parede da frente, sem dígitos, não concluída. */
export type CriarPartida = (fase: FaseJogo, verificador: Verificador) => Partida;

/**
 * Verificador que fala com `POST /fases/:id/verificar` (modo 'teste' acrescenta `?modo=teste`
 * e manda o cookie). 429 vira Limitado; erro de rede rejeita a promessa.
 */
export type CriarVerificadorHttp = (opcoes: {
  baseUrlApi: string;
  faseId: string;
  modo: 'jogo' | 'teste';
  fetch?: typeof globalThis.fetch;
}) => Verificador;
