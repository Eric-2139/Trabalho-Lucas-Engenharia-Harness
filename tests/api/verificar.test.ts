/**
 * Módulo: Verificar da Api (`POST /fases/:id/verificar`, público ou `?modo=teste`) e o limite de
 * tentativas que o protege (contratos/api.md §Jogo; modulos-api.md §1 e §2; ADR-003;
 * `LIMITES_VERIFICAR` em apps/api/contrato).
 * Requisitos: RF-15 (enigma resolvido com qualquer resposta cadastrada, comparando só o número,
 * revela os dígitos; porta abre só com a senha completa), RF-11 (modo testar confere no servidor,
 * contra o rascunho, só para o dono, sem limite; a fase fica inalterada), RNF-04 (a resposta da
 * rota traz só certo/errado e dígitos revelados).
 *
 * Integração: `construirApp` + `app.inject` contra o PostgreSQL do contêiner (ADR-016);
 * banco limpo e app novo antes de cada caso (o limite de tentativas recomeça).
 * Fase sintética (tests/fixtures/fases.ts, `faseValida`): senha 92139;
 * enigma-frente (respostas -15 ou 80) revela [1, 2]; enigma-fundo (7) revela [3];
 * enigma-esquerda (15) revela []; enigma-teto (55) revela [4, 5]; porta-1; fala-direita; lampada-teto.
 */
import { construirApp } from '@math-scape/api';
import { LIMITES_VERIFICAR } from '@math-scape/api/contrato';
import type { Fase } from '@math-scape/schema/contrato';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { documentoJogavel } from '../fixtures/fases-api.ts';
import {
  type App,
  PESSOA_A,
  PESSOA_B,
  type Resposta,
  abrirFase,
  criarComDocumento,
  criarEPublicar,
  entrar,
  salvarFase,
  verificar,
} from '../support/api.ts';
import { criarArmazenamentoMemoria } from '../support/armazenamento-memoria.ts';
import { limparBanco, urlBancoDeTeste } from '../support/banco.ts';

let app: App;

beforeEach(async () => {
  await limparBanco();
  app = await construirApp({ urlBanco: urlBancoDeTeste(), armazenamento: criarArmazenamentoMemoria() });
});

afterEach(async () => {
  await app?.close();
});

const ID_INEXISTENTE = '00000000-0000-4000-8000-00000000f404';
const TEMPO_LIMITE_MS = 120_000;

/** Rascunho com senha e resposta diferentes da versão publicada (RF-11): senha 45678; enigma-frente só 42. */
function documentoRascunho(titulo: string): Fase {
  const documento = documentoJogavel(titulo);
  documento.senha = '45678';
  const enigmaFrente = documento.paredes.frente.objetos.find((objeto) => objeto.id === 'enigma-frente');
  if (enigmaFrente?.interacao.tipo === 'enigma') enigmaFrente.interacao.respostas = [42];
  return documento;
}

async function faseJogavelPublicada(): Promise<{ sid: string; id: string; revisao: number }> {
  const sid = await entrar(app, PESSOA_A);
  const fase = await criarEPublicar(app, sid, documentoJogavel('Sala sintética de verificar'));
  return { sid, ...fase };
}

/** Publicada com documentoJogavel e, depois, rascunho trocado por documentoRascunho. */
async function publicadaComRascunhoDiferente(): Promise<{ sid: string; id: string; revisao: number }> {
  const { sid, id, revisao } = await faseJogavelPublicada();
  const salva = await salvarFase(app, sid, id, { revisao, documento: documentoRascunho('Rascunho sintético diferente') });
  expect(salva.statusCode).toBe(200);
  return { sid, id, revisao: (salva.json() as { revisao: number }).revisao };
}

function semSegredos(res: Resposta): void {
  expect(res.body).not.toContain('respostas');
  expect(res.body).not.toContain('senha');
  expect(res.body).not.toContain('revela');
}

