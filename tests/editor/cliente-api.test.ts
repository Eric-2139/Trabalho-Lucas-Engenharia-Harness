/**
 * Módulo: Cliente HTTP do editor (apps/editor/contrato/salvamento.ts · CriarClienteApiEditor, ClienteApiEditor,
 * ResultadoHttp; modulos-editor.md §3 e §5; contrato api.md; LAC-038).
 * Requisitos: RF-01 — cadastro e login; sem sessão, o editor leva ao login (401 chama `aoNaoAutenticado`,
 * exceto em `entrar` e `cadastrar`). RF-10 — gravação por `PUT /fases/:id` com a revisão.
 * O fetch é sempre um falso injetado, sem rede. Dados sintéticos escritos à mão.
 */
import { criarClienteApiEditor } from '@math-scape/app-editor';
import type { ClienteApiEditor } from '@math-scape/app-editor/contrato';
import type { ResumoFase } from '@math-scape/schema/contrato';
import { describe, expect, test, vi } from 'vitest';
import { faseValida } from '../fixtures/fases.ts';

const BASE = '/api';
const MSG_REDE = 'Não foi possível falar com o servidor. Tente de novo.';
const NOME = 'Criadora Sintética';
const EMAIL = 'criadora@exemplo.test';
const SENHA = 'x7k2q';

type Chamada = { url: string; init: RequestInit | undefined };

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

const semCorpo = (status: number) => () => new Response(null, { status });

function fetchSemRede() {
  const fn = vi.fn(async () => {
    throw new TypeError('Failed to fetch');
  });
  return fn as unknown as typeof globalThis.fetch;
}

function metodo(chamada: Chamada | undefined): string {
  return (chamada?.init?.method ?? 'GET').toUpperCase();
}

function corpoJson(chamada: Chamada | undefined): unknown {
  return JSON.parse(String(chamada?.init?.body));
}

function montar(resposta: () => Response) {
  const { fetch, chamadas } = fetchFalso(resposta);
  const aoNaoAutenticado = vi.fn();
  const cliente = criarClienteApiEditor(BASE, { fetch, aoNaoAutenticado });
  return { cliente, chamadas, aoNaoAutenticado };
}

