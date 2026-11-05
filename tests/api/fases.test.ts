/**
 * Módulo: Rotas do criador da Api (contratos/api.md §Fases do criador; modulos-api.md §2;
 * contratos/banco.md; ADR-002, ADR-005, ADR-013; modulos-schema.md §4).
 * Requisitos: RF-02 (criar, renomear, duplicar, excluir; dono), RF-10 (salvar com `revisao`),
 * RF-12 (publicar só fase jogável, 422 com as posições), RF-14 (exportar envelope e importar),
 * RNF-09 (documento fora do schema recusado ao salvar, publicar e importar).
 *
 * Integração: `construirApp` + `app.inject` contra o PostgreSQL do contêiner (ADR-016);
 * banco limpo antes de cada caso; armazenamento de imagens em memória.
 * Dados sintéticos: pessoas em `@exemplo.test`, fases montadas em tests/fixtures/.
 */
import { construirApp } from '@math-scape/api';
import { LIMITES_CORPO } from '@math-scape/api/contrato';
import { faseInicial, projetarParaJogo } from '@math-scape/schema';
import type { Fase } from '@math-scape/schema/contrato';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import {
  DATA_URL_PNG,
  UUID_ASSET,
  documentoComImagemPropria,
  documentoComPosicoesSemEnigma,
  documentoJogavel,
  documentoSemPorta,
  envelope,
} from '../fixtures/fases-api.ts';
import {
  type App,
  PESSOA_A,
  PESSOA_B,
  type Resposta,
  abrirFase,
  comSessao,
  criarComDocumento,
  criarEPublicar,
  criarFase,
  duplicarFase,
  entrar,
  excluirFase,
  exportarFase,
  importarFase,
  jogoPublicado,
  listarFases,
  listarPublicadas,
  publicarFase,
  renomearFase,
  salvarFase,
} from '../support/api.ts';
import { type ArmazenamentoMemoria, criarArmazenamentoMemoria } from '../support/armazenamento-memoria.ts';
import { limparBanco, urlBancoDeTeste } from '../support/banco.ts';
import { consultar, contar } from '../support/consulta.ts';

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

// ----- apoio -----

interface ResumoLista {
  id: string;
  titulo: string;
  publicada: boolean;
  atualizadaEm: string;
}

interface FaseAberta {
  id: string;
  revisao: number;
  documento: Fase;
  publicada: boolean;
  alteracoesNaoPublicadas: boolean;
}

const ID_INEXISTENTE = '00000000-0000-4000-8000-00000000f404';
const MENSAGEM_RECUSA_PUBLICACAO = 'A fase não pode ser publicada: há posições da senha sem enigma.';

async function lista(sid: string): Promise<ResumoLista[]> {
  const res = await listarFases(app, sid);
  expect(res.statusCode).toBe(200);
  return (res.json() as ResumoLista[]).slice().sort((a, b) => a.titulo.localeCompare(b.titulo));
}

async function aberta(sid: string, id: string): Promise<FaseAberta> {
  const res = await abrirFase(app, sid, id);
  expect(res.statusCode).toBe(200);
  return res.json() as FaseAberta;
}

async function publicadas(): Promise<{ id: string; titulo: string }[]> {
  const res = await listarPublicadas(app);
  expect(res.statusCode).toBe(200);
  return res.json() as { id: string; titulo: string }[];
}

/** Caminhos dos erros de validação (`detalhes`) da resposta, como "paredes.frente.objetos.0.x". */
function caminhosDosErros(res: Resposta): string[] {
  const corpo = res.json() as { erro?: unknown; detalhes?: { caminho: (string | number)[] }[] };
  return (corpo.detalhes ?? []).map((erro) => erro.caminho.join('.'));
}

function semPrefixoDataUrl(dataUrl: string): Buffer {
  return Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
}

async function idDoUsuario(email: string): Promise<string> {
  const linhas = await consultar<{ id: string }>('SELECT id FROM usuarios WHERE email = $1', [email]);
  return String(linhas[0]?.id);
}