// =====================================================================
// RF-15 · enigma revela dígitos; comparação só pelo número; porta só com a senha completa
// =====================================================================
describe('RF-15 · verificar enigma e porta', () => {
  // @req RF-15 @tipo feliz
  test('test_RF15_enigma_certo_responde_correto_com_os_digitos_da_senha_nas_posicoes_reveladas', async () => {
    const { id } = await faseJogavelPublicada();

    const res = await verificar(app, id, { objetoId: 'enigma-frente', resposta: '80' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      correto: true,
      digitos: [
        { posicao: 1, valor: '9' },
        { posicao: 2, valor: '2' },
      ],
    });

    const teto = await verificar(app, id, { objetoId: 'enigma-teto', resposta: '55' });
    expect(teto.statusCode).toBe(200);
    expect(teto.json()).toEqual({
      correto: true,
      digitos: [
        { posicao: 4, valor: '3' },
        { posicao: 5, valor: '9' },
      ],
    });
  });

  // @req RF-15 @tipo feliz
  test('test_RF15_enigma_com_duas_respostas_cadastradas_aceita_qualquer_uma', async () => {
    const { id } = await faseJogavelPublicada();
    const esperado = {
      correto: true,
      digitos: [
        { posicao: 1, valor: '9' },
        { posicao: 2, valor: '2' },
      ],
    };

    for (const resposta of ['80', '-15']) {
      const res = await verificar(app, id, { objetoId: 'enigma-frente', resposta });
      expect(res.statusCode, `resposta ${resposta}`).toBe(200);
      expect(res.json(), `resposta ${resposta}`).toEqual(esperado);
    }
  });

  // @req RF-15 @tipo feliz
  test('test_RF15_porta_com_a_senha_completa_correta_abre', async () => {
    const { id } = await faseJogavelPublicada();

    const res = await verificar(app, id, { objetoId: 'porta-1', resposta: '92139' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ aberta: true });
  });

  // @req RF-15 @tipo borda
  test('test_RF15_comparacao_so_pelo_numero_aceita_80_com_espacos_zero_a_esquerda_e_virgula', async () => {
    const { id } = await faseJogavelPublicada();

    for (const resposta of ['80', ' 80 ', '080', '80,0']) {
      const res = await verificar(app, id, { objetoId: 'enigma-frente', resposta });
      expect(res.statusCode, `resposta ${JSON.stringify(resposta)}`).toBe(200);
      expect((res.json() as { correto: boolean }).correto, `resposta ${JSON.stringify(resposta)}`).toBe(true);
    }
  });

  // @req RF-15 @tipo borda
  test('test_RF15_enigma_certo_que_nao_revela_posicao_responde_correto_sem_digitos', async () => {
    const { id } = await faseJogavelPublicada();

    const res = await verificar(app, id, { objetoId: 'enigma-esquerda', resposta: '15' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ correto: true, digitos: [] });
  });

  // @req RF-15 @tipo borda
  test('test_RF15_porta_com_senha_incompleta_ou_com_digito_a_mais_nao_abre', async () => {
    const { id } = await faseJogavelPublicada();

    for (const resposta of ['9213', '2139', '921390', '092139', '']) {
      const res = await verificar(app, id, { objetoId: 'porta-1', resposta });
      expect(res.statusCode, `senha ${JSON.stringify(resposta)}`).toBe(200);
      expect(res.json(), `senha ${JSON.stringify(resposta)}`).toEqual({ aberta: false });
    }
  });

  // @req RF-15 @tipo borda
  test('test_RF15_respostas_dos_enigmas_nao_abrem_a_porta_e_a_senha_nao_resolve_enigma', async () => {
    const { id } = await faseJogavelPublicada();

    expect((await verificar(app, id, { objetoId: 'porta-1', resposta: '80' })).json()).toEqual({ aberta: false });
    expect((await verificar(app, id, { objetoId: 'enigma-frente', resposta: '92139' })).json()).toEqual({
      correto: false,
      digitos: [],
    });
  });

  // @req RF-15 @tipo negativo
  test('test_RF15_resposta_errada_ou_sem_numero_responde_incorreto_sem_digitos', async () => {
    const { id } = await faseJogavelPublicada();

    for (const resposta of ['81', '-80', '7', 'oitenta', 'resposta sem número', '']) {
      const res = await verificar(app, id, { objetoId: 'enigma-frente', resposta });
      expect(res.statusCode, `resposta ${JSON.stringify(resposta)}`).toBe(200);
      expect(res.json(), `resposta ${JSON.stringify(resposta)}`).toEqual({ correto: false, digitos: [] });
    }
  });

  // @req RF-15 @tipo negativo
  test('test_RF15_porta_com_senha_errada_nao_abre', async () => {
    const { id } = await faseJogavelPublicada();

    for (const resposta of ['12345', '92138', 'noventa e dois']) {
      const res = await verificar(app, id, { objetoId: 'porta-1', resposta });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ aberta: false });
    }
  });

  // @req RF-15 @tipo negativo
  test('test_RF15_objeto_inexistente_decoracao_ou_fala_responde_404', async () => {
    const { id } = await faseJogavelPublicada();

    for (const objetoId of ['objeto-que-nao-existe', 'lampada-teto', 'fala-direita']) {
      const res = await verificar(app, id, { objetoId, resposta: '80' });
      expect(res.statusCode, `objeto ${objetoId}`).toBe(404);
      expect(res.body).not.toContain('correto');
      expect(res.body).not.toContain('aberta');
    }
  });

  // @req RF-15 @tipo negativo
  test('test_RF15_fase_nao_publicada_ou_inexistente_responde_404_no_modo_publico', async () => {
    const sid = await entrar(app, PESSOA_A);
    const { id } = await criarComDocumento(app, sid, documentoJogavel('Rascunho sintético não publicado'));

    const naoPublicada = await verificar(app, id, { objetoId: 'enigma-frente', resposta: '80' });
    expect(naoPublicada.statusCode).toBe(404);
    expect(naoPublicada.body).not.toContain('digitos');

    // Nem o dono logado verifica no modo público uma fase que não está publicada.
    const doDono = await verificar(app, id, { objetoId: 'porta-1', resposta: '92139' }, { sid });
    expect(doDono.statusCode).toBe(404);

    const inexistente = await verificar(app, ID_INEXISTENTE, { objetoId: 'porta-1', resposta: '92139' });
    expect(inexistente.statusCode).toBe(404);
  });

  // @req RF-15 @tipo negativo
  test('test_RF15_resposta_da_verificacao_nunca_contem_a_resposta_cadastrada_nem_a_senha', async () => {
    const { id } = await faseJogavelPublicada();

    const certo = await verificar(app, id, { objetoId: 'enigma-frente', resposta: '80' });
    expect(Object.keys(certo.json() as object).sort()).toEqual(['correto', 'digitos']);
    expect(certo.body).not.toContain('-15');
    expect(certo.body).not.toContain('80');
    semSegredos(certo);

    const errado = await verificar(app, id, { objetoId: 'enigma-frente', resposta: '81' });
    expect(errado.body).not.toContain('-15');
    expect(errado.body).not.toContain('80');
    semSegredos(errado);

    const porta = await verificar(app, id, { objetoId: 'porta-1', resposta: '12345' });
    expect(Object.keys(porta.json() as object)).toEqual(['aberta']);
    expect(porta.body).not.toContain('92139');
    semSegredos(porta);
  });
});

