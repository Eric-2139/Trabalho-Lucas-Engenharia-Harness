/**
 * Módulo: Salvamento (apps/editor/contrato/salvamento.ts · CriarSalvamento, Salvamento, EstadoSalvamento;
 * modulos-editor.md §3; ADR-002, ADR-011, LAC-038).
 * Requisito: RF-10 — alteração não salva é gravada em até 30 s, ao trocar de parede e ao mandar salvar
 * (salvarAgora). O tempo é o do relógio falso (tests/support/relogio-falso.ts); a Api é um cliente falso.
 */
import { criarSalvamento } from '@math-scape/app-editor';
import type { ClienteApiEditor, EstadoSalvamento, ResultadoHttp } from '@math-scape/app-editor/contrato';
import type { Fase } from '@math-scape/schema/contrato';
import { describe, expect, test, vi } from 'vitest';
import { fase, faseValida, porta } from '../fixtures/fases.ts';
import { criarRelogioFalso, drenarPromessas } from '../support/relogio-falso.ts';

type RespostaSalvar = ResultadoHttp<{ revisao: number }>;
type Chamada = { id: string; revisao: number; documento: Fase };

const FASE_ID = 'fase-sintetica-1';
const MSG_REDE = 'Não foi possível falar com o servidor. Tente de novo.';

/** Cliente que responde na hora, na ordem da lista; sem resposta na lista, aceita e devolve revisão + 1. */
function clienteImediato(respostas: RespostaSalvar[] = []) {
  const chamadas: Chamada[] = [];
  const salvarFase = vi.fn(async (id: string, revisao: number, documento: Fase): Promise<RespostaSalvar> => {
    chamadas.push({ id, revisao, documento: structuredClone(documento) });
    return respostas.shift() ?? { ok: true, valor: { revisao: revisao + 1 } };
  });
  const cliente: Pick<ClienteApiEditor, 'salvarFase'> = { salvarFase };
  return { cliente, salvarFase, chamadas };
}

/** Cliente cuja resposta só chega quando o teste chama `responder`. */
function clienteManual() {
  const pendentes: Array<(r: RespostaSalvar) => void> = [];
  const salvarFase = vi.fn(
    () =>
      new Promise<RespostaSalvar>((resolver) => {
        pendentes.push(resolver);
      }),
  );
  const cliente: Pick<ClienteApiEditor, 'salvarFase'> = { salvarFase };
  return {
    cliente,
    salvarFase,
    responder(resposta: RespostaSalvar) {
      const proximo = pendentes.shift();
      if (!proximo) throw new Error('nenhuma gravação em andamento');
      proximo(resposta);
    },
  };
}

/** true se `esperada` aparece em `lista` na mesma ordem (não necessariamente seguida). */
function contemEmOrdem(lista: EstadoSalvamento[], esperada: EstadoSalvamento[]): boolean {
  let i = 0;
  for (const item of lista) if (item === esperada[i]) i++;
  return i === esperada.length;
}

function documentoComTitulo(titulo: string): Fase {
  return { ...fase('12345', { frente: [porta('porta-1')] }), titulo };
}