// =====================================================================
// RF-02 · criar, renomear, duplicar e excluir as próprias fases
// =====================================================================
describe('RF-02 · fases do criador', () => {
  // @req RF-02 @tipo feliz
  test('test_RF02_criar_fase_aparece_na_lista_do_criador_com_o_documento_inicial', async () => {
    const sid = await entrar(app, PESSOA_A);
    const titulo = 'Sala sintética um';
    const res = await criarFase(app, sid, titulo);
    expect(res.statusCode).toBe(201);
    const criada = res.json() as { id: string; revisao: number; documento: unknown };
    expect(typeof criada.id).toBe('string');
    expect(typeof criada.revisao).toBe('number');
    expect(criada.documento).toEqual(faseInicial(titulo));

    const itens = await lista(sid);
    expect(itens).toHaveLength(1);
    expect(itens[0]?.id).toBe(criada.id);
    expect(itens[0]?.titulo).toBe(titulo);
    expect(itens[0]?.publicada).toBe(false);
    expect(typeof itens[0]?.atualizadaEm).toBe('string');

    const fase = await aberta(sid, criada.id);
    expect(fase.documento).toEqual(faseInicial(titulo));
    expect(fase.revisao).toBe(criada.revisao);
    expect(fase.publicada).toBe(false);
  });

  // @req RF-02 @tipo feliz
  test('test_RF02_renomear_altera_o_titulo_na_lista_e_no_documento', async () => {
    const sid = await entrar(app, PESSOA_A);
    const { id, revisao } = await criarComDocumento(app, sid, documentoJogavel('Título antigo sintético'));

    const res = await renomearFase(app, sid, id, 'Título novo sintético');
    expect(res.statusCode).toBe(200);
    const novaRevisao = (res.json() as { revisao: number }).revisao;
    expect(novaRevisao).toBeGreaterThan(revisao);

    expect((await lista(sid)).map((f) => f.titulo)).toEqual(['Título novo sintético']);
    const fase = await aberta(sid, id);
    expect(fase.documento).toEqual(documentoJogavel('Título novo sintético'));
    expect(fase.revisao).toBe(novaRevisao);
  });

  // @req RF-02 @tipo feliz
  test('test_RF02_duplicar_cria_copia_nao_publicada_do_documento_na_lista_do_dono', async () => {
    const sid = await entrar(app, PESSOA_A);
    const documento = documentoJogavel('Sala sintética para duplicar');
    const { id } = await criarComDocumento(app, sid, documento);

    const res = await duplicarFase(app, sid, id);
    expect(res.statusCode).toBe(201);
    const copiaId = (res.json() as { id: string }).id;
    expect(typeof copiaId).toBe('string');
    expect(copiaId).not.toBe(id);

    const itens = await lista(sid);
    expect(itens.map((f) => f.id).sort()).toEqual([id, copiaId].sort());
    const copia = await aberta(sid, copiaId);
    expect(copia.documento).toEqual(documento);
    expect(copia.publicada).toBe(false);
    // A original continua intacta.
    expect((await aberta(sid, id)).documento).toEqual(documento);
  });

  // @req RF-02 @tipo feliz
  test('test_RF02_excluir_tira_a_fase_da_lista_e_ela_nao_abre_mais', async () => {
    const sid = await entrar(app, PESSOA_A);
    const { id } = await criarComDocumento(app, sid, documentoJogavel('Sala sintética a excluir'));
    const fica = await criarComDocumento(app, sid, documentoJogavel('Sala sintética que fica'));

    const res = await excluirFase(app, sid, id);
    expect(res.statusCode).toBe(204);

    expect((await lista(sid)).map((f) => f.id)).toEqual([fica.id]);
    expect((await abrirFase(app, sid, id)).statusCode).toBe(404);
  });

  // @req RF-02 @tipo borda
  test('test_RF02_lista_mostra_so_as_fases_do_proprio_criador', async () => {
    const sidA = await entrar(app, PESSOA_A);
    const sidB = await entrar(app, PESSOA_B);
    expect((await criarFase(app, sidA, 'Fase sintética de A1')).statusCode).toBe(201);
    expect((await criarFase(app, sidA, 'Fase sintética de A2')).statusCode).toBe(201);
    expect((await criarFase(app, sidB, 'Fase sintética de B1')).statusCode).toBe(201);

    expect((await lista(sidA)).map((f) => f.titulo)).toEqual(['Fase sintética de A1', 'Fase sintética de A2']);
    expect((await lista(sidB)).map((f) => f.titulo)).toEqual(['Fase sintética de B1']);
  });

  // @req RF-02 @tipo borda
  test('test_RF02_excluir_fase_publicada_tira_a_fase_de_escolher_fase', async () => {
    const sid = await entrar(app, PESSOA_A);
    const { id } = await criarEPublicar(app, sid, documentoJogavel('Sala sintética publicada a excluir'));
    expect((await publicadas()).map((f) => f.id)).toContain(id);

    expect((await excluirFase(app, sid, id)).statusCode).toBe(204);

    expect((await publicadas()).map((f) => f.id)).not.toContain(id);
    expect((await jogoPublicado(app, id)).statusCode).toBe(404);
  });

  // @req RF-02 @tipo borda
  test('test_RF02_exclusao_e_definitiva_e_excluir_de_novo_responde_404', async () => {
    const sid = await entrar(app, PESSOA_A);
    const { id } = await criarComDocumento(app, sid, documentoJogavel('Sala sintética sem volta'));

    expect((await excluirFase(app, sid, id)).statusCode).toBe(204);
    // ADR-002: exclusão física, sem lixeira; nada sobra para restaurar.
    expect(await contar('fases', 'id = $1', [id])).toBe(0);
    expect((await excluirFase(app, sid, id)).statusCode).toBe(404);
    expect((await duplicarFase(app, sid, id)).statusCode).toBe(404);
  });

  // @req RF-02 @tipo borda
  test('test_RF02_duplicar_fase_publicada_copia_a_versao_em_edicao_e_a_copia_nao_e_publicada', async () => {
    const sid = await entrar(app, PESSOA_A);
    const { id, revisao } = await criarEPublicar(app, sid, documentoJogavel('Versão publicada sintética'));
    const emEdicao = documentoJogavel('Versão em edição sintética');
    expect((await salvarFase(app, sid, id, { revisao, documento: emEdicao })).statusCode).toBe(200);

    const res = await duplicarFase(app, sid, id);
    expect(res.statusCode).toBe(201);
    const copiaId = (res.json() as { id: string }).id;

    const copia = await aberta(sid, copiaId);
    expect(copia.documento).toEqual(emEdicao);
    expect(copia.publicada).toBe(false);
    const naLista = (await lista(sid)).find((f) => f.id === copiaId);
    expect(naLista?.publicada).toBe(false);
    expect(await publicadas()).toEqual([{ id, titulo: 'Versão publicada sintética' }]);
  });

  // @req RF-02 @tipo borda
  test('test_RF02_titulo_com_80_caracteres_e_aceito_e_com_81_e_recusado', async () => {
    const sid = await entrar(app, PESSOA_A);
    const titulo80 = 'T'.repeat(80);
    const titulo81 = 'T'.repeat(81);

    const criada = await criarFase(app, sid, titulo80);
    expect(criada.statusCode).toBe(201);
    expect((await criarFase(app, sid, titulo81)).statusCode).toBe(400);
    expect(await contar('fases')).toBe(1);

    const id = (criada.json() as { id: string }).id;
    expect((await renomearFase(app, sid, id, titulo81)).statusCode).toBe(400);
    expect((await renomearFase(app, sid, id, 'U'.repeat(80))).statusCode).toBe(200);
    expect((await lista(sid)).map((f) => f.titulo)).toEqual(['U'.repeat(80)]);
  });

  // @req RF-02 @tipo borda
  test('test_RF02_titulo_so_com_espacos_e_recusado_ao_criar_e_ao_renomear', async () => {
    const sid = await entrar(app, PESSOA_A);
    expect((await criarFase(app, sid, '   ')).statusCode).toBe(400);
    expect(await contar('fases')).toBe(0);

    const criada = await criarFase(app, sid, 'Sala sintética com título');
    const id = (criada.json() as { id: string }).id;
    expect((await renomearFase(app, sid, id, '   ')).statusCode).toBe(400);
    expect((await lista(sid)).map((f) => f.titulo)).toEqual(['Sala sintética com título']);
  });

  // @req RF-02 @tipo negativo
  test('test_RF02_criar_fase_com_titulo_vazio_ou_ausente_responde_400_e_nada_e_gravado', async () => {
    const sid = await entrar(app, PESSOA_A);
    expect((await criarFase(app, sid, '')).statusCode).toBe(400);
    expect((await criarFase(app, sid, undefined)).statusCode).toBe(400);
    expect((await criarFase(app, sid, 42)).statusCode).toBe(400);
    expect(await contar('fases')).toBe(0);
    expect(await lista(sid)).toEqual([]);
  });

  // @req RF-02 @tipo negativo
  test('test_RF02_renomear_com_titulo_vazio_responde_400_e_mantem_o_titulo', async () => {
    const sid = await entrar(app, PESSOA_A);
    const { id, revisao } = await criarComDocumento(app, sid, documentoJogavel('Título sintético mantido'));

    expect((await renomearFase(app, sid, id, '')).statusCode).toBe(400);

    const fase = await aberta(sid, id);
    expect(fase.documento.titulo).toBe('Título sintético mantido');
    expect(fase.revisao).toBe(revisao);
    expect((await lista(sid)).map((f) => f.titulo)).toEqual(['Título sintético mantido']);
  });

  // @req RF-02 @tipo negativo
  test('test_RF02_outro_criador_nao_abre_a_fase_e_recebe_404_sem_o_documento', async () => {
    const sidA = await entrar(app, PESSOA_A);
    const sidB = await entrar(app, PESSOA_B);
    const { id } = await criarComDocumento(app, sidA, documentoJogavel('Rascunho sintético de A'));

    const res = await abrirFase(app, sidB, id);
    expect(res.statusCode).toBe(404);
    expect(res.body).not.toContain('Rascunho sintético de A');
    expect(res.body).not.toContain('92139');
  });

  // @req RF-02 @tipo negativo
  test('test_RF02_outro_criador_nao_renomeia_e_recebe_404', async () => {
    const sidA = await entrar(app, PESSOA_A);
    const sidB = await entrar(app, PESSOA_B);
    const { id, revisao } = await criarComDocumento(app, sidA, documentoJogavel('Título sintético de A'));

    expect((await renomearFase(app, sidB, id, 'Título trocado por B')).statusCode).toBe(404);

    const fase = await aberta(sidA, id);
    expect(fase.documento.titulo).toBe('Título sintético de A');
    expect(fase.revisao).toBe(revisao);
  });

  // @req RF-02 @tipo negativo
  test('test_RF02_outro_criador_nao_salva_documento_e_recebe_404', async () => {
    const sidA = await entrar(app, PESSOA_A);
    const sidB = await entrar(app, PESSOA_B);
    const original = documentoJogavel('Documento sintético de A');
    const { id, revisao } = await criarComDocumento(app, sidA, original);

    const res = await salvarFase(app, sidB, id, { revisao, documento: documentoJogavel('Documento escrito por B') });
    expect(res.statusCode).toBe(404);

    const fase = await aberta(sidA, id);
    expect(fase.documento).toEqual(original);
    expect(fase.revisao).toBe(revisao);
  });

  // @req RF-02 @tipo negativo
  test('test_RF02_outro_criador_nao_exclui_e_recebe_404', async () => {
    const sidA = await entrar(app, PESSOA_A);
    const sidB = await entrar(app, PESSOA_B);
    const { id } = await criarEPublicar(app, sidA, documentoJogavel('Fase sintética publicada de A'));

    expect((await excluirFase(app, sidB, id)).statusCode).toBe(404);

    expect((await lista(sidA)).map((f) => f.id)).toEqual([id]);
    expect((await publicadas()).map((f) => f.id)).toContain(id);
  });

  // @req RF-02 @tipo negativo
  test('test_RF02_outro_criador_nao_duplica_e_recebe_404', async () => {
    const sidA = await entrar(app, PESSOA_A);
    const sidB = await entrar(app, PESSOA_B);
    const { id } = await criarComDocumento(app, sidA, documentoJogavel('Fase sintética de A'));

    expect((await duplicarFase(app, sidB, id)).statusCode).toBe(404);

    expect(await lista(sidB)).toEqual([]);
    expect(await contar('fases')).toBe(1);
  });

  // @req RF-02 @tipo negativo
  test('test_RF02_outro_criador_nao_publica_e_recebe_404', async () => {
    const sidA = await entrar(app, PESSOA_A);
    const sidB = await entrar(app, PESSOA_B);
    const { id } = await criarComDocumento(app, sidA, documentoJogavel('Rascunho sintético jogável de A'));

    expect((await publicarFase(app, sidB, id)).statusCode).toBe(404);

    expect((await aberta(sidA, id)).publicada).toBe(false);
    expect(await publicadas()).toEqual([]);
  });

  // @req RF-02 @tipo negativo
  test('test_RF02_fase_inexistente_responde_404', async () => {
    const sid = await entrar(app, PESSOA_A);
    expect((await abrirFase(app, sid, ID_INEXISTENTE)).statusCode).toBe(404);
    expect((await renomearFase(app, sid, ID_INEXISTENTE, 'Título sintético')).statusCode).toBe(404);
    expect((await excluirFase(app, sid, ID_INEXISTENTE)).statusCode).toBe(404);
    expect((await duplicarFase(app, sid, ID_INEXISTENTE)).statusCode).toBe(404);
    expect(await contar('fases')).toBe(0);
  });

  // @req RF-02 @tipo negativo
  test('test_RF02_sem_sessao_alterar_fase_responde_401_e_nada_muda', async () => {
    const sid = await entrar(app, PESSOA_A);
    const original = documentoJogavel('Fase sintética protegida');
    const { id, revisao } = await criarComDocumento(app, sid, original);

    expect((await renomearFase(app, undefined, id, 'Título sem sessão')).statusCode).toBe(401);
    expect((await salvarFase(app, undefined, id, { revisao, documento: documentoJogavel('Sem sessão') })).statusCode).toBe(401);
    expect((await duplicarFase(app, undefined, id)).statusCode).toBe(401);
    expect((await excluirFase(app, undefined, id)).statusCode).toBe(401);

    const fase = await aberta(sid, id);
    expect(fase.documento).toEqual(original);
    expect(fase.revisao).toBe(revisao);
    expect(await contar('fases')).toBe(1);
  });
});