// =====================================================================
// RF-15 · limite de tentativas (ADR-003): por IP e fase, separado por tipo
// =====================================================================
describe('RF-15 · limite de tentativas de verificar', () => {
  // @req RF-15 @tipo borda
  test(
    'test_RF15_porta_aceita_ate_o_maximo_da_janela_e_a_tentativa_seguinte_responde_429',
    async () => {
      const { id } = await faseJogavelPublicada();

      for (let tentativa = 1; tentativa <= LIMITES_VERIFICAR.porta.maximo; tentativa++) {
        const res = await verificar(app, id, { objetoId: 'porta-1', resposta: '00000' });
        expect(res.statusCode, `tentativa ${tentativa}`).toBe(200);
      }

      // Acima do limite, nem a senha correta é conferida.
      const excedeu = await verificar(app, id, { objetoId: 'porta-1', resposta: '92139' });
      expect(excedeu.statusCode).toBe(429);
      const corpo = excedeu.json() as { tentarEmSegundos: unknown };
      expect(typeof corpo.tentarEmSegundos).toBe('number');
      expect(corpo.tentarEmSegundos as number).toBeGreaterThan(0);
      expect(corpo.tentarEmSegundos as number).toBeLessThanOrEqual(LIMITES_VERIFICAR.porta.janelaSegundos);
      expect(excedeu.body).not.toContain('aberta');
    },
    TEMPO_LIMITE_MS,
  );

  // @req RF-15 @tipo borda
  test(
    'test_RF15_enigma_aceita_ate_o_maximo_da_janela_somando_os_enigmas_da_fase_e_a_seguinte_responde_429',
    async () => {
      const { id } = await faseJogavelPublicada();
      const enigmas = ['enigma-frente', 'enigma-fundo'];

      for (let tentativa = 1; tentativa <= LIMITES_VERIFICAR.enigma.maximo; tentativa++) {
        const objetoId = enigmas[tentativa % enigmas.length] as string;
        const res = await verificar(app, id, { objetoId, resposta: '1' });
        expect(res.statusCode, `tentativa ${tentativa}`).toBe(200);
      }

      const excedeu = await verificar(app, id, { objetoId: 'enigma-teto', resposta: '55' });
      expect(excedeu.statusCode).toBe(429);
      const corpo = excedeu.json() as { tentarEmSegundos: unknown };
      expect(typeof corpo.tentarEmSegundos).toBe('number');
      expect(corpo.tentarEmSegundos as number).toBeGreaterThan(0);
      expect(corpo.tentarEmSegundos as number).toBeLessThanOrEqual(LIMITES_VERIFICAR.enigma.janelaSegundos);
      expect(excedeu.body).not.toContain('digitos');
    },
    TEMPO_LIMITE_MS,
  );

  // @req RF-15 @tipo borda
  test(
    'test_RF15_limite_da_porta_nao_atinge_enigma_outra_fase_nem_outro_ip',
    async () => {
      const { sid, id } = await faseJogavelPublicada();
      const outra = await criarEPublicar(app, sid, documentoJogavel('Outra sala sintética'));
      const IP_A = '10.0.0.1';
      const IP_B = '10.0.0.2';

      for (let tentativa = 1; tentativa <= LIMITES_VERIFICAR.porta.maximo; tentativa++) {
        await verificar(app, id, { objetoId: 'porta-1', resposta: '00000' }, { ip: IP_A });
      }
      expect((await verificar(app, id, { objetoId: 'porta-1', resposta: '00000' }, { ip: IP_A })).statusCode).toBe(429);

      // Mesmo IP e fase, outro tipo.
      const enigma = await verificar(app, id, { objetoId: 'enigma-frente', resposta: '80' }, { ip: IP_A });
      expect(enigma.statusCode).toBe(200);
      expect((enigma.json() as { correto: boolean }).correto).toBe(true);
      // Mesmo IP, outra fase.
      const outraFase = await verificar(app, outra.id, { objetoId: 'porta-1', resposta: '92139' }, { ip: IP_A });
      expect(outraFase.statusCode).toBe(200);
      expect(outraFase.json()).toEqual({ aberta: true });
      // Mesma fase, outro IP.
      const outroIp = await verificar(app, id, { objetoId: 'porta-1', resposta: '92139' }, { ip: IP_B });
      expect(outroIp.statusCode).toBe(200);
      expect(outroIp.json()).toEqual({ aberta: true });
    },
    TEMPO_LIMITE_MS,
  );
});

