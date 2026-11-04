/**
 * Salvamento (RF-10, ADR-002) e cliente HTTP do editor.
 * O relógio é injetado: os testes controlam o tempo sem esperar 30 s de verdade.
 */
import type {
  AssetCriado,
  Fase,
  FaseDoDono,
  FaseJogo,
  RecusaPublicacao,
  ResumoFase,
} from '@math-scape/schema/contrato';

export interface Relogio {
  agora(): number;
  /** Agenda `funcao` para daqui a `ms`; devolve a função que cancela. */
  agendar(funcao: () => void, ms: number): () => void;
}

/**
 * Resultado de toda chamada dos clientes HTTP. Os clientes nunca rejeitam a promessa (LAC-038):
 * - resposta 2xx → { ok: true, valor }: corpo JSON; sem corpo, valor undefined; exportarFase devolve o arquivo como Blob;
 * - resposta de erro com corpo { erro, detalhes? } → { ok: false, status, erro, detalhes };
 * - resposta de erro sem corpo JSON → { ok: false, status, erro: "Erro <status> do servidor." };
 * - sem resposta (falha de rede, fetch rejeitado) → { ok: false, status: 0, erro: "Não foi possível falar com o servidor. Tente de novo." }.
 */
export type ResultadoHttp<T> = { ok: true; valor: T } | { ok: false; status: number; erro: string; detalhes?: unknown };

/** Chamadas da Api usadas pelo editor (contrato api.md); envia o cookie de sessão. */
export interface ClienteApiEditor {
  cadastrar(nome: string, email: string, senha: string): Promise<ResultadoHttp<{ id: string }>>;
  entrar(email: string, senha: string): Promise<ResultadoHttp<void>>;
  sair(): Promise<ResultadoHttp<void>>;
  excluirConta(): Promise<ResultadoHttp<void>>;
  listarFases(): Promise<ResultadoHttp<ResumoFase[]>>;
  criarFase(titulo: string): Promise<ResultadoHttp<{ id: string; revisao: number; documento: Fase }>>;
  abrirFase(id: string): Promise<ResultadoHttp<FaseDoDono>>;
  salvarFase(id: string, revisao: number, documento: Fase): Promise<ResultadoHttp<{ revisao: number }>>;
  renomearFase(id: string, titulo: string): Promise<ResultadoHttp<{ revisao: number }>>;
  excluirFase(id: string): Promise<ResultadoHttp<void>>;
  duplicarFase(id: string): Promise<ResultadoHttp<{ id: string }>>;
  /** 422 com `posicoesSemEnigma` → { ok: false, status: 422, recusa }; qualquer outra falha segue ResultadoHttp (LAC-039). */
  publicarFase(
    id: string,
  ): Promise<ResultadoHttp<{ publicadaEm: string }> | { ok: false; status: 422; recusa: RecusaPublicacao }>;
  jogoTeste(id: string): Promise<ResultadoHttp<FaseJogo>>;
  exportarFase(id: string): Promise<ResultadoHttp<Blob>>;
  importarFase(arquivo: Blob): Promise<ResultadoHttp<{ id: string }>>;
  enviarImagem(arquivo: Blob): Promise<ResultadoHttp<AssetCriado>>;
}

export type EstadoSalvamento = 'salvo' | 'pendente' | 'salvando' | 'conflito' | 'erro';

export interface Salvamento {
  estado(): EstadoSalvamento;
  assinar(ouvinte: (estado: EstadoSalvamento) => void): () => void;
  /** Chamado a cada mudança do documento: agenda a gravação para até 30 s depois (RF-10). */
  marcarAlterado(): void;
  /**
   * Botão salvar, troca de parede e entrada no modo testar: grava já, se houver alteração pendente.
   * Nunca rejeita: devolve o estado em que o salvamento ficou. Sem alteração pendente, devolve o estado atual sem chamar a Api.
   */
  salvarAgora(): Promise<EstadoSalvamento>;
  /** Para o agendamento (ao fechar a fase). */
  parar(): void;
}

/**
 * Grava o documento do store com `PUT /fases/:id` e a revisão atual.
 * 409 → 'conflito' (não sobrescreve); qualquer outro { ok: false } (400, 401, 5xx, status 0 de rede) → 'erro',
 * mantendo a alteração local para a próxima tentativa (ADR-011). Nunca rejeita.
 */
export type CriarSalvamento = (opcoes: {
  faseId: string;
  revisaoInicial: number;
  obterDocumento: () => Fase;
  cliente: Pick<ClienteApiEditor, 'salvarFase'>;
  relogio: Relogio;
  /** Padrão 30 000 ms (RF-10). */
  intervaloMs?: number;
}) => Salvamento;

/**
 * RF-01: resposta 401 de qualquer chamada, exceto `entrar` e `cadastrar`, chama `aoNaoAutenticado` (o app mostra o login
 * sem recarregar a página, e a alteração local do salvamento fica guardada até o novo login). Login recusado (401 em `entrar`)
 * é só resultado, sem chamar `aoNaoAutenticado`. Em todos os casos o 401 volta como ResultadoHttp:
 * { ok: false, status: 401, erro } com o `erro` do corpo, ou "Erro 401 do servidor." sem corpo.
 */
export type CriarClienteApiEditor = (
  baseUrlApi: string,
  opcoes?: { fetch?: typeof globalThis.fetch; aoNaoAutenticado?: () => void },
) => ClienteApiEditor;