// =====================================================================
// RF-10 · salvar (na Api: PUT /fases/:id com `revisao`)
// =====================================================================
describe('RF-10 · salvar a fase', () => {
  // @req RF-10 @tipo feliz
  test('test_RF10_salvar_com_a_revisao_atual_grava_o_documento_e_avanca_a_revisao', async () => {
    const sid = await entrar(app, PESSOA_A);
    const criada = await criarFase(app, sid, 'Sala sintética inicial');
    const { id, revisao } = criada.json() as { id: string; revisao: number };
    const documento = documentoJogavel('Sala sintética salva');

    const res = await salvarFase(app, sid, id, { revisao, documento });
    expect(res.statusCode).toBe(200);
    const novaRevisao = (res.json() as { revisao: number }).revisao;
    expect(novaRevisao).toBeGreaterThan(revisao);

    // Ao recarregar, a alteração está presente.
    const fase = await aberta(sid, id);
    expect(fase.documento).toEqual(documento);
    expect(fase.revisao).toBe(novaRevisao);
    // A coluna do título acompanha documento.titulo (ADR-002).
    expect((await lista(sid)).map((f) => f.titulo)).toEqual(['Sala sintética salva']);
  });

  // @req RF-10 @tipo feliz
  test('test_RF10_salvar_fase_publicada_altera_so_a_versao_em_edicao', async () => {
    const sid = await entrar(app, PESSOA_A);
    const publicadaDoc = documentoJogavel('Versão sintética publicada');
    const { id, revisao } = await criarEPublicar(app, sid, publicadaDoc);
    const emEdicao = documentoSemPorta('Versão sintética em edição');

    expect((await salvarFase(app, sid, id, { revisao, documento: emEdicao })).statusCode).toBe(200);

    const fase = await aberta(sid, id);
    expect(fase.documento).toEqual(emEdicao);
    expect(fase.publicada).toBe(true);
    expect(fase.alteracoesNaoPublicadas).toBe(true);
    // Os jogadores continuam vendo a versão publicada.
    expect(await publicadas()).toEqual([{ id, titulo: 'Versão sintética publicada' }]);
    const jogo = await jogoPublicado(app, id);
    expect(jogo.statusCode).toBe(200);
    expect(jogo.json()).toEqual(projetarParaJogo(publicadaDoc));
  });

  // @req RF-10 @tipo borda
  test('test_RF10_salvamentos_seguidos_com_a_revisao_devolvida_sao_todos_aceitos', async () => {
    const sid = await entrar(app, PESSOA_A);
    const criada = await criarFase(app, sid, 'Sala sintética de salvamentos');
    const { id } = criada.json() as { id: string };
    let revisao = (criada.json() as { revisao: number }).revisao;

    for (const titulo of ['Salvamento sintético 1', 'Salvamento sintético 2', 'Salvamento sintético 3']) {
      const res = await salvarFase(app, sid, id, { revisao, documento: documentoJogavel(titulo) });
      expect(res.statusCode).toBe(200);
      const proxima = (res.json() as { revisao: number }).revisao;
      expect(proxima).toBeGreaterThan(revisao);
      revisao = proxima;
    }

    const fase = await aberta(sid, id);
    expect(fase.documento.titulo).toBe('Salvamento sintético 3');
    expect(fase.revisao).toBe(revisao);
  });

  // @req RF-10 @tipo borda
  test('test_RF10_segunda_aba_com_a_mesma_revisao_recebe_409_e_nao_sobrescreve', async () => {
    const sid = await entrar(app, PESSOA_A);
    const criada = await criarFase(app, sid, 'Sala sintética em duas abas');
    const { id, revisao } = criada.json() as { id: string; revisao: number };
    const daAba1 = documentoJogavel('Gravado pela aba 1');

    expect((await salvarFase(app, sid, id, { revisao, documento: daAba1 })).statusCode).toBe(200);
    const aba2 = await salvarFase(app, sid, id, { revisao, documento: documentoJogavel('Gravado pela aba 2') });
    expect(aba2.statusCode).toBe(409);

    expect((await aberta(sid, id)).documento).toEqual(daAba1);
  });

  // @req RF-10 @tipo borda
  test('test_RF10_alteracoes_nao_publicadas_acompanham_a_diferenca_entre_rascunho_e_publicada', async () => {
    const sid = await entrar(app, PESSOA_A);
    const v1 = documentoJogavel('Versão sintética um');
    const { id } = await criarEPublicar(app, sid, v1);
    let fase = await aberta(sid, id);
    expect(fase.alteracoesNaoPublicadas).toBe(false);

    const v2 = documentoJogavel('Versão sintética dois');
    expect((await salvarFase(app, sid, id, { revisao: fase.revisao, documento: v2 })).statusCode).toBe(200);
    fase = await aberta(sid, id);
    expect(fase.alteracoesNaoPublicadas).toBe(true);

    // Voltar ao mesmo documento publicado: não há mais diferença.
    expect((await salvarFase(app, sid, id, { revisao: fase.revisao, documento: v1 })).statusCode).toBe(200);
    expect((await aberta(sid, id)).alteracoesNaoPublicadas).toBe(false);
  });

  // @req RF-10 @tipo borda
  test('test_RF10_documento_invalido_com_revisao_desatualizada_responde_400_antes_de_409', async () => {
    const sid = await entrar(app, PESSOA_A);
    const original = documentoJogavel('Sala sintética da ordem dos erros');
    const { id, revisao } = await criarComDocumento(app, sid, original);

    const invalido = { ...documentoJogavel('Documento sintético inválido'), senha: '12' };
    const res = await salvarFase(app, sid, id, { revisao: revisao + 100, documento: invalido });
    expect(res.statusCode).toBe(400);

    const fase = await aberta(sid, id);
    expect(fase.documento).toEqual(original);
    expect(fase.revisao).toBe(revisao);
  });

  // @req RF-10 @tipo negativo
  test('test_RF10_revisao_desatualizada_responde_409_e_nao_grava', async () => {
    const sid = await entrar(app, PESSOA_A);
    const criada = await criarFase(app, sid, 'Sala sintética desatualizada');
    const { id, revisao: revisaoAntiga } = criada.json() as { id: string; revisao: number };
    const primeiro = documentoJogavel('Primeiro salvamento sintético');
    const salvo = await salvarFase(app, sid, id, { revisao: revisaoAntiga, documento: primeiro });
    expect(salvo.statusCode).toBe(200);
    const revisaoAtual = (salvo.json() as { revisao: number }).revisao;

    const res = await salvarFase(app, sid, id, { revisao: revisaoAntiga, documento: documentoJogavel('Salvamento atrasado') });
    expect(res.statusCode).toBe(409);

    const fase = await aberta(sid, id);
    expect(fase.documento).toEqual(primeiro);
    expect(fase.revisao).toBe(revisaoAtual);
    expect((await lista(sid)).map((f) => f.titulo)).toEqual(['Primeiro salvamento sintético']);
  });

  // @req RF-10 @tipo negativo
  test('test_RF10_corpo_sem_revisao_ou_com_revisao_invalida_responde_400_e_nao_grava', async () => {
    const sid = await entrar(app, PESSOA_A);
    const original = documentoJogavel('Sala sintética do corpo inválido');
    const { id, revisao } = await criarComDocumento(app, sid, original);
    const outro = documentoJogavel('Documento sintético recusado');

    for (const corpo of [{ documento: outro }, { revisao: -1, documento: outro }, { revisao: String(revisao), documento: outro }, { revisao: 1.5, documento: outro }]) {
      expect((await salvarFase(app, sid, id, corpo)).statusCode).toBe(400);
    }

    const fase = await aberta(sid, id);
    expect(fase.documento).toEqual(original);
    expect(fase.revisao).toBe(revisao);
  });
});