// =====================================================================
// RF-15 · a janela do limite termina e libera novas tentativas (PEND-010: OpcoesApp.relogio)
// =====================================================================
describe('RF-15 · liberação do limite depois da janela (relógio controlado)', () => {
  /**
   * Instante sintético fixo, múltiplo das duas janelas (60 s e 600 s): vale igual para janela que
   * começa na primeira tentativa e para janela alinhada ao relógio. Todas as tentativas que esgotam
   * o limite acontecem nesse instante; o teste só avança `agora`.
   */
  const T0 = 1_800_000_000_000;
  const PORTA_MS = LIMITES_VERIFICAR.porta.janelaSegundos * 1000;
  const ENIGMA_MS = LIMITES_VERIFICAR.enigma.janelaSegundos * 1000;
  let agora = T0;

  beforeEach(async () => {
    agora = T0;
    await app.close();
    app = await construirApp({
      urlBanco: urlBancoDeTeste(),
      armazenamento: criarArmazenamentoMemoria(),
      relogio: () => agora,
    });
  });

  async function esgotarPorta(id: string): Promise<void> {
    for (let tentativa = 1; tentativa <= LIMITES_VERIFICAR.porta.maximo; tentativa++) {
      const res = await verificar(app, id, { objetoId: 'porta-1', resposta: '00000' });
      expect(res.statusCode, `tentativa ${tentativa}`).toBe(200);
    }
  }

  async function esgotarEnigma(id: string): Promise<void> {
    for (let tentativa = 1; tentativa <= LIMITES_VERIFICAR.enigma.maximo; tentativa++) {
      const res = await verificar(app, id, { objetoId: 'enigma-frente', resposta: '1' });
      expect(res.statusCode, `tentativa ${tentativa}`).toBe(200);
    }
  }

  function tentarEm(res: Resposta): number {
    const corpo = res.json() as { tentarEmSegundos: unknown };
    expect(typeof corpo.tentarEmSegundos).toBe('number');
    return corpo.tentarEmSegundos as number;
  }

  // @req RF-15 @tipo feliz
  test(
    'test_RF15_porta_volta_a_conferir_a_senha_quando_o_relogio_chega_ao_fim_da_janela',
    async () => {
      const { id } = await faseJogavelPublicada();
      await esgotarPorta(id);
      expect((await verificar(app, id, { objetoId: 'porta-1', resposta: '92139' })).statusCode).toBe(429);

      agora = T0 + PORTA_MS;
      const liberada = await verificar(app, id, { objetoId: 'porta-1', resposta: '92139' });
      expect(liberada.statusCode).toBe(200);
      expect(liberada.json()).toEqual({ aberta: true });
    },
    TEMPO_LIMITE_MS,
  );

  // @req RF-15 @tipo feliz
  test(
    'test_RF15_enigma_volta_a_revelar_digitos_quando_o_relogio_chega_ao_fim_da_janela',
    async () => {
      const { id } = await faseJogavelPublicada();
      await esgotarEnigma(id);
      expect((await verificar(app, id, { objetoId: 'enigma-frente', resposta: '80' })).statusCode).toBe(429);

      agora = T0 + ENIGMA_MS;
      const liberado = await verificar(app, id, { objetoId: 'enigma-frente', resposta: '80' });
      expect(liberado.statusCode).toBe(200);
      expect(liberado.json()).toEqual({
        correto: true,
        digitos: [
          { posicao: 1, valor: '9' },
          { posicao: 2, valor: '2' },
        ],
      });
    },
    TEMPO_LIMITE_MS,
  );

  // @req RF-15 @tipo borda
  test(
    'test_RF15_porta_um_milissegundo_antes_do_fim_da_janela_ainda_responde_429',
    async () => {
      const { id } = await faseJogavelPublicada();
      await esgotarPorta(id);

      agora = T0 + PORTA_MS - 1;
      const antes = await verificar(app, id, { objetoId: 'porta-1', resposta: '92139' });
      expect(antes.statusCode).toBe(429);
      expect(antes.body).not.toContain('aberta');
      const espera = tentarEm(antes);
      expect(espera).toBeGreaterThan(0);
      expect(espera).toBeLessThanOrEqual(1);

      agora = T0 + PORTA_MS;
      expect((await verificar(app, id, { objetoId: 'porta-1', resposta: '92139' })).statusCode).toBe(200);
    },
    TEMPO_LIMITE_MS,
  );

  // @req RF-15 @tipo borda
  test(
    'test_RF15_enigma_um_milissegundo_antes_do_fim_da_janela_ainda_responde_429',
    async () => {
      const { id } = await faseJogavelPublicada();
      await esgotarEnigma(id);

      agora = T0 + ENIGMA_MS - 1;
      const antes = await verificar(app, id, { objetoId: 'enigma-frente', resposta: '80' });
      expect(antes.statusCode).toBe(429);
      expect(antes.body).not.toContain('digitos');
      const espera = tentarEm(antes);
      expect(espera).toBeGreaterThan(0);
      expect(espera).toBeLessThanOrEqual(1);

      agora = T0 + ENIGMA_MS;
      expect((await verificar(app, id, { objetoId: 'enigma-frente', resposta: '80' })).statusCode).toBe(200);
    },
    TEMPO_LIMITE_MS,
  );

  // @req RF-15 @tipo borda
  test(
    'test_RF15_tentar_em_segundos_diminui_conforme_o_relogio_avanca_dentro_da_janela',
    async () => {
      const { id } = await faseJogavelPublicada();
      await esgotarPorta(id);

      const noInicio = tentarEm(await verificar(app, id, { objetoId: 'porta-1', resposta: '00000' }));
      expect(noInicio).toBeGreaterThan(0);
      expect(noInicio).toBeLessThanOrEqual(LIMITES_VERIFICAR.porta.janelaSegundos);

      agora = T0 + 200_000;
      const depoisDe200s = await verificar(app, id, { objetoId: 'porta-1', resposta: '00000' });
      expect(depoisDe200s.statusCode).toBe(429);
      const meio = tentarEm(depoisDe200s);
      expect(meio).toBeLessThan(noInicio);
      expect(meio).toBeGreaterThan(0);
      expect(meio).toBeLessThanOrEqual(LIMITES_VERIFICAR.porta.janelaSegundos - 200);

      agora = T0 + PORTA_MS - 1000;
      const quaseNoFim = await verificar(app, id, { objetoId: 'porta-1', resposta: '00000' });
      expect(quaseNoFim.statusCode).toBe(429);
      const fim = tentarEm(quaseNoFim);
      expect(fim).toBeLessThan(meio);
      expect(fim).toBeGreaterThan(0);
      expect(fim).toBeLessThanOrEqual(1);
    },
    TEMPO_LIMITE_MS,
  );

  // @req RF-15 @tipo negativo
  test(
    'test_RF15_depois_da_liberacao_o_limite_vale_de_novo_e_a_tentativa_acima_do_maximo_responde_429',
    async () => {
      const { id } = await faseJogavelPublicada();
      await esgotarPorta(id);

      agora = T0 + PORTA_MS;
      await esgotarPorta(id);
      const excedeu = await verificar(app, id, { objetoId: 'porta-1', resposta: '92139' });
      expect(excedeu.statusCode).toBe(429);
      expect(excedeu.body).not.toContain('aberta');
      const espera = tentarEm(excedeu);
      expect(espera).toBeGreaterThan(0);
      expect(espera).toBeLessThanOrEqual(LIMITES_VERIFICAR.porta.janelaSegundos);
    },
    TEMPO_LIMITE_MS,
  );

  // @req RF-15 @tipo negativo
  test(
    'test_RF15_avancar_o_relogio_dentro_da_janela_nao_libera_a_porta',
    async () => {
      const { id } = await faseJogavelPublicada();
      await esgotarPorta(id);

      for (const passoMs of [1, 60_000, 300_000, PORTA_MS / 2 + 1, PORTA_MS - 1000]) {
        agora = T0 + passoMs;
        const res = await verificar(app, id, { objetoId: 'porta-1', resposta: '92139' });
        expect(res.statusCode, `após ${passoMs} ms`).toBe(429);
        expect(res.body, `após ${passoMs} ms`).not.toContain('aberta');
      }
    },
    TEMPO_LIMITE_MS,
  );
});

