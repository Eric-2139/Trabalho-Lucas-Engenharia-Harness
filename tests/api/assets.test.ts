/**
 * Módulo: Imagens da Api (`POST /assets`, `GET /assets/:id`; contratos/api.md §Imagens;
 * modulos-api.md §1 e §2 "Assets" e "Salvar"; ADR-010; `LIMITES_CORPO` em apps/api/contrato).
 * Requisito: RF-06 (PNG, JPG ou WebP de até 5 MB pode ser usado como fundo ou objeto; outro
 * formato ou mais de 5 MB é recusado com mensagem e nada é gravado).
 *
 * Integração: `construirApp` + `app.inject` contra o PostgreSQL do contêiner (ADR-016);
 * armazenamento em memória para conferir o que foi gravado. Arquivos sintéticos: só a assinatura
 * do tipo seguida de zeros (tests/support/imagens.ts).
 */
import { construirApp } from '@math-scape/api';
import { LIMITES_CORPO } from '@math-scape/api/contrato';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { UUID_ASSET, documentoComImagens } from '../fixtures/fases-api.ts';
import { type App, PESSOA_A, PESSOA_B, type Resposta, abrirFase, criarComDocumento, criarEPublicar, criarFase, entrar, jogoPublicado, salvarFase } from '../support/api.ts';
import { type ArmazenamentoMemoria, criarArmazenamentoMemoria } from '../support/armazenamento-memoria.ts';
import { limparBanco, urlBancoDeTeste } from '../support/banco.ts';
import { contar } from '../support/consulta.ts';
import { arquivoSintetico, enviarAsset, enviarPngSintetico, lerAsset } from '../support/imagens.ts';

let app: App;
let armazenamento: ArmazenamentoMemoria;

beforeEach(async () => {
  await limparBanco();
  armazenamento = criarArmazenamentoMemoria();
  app = await construirApp({ urlBanco: urlBancoDeTeste(), armazenamento });
});

afterEach(async () => {
  await app?.close();
});

const PADRAO_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const TEMPO_LIMITE_MS = 60_000;

interface AssetCriado {
  id: string;
  ref: string;
  url: string;
}

function assetCriado(res: Resposta): AssetCriado {
  expect(res.statusCode, res.body).toBe(201);
  const corpo = res.json() as AssetCriado;
  expect(corpo.id).toMatch(PADRAO_UUID);
  expect(corpo.ref).toBe(`asset:${corpo.id}`);
  expect(corpo.url.endsWith(`/assets/${corpo.id}`)).toBe(true);
  return corpo;
}

/** Recusa com mensagem (`{ erro }` não vazio) e nada gravado: nem arquivo, nem registro. */
async function recusadoSemGravar(res: Resposta, status: number): Promise<void> {
  expect(res.statusCode, res.body).toBe(status);
  const corpo = res.json() as { erro?: unknown };
  expect(typeof corpo.erro).toBe('string');
  expect(String(corpo.erro).trim().length).toBeGreaterThan(0);
  expect(armazenamento.gravados).toEqual([]);
  expect(await contar('assets')).toBe(0);
}