// =====================================================================
// RNF-09 · documento fora do schema recusado ao salvar, publicar e importar
// =====================================================================
describe('RNF-09 · schema único na Api', () => {
  // @req RNF-09 @tipo feliz
  test('test_RNF09_documento_valido_e_aceito_ao_salvar_publicar_e_importar', async () => {
    const sid = await entrar(app, PESSOA_A);
    const documento = documentoJogavel('Documento sintético válido');
    const criada = await criarFase(app, sid, documento.titulo);
    const { id, revisao } = criada.json() as { id: string; revisao: number };

    expect((await salvarFase(app, sid, id, { revisao, documento })).statusCode).toBe(200);
    expect((await publicarFase(app, sid, id)).statusCode).toBe(200);
    const importada = await importarFase(app, sid, envelope(documentoJogavel('Documento sintético importado')));
    expect(importada.statusCode).toBe(201);
    expect(await contar('fases')).toBe(2);
  });

  // @req RNF-09 @tipo borda
  test('test_RNF09_documento_nos_limites_do_schema_e_aceito_e_gravado_sem_alteracao', async () => {
    const sid = await entrar(app, PESSOA_A);
    const criada = await criarFase(app, sid, 'Sala sintética nos limites');
    const { id, revisao } = criada.json() as { id: string; revisao: number };
    const documento = documentoJogavel('L'.repeat(80));
    documento.senha = '12345678';
    const primeiro = documento.paredes.frente.objetos[0];
    if (primeiro) {
      primeiro.x = 0;
      primeiro.y = 1;
      primeiro.largura = 1;
      primeiro.rotacao = 359.5;
    }

    expect((await salvarFase(app, sid, id, { revisao, documento })).statusCode).toBe(200);
    expect((await aberta(sid, id)).documento).toEqual(documento);
  });

  // @req RNF-09 @tipo borda
  test('test_RNF09_senha_de_9_digitos_e_campo_desconhecido_sao_recusados_ao_salvar', async () => {
    const sid = await entrar(app, PESSOA_A);
    const original = documentoJogavel('Sala sintética estrita');
    const { id, revisao } = await criarComDocumento(app, sid, original);

    const nove = await salvarFase(app, sid, id, { revisao, documento: { ...original, senha: '123456789' } });
    expect(nove.statusCode).toBe(400);
    expect(caminhosDosErros(nove)).toContain('senha');

    const extra = await salvarFase(app, sid, id, { revisao, documento: { ...original, autor: 'Pessoa Sintética A' } });
    expect(extra.statusCode).toBe(400);
    expect(caminhosDosErros(extra).length).toBeGreaterThan(0);

    expect((await aberta(sid, id)).documento).toEqual(original);
  });

  // @req RNF-09 @tipo negativo
  test('test_RNF09_salvar_documento_fora_do_schema_responde_400_apontando_o_campo', async () => {
    const sid = await entrar(app, PESSOA_A);
    const original = documentoJogavel('Sala sintética com erro de campo');
    const { id, revisao } = await criarComDocumento(app, sid, original);
    const invalido = structuredClone(original);
    const primeiro = invalido.paredes.frente.objetos[0];
    if (primeiro) primeiro.x = 1.5;

    const res = await salvarFase(app, sid, id, { revisao, documento: invalido });
    expect(res.statusCode).toBe(400);
    expect(typeof (res.json() as { erro: unknown }).erro).toBe('string');
    expect(caminhosDosErros(res)).toContain('paredes.frente.objetos.0.x');

    const fase = await aberta(sid, id);
    expect(fase.documento).toEqual(original);
    expect(fase.revisao).toBe(revisao);
  });

  // @req RNF-09 @tipo negativo
  test('test_RNF09_publicar_documento_fora_do_schema_responde_400_e_nao_publica', async () => {
    const sid = await entrar(app, PESSOA_A);
    const { id } = await criarComDocumento(app, sid, documentoJogavel('Sala sintética corrompida'));
    // O PUT nunca grava documento inválido; o banco é alterado por fora para exercitar a validação do publicar.
    const corrompido = { ...documentoJogavel('Sala sintética corrompida'), senha: 'abc' };
    await consultar('UPDATE fases SET documento = $1::jsonb WHERE id = $2', [JSON.stringify(corrompido), id]);

    const res = await publicarFase(app, sid, id);
    expect(res.statusCode).toBe(400);
    expect(caminhosDosErros(res)).toContain('senha');

    expect(await publicadas()).toEqual([]);
    const linhas = await consultar<{ documento_publicado: unknown; publicada_em: unknown }>(
      'SELECT documento_publicado, publicada_em FROM fases WHERE id = $1',
      [id],
    );
    expect(linhas[0]?.documento_publicado).toBeNull();
    expect(linhas[0]?.publicada_em).toBeNull();
  });

  // @req RNF-09 @tipo negativo
  test('test_RNF09_importar_envelope_com_fase_fora_do_schema_responde_400_e_nada_e_gravado', async () => {
    const sid = await entrar(app, PESSOA_A);
    const invalida = { ...documentoJogavel('Fase sintética inválida no arquivo'), senha: '12' };

    const res = await importarFase(app, sid, envelope(invalida));
    expect(res.statusCode).toBe(400);
    expect(caminhosDosErros(res)).toContain('fase.senha');

    expect(await contar('fases')).toBe(0);
    expect(await contar('assets')).toBe(0);
  });
});