// ---------------------------------------------------------------------------
// RF-01 · cadastro e login
// ---------------------------------------------------------------------------
describe('RF-01 · cadastrar e entrar', () => {
  // @req RF-01 @tipo feliz
  test('test_RF01_cadastrar_envia_nome_email_e_senha_para_auth_cadastro', async () => {
    const criado = { id: 'usuario-1', nome: NOME, email: EMAIL };
    const { cliente, chamadas, aoNaoAutenticado } = montar(json(201, criado));

    const resultado = await cliente.cadastrar(NOME, EMAIL, SENHA);

    expect(chamadas).toHaveLength(1);
    expect(chamadas[0]?.url).toBe(`${BASE}/auth/cadastro`);
    expect(metodo(chamadas[0])).toBe('POST');
    expect(corpoJson(chamadas[0])).toEqual({ nome: NOME, email: EMAIL, senha: SENHA });
    expect(resultado).toEqual({ ok: true, valor: criado });
    expect(aoNaoAutenticado).not.toHaveBeenCalled();
  });

  // @req RF-01 @tipo feliz
  test('test_RF01_entrar_envia_email_e_senha_para_auth_login_e_aceita_204', async () => {
    const { cliente, chamadas, aoNaoAutenticado } = montar(semCorpo(204));

    const resultado = await cliente.entrar(EMAIL, SENHA);

    expect(chamadas).toHaveLength(1);
    expect(chamadas[0]?.url).toBe(`${BASE}/auth/login`);
    expect(metodo(chamadas[0])).toBe('POST');
    expect(corpoJson(chamadas[0])).toEqual({ email: EMAIL, senha: SENHA });
    expect(resultado).toEqual({ ok: true, valor: undefined });
    expect(aoNaoAutenticado).not.toHaveBeenCalled();
  });

  // @req RF-01 @tipo negativo
  test('test_RF01_login_recusado_volta_como_resultado_sem_chamar_ao_nao_autenticado', async () => {
    const { cliente, aoNaoAutenticado } = montar(json(401, { erro: 'E-mail ou senha incorretos.' }));

    const resultado = await cliente.entrar(EMAIL, 'errad');

    expect(resultado).toEqual({ ok: false, status: 401, erro: 'E-mail ou senha incorretos.' });
    expect(aoNaoAutenticado).not.toHaveBeenCalled();
  });

  // @req RF-01 @tipo borda
  test('test_RF01_401_em_cadastrar_tambem_nao_chama_ao_nao_autenticado', async () => {
    const { cliente, aoNaoAutenticado } = montar(semCorpo(401));

    const resultado = await cliente.cadastrar(NOME, EMAIL, SENHA);

    expect(resultado).toEqual({ ok: false, status: 401, erro: 'Erro 401 do servidor.' });
    expect(aoNaoAutenticado).not.toHaveBeenCalled();
  });

  // @req RF-01 @tipo negativo
  test('test_RF01_cadastro_com_email_em_uso_devolve_o_erro_do_corpo', async () => {
    const { cliente, aoNaoAutenticado } = montar(json(409, { erro: 'Este e-mail já está em uso.' }));

    const resultado = await cliente.cadastrar(NOME, EMAIL, SENHA);

    expect(resultado).toMatchObject({ ok: false, status: 409, erro: 'Este e-mail já está em uso.' });
    expect(aoNaoAutenticado).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// RF-01 · sem sessão, o editor leva ao login
// ---------------------------------------------------------------------------
describe('RF-01 · 401 fora do login', () => {
  // @req RF-01 @tipo feliz
  test('test_RF01_listar_fases_sem_sessao_chama_ao_nao_autenticado_e_devolve_o_401', async () => {
    const { cliente, chamadas, aoNaoAutenticado } = montar(json(401, { erro: 'Entre para continuar.' }));

    const resultado = await cliente.listarFases();

    expect(chamadas[0]?.url).toBe(`${BASE}/fases`);
    expect(metodo(chamadas[0])).toBe('GET');
    expect(resultado).toEqual({ ok: false, status: 401, erro: 'Entre para continuar.' });
    expect(aoNaoAutenticado).toHaveBeenCalledTimes(1);
  });

  // @req RF-01 @tipo feliz
  test('test_RF01_listar_fases_com_sessao_devolve_a_lista_sem_chamar_ao_nao_autenticado', async () => {
    const fases: ResumoFase[] = [
      { id: 'fase-a', titulo: 'Sala das frações', publicada: false, atualizadaEm: '2026-01-02T03:04:05.000Z' },
    ];
    const { cliente, aoNaoAutenticado } = montar(json(200, fases));

    await expect(cliente.listarFases()).resolves.toEqual({ ok: true, valor: fases });
    expect(aoNaoAutenticado).not.toHaveBeenCalled();
  });

  // @req RF-01 @tipo borda
  test('test_RF01_401_sem_corpo_no_salvamento_chama_ao_nao_autenticado_com_erro_padrao', async () => {
    const { cliente, aoNaoAutenticado } = montar(semCorpo(401));

    const resultado = await cliente.salvarFase('fase-a', 3, faseValida());

    expect(resultado).toEqual({ ok: false, status: 401, erro: 'Erro 401 do servidor.' });
    expect(aoNaoAutenticado).toHaveBeenCalledTimes(1);
  });

  // @req RF-01 @tipo borda
  test('test_RF01_401_em_qualquer_rota_do_criador_chama_ao_nao_autenticado', async () => {
    const chamadasDoCriador: Array<[string, (c: ClienteApiEditor) => Promise<unknown>]> = [
      ['sair', (c) => c.sair()],
      ['excluirConta', (c) => c.excluirConta()],
      ['criarFase', (c) => c.criarFase('Nova fase')],
      ['abrirFase', (c) => c.abrirFase('fase-a')],
      ['renomearFase', (c) => c.renomearFase('fase-a', 'Outro título')],
      ['excluirFase', (c) => c.excluirFase('fase-a')],
      ['duplicarFase', (c) => c.duplicarFase('fase-a')],
      ['publicarFase', (c) => c.publicarFase('fase-a')],
      ['jogoTeste', (c) => c.jogoTeste('fase-a')],
    ];
    for (const [nome, chamar] of chamadasDoCriador) {
      const { cliente, aoNaoAutenticado } = montar(json(401, { erro: 'Entre para continuar.' }));
      const resultado = await chamar(cliente);
      expect(resultado, nome).toEqual({ ok: false, status: 401, erro: 'Entre para continuar.' });
      expect(aoNaoAutenticado, nome).toHaveBeenCalledTimes(1);
    }
  });

  // @req RF-01 @tipo borda
  test('test_RF01_outros_erros_que_nao_401_nao_chamam_ao_nao_autenticado', async () => {
    for (const status of [400, 403, 404, 409, 500]) {
      const { cliente, aoNaoAutenticado } = montar(json(status, { erro: `Falha ${status}.` }));
      const resultado = await cliente.abrirFase('fase-a');
      expect(resultado, `status ${status}`).toMatchObject({ ok: false, status, erro: `Falha ${status}.` });
      expect(aoNaoAutenticado, `status ${status}`).not.toHaveBeenCalled();
    }
  });

  // @req RF-01 @tipo borda
  test('test_RF01_401_sem_ao_nao_autenticado_configurado_nao_rejeita', async () => {
    const { fetch } = fetchFalso(json(401, { erro: 'Entre para continuar.' }));
    const cliente = criarClienteApiEditor(BASE, { fetch });

    await expect(cliente.listarFases()).resolves.toEqual({ ok: false, status: 401, erro: 'Entre para continuar.' });
  });

  // @req RF-01 @tipo negativo
  test('test_RF01_falha_de_rede_devolve_status_0_sem_rejeitar_e_sem_mandar_ao_login', async () => {
    const aoNaoAutenticado = vi.fn();
    const cliente = criarClienteApiEditor(BASE, { fetch: fetchSemRede(), aoNaoAutenticado });

    await expect(cliente.listarFases()).resolves.toEqual({ ok: false, status: 0, erro: MSG_REDE });
    await expect(cliente.entrar(EMAIL, SENHA)).resolves.toEqual({ ok: false, status: 0, erro: MSG_REDE });
    expect(aoNaoAutenticado).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// RF-10 · gravação da fase
// ---------------------------------------------------------------------------
describe('RF-10 · salvarFase', () => {
  // @req RF-10 @tipo feliz
  test('test_RF10_salvar_fase_faz_put_com_revisao_e_documento_e_devolve_a_nova_revisao', async () => {
    const documento = faseValida();
    const { cliente, chamadas } = montar(json(200, { revisao: 8 }));

    const resultado = await cliente.salvarFase('fase-a', 7, documento);

    expect(chamadas).toHaveLength(1);
    expect(chamadas[0]?.url).toBe(`${BASE}/fases/fase-a`);
    expect(metodo(chamadas[0])).toBe('PUT');
    expect(corpoJson(chamadas[0])).toEqual({ revisao: 7, documento });
    expect(resultado).toEqual({ ok: true, valor: { revisao: 8 } });
  });

  // @req RF-10 @tipo negativo
  test('test_RF10_salvar_fase_com_revisao_desatualizada_devolve_409', async () => {
    const { cliente, aoNaoAutenticado } = montar(json(409, { erro: 'A fase foi alterada em outro lugar.' }));

    const resultado = await cliente.salvarFase('fase-a', 2, faseValida());

    expect(resultado).toMatchObject({ ok: false, status: 409, erro: 'A fase foi alterada em outro lugar.' });
    expect(aoNaoAutenticado).not.toHaveBeenCalled();
  });

  // @req RF-10 @tipo negativo
  test('test_RF10_salvar_fase_sem_rede_nao_rejeita_e_devolve_status_0', async () => {
    const cliente = criarClienteApiEditor(BASE, { fetch: fetchSemRede() });
    await expect(cliente.salvarFase('fase-a', 2, faseValida())).resolves.toEqual({ ok: false, status: 0, erro: MSG_REDE });
  });
});