// =====================================================================
// RF-06 · envio de imagem própria
// =====================================================================
describe('RF-06 · enviar imagem', () => {
  // @req RF-06 @tipo feliz
  test('test_RF06_png_jpg_e_webp_sao_aceitos_com_id_e_gravados_com_o_tipo_certo', async () => {
    const sid = await entrar(app, PESSOA_A);
    const casos = [
      { tipo: 'png', mime: 'image/png', nome: 'parede.png' },
      { tipo: 'jpeg', mime: 'image/jpeg', nome: 'parede.jpg' },
      { tipo: 'webp', mime: 'image/webp', nome: 'parede.webp' },
    ] as const;

    for (const caso of casos) {
      const bytes = arquivoSintetico(caso.tipo, 256);
      const criado = assetCriado(await enviarAsset(app, sid, { bytes, nome: caso.nome, tipoDeclarado: caso.mime }));
      const gravado = armazenamento.arquivos.get(criado.id);
      expect(gravado?.mime, caso.tipo).toBe(caso.mime);
      expect(Buffer.from(gravado?.bytes ?? new Uint8Array()).equals(bytes), caso.tipo).toBe(true);
    }
    expect(await contar('assets')).toBe(3);
  });

  // @req RF-06 @tipo feliz
  test('test_RF06_imagem_enviada_e_lida_pela_url_com_os_mesmos_bytes', async () => {
    const sid = await entrar(app, PESSOA_A);
    const bytes = arquivoSintetico('webp', 128);
    const criado = assetCriado(await enviarAsset(app, sid, { bytes, nome: 'objeto.webp', tipoDeclarado: 'image/webp' }));

    const res = await lerAsset(app, criado.id);
    expect(res.statusCode).toBe(200);
    expect(String(res.headers['content-type'])).toContain('image/webp');
    expect(res.rawPayload.equals(bytes)).toBe(true);
  });

  // @req RF-06 @tipo borda
  test(
    'test_RF06_imagem_com_exatamente_5_MB_e_aceita',
    async () => {
      const sid = await entrar(app, PESSOA_A);
      const bytes = arquivoSintetico('png', LIMITES_CORPO.asset);

      const criado = assetCriado(await enviarAsset(app, sid, { bytes, nome: 'cinco-mega.png' }));
      expect(armazenamento.arquivos.get(criado.id)?.bytes.length).toBe(LIMITES_CORPO.asset);
    },
    TEMPO_LIMITE_MS,
  );

  // @req RF-06 @tipo borda
  test(
    'test_RF06_imagem_com_um_byte_acima_de_5_MB_responde_413_e_nada_e_gravado',
    async () => {
      const sid = await entrar(app, PESSOA_A);
      const bytes = arquivoSintetico('png', LIMITES_CORPO.asset + 1);

      await recusadoSemGravar(await enviarAsset(app, sid, { bytes, nome: 'grande-demais.png' }), 413);
    },
    TEMPO_LIMITE_MS,
  );

  // @req RF-06 @tipo borda
  test('test_RF06_tipo_e_decidido_pelos_bytes_e_nao_pelo_nome_nem_pelo_tipo_declarado', async () => {
    const sid = await entrar(app, PESSOA_A);

    // PNG verdadeiro com nome e tipo declarado errados: aceito como PNG.
    const bytes = arquivoSintetico('png', 64);
    const criado = assetCriado(
      await enviarAsset(app, sid, { bytes, nome: 'arquivo.bin', tipoDeclarado: 'application/octet-stream' }),
    );
    expect(armazenamento.arquivos.get(criado.id)?.mime).toBe('image/png');
  });

  // @req RF-06 @tipo negativo
  test('test_RF06_gif_disfarcado_de_png_responde_415_e_nada_e_gravado', async () => {
    const sid = await entrar(app, PESSOA_A);

    const res = await enviarAsset(app, sid, { bytes: arquivoSintetico('gif', 64), nome: 'animacao.png', tipoDeclarado: 'image/png' });
    await recusadoSemGravar(res, 415);
  });

  // @req RF-06 @tipo negativo
  test('test_RF06_texto_ou_gif_responde_415_e_nada_e_gravado', async () => {
    const sid = await entrar(app, PESSOA_A);

    await recusadoSemGravar(
      await enviarAsset(app, sid, { bytes: arquivoSintetico('texto', 32), nome: 'nota.txt', tipoDeclarado: 'text/plain' }),
      415,
    );
    await recusadoSemGravar(
      await enviarAsset(app, sid, { bytes: arquivoSintetico('gif', 32), nome: 'animacao.gif', tipoDeclarado: 'image/gif' }),
      415,
    );
  });

  // @req RF-06 @tipo negativo
  test('test_RF06_enviar_imagem_sem_login_responde_401_e_nada_e_gravado', async () => {
    const res = await enviarAsset(app, undefined, { bytes: arquivoSintetico('png', 64) });
    expect(res.statusCode).toBe(401);
    expect(armazenamento.gravados).toEqual([]);
    expect(await contar('assets')).toBe(0);
  });

  // @req RF-06 @tipo negativo
  test('test_RF06_ler_imagem_inexistente_responde_404', async () => {
    expect((await lerAsset(app, UUID_ASSET)).statusCode).toBe(404);
  });
});