describe('RF-10 · salvamento automático', () => {
  // @req RF-10 @tipo feliz
  test('test_RF10_alteracao_pendente_e_gravada_em_ate_30s_com_a_revisao_atual', async () => {
    const relogio = criarRelogioFalso();
    const { cliente, salvarFase } = clienteImediato();
    const documento = faseValida();
    const salvamento = criarSalvamento({ faseId: FASE_ID, revisaoInicial: 7, obterDocumento: () => documento, cliente, relogio });

    expect(salvamento.estado()).toBe('salvo');
    salvamento.marcarAlterado();
    expect(salvamento.estado()).toBe('pendente');

    relogio.avancar(30_000);
    await drenarPromessas();

    expect(salvarFase).toHaveBeenCalledTimes(1);
    expect(salvarFase).toHaveBeenCalledWith(FASE_ID, 7, documento);
    expect(salvamento.estado()).toBe('salvo');
  });

  // @req RF-10 @tipo borda
  test('test_RF10_prazo_de_30s_conta_da_primeira_alteracao_e_nao_reinicia_a_cada_nova', async () => {
    const relogio = criarRelogioFalso();
    const { cliente, salvarFase, chamadas } = clienteImediato();
    let atual = documentoComTitulo('Versão 1');
    const salvamento = criarSalvamento({ faseId: FASE_ID, revisaoInicial: 1, obterDocumento: () => atual, cliente, relogio });

    salvamento.marcarAlterado();
    relogio.avancar(20_000);
    await drenarPromessas();
    atual = documentoComTitulo('Versão 2');
    salvamento.marcarAlterado();
    relogio.avancar(5_000);
    await drenarPromessas();
    atual = documentoComTitulo('Versão 3');
    salvamento.marcarAlterado();
    relogio.avancar(5_000); // 30 s desde a primeira alteração
    await drenarPromessas();

    expect(salvarFase).toHaveBeenCalled();
    expect(chamadas.at(-1)?.documento.titulo).toBe('Versão 3');
    expect(salvamento.estado()).toBe('salvo');
  });

  // @req RF-10 @tipo borda
  test('test_RF10_intervalo_configurado_e_respeitado', async () => {
    const relogio = criarRelogioFalso();
    const { cliente, salvarFase } = clienteImediato();
    const salvamento = criarSalvamento({
      faseId: FASE_ID,
      revisaoInicial: 0,
      obterDocumento: () => faseValida(),
      cliente,
      relogio,
      intervaloMs: 5_000,
    });

    salvamento.marcarAlterado();
    relogio.avancar(5_000);
    await drenarPromessas();

    expect(salvarFase).toHaveBeenCalledTimes(1);
    expect(salvamento.estado()).toBe('salvo');
  });

  // @req RF-10 @tipo borda
  test('test_RF10_nova_alteracao_depois_de_salvo_e_gravada_no_proximo_prazo', async () => {
    const relogio = criarRelogioFalso();
    const { cliente, chamadas } = clienteImediato();
    let atual = documentoComTitulo('Primeira');
    const salvamento = criarSalvamento({ faseId: FASE_ID, revisaoInicial: 1, obterDocumento: () => atual, cliente, relogio });

    salvamento.marcarAlterado();
    relogio.avancar(30_000);
    await drenarPromessas();
    atual = documentoComTitulo('Segunda');
    salvamento.marcarAlterado();
    expect(salvamento.estado()).toBe('pendente');
    relogio.avancar(30_000);
    await drenarPromessas();

    expect(chamadas.at(-1)?.documento.titulo).toBe('Segunda');
    expect(salvamento.estado()).toBe('salvo');
  });

  // @req RF-10 @tipo negativo
  test('test_RF10_sem_alteracao_nada_e_gravado', async () => {
    const relogio = criarRelogioFalso();
    const { cliente, salvarFase } = clienteImediato();
    const salvamento = criarSalvamento({ faseId: FASE_ID, revisaoInicial: 1, obterDocumento: () => faseValida(), cliente, relogio });

    relogio.avancar(120_000);
    await drenarPromessas();

    expect(salvarFase).not.toHaveBeenCalled();
    expect(salvamento.estado()).toBe('salvo');
  });

  // @req RF-10 @tipo borda
  test('test_RF10_parar_cancela_a_gravacao_agendada', async () => {
    const relogio = criarRelogioFalso();
    const { cliente, salvarFase } = clienteImediato();
    const salvamento = criarSalvamento({ faseId: FASE_ID, revisaoInicial: 1, obterDocumento: () => faseValida(), cliente, relogio });

    salvamento.marcarAlterado();
    salvamento.parar();
    relogio.avancar(60_000);
    await drenarPromessas();

    expect(salvarFase).not.toHaveBeenCalled();
  });
});

describe('RF-10 · salvarAgora (botão salvar e troca de parede)', () => {
  // @req RF-10 @tipo feliz
  test('test_RF10_salvar_agora_grava_imediatamente_sem_esperar_o_prazo', async () => {
    const relogio = criarRelogioFalso();
    const { cliente, salvarFase } = clienteImediato();
    const documento = faseValida();
    const salvamento = criarSalvamento({ faseId: FASE_ID, revisaoInicial: 4, obterDocumento: () => documento, cliente, relogio });

    salvamento.marcarAlterado();
    const estado = await salvamento.salvarAgora();

    expect(estado).toBe('salvo');
    expect(salvamento.estado()).toBe('salvo');
    expect(salvarFase).toHaveBeenCalledTimes(1);
    expect(salvarFase).toHaveBeenCalledWith(FASE_ID, 4, documento);

    relogio.avancar(30_000);
    await drenarPromessas();
    expect(salvarFase).toHaveBeenCalledTimes(1);
  });

  // @req RF-10 @tipo negativo
  test('test_RF10_salvar_agora_sem_alteracao_pendente_nao_chama_a_api', async () => {
    const relogio = criarRelogioFalso();
    const { cliente, salvarFase } = clienteImediato();
    const salvamento = criarSalvamento({ faseId: FASE_ID, revisaoInicial: 1, obterDocumento: () => faseValida(), cliente, relogio });

    await expect(salvamento.salvarAgora()).resolves.toBe('salvo');
    expect(salvarFase).not.toHaveBeenCalled();
  });

  // @req RF-10 @tipo borda
  test('test_RF10_estado_passa_por_pendente_salvando_e_salvo', async () => {
    const relogio = criarRelogioFalso();
    const manual = clienteManual();
    const salvamento = criarSalvamento({
      faseId: FASE_ID,
      revisaoInicial: 1,
      obterDocumento: () => faseValida(),
      cliente: manual.cliente,
      relogio,
    });
    const vistos: EstadoSalvamento[] = [];
    salvamento.assinar((estado) => vistos.push(estado));

    salvamento.marcarAlterado();
    const promessa = salvamento.salvarAgora();
    await drenarPromessas();
    expect(salvamento.estado()).toBe('salvando');

    manual.responder({ ok: true, valor: { revisao: 2 } });
    await expect(promessa).resolves.toBe('salvo');

    expect(salvamento.estado()).toBe('salvo');
    expect(contemEmOrdem(vistos, ['pendente', 'salvando', 'salvo'])).toBe(true);
  });

  // @req RF-10 @tipo borda
  test('test_RF10_revisao_devolvida_pelo_put_e_usada_na_gravacao_seguinte', async () => {
    const relogio = criarRelogioFalso();
    const { cliente, chamadas } = clienteImediato([
      { ok: true, valor: { revisao: 4 } },
      { ok: true, valor: { revisao: 9 } },
    ]);
    const salvamento = criarSalvamento({ faseId: FASE_ID, revisaoInicial: 3, obterDocumento: () => faseValida(), cliente, relogio });

    salvamento.marcarAlterado();
    await salvamento.salvarAgora();
    salvamento.marcarAlterado();
    await salvamento.salvarAgora();
    salvamento.marcarAlterado();
    await salvamento.salvarAgora();

    expect(chamadas.map((c) => c.revisao)).toEqual([3, 4, 9]);
  });
});