// =====================================================================
// RF-11 · modo testar: confere no servidor contra o rascunho, só para o dono, sem limite
// =====================================================================
describe('RF-11 · verificar no modo testar', () => {
  // @req RF-11 @tipo feliz
  test('test_RF11_modo_teste_confere_contra_o_rascunho_e_nao_contra_a_versao_publicada', async () => {
    const { sid, id } = await publicadaComRascunhoDiferente();

    const enigmaTeste = await verificar(app, id, { objetoId: 'enigma-frente', resposta: '42' }, { modo: 'teste', sid });
    expect(enigmaTeste.statusCode).toBe(200);
    expect(enigmaTeste.json()).toEqual({
      correto: true,
      digitos: [
        { posicao: 1, valor: '4' },
        { posicao: 2, valor: '5' },
      ],
    });
    const portaTeste = await verificar(app, id, { objetoId: 'porta-1', resposta: '45678' }, { modo: 'teste', sid });
    expect(portaTeste.json()).toEqual({ aberta: true });

    // A versão publicada não muda: no modo público valem as respostas e a senha publicadas.
    expect((await verificar(app, id, { objetoId: 'enigma-frente', resposta: '42' })).json()).toEqual({
      correto: false,
      digitos: [],
    });
    expect((await verificar(app, id, { objetoId: 'porta-1', resposta: '92139' })).json()).toEqual({ aberta: true });
  });

  // @req RF-11 @tipo feliz
  test('test_RF11_modo_teste_funciona_em_fase_nunca_publicada', async () => {
    const sid = await entrar(app, PESSOA_A);
    const { id } = await criarComDocumento(app, sid, documentoJogavel('Rascunho sintético em teste'));

    const enigma = await verificar(app, id, { objetoId: 'enigma-fundo', resposta: '7' }, { modo: 'teste', sid });
    expect(enigma.statusCode).toBe(200);
    expect(enigma.json()).toEqual({ correto: true, digitos: [{ posicao: 3, valor: '1' }] });
    const porta = await verificar(app, id, { objetoId: 'porta-1', resposta: '92139' }, { modo: 'teste', sid });
    expect(porta.statusCode).toBe(200);
    expect(porta.json()).toEqual({ aberta: true });
  });

  // @req RF-11 @tipo borda
  test('test_RF11_modo_teste_usa_as_mesmas_regras_e_responde_errado_ao_que_so_vale_na_publicada', async () => {
    const { sid, id } = await publicadaComRascunhoDiferente();

    for (const resposta of [' 42 ', '042', '42,0']) {
      const res = await verificar(app, id, { objetoId: 'enigma-frente', resposta }, { modo: 'teste', sid });
      expect((res.json() as { correto: boolean }).correto, `resposta ${JSON.stringify(resposta)}`).toBe(true);
    }
    const antiga = await verificar(app, id, { objetoId: 'enigma-frente', resposta: '80' }, { modo: 'teste', sid });
    expect(antiga.json()).toEqual({ correto: false, digitos: [] });
    const senhaAntiga = await verificar(app, id, { objetoId: 'porta-1', resposta: '92139' }, { modo: 'teste', sid });
    expect(senhaAntiga.json()).toEqual({ aberta: false });
    const decoracao = await verificar(app, id, { objetoId: 'lampada-teto', resposta: '1' }, { modo: 'teste', sid });
    expect(decoracao.statusCode).toBe(404);
  });

  // @req RF-11 @tipo borda
  test(
    'test_RF11_modo_teste_do_dono_nao_tem_limite_de_tentativas',
    async () => {
      const sid = await entrar(app, PESSOA_A);
      const { id } = await criarComDocumento(app, sid, documentoJogavel('Rascunho sintético sem limite'));

      for (let tentativa = 1; tentativa <= LIMITES_VERIFICAR.porta.maximo + 5; tentativa++) {
        const res = await verificar(app, id, { objetoId: 'porta-1', resposta: '00000' }, { modo: 'teste', sid });
        expect(res.statusCode, `tentativa ${tentativa}`).toBe(200);
      }
      const certa = await verificar(app, id, { objetoId: 'porta-1', resposta: '92139' }, { modo: 'teste', sid });
      expect(certa.statusCode).toBe(200);
      expect(certa.json()).toEqual({ aberta: true });
    },
    TEMPO_LIMITE_MS,
  );

  // @req RF-11 @tipo borda
  test('test_RF11_ao_sair_do_modo_testar_a_fase_esta_inalterada', async () => {
    const { sid, id } = await publicadaComRascunhoDiferente();
    const antes = await abrirFase(app, sid, id);
    expect(antes.statusCode).toBe(200);

    await verificar(app, id, { objetoId: 'enigma-frente', resposta: '42' }, { modo: 'teste', sid });
    await verificar(app, id, { objetoId: 'enigma-frente', resposta: '1' }, { modo: 'teste', sid });
    await verificar(app, id, { objetoId: 'porta-1', resposta: '45678' }, { modo: 'teste', sid });

    const depois = await abrirFase(app, sid, id);
    expect(depois.statusCode).toBe(200);
    expect(depois.json()).toEqual(antes.json());
  });

  // @req RF-11 @tipo negativo
  test('test_RF11_outro_criador_no_modo_teste_recebe_404_sem_veredito', async () => {
    const { id } = await publicadaComRascunhoDiferente();
    const sidB = await entrar(app, PESSOA_B);

    for (const corpo of [
      { objetoId: 'enigma-frente', resposta: '42' },
      { objetoId: 'porta-1', resposta: '45678' },
    ]) {
      const res = await verificar(app, id, corpo, { modo: 'teste', sid: sidB });
      expect(res.statusCode).toBe(404);
      expect(res.body).not.toContain('correto');
      expect(res.body).not.toContain('aberta');
    }
  });

  // @req RF-11 @tipo negativo
  test('test_RF11_modo_teste_sem_sessao_e_recusado_sem_veredito', async () => {
    const { id } = await publicadaComRascunhoDiferente();

    const res = await verificar(app, id, { objetoId: 'enigma-frente', resposta: '42' }, { modo: 'teste' });
    expect([401, 404]).toContain(res.statusCode);
    expect(res.body).not.toContain('correto');
    expect(res.body).not.toContain('digitos');
  });
});