// =====================================================================
// RF-06 · imagem própria usada como fundo ou objeto da fase
// =====================================================================
describe('RF-06 · usar a imagem na fase', () => {
  // @req RF-06 @tipo feliz
  test('test_RF06_imagem_propria_salva_como_fundo_e_como_objeto_da_fase', async () => {
    const sid = await entrar(app, PESSOA_A);
    const fundo = await enviarPngSintetico(app, sid);
    const objeto = assetCriado(
      await enviarAsset(app, sid, { bytes: arquivoSintetico('jpeg', 96), nome: 'quadro.jpg', tipoDeclarado: 'image/jpeg' }),
    ).id;
    const documento = documentoComImagens('Sala sintética com imagens próprias', fundo, objeto);

    const { id } = await criarComDocumento(app, sid, documento);

    const aberta = await abrirFase(app, sid, id);
    expect(aberta.statusCode).toBe(200);
    expect((aberta.json() as { documento: unknown }).documento).toEqual(documento);
  });

  // @req RF-06 @tipo borda
  test('test_RF06_imagem_de_fase_publicada_aparece_no_jogo_e_e_lida_sem_login', async () => {
    const sid = await entrar(app, PESSOA_A);
    const fundo = await enviarPngSintetico(app, sid);
    const objeto = await enviarPngSintetico(app, sid);
    const { id } = await criarEPublicar(app, sid, documentoComImagens('Sala sintética publicada com imagens', fundo, objeto));

    const jogo = await jogoPublicado(app, id);
    expect(jogo.statusCode).toBe(200);
    expect(jogo.body).toContain(`asset:${fundo}`);
    expect(jogo.body).toContain(`asset:${objeto}`);
    for (const asset of [fundo, objeto]) {
      expect((await lerAsset(app, asset)).statusCode).toBe(200);
    }
  });

  // @req RF-06 @tipo negativo
  test('test_RF06_salvar_fase_com_imagem_de_outro_criador_responde_400_e_nao_grava', async () => {
    const sidA = await entrar(app, PESSOA_A);
    const sidB = await entrar(app, PESSOA_B);
    const daOutraPessoa = await enviarPngSintetico(app, sidB);
    const propria = await enviarPngSintetico(app, sidA);
    const criada = await criarFase(app, sidA, 'Rascunho sintético de A');
    expect(criada.statusCode).toBe(201);
    const { id, revisao, documento } = criada.json() as { id: string; revisao: number; documento: unknown };

    for (const [fundo, objeto] of [
      [daOutraPessoa, propria],
      [propria, daOutraPessoa],
    ] as const) {
      const res = await salvarFase(app, sidA, id, { revisao, documento: documentoComImagens('Com imagem alheia', fundo, objeto) });
      expect(res.statusCode).toBe(400);
    }

    const aberta = (await abrirFase(app, sidA, id)).json() as { revisao: number; documento: unknown };
    expect(aberta.revisao).toBe(revisao);
    expect(aberta.documento).toEqual(documento);
  });

  // @req RF-06 @tipo negativo
  test('test_RF06_salvar_fase_com_imagem_inexistente_responde_400_e_nao_grava', async () => {
    const sid = await entrar(app, PESSOA_A);
    const criada = await criarFase(app, sid, 'Rascunho sintético sem imagem');
    expect(criada.statusCode).toBe(201);
    const { id, revisao } = criada.json() as { id: string; revisao: number };

    const res = await salvarFase(app, sid, id, { revisao, documento: documentoComImagens('Com imagem que não existe', UUID_ASSET, UUID_ASSET) });
    expect(res.statusCode).toBe(400);
    expect(((await abrirFase(app, sid, id)).json() as { revisao: number }).revisao).toBe(revisao);
  });
});
