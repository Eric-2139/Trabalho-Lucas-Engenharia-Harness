/**
 * App público do jogador (contrato player.md): tela inicial, Escolher Fase e jogo. Sem login (RF-01).
 */
import type { Verificador } from '@math-scape/player/contrato';
import type { FaseJogo, FasePublicadaResumo } from '@math-scape/schema/contrato';

/**
 * Resultado de toda chamada dos clientes HTTP. Os clientes nunca rejeitam a promessa (LAC-038):
 * - resposta 2xx → { ok: true, valor } (corpo JSON; sem corpo, valor undefined);
 * - resposta de erro com corpo { erro, detalhes? } → { ok: false, status, erro, detalhes };
 * - resposta de erro sem corpo JSON → { ok: false, status, erro: "Erro <status> do servidor." };
 * - sem resposta (falha de rede, fetch rejeitado) → { ok: false, status: 0, erro: "Não foi possível falar com o servidor. Tente de novo." }.
 */
export type ResultadoHttp<T> = { ok: true; valor: T } | { ok: false; status: number; erro: string; detalhes?: unknown };

export interface ClienteApiJogo {
  /** GET /publicadas (RF-13). */
  listarPublicadas(): Promise<ResultadoHttp<FasePublicadaResumo[]>>;
  /** GET /publicadas/:id/jogo (RF-13, RNF-04). */
  obterJogo(id: string): Promise<ResultadoHttp<FaseJogo>>;
}

export type CriarClienteApiJogo = (baseUrlApi: string, fetch?: typeof globalThis.fetch) => ClienteApiJogo;

/**
 * Escolher Fase (RF-13, RNF-07): uma lista de links/botões nativos, um por fase, na ordem recebida;
 * Tab percorre, Enter abre; lista vazia mostra "Nenhuma fase publicada ainda.".
 */
export interface PropsEscolherFase {
  fases: FasePublicadaResumo[];
  aoAbrir: (id: string) => void;
}

/**
 * Tela de jogo: botões das 5 paredes, palco 16:9, falas, caixa de resposta, ícone de dica,
 * dígitos revelados e aviso abaixo de 1280×720 (RNF-01, RNF-02). Ao abrir a porta, mostra o fim.
 *
 * Layout (LAC-046, Eric em 06/11/2026): palco à esquerda e, à direita, uma coluna com o aviso de resolução, os botões
 * das paredes, os controles de dica, a fala, a pergunta, a dica, o campo de resposta ou senha, o resultado e os
 * dígitos revelados. O palco mede o elemento que o contém (`ResizeObserver`) e a sala é o maior 16:9 dentro dele;
 * sem `ResizeObserver` (jsdom), a janela (`innerWidth`/`innerHeight`) é a reserva. Em 1280x720, 1920x1080 e
 * 2560x1440, a página não rola, e o que o clique mostra (fala, pergunta, campo) aparece sem rolar (RF-16, RNF-02).
 */
export interface PropsTelaJogo {
  faseId: string;
  fase: FaseJogo;
  baseUrlApi: string;
  /** Injetável para testes; o padrão é criarVerificadorHttp em modo 'jogo'. */
  verificador?: Verificador;
  aoConcluir?: () => void;
}
