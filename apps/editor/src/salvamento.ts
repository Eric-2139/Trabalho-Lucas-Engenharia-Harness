import type { CriarSalvamento, EstadoSalvamento } from '../contrato/index.ts';

const INTERVALO_PADRAO_MS = 30_000;

/**
 * RF-10, ADR-002 (modulos-editor.md §3): grava com `PUT /fases/:id` em até `intervaloMs` depois da primeira
 * alteração pendente (o prazo não reinicia a cada alteração), ou já, em `salvarAgora`.
 * 409 → 'conflito'; qualquer outra falha → 'erro', com a alteração guardada para a próxima tentativa. Nunca rejeita.
 */
export const criarSalvamento: CriarSalvamento = ({
  faseId,
  revisaoInicial,
  obterDocumento,
  cliente,
  relogio,
  intervaloMs = INTERVALO_PADRAO_MS,
}) => {
  let estado: EstadoSalvamento = 'salvo';
  let revisao = revisaoInicial;
  let pendente = false;
  let cancelarAgendamento: (() => void) | null = null;
  let emAndamento: Promise<EstadoSalvamento> | null = null;
  const ouvintes = new Set<(estado: EstadoSalvamento) => void>();

  function mudar(novo: EstadoSalvamento): void {
    if (novo === estado) return;
    estado = novo;
    for (const ouvinte of [...ouvintes]) ouvinte(novo);
  }

  function cancelar(): void {
    cancelarAgendamento?.();
    cancelarAgendamento = null;
  }

  function agendar(): void {
    if (cancelarAgendamento || estado === 'conflito') return;
    cancelarAgendamento = relogio.agendar(() => {
      cancelarAgendamento = null;
      void salvarAgora();
    }, intervaloMs);
  }

  async function gravar(): Promise<EstadoSalvamento> {
    cancelar();
    pendente = false;
    mudar('salvando');
    let resultado: Awaited<ReturnType<typeof cliente.salvarFase>>;
    try {
      resultado = await cliente.salvarFase(faseId, revisao, obterDocumento());
    } catch {
      resultado = { ok: false, status: 0, erro: 'Não foi possível falar com o servidor. Tente de novo.' };
    }
    if (resultado.ok) {
      revisao = resultado.valor.revisao;
      if (pendente) {
        mudar('pendente');
        agendar();
      } else {
        mudar('salvo');
      }
    } else {
      pendente = true;
      mudar(resultado.status === 409 ? 'conflito' : 'erro');
    }
    return estado;
  }

  async function salvarAgora(): Promise<EstadoSalvamento> {
    if (emAndamento) await emAndamento;
    if (!pendente) return estado;
    const atual = gravar();
    emAndamento = atual;
    try {
      return await atual;
    } finally {
      if (emAndamento === atual) emAndamento = null;
    }
  }

  return {
    estado: () => estado,
    assinar(ouvinte) {
      ouvintes.add(ouvinte);
      return () => {
        ouvintes.delete(ouvinte);
      };
    },
    marcarAlterado() {
      pendente = true;
      if (estado === 'conflito') return;
      if (estado !== 'salvando') mudar('pendente');
      agendar();
    },
    salvarAgora,
    parar: cancelar,
  };
};
