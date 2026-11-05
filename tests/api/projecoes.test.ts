/**
 * Módulo: projeções de jogo da Api (modulos-api.md §2 "Projeções": `GET /publicadas/:id/jogo` e
 * `GET /fases/:id/jogo-teste` passam por `projetarParaJogo` e por `FaseJogo` estrito;
 * contratos/api.md §Jogo e §Fases do criador; ADR-003).
 * Requisitos: RNF-04 (nenhuma resposta nem senha aparece nas respostas HTTP do jogo e do modo
 * testar; o editor do autor recebe o próprio documento) e RF-11 (o modo testar recebe a projeção
 * do rascunho, só o dono).
 *
 * Integração: `construirApp` + `app.inject` contra o PostgreSQL do contêiner (ADR-016).
 * Fase sintética com segredos fáceis de procurar (tests/fixtures/fases-api.ts `documentoComSegredos`):
 * senha 86420, respostas 271828, 161803 e 314159.
 */
import { construirApp } from '@math-scape/api';
import { projetarParaJogo } from '@math-scape/schema';
import { FaseJogo } from '@math-scape/schema/contrato';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { DICA_SEGREDO, SEGREDOS, documentoComSegredos, documentoJogavel } from '../fixtures/fases-api.ts';
import {
  type App,
  PESSOA_A,
  PESSOA_B,
  type Resposta,
  abrirFase,
  criarComDocumento,
  criarEPublicar,
  entrar,
  jogoPublicado,
  jogoTeste,
  salvarFase,
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

/** Nenhum nome de campo secreto nem valor secreto no corpo serializado. */
function semSegredos(res: Resposta): void {
  for (const campo of ['"senha"', '"respostas"', '"revela"']) {
    expect(res.body, `campo ${campo}`).not.toContain(campo);
  }
  expect(res.body).not.toContain(SEGREDOS.senha);
  for (const resposta of SEGREDOS.respostas) {
    expect(res.body, `resposta ${resposta}`).not.toContain(resposta);
  }
}

// =====================================================================
// RNF-04 · respostas e senha nunca vão ao navegador de quem joga, inclusive no modo testar
// =====================================================================
describe('RNF-04 · projeções de jogo', () => {
  // @req RNF-04 @tipo feliz
  test('test_RNF04_jogo_publicado_sem_login_nao_contem_respostas_senha_nem_revela', async () => {
    const sid = await entrar(app, PESSOA_A);
    const documento = documentoComSegredos('Sala sintética secreta');
    const { id } = await criarEPublicar(app, sid, documento);

    const res = await jogoPublicado(app, id);
    expect(res.statusCode).toBe(200);
    semSegredos(res);
    expect(FaseJogo.safeParse(res.json()).success).toBe(true);
    expect(res.json()).toEqual(projetarParaJogo(documento));
  });

  // @req RNF-04 @tipo feliz
  test('test_RNF04_jogo_teste_do_dono_nao_contem_respostas_senha_nem_revela', async () => {
    const sid = await entrar(app, PESSOA_A);
    const { id } = await criarComDocumento(app, sid, documentoComSegredos('Rascunho sintético secreto'));

    const res = await jogoTeste(app, sid, id);
    expect(res.statusCode).toBe(200);
    semSegredos(res);
    expect(FaseJogo.safeParse(res.json()).success).toBe(true);
  });

  // @req RNF-04 @tipo borda
  test('test_RNF04_projecoes_mantem_a_dica_e_o_tamanho_da_senha', async () => {
    const sid = await entrar(app, PESSOA_A);
    const { id } = await criarEPublicar(app, sid, documentoComSegredos('Sala sintética com dica'));

    for (const res of [await jogoPublicado(app, id), await jogoTeste(app, sid, id)]) {
      expect(res.statusCode).toBe(200);
      const jogo = res.json() as FaseJogo;
      expect(jogo.tamanhoSenha).toBe(SEGREDOS.senha.length);
      const enigma = jogo.paredes.frente.objetos.find((objeto) => objeto.id === 'enigma-segredo');
      expect(enigma?.interacao).toEqual({
        tipo: 'enigma',
        pergunta: 'Qual constante sintética abre o cofre?',
        dica: DICA_SEGREDO,
      });
    }
  });

  // @req RNF-04 @tipo borda
  test('test_RNF04_editor_do_autor_recebe_o_proprio_documento_com_respostas_e_senha', async () => {
    const sid = await entrar(app, PESSOA_A);
    const documento = documentoComSegredos('Rascunho sintético do autor');
    const { id } = await criarComDocumento(app, sid, documento);

    const res = await abrirFase(app, sid, id);
    expect(res.statusCode).toBe(200);
    expect((res.json() as { documento: unknown }).documento).toEqual(documento);
  });

  // @req RNF-04 @tipo negativo
  test('test_RNF04_jogo_teste_de_outro_criador_responde_404_sem_o_documento', async () => {
    const sidA = await entrar(app, PESSOA_A);
    const { id } = await criarEPublicar(app, sidA, documentoComSegredos('Sala sintética alheia'));
    const sidB = await entrar(app, PESSOA_B);

    const res = await jogoTeste(app, sidB, id);
    expect(res.statusCode).toBe(404);
    semSegredos(res);
    expect(res.body).not.toContain('Qual constante sintética abre o cofre?');
  });

  // @req RNF-04 @tipo negativo
  test('test_RNF04_jogo_teste_sem_sessao_ou_de_fase_inexistente_nao_devolve_a_fase', async () => {
    const sid = await entrar(app, PESSOA_A);
    const { id } = await criarComDocumento(app, sid, documentoComSegredos('Rascunho sintético fechado'));

    const semSessao = await jogoTeste(app, undefined, id);
    expect(semSessao.statusCode).toBe(401);
    semSegredos(semSessao);
    expect(semSessao.body).not.toContain('Qual constante sintética abre o cofre?');

    expect((await jogoTeste(app, sid, ID_INEXISTENTE)).statusCode).toBe(404);
  });
});

// =====================================================================
// RF-11 · o modo testar joga o rascunho, com a projeção da Api
// =====================================================================
describe('RF-11 · jogo-teste', () => {
  // @req RF-11 @tipo feliz
  test('test_RF11_jogo_teste_devolve_a_projecao_do_rascunho_de_fase_nao_publicada', async () => {
    const sid = await entrar(app, PESSOA_A);
    const documento = documentoJogavel('Rascunho sintético para testar');
    const { id } = await criarComDocumento(app, sid, documento);

    const res = await jogoTeste(app, sid, id);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual(projetarParaJogo(documento));
  });

  // @req RF-11 @tipo borda
  test('test_RF11_jogo_teste_de_fase_publicada_usa_o_rascunho_e_nao_muda_a_fase', async () => {
    const sid = await entrar(app, PESSOA_A);
    const publicada = documentoJogavel('Versão sintética publicada');
    const { id, revisao } = await criarEPublicar(app, sid, publicada);
    const rascunho = documentoComSegredos('Rascunho sintético editado');
    expect((await salvarFase(app, sid, id, { revisao, documento: rascunho })).statusCode).toBe(200);
    const antes = await abrirFase(app, sid, id);

    const res = await jogoTeste(app, sid, id);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual(projetarParaJogo(rascunho));

    // Ao sair, a fase está inalterada; e o jogador continua vendo a versão publicada.
    expect((await abrirFase(app, sid, id)).json()).toEqual(antes.json());
    expect((await jogoPublicado(app, id)).json()).toEqual(projetarParaJogo(publicada));
  });

  // @req RF-11 @tipo negativo
  test('test_RF11_outro_criador_nao_abre_o_jogo_teste', async () => {
    const sidA = await entrar(app, PESSOA_A);
    const { id } = await criarComDocumento(app, sidA, documentoJogavel('Rascunho sintético de A'));
    const sidB = await entrar(app, PESSOA_B);

    const res = await jogoTeste(app, sidB, id);
    expect(res.statusCode).toBe(404);
    expect(res.body).not.toContain('Rascunho sintético de A');
  });
});
