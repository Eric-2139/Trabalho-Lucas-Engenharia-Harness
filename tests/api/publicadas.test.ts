/**
 * Módulo: Rotas públicas da Api (contratos/api.md §Jogo; modulos-api.md §1 e §2; ADR-002).
 * Requisito: RF-13 (fase não publicada fica fora de Escolher Fase; publicada aparece e qualquer
 * jogador joga; editar a publicada não muda o que os jogadores veem; publicar de novo substitui).
 *
 * Integração: `construirApp` + `app.inject` contra o PostgreSQL do contêiner (ADR-016);
 * banco limpo antes de cada caso; armazenamento de imagens em memória.
 * Dados sintéticos: pessoas em `@exemplo.test`, fases montadas em tests/fixtures/.
 */
import { construirApp } from '@math-scape/api';
import { projetarParaJogo } from '@math-scape/schema';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { documentoComPosicoesSemEnigma, documentoJogavel, documentoSemPorta } from '../fixtures/fases-api.ts';
import {
  type App,
  PESSOA_A,
  PESSOA_B,
  criarComDocumento,
  criarEPublicar,
  criarFase,
  entrar,
  jogoPublicado,
  listarPublicadas,
  publicarFase,
  renomearFase,
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

type ItemPublicado = { id: string; titulo: string };

async function publicadas(): Promise<ItemPublicado[]> {
  const res = await listarPublicadas(app);
  expect(res.statusCode).toBe(200);
  return (res.json() as ItemPublicado[]).slice().sort((a, b) => a.titulo.localeCompare(b.titulo));
}

const ID_INEXISTENTE = '00000000-0000-4000-8000-00000000f404';

// =====================================================================
// RF-13 · publicar fase; Escolher Fase lista as publicadas
// =====================================================================
describe('RF-13 · Escolher Fase', () => {
  // @req RF-13 @tipo feliz
  test('test_RF13_fase_publicada_aparece_em_escolher_fase_sem_login_com_id_e_titulo', async () => {
    const sid = await entrar(app, PESSOA_A);
    const { id } = await criarEPublicar(app, sid, documentoJogavel('Sala sintética publicada'));

    const res = await listarPublicadas(app);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([{ id, titulo: 'Sala sintética publicada' }]);
  });

  // @req RF-13 @tipo feliz
  test('test_RF13_qualquer_jogador_sem_login_abre_o_jogo_da_fase_publicada', async () => {
    const sid = await entrar(app, PESSOA_A);
    const documento = documentoJogavel('Sala sintética para jogar');
    const { id } = await criarEPublicar(app, sid, documento);

    const res = await jogoPublicado(app, id);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual(projetarParaJogo(documento));
  });

  // @req RF-13 @tipo borda
  test('test_RF13_editar_ou_renomear_fase_publicada_nao_muda_o_que_os_jogadores_veem', async () => {
    const sid = await entrar(app, PESSOA_A);
    const v1 = documentoJogavel('Versão sintética que o jogador vê');
    const { id, revisao } = await criarEPublicar(app, sid, v1);

    const salvo = await salvarFase(app, sid, id, { revisao, documento: documentoSemPorta('Rascunho sintético editado') });
    expect(salvo.statusCode).toBe(200);
    expect((await renomearFase(app, sid, id, 'Rascunho sintético renomeado')).statusCode).toBe(200);

    expect(await publicadas()).toEqual([{ id, titulo: 'Versão sintética que o jogador vê' }]);
    const jogo = await jogoPublicado(app, id);
    expect(jogo.statusCode).toBe(200);
    expect(jogo.json()).toEqual(projetarParaJogo(v1));
  });

  // @req RF-13 @tipo borda
  test('test_RF13_publicar_de_novo_substitui_a_versao_publicada', async () => {
    const sid = await entrar(app, PESSOA_A);
    const { id, revisao } = await criarEPublicar(app, sid, documentoJogavel('Primeira versão sintética'));
    const v2 = documentoSemPorta('Segunda versão sintética');
    expect((await salvarFase(app, sid, id, { revisao, documento: v2 })).statusCode).toBe(200);

    expect((await publicarFase(app, sid, id)).statusCode).toBe(200);

    expect(await publicadas()).toEqual([{ id, titulo: 'Segunda versão sintética' }]);
    const jogo = await jogoPublicado(app, id);
    expect(jogo.statusCode).toBe(200);
    expect(jogo.json()).toEqual(projetarParaJogo(v2));
  });

  // @req RF-13 @tipo borda
  test('test_RF13_lista_reune_publicadas_de_criadores_diferentes_e_omite_rascunhos', async () => {
    const sidA = await entrar(app, PESSOA_A);
    const sidB = await entrar(app, PESSOA_B);
    const deA = await criarEPublicar(app, sidA, documentoJogavel('Publicada sintética de A'));
    const deB = await criarEPublicar(app, sidB, documentoSemPorta('Publicada sintética de B'));
    expect((await criarFase(app, sidA, 'Rascunho sintético de A')).statusCode).toBe(201);
    await criarComDocumento(app, sidB, documentoJogavel('Rascunho sintético jogável de B'));

    expect(await publicadas()).toEqual([
      { id: deA.id, titulo: 'Publicada sintética de A' },
      { id: deB.id, titulo: 'Publicada sintética de B' },
    ]);
  });

  // @req RF-13 @tipo negativo
  test('test_RF13_fase_nao_publicada_nao_aparece_em_escolher_fase', async () => {
    const sid = await entrar(app, PESSOA_A);
    expect((await criarFase(app, sid, 'Rascunho sintético recém-criado')).statusCode).toBe(201);
    await criarComDocumento(app, sid, documentoJogavel('Rascunho sintético jogável'));
    // Tentativa de publicar recusada (RF-12) também não coloca a fase na lista.
    const recusada = await criarComDocumento(app, sid, documentoComPosicoesSemEnigma('Rascunho sintético com buracos'));
    expect((await publicarFase(app, sid, recusada.id)).statusCode).toBe(422);

    expect(await publicadas()).toEqual([]);
  });

  // @req RF-13 @tipo negativo
  test('test_RF13_jogo_de_fase_nao_publicada_ou_inexistente_responde_404_sem_o_documento', async () => {
    const sid = await entrar(app, PESSOA_A);
    const { id } = await criarComDocumento(app, sid, documentoJogavel('Rascunho sintético secreto'));

    const naoPublicada = await jogoPublicado(app, id);
    expect(naoPublicada.statusCode).toBe(404);
    expect(naoPublicada.body).not.toContain('Rascunho sintético secreto');
    expect(naoPublicada.body).not.toContain('Quanto é 10 + 15 x 20?');

    expect((await jogoPublicado(app, ID_INEXISTENTE)).statusCode).toBe(404);
  });

  // @req RF-13 @tipo negativo
  test('test_RF13_escolher_fase_nao_expoe_dado_do_autor', async () => {
    const sid = await entrar(app, PESSOA_A);
    await criarEPublicar(app, sid, documentoJogavel('Sala sintética sem autor'));

    const res = await listarPublicadas(app);
    expect(res.statusCode).toBe(200);
    for (const item of res.json() as Record<string, unknown>[]) {
      expect(Object.keys(item).sort()).toEqual(['id', 'titulo']);
    }
    expect(res.body).not.toContain(PESSOA_A.nome);
    expect(res.body).not.toContain(PESSOA_A.email);
  });
});