// =====================================================================
// RNF-04 · a verificação devolve só certo/errado e dígitos revelados, inclusive no modo testar
// =====================================================================
describe('RNF-04 · respostas da verificação', () => {
  // @req RNF-04 @tipo feliz
  test('test_RNF04_verificar_devolve_so_veredito_e_digitos_no_jogo_e_no_modo_testar', async () => {
    const { sid, id } = await publicadaComRascunhoDiferente();

    const publico = await verificar(app, id, { objetoId: 'enigma-frente', resposta: '80' });
    expect(Object.keys(publico.json() as object).sort()).toEqual(['correto', 'digitos']);
    const teste = await verificar(app, id, { objetoId: 'enigma-frente', resposta: '42' }, { modo: 'teste', sid });
    expect(Object.keys(teste.json() as object).sort()).toEqual(['correto', 'digitos']);
    for (const digito of (teste.json() as { digitos: object[] }).digitos) {
      expect(Object.keys(digito).sort()).toEqual(['posicao', 'valor']);
    }
  });

  // @req RNF-04 @tipo borda
  test('test_RNF04_modo_testar_errado_nao_devolve_a_resposta_nem_a_senha_do_rascunho', async () => {
    const { sid, id } = await publicadaComRascunhoDiferente();

    const enigma = await verificar(app, id, { objetoId: 'enigma-frente', resposta: '1' }, { modo: 'teste', sid });
    expect(enigma.json()).toEqual({ correto: false, digitos: [] });
    expect(enigma.body).not.toContain('42');
    semSegredos(enigma);

    const porta = await verificar(app, id, { objetoId: 'porta-1', resposta: '1' }, { modo: 'teste', sid });
    expect(porta.json()).toEqual({ aberta: false });
    expect(porta.body).not.toContain('45678');
    semSegredos(porta);
  });

  // @req RNF-04 @tipo negativo
  test('test_RNF04_verificar_publico_nunca_inclui_respostas_senha_ou_revela', async () => {
    const { id } = await faseJogavelPublicada();
    const pedidos = [
      { objetoId: 'enigma-frente', resposta: '80' },
      { objetoId: 'enigma-frente', resposta: '79' },
      { objetoId: 'enigma-esquerda', resposta: '15' },
      { objetoId: 'porta-1', resposta: '92139' },
      { objetoId: 'porta-1', resposta: '11111' },
      { objetoId: 'fala-direita', resposta: '1' },
    ];
    for (const corpo of pedidos) {
      const res = await verificar(app, id, corpo);
      semSegredos(res);
      expect(res.body).not.toContain('92139');
    }
  });
});