// =====================================================================
// RF-12 · publicar só fase com todas as posições da senha ligadas a enigmas
// =====================================================================
describe('RF-12 · validação de jogabilidade ao publicar', () => {
  // @req RF-12 @tipo feliz
  test('test_RF12_fase_com_todas_as_posicoes_ligadas_a_enigmas_e_publicada', async () => {
    const sid = await entrar(app, PESSOA_A);
    const { id } = await criarComDocumento(app, sid, documentoJogavel('Sala sintética jogável'));

    const res = await publicarFase(app, sid, id);
    expect(res.statusCode).toBe(200);
    expect(typeof (res.json() as { publicadaEm: unknown }).publicadaEm).toBe('string');

    expect((await lista(sid))[0]?.publicada).toBe(true);
    expect((await aberta(sid, id)).publicada).toBe(true);
    expect(await publicadas()).toEqual([{ id, titulo: 'Sala sintética jogável' }]);
  });

  // @req RF-12 @tipo borda
  test('test_RF12_fase_sem_porta_com_todas_as_posicoes_ligadas_e_publicada', async () => {
    const sid = await entrar(app, PESSOA_A);
    const { id } = await criarComDocumento(app, sid, documentoSemPorta('Sala sintética sem porta'));

    expect((await publicarFase(app, sid, id)).statusCode).toBe(200);
    expect(await publicadas()).toEqual([{ id, titulo: 'Sala sintética sem porta' }]);
  });

  // @req RF-12 @tipo borda
  test('test_RF12_fase_inicial_sem_enigmas_e_recusada_com_as_5_posicoes', async () => {
    const sid = await entrar(app, PESSOA_A);
    const criada = await criarFase(app, sid, 'Sala sintética recém-criada');
    const { id } = criada.json() as { id: string };

    const res = await publicarFase(app, sid, id);
    expect(res.statusCode).toBe(422);
    expect(res.json()).toEqual({ erro: MENSAGEM_RECUSA_PUBLICACAO, posicoesSemEnigma: [1, 2, 3, 4, 5] });
    expect(await publicadas()).toEqual([]);
  });

  // @req RF-12 @tipo borda
  test('test_RF12_publicacao_recusada_mantem_a_versao_publicada_anterior', async () => {
    const sid = await entrar(app, PESSOA_A);
    const v1 = documentoJogavel('Versão sintética jogável publicada');
    const { id, revisao } = await criarEPublicar(app, sid, v1);
    const comBuracos = documentoComPosicoesSemEnigma('Versão sintética com buracos');
    expect((await salvarFase(app, sid, id, { revisao, documento: comBuracos })).statusCode).toBe(200);

    const res = await publicarFase(app, sid, id);
    expect(res.statusCode).toBe(422);
    expect((res.json() as { posicoesSemEnigma: number[] }).posicoesSemEnigma).toEqual([2, 5]);

    expect(await publicadas()).toEqual([{ id, titulo: 'Versão sintética jogável publicada' }]);
    const jogo = await jogoPublicado(app, id);
    expect(jogo.statusCode).toBe(200);
    expect(jogo.json()).toEqual(projetarParaJogo(v1));
  });

  // @req RF-12 @tipo negativo
  test('test_RF12_senha_92139_com_posicoes_2_e_5_sem_enigma_responde_422_com_as_posicoes', async () => {
    const sid = await entrar(app, PESSOA_A);
    const { id } = await criarComDocumento(app, sid, documentoComPosicoesSemEnigma('Sala sintética 92139'));

    const res = await publicarFase(app, sid, id);
    expect(res.statusCode).toBe(422);
    expect(res.json()).toEqual({ erro: MENSAGEM_RECUSA_PUBLICACAO, posicoesSemEnigma: [2, 5] });

    expect((await aberta(sid, id)).publicada).toBe(false);
    expect((await lista(sid))[0]?.publicada).toBe(false);
    expect(await publicadas()).toEqual([]);
    const linhas = await consultar<{ documento_publicado: unknown }>('SELECT documento_publicado FROM fases WHERE id = $1', [id]);
    expect(linhas[0]?.documento_publicado).toBeNull();
  });
});