describe('RF-10 · falhas ao gravar', () => {
  // @req RF-10 @tipo negativo
  test('test_RF10_resposta_409_vira_conflito', async () => {
    const relogio = criarRelogioFalso();
    const { cliente } = clienteImediato([{ ok: false, status: 409, erro: 'A fase foi alterada em outro lugar.' }]);
    const salvamento = criarSalvamento({ faseId: FASE_ID, revisaoInicial: 2, obterDocumento: () => faseValida(), cliente, relogio });

    salvamento.marcarAlterado();
    const estado = await salvamento.salvarAgora();

    expect(estado).toBe('conflito');
    expect(salvamento.estado()).toBe('conflito');
  });

  // @req RF-10 @tipo negativo
  test('test_RF10_falha_que_nao_e_409_vira_erro_sem_rejeitar', async () => {
    const falhas: RespostaSalvar[] = [
      { ok: false, status: 0, erro: MSG_REDE },
      { ok: false, status: 400, erro: 'Documento fora do schema.' },
      { ok: false, status: 401, erro: 'Erro 401 do servidor.' },
      { ok: false, status: 500, erro: 'Erro 500 do servidor.' },
      { ok: false, status: 503, erro: 'Erro 503 do servidor.' },
    ];
    for (const falha of falhas) {
      const relogio = criarRelogioFalso();
      const { cliente } = clienteImediato([falha]);
      const salvamento = criarSalvamento({ faseId: FASE_ID, revisaoInicial: 2, obterDocumento: () => faseValida(), cliente, relogio });

      salvamento.marcarAlterado();
      await expect(salvamento.salvarAgora(), `status ${falha.ok ? '' : falha.status}`).resolves.toBe('erro');
      expect(salvamento.estado()).toBe('erro');
    }
  });

  // @req RF-10 @tipo negativo
  test('test_RF10_depois_de_erro_a_alteracao_fica_guardada_e_o_botao_grava_de_novo', async () => {
    const relogio = criarRelogioFalso();
    const { cliente, chamadas } = clienteImediato([
      { ok: false, status: 500, erro: 'Erro 500 do servidor.' },
      { ok: true, valor: { revisao: 6 } },
    ]);
    const documento = documentoComTitulo('Alteração que não pode se perder');
    const salvamento = criarSalvamento({ faseId: FASE_ID, revisaoInicial: 5, obterDocumento: () => documento, cliente, relogio });

    salvamento.marcarAlterado();
    expect(await salvamento.salvarAgora()).toBe('erro');
    expect(await salvamento.salvarAgora()).toBe('salvo');

    expect(chamadas).toHaveLength(2);
    expect(chamadas[1]).toEqual({ id: FASE_ID, revisao: 5, documento });
  });

  // @req RF-10 @tipo borda
  test('test_RF10_depois_de_erro_nova_alteracao_reagenda_e_grava_no_prazo', async () => {
    const relogio = criarRelogioFalso();
    const { cliente, chamadas } = clienteImediato([{ ok: false, status: 0, erro: MSG_REDE }]);
    const salvamento = criarSalvamento({ faseId: FASE_ID, revisaoInicial: 5, obterDocumento: () => faseValida(), cliente, relogio });

    salvamento.marcarAlterado();
    relogio.avancar(30_000);
    await drenarPromessas();
    expect(salvamento.estado()).toBe('erro');

    salvamento.marcarAlterado();
    relogio.avancar(30_000);
    await drenarPromessas();

    expect(salvamento.estado()).toBe('salvo');
    expect(chamadas.at(-1)?.revisao).toBe(5);
  });
});
