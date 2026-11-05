/**
 * Módulo: ClienteApiJogo (apps/player/contrato/index.ts · CriarClienteApiJogo, ResultadoHttp; modulos-player.md §2, LAC-038).
 * Requisito: RF-13 — Escolher Fase lista as fases publicadas (GET /publicadas) e o jogador abre
 * a projeção de jogo de uma delas (GET /publicadas/:id/jogo). O filtro de "só publicadas" é da Api
 * (tests/api/publicadas.test.ts); aqui o fetch é sempre um falso injetado, sem rede.
 */
import { criarClienteApiJogo } from '@math-scape/app-player';
import type { FasePublicadaResumo } from '@math-scape/schema/contrato';
import { describe, expect, test, vi } from 'vitest';
import { faseJogo, falaJogo } from '../fixtures/fases-jogo.ts';

const BASE = '/api';
const MENSAGEM_REDE = 'Não foi possível falar com o servidor. Tente de novo.';

type Chamada = { url: string; init: RequestInit | undefined };

/** fetch falso que devolve a Response dada e registra cada chamada. */
function fetchFalso(resposta: () => Response) {
  const chamadas: Chamada[] = [];
  const fn = vi.fn(async (entrada: RequestInfo | URL, init?: RequestInit) => {
    chamadas.push({ url: String(entrada), init });
    return resposta();
  });
  return { fetch: fn as unknown as typeof globalThis.fetch, chamadas };
}

const json = (status: number, corpo: unknown) => () =>
  new Response(JSON.stringify(corpo), { status, headers: { 'content-type': 'application/json' } });

/** fetch falso que rejeita a promessa, como numa queda de rede. */
function fetchSemRede() {
  const fn = vi.fn(async () => {
    throw new TypeError('Failed to fetch');
  });
  return fn as unknown as typeof globalThis.fetch;
}

function metodo(chamada: Chamada | undefined): string {
  return (chamada?.init?.method ?? 'GET').toUpperCase();
}

const RESUMOS: FasePublicadaResumo[] = [
  { id: 'fase-sintetica-a', titulo: 'Sala das frações' },
  { id: 'fase-sintetica-b', titulo: 'Corredor dos primos' },
];

describe('RF-13 · listarPublicadas', () => {
  // @req RF-13 @tipo feliz
  test('test_RF13_listar_publicadas_faz_get_em_base_publicadas_e_devolve_a_lista', async () => {
    const { fetch, chamadas } = fetchFalso(json(200, RESUMOS));
    const cliente = criarClienteApiJogo(BASE, fetch);

    const resultado = await cliente.listarPublicadas();

    expect(chamadas).toHaveLength(1);
    expect(chamadas[0]?.url).toBe(`${BASE}/publicadas`);
    expect(metodo(chamadas[0])).toBe('GET');
    expect(resultado).toEqual({ ok: true, valor: RESUMOS });
  });

  // @req RF-13 @tipo borda
  test('test_RF13_listar_publicadas_sem_nenhuma_fase_devolve_lista_vazia', async () => {
    const { fetch } = fetchFalso(json(200, []));
    const resultado = await criarClienteApiJogo(BASE, fetch).listarPublicadas();
    expect(resultado).toEqual({ ok: true, valor: [] });
  });

  // @req RF-13 @tipo borda
  test('test_RF13_resposta_2xx_sem_corpo_devolve_ok_com_valor_indefinido', async () => {
    const { fetch } = fetchFalso(() => new Response(null, { status: 204 }));
    const resultado = await criarClienteApiJogo(BASE, fetch).listarPublicadas();
    expect(resultado.ok).toBe(true);
    expect(resultado).toEqual({ ok: true, valor: undefined });
  });

  // @req RF-13 @tipo negativo
  test('test_RF13_listar_publicadas_sem_rede_nao_rejeita_e_devolve_status_0', async () => {
    const cliente = criarClienteApiJogo(BASE, fetchSemRede());
    await expect(cliente.listarPublicadas()).resolves.toEqual({ ok: false, status: 0, erro: MENSAGEM_REDE });
  });

  // @req RF-13 @tipo negativo
  test('test_RF13_erro_sem_corpo_json_vira_erro_status_do_servidor', async () => {
    const { fetch } = fetchFalso(() => new Response('falha interna', { status: 500, headers: { 'content-type': 'text/plain' } }));
    const resultado = await criarClienteApiJogo(BASE, fetch).listarPublicadas();
    expect(resultado).toEqual({ ok: false, status: 500, erro: 'Erro 500 do servidor.' });
  });

  // @req RF-13 @tipo borda
  test('test_RF13_erro_sem_corpo_algum_tambem_vira_erro_status_do_servidor', async () => {
    const { fetch } = fetchFalso(() => new Response(null, { status: 503 }));
    const resultado = await criarClienteApiJogo(BASE, fetch).listarPublicadas();
    expect(resultado).toEqual({ ok: false, status: 503, erro: 'Erro 503 do servidor.' });
  });
});

describe('RF-13 · obterJogo', () => {
  // @req RF-13 @tipo feliz
  test('test_RF13_obter_jogo_faz_get_em_publicadas_id_jogo_e_devolve_a_projecao', async () => {
    const projecao = faseJogo({ frente: [falaJogo('fala-1', 'Você: há um bilhete no chão.')] });
    const { fetch, chamadas } = fetchFalso(json(200, projecao));
    const cliente = criarClienteApiJogo(BASE, fetch);

    const resultado = await cliente.obterJogo('fase-sintetica-a');

    expect(chamadas).toHaveLength(1);
    expect(chamadas[0]?.url).toBe(`${BASE}/publicadas/fase-sintetica-a/jogo`);
    expect(metodo(chamadas[0])).toBe('GET');
    expect(resultado).toEqual({ ok: true, valor: projecao });
  });

  // @req RF-13 @tipo negativo
  test('test_RF13_obter_jogo_de_fase_nao_publicada_devolve_o_erro_do_corpo', async () => {
    const corpo = { erro: 'Fase não encontrada.', detalhes: { id: 'fase-rascunho' } };
    const { fetch } = fetchFalso(json(404, corpo));
    const resultado = await criarClienteApiJogo(BASE, fetch).obterJogo('fase-rascunho');
    expect(resultado).toEqual({ ok: false, status: 404, erro: 'Fase não encontrada.', detalhes: { id: 'fase-rascunho' } });
  });

  // @req RF-13 @tipo borda
  test('test_RF13_erro_com_corpo_sem_detalhes_devolve_status_e_erro', async () => {
    const { fetch } = fetchFalso(json(404, { erro: 'Fase não encontrada.' }));
    const resultado = await criarClienteApiJogo(BASE, fetch).obterJogo('fase-inexistente');
    expect(resultado).toMatchObject({ ok: false, status: 404, erro: 'Fase não encontrada.' });
  });

  // @req RF-13 @tipo negativo
  test('test_RF13_obter_jogo_sem_rede_nao_rejeita_e_devolve_status_0', async () => {
    const cliente = criarClienteApiJogo(BASE, fetchSemRede());
    await expect(cliente.obterJogo('fase-sintetica-a')).resolves.toEqual({ ok: false, status: 0, erro: MENSAGEM_REDE });
  });
});