// =====================================================================
// RF-14 · exportar as próprias fases e importar fase em JSON
// =====================================================================
describe('RF-14 · exportar e importar', () => {
  // @req RF-14 @tipo feliz
  test('test_RF14_exportar_devolve_envelope_com_o_documento_da_fase', async () => {
    const sid = await entrar(app, PESSOA_A);
    const documento = documentoJogavel('Sala sintética exportada');
    const { id } = await criarComDocumento(app, sid, documento);

    const res = await exportarFase(app, sid, id);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ formato: 'math-scape-fase', versao: 1, fase: documento, imagens: {} });
  });

  // @req RF-14 @tipo feliz
  test('test_RF14_exportar_e_importar_o_mesmo_arquivo_gera_fase_igual', async () => {
    const sidA = await entrar(app, PESSOA_A);
    const sidB = await entrar(app, PESSOA_B);
    const documento = documentoJogavel('Sala sintética de ida e volta');
    const { id } = await criarComDocumento(app, sidA, documento);
    const arquivo = (await exportarFase(app, sidA, id)).json() as Record<string, unknown>;

    // Outro criador importa o arquivo.
    const deB = await importarFase(app, sidB, arquivo);
    expect(deB.statusCode).toBe(201);
    const idB = (deB.json() as { id: string }).id;
    expect((await aberta(sidB, idB)).documento).toEqual(documento);
    expect((await lista(sidB)).map((f) => f.id)).toEqual([idB]);

    // O próprio autor importa o mesmo arquivo: fase nova, igual à original.
    const deA = await importarFase(app, sidA, arquivo);
    expect(deA.statusCode).toBe(201);
    const idA = (deA.json() as { id: string }).id;
    expect(idA).not.toBe(id);
    expect((await aberta(sidA, idA)).documento).toEqual(documento);
    expect((await lista(sidA)).map((f) => f.id).sort()).toEqual([id, idA].sort());
  });

  // @req RF-14 @tipo borda
  test('test_RF14_exportar_fase_publicada_usa_a_versao_em_edicao', async () => {
    const sid = await entrar(app, PESSOA_A);
    const { id, revisao } = await criarEPublicar(app, sid, documentoJogavel('Versão sintética publicada'));
    const emEdicao = documentoSemPorta('Versão sintética em edição');
    expect((await salvarFase(app, sid, id, { revisao, documento: emEdicao })).statusCode).toBe(200);

    const res = await exportarFase(app, sid, id);
    expect(res.statusCode).toBe(200);
    expect((res.json() as { fase: unknown }).fase).toEqual(emEdicao);
  });

  // @req RF-14 @tipo borda
  test('test_RF14_importar_com_imagem_propria_cria_imagem_do_importador_e_troca_so_a_referencia', async () => {
    const sidB = await entrar(app, PESSOA_B);
    const idB = await idDoUsuario(PESSOA_B.email);
    const original = documentoComImagemPropria('Sala sintética com imagem própria');

    const res = await importarFase(app, sidB, envelope(original, { [UUID_ASSET]: DATA_URL_PNG }));
    expect(res.statusCode).toBe(201);
    const id = (res.json() as { id: string }).id;

    const importado = (await aberta(sidB, id)).documento;
    const quadro = importado.paredes.direita.objetos.find((o) => o.id === 'quadro-proprio');
    const ref = String(quadro?.imagem);
    expect(ref.startsWith('asset:')).toBe(true);
    const novoUuid = ref.slice('asset:'.length);
    expect(novoUuid).not.toBe(UUID_ASSET);
    // Igual à exportada, exceto o uuid da imagem (modulos-schema.md §4).
    expect(importado).toEqual(JSON.parse(JSON.stringify(original).split(UUID_ASSET).join(novoUuid)));

    // A imagem é nova e do importador, com os mesmos bytes.
    const assets = await consultar<{ dono_id: string }>('SELECT dono_id FROM assets WHERE id = $1', [novoUuid]);
    expect(assets).toHaveLength(1);
    expect(String(assets[0]?.dono_id)).toBe(idB);
    const gravado = await armazenamento.ler(armazenamento.gravados[0] ?? '');
    expect(Buffer.from(gravado?.bytes ?? new Uint8Array()).equals(semPrefixoDataUrl(DATA_URL_PNG))).toBe(true);

    // Exportar a importada devolve a mesma imagem embutida, agora com o uuid novo.
    const exportado = await exportarFase(app, sidB, id);
    expect(exportado.statusCode).toBe(200);
    expect(exportado.json()).toEqual({ formato: 'math-scape-fase', versao: 1, fase: importado, imagens: { [novoUuid]: DATA_URL_PNG } });
  });

  // @req RF-14 @tipo borda
  test('test_RF14_importar_arquivo_de_alguns_MB_dentro_do_limite_e_aceito', async () => {
    const sid = await entrar(app, PESSOA_A);
    // PNG sintético de 2 MB: assinatura PNG seguida de zeros (tipo detectado pelos bytes iniciais, ADR-010).
    const bytes = Buffer.alloc(2 * 1024 * 1024);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(bytes);
    const dataUrl = `data:image/png;base64,${bytes.toString('base64')}`;
    const corpo = envelope(documentoComImagemPropria('Sala sintética pesada'), { [UUID_ASSET]: dataUrl });
    expect(JSON.stringify(corpo).length).toBeGreaterThan(1024 * 1024);

    const res = await importarFase(app, sid, corpo);
    expect(res.statusCode).toBe(201);
    expect(await contar('fases')).toBe(1);
    expect(await contar('assets')).toBe(1);
  });

  // @req RF-14 @tipo borda
  test('test_RF14_importar_corpo_acima_do_limite_responde_413_e_nada_e_gravado', async () => {
    const sid = await entrar(app, PESSOA_A);
    const corpo = `{"formato":"math-scape-fase","versao":1,"fase":{},"imagens":{},"sobra":"${'a'.repeat(LIMITES_CORPO.importar)}"}`;
    expect(corpo.length).toBeGreaterThan(LIMITES_CORPO.importar);

    const res = await app.inject({
      method: 'POST',
      url: '/fases/importar',
      cookies: comSessao(sid),
      headers: { 'content-type': 'application/json' },
      payload: corpo,
    });
    expect(res.statusCode).toBe(413);
    expect(await contar('fases')).toBe(0);
    expect(await contar('assets')).toBe(0);
  });

  // @req RF-14 @tipo negativo
  test('test_RF14_exportar_fase_de_outro_criador_responde_404_sem_o_documento', async () => {
    const sidA = await entrar(app, PESSOA_A);
    const sidB = await entrar(app, PESSOA_B);
    const { id } = await criarEPublicar(app, sidA, documentoJogavel('Fase sintética de A para exportar'));

    const res = await exportarFase(app, sidB, id);
    expect(res.statusCode).toBe(404);
    expect(res.body).not.toContain('92139');
    expect(res.body).not.toContain('Quanto é 10 + 15 x 20?');
    expect(res.body).not.toContain('math-scape-fase');
  });

  // @req RF-14 @tipo negativo
  test('test_RF14_importar_arquivo_que_nao_e_envelope_valido_responde_400_e_nada_e_gravado', async () => {
    const sid = await entrar(app, PESSOA_A);
    const documento = documentoJogavel('Fase sintética fora do envelope');
    const recusados: unknown[] = [
      documento,
      { ...envelope(documento), formato: 'outro-formato' },
      { ...envelope(documento), versao: 2 },
      // Imagem usada na fase sem entrada no arquivo.
      envelope(documentoComImagemPropria('Fase sintética sem a imagem')),
      // Entrada de imagem que a fase não usa.
      envelope(documento, { [UUID_ASSET]: DATA_URL_PNG }),
    ];

    for (const arquivo of recusados) {
      expect((await importarFase(app, sid, arquivo)).statusCode).toBe(400);
    }
    expect(await contar('fases')).toBe(0);
    expect(await contar('assets')).toBe(0);
    expect(armazenamento.arquivos.size).toBe(0);
  });

  // @req RF-14 @tipo negativo
  test('test_RF14_importar_imagem_que_nao_e_png_jpg_nem_webp_responde_415_e_nada_e_gravado', async () => {
    const sid = await entrar(app, PESSOA_A);
    // Declarada como PNG, mas os bytes (oito zeros) não têm assinatura de imagem aceita.
    const falsoPng = 'data:image/png;base64,AAAAAAAAAAA=';

    const res = await importarFase(app, sid, envelope(documentoComImagemPropria('Fase sintética com imagem falsa'), { [UUID_ASSET]: falsoPng }));
    expect(res.statusCode).toBe(415);

    expect(await contar('fases')).toBe(0);
    expect(await contar('assets')).toBe(0);
    expect(armazenamento.arquivos.size).toBe(0);
  });
});
