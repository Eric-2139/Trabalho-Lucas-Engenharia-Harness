/**
 * Módulo: VerificadorHttp (packages/player/contrato/motor.ts · CriarVerificadorHttp, modulos-player.md §1).
 * Requisito: RF-15 na camada Player — o veredito vem da Api por POST /fases/:id/verificar (ADR-003).
 * O fetch é sempre um falso injetado: nenhum teste usa rede.
 */
import { criarVerificadorHttp } from '@math-scape/player';
import { describe, expect, test, vi } from 'vitest';

const BASE = '/api';
const FASE_ID = 'fase-sintetica-1';

type Chamada = { url: string; init: RequestInit | undefined };

/** fetch falso que responde sempre com o status e o corpo dados e registra cada chamada. */
function fetchFalso(status: number, corpo: unknown) {
  const chamadas: Chamada[] = [];
  const fn = vi.fn(async (entrada: RequestInfo | URL, init?: RequestInit) => {
    chamadas.push({ url: String(entrada), init });
    return new Response(JSON.stringify(corpo), { status, headers: { 'content-type': 'application/json' } });
  });
  return { fetch: fn as unknown as typeof globalThis.fetch, chamadas };
}

function corpoEnviado(chamada: Chamada | undefined): unknown {
  return JSON.parse(String(chamada?.init?.body));
}

describe('RF-15 · criarVerificadorHttp', () => {
  // @req RF-15 @tipo feliz
  test('test_RF15_http_enigma_faz_post_com_objeto_e_resposta_e_devolve_o_corpo', async () => {
    const corpo = { correto: true, digitos: [{ posicao: 1, valor: '9' }] };
    const { fetch, chamadas } = fetchFalso(200, corpo);
    const verificador = criarVerificadorHttp({ baseUrlApi: BASE, faseId: FASE_ID, modo: 'jogo', fetch });

    const resultado = await verificador.enigma('enigma-1', '80');

    expect(chamadas).toHaveLength(1);
    expect(chamadas[0]?.url).toBe(`${BASE}/fases/${FASE_ID}/verificar`);
    expect(chamadas[0]?.init?.method?.toUpperCase()).toBe('POST');
    expect(corpoEnviado(chamadas[0])).toEqual({ objetoId: 'enigma-1', resposta: '80' });
    expect(resultado).toEqual(corpo);
  });

  // @req RF-15 @tipo feliz
  test('test_RF15_http_porta_envia_a_senha_como_resposta_e_devolve_aberta', async () => {
    const { fetch, chamadas } = fetchFalso(200, { aberta: true });
    const verificador = criarVerificadorHttp({ baseUrlApi: BASE, faseId: FASE_ID, modo: 'jogo', fetch });

    const resultado = await verificador.porta('porta-1', '56781');

    expect(chamadas[0]?.url).toBe(`${BASE}/fases/${FASE_ID}/verificar`);
    expect(chamadas[0]?.init?.method?.toUpperCase()).toBe('POST');
    expect(corpoEnviado(chamadas[0])).toEqual({ objetoId: 'porta-1', resposta: '56781' });
    expect(resultado).toEqual({ aberta: true });
  });

  // @req RF-15 @tipo feliz
  test('test_RF15_http_resposta_errada_da_api_volta_como_veio', async () => {
    const { fetch } = fetchFalso(200, { correto: false, digitos: [] });
    const verificador = criarVerificadorHttp({ baseUrlApi: BASE, faseId: FASE_ID, modo: 'jogo', fetch });
    expect(await verificador.enigma('enigma-1', 'oitenta')).toEqual({ correto: false, digitos: [] });
  });

  // @req RF-15 @tipo borda
  test('test_RF15_http_modo_teste_acrescenta_modo_teste_e_manda_o_cookie', async () => {
    const { fetch, chamadas } = fetchFalso(200, { correto: true, digitos: [] });
    const verificador = criarVerificadorHttp({ baseUrlApi: BASE, faseId: FASE_ID, modo: 'teste', fetch });

    await verificador.enigma('enigma-1', '15');

    expect(chamadas[0]?.url).toBe(`${BASE}/fases/${FASE_ID}/verificar?modo=teste`);
    expect(chamadas[0]?.init?.credentials).toBe('include');
    expect(corpoEnviado(chamadas[0])).toEqual({ objetoId: 'enigma-1', resposta: '15' });
  });

  // @req RF-15 @tipo borda
  test('test_RF15_http_modo_teste_vale_tambem_para_a_porta', async () => {
    const { fetch, chamadas } = fetchFalso(200, { aberta: false });
    const verificador = criarVerificadorHttp({ baseUrlApi: BASE, faseId: FASE_ID, modo: 'teste', fetch });

    expect(await verificador.porta('porta-1', '1234')).toEqual({ aberta: false });
    expect(chamadas[0]?.url).toBe(`${BASE}/fases/${FASE_ID}/verificar?modo=teste`);
    expect(chamadas[0]?.init?.credentials).toBe('include');
  });

  // @req RF-15 @tipo borda
  test('test_RF15_http_modo_jogo_nao_acrescenta_modo_teste', async () => {
    const { fetch, chamadas } = fetchFalso(200, { aberta: false });
    const verificador = criarVerificadorHttp({ baseUrlApi: BASE, faseId: FASE_ID, modo: 'jogo', fetch });

    await verificador.porta('porta-1', '1234');

    expect(chamadas[0]?.url).not.toContain('modo=teste');
  });

  // @req RF-15 @tipo borda
  test('test_RF15_http_429_vira_limitado_com_o_tempo_da_api', async () => {
    const { fetch } = fetchFalso(429, { tentarEmSegundos: 37 });
    const verificador = criarVerificadorHttp({ baseUrlApi: BASE, faseId: FASE_ID, modo: 'jogo', fetch });

    await expect(verificador.enigma('enigma-1', '80')).resolves.toEqual({ limitado: true, tentarEmSegundos: 37 });
    await expect(verificador.porta('porta-1', '56781')).resolves.toEqual({ limitado: true, tentarEmSegundos: 37 });
  });

  // @req RF-15 @tipo negativo
  test('test_RF15_http_status_404_rejeita', async () => {
    const { fetch } = fetchFalso(404, { erro: 'fase não encontrada' });
    const verificador = criarVerificadorHttp({ baseUrlApi: BASE, faseId: FASE_ID, modo: 'jogo', fetch });

    await expect(verificador.enigma('enigma-1', '80')).rejects.toBeDefined();
    await expect(verificador.porta('porta-1', '56781')).rejects.toBeDefined();
  });

  // @req RF-15 @tipo negativo
  test('test_RF15_http_status_500_rejeita_em_vez_de_virar_acerto', async () => {
    const { fetch } = fetchFalso(500, { correto: true, digitos: [{ posicao: 1, valor: '9' }] });
    const verificador = criarVerificadorHttp({ baseUrlApi: BASE, faseId: FASE_ID, modo: 'jogo', fetch });

    await expect(verificador.enigma('enigma-1', '80')).rejects.toBeDefined();
  });

  // @req RF-15 @tipo negativo
  test('test_RF15_http_erro_de_rede_rejeita', async () => {
    const fetch = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof globalThis.fetch;
    const verificador = criarVerificadorHttp({ baseUrlApi: BASE, faseId: FASE_ID, modo: 'jogo', fetch });

    await expect(verificador.enigma('enigma-1', '80')).rejects.toBeDefined();
  });
});
