/**
 * Módulo: Store com histórico (apps/editor/contrato/store.ts · CriarStoreEditor, EstadoEditor, ResultadoAcao;
 * modulos-editor.md §2; ADR-008, ADR-011, LAC-032, LAC-037).
 * Requisitos: RF-04 (inserir da biblioteca na parede ativa), RF-05 (mover, redimensionar, rotacionar, camadas,
 * duplicar, excluir), RF-07 (tipo do objeto), RF-08 (campos da interação e senha), RF-09 (desfazer/refazer).
 * Fases sintéticas de tests/fixtures/fases.ts; ids escritos à mão, sem aleatoriedade.
 */
import { criarStoreEditor } from '@math-scape/app-editor';
import type { ResultadoAcao, StoreEditor } from '@math-scape/app-editor/contrato';
import { objetoPadrao } from '@math-scape/schema';
import { CATALOGO, type Fase, type Interacao, type Objeto, type ParedeId } from '@math-scape/schema/contrato';
import { describe, expect, test } from 'vitest';
import { UUID_ASSET, decoracao, enigma, fala, fase, faseValida, objeto, porta } from '../fixtures/fases.ts';

const MSG_FRENTE = 'O objeto já está na frente de todos.';
const MSG_TRAS = 'O objeto já está atrás de todos.';
const MSG_SENHA = 'Ajuste os enigmas que revelam posições que deixariam de existir.';
const msgInexistente = (id: string) => `O objeto "${id}" não existe nesta fase.`;

function objetosDe(store: StoreEditor, parede: ParedeId): Objeto[] {
  return store.getState().documento.paredes[parede].objetos;
}

function achar(store: StoreEditor, id: string): Objeto | undefined {
  const paredes = store.getState().documento.paredes;
  for (const parede of Object.values(paredes)) {
    const encontrado = parede.objetos.find((o) => o.id === id);
    if (encontrado) return encontrado;
  }
  return undefined;
}

/** Ordem de desenho de uma parede: camada crescente, empate pela posição na lista (o último fica na frente). */
function ordemVisual(objetos: Objeto[]): string[] {
  return objetos
    .map((o, indice) => ({ o, indice }))
    .sort((a, b) => a.o.camada - b.o.camada || a.indice - b.indice)
    .map(({ o }) => o.id);
}

function camadas(objetos: Objeto[]): Record<string, number> {
  return Object.fromEntries(objetos.map((o) => [o.id, o.camada]));
}

function emCamada(o: Objeto, camada: number): Objeto {
  return { ...o, camada };
}

function errosDe(resultado: ResultadoAcao) {
  return resultado.ok ? [] : resultado.erros;
}

/** Recusa: nada muda no documento, a seleção fica igual e nenhum passo de histórico é criado. */
function esperarRecusaSemEfeito(store: StoreEditor, antes: Fase, resultado: ResultadoAcao, selecionadoAntes: string | null) {
  expect(resultado.ok).toBe(false);
  expect(errosDe(resultado).length).toBeGreaterThan(0);
  expect(store.getState().documento).toEqual(antes);
  expect(store.getState().selecionado).toBe(selecionadoAntes);
  expect(store.getState().podeDesfazer()).toBe(false);
}

/** Parede da frente com três decorações em camadas distintas: a (0) atrás, b (1) no meio, c (2) na frente. */
function faseTresCamadas(): Fase {
  return fase('12345', {
    frente: [emCamada(decoracao('a'), 0), emCamada(decoracao('b'), 1), emCamada(decoracao('c'), 2)],
    direita: [emCamada(decoracao('d'), 0)],
  });
}

// ---------------------------------------------------------------------------
// Estado inicial
// ---------------------------------------------------------------------------
describe('RF-09 · estado inicial do store', () => {
  // @req RF-09 @tipo borda
  test('test_RF09_store_novo_comeca_na_frente_sem_selecao_e_sem_historico', () => {
    const documento = faseValida();
    const store = criarStoreEditor(structuredClone(documento));
    const estado = store.getState();
    expect(estado.documento).toEqual(documento);
    expect(estado.paredeAtiva).toBe('frente');
    expect(estado.selecionado).toBeNull();
    expect(estado.podeDesfazer()).toBe(false);
    expect(estado.podeRefazer()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// RF-04 · adicionarObjeto
// ---------------------------------------------------------------------------
describe('RF-04 · adicionarObjeto', () => {
  // @req RF-04 @tipo feliz
  test('test_RF04_adicionar_insere_objeto_padrao_na_parede_ativa_na_camada_mais_alta_e_seleciona', () => {
    const store = criarStoreEditor(fase('12345', { frente: [porta('porta-1')] }));

    const resultado = store.getState().adicionarObjeto('decoracao', 'sprite:quadro', 'novo-1');

    expect(resultado).toEqual({ ok: true });
    const frente = objetosDe(store, 'frente');
    expect(frente.map((o) => o.id)).toEqual(['porta-1', 'novo-1']);
    expect(frente[1]).toEqual({ ...objetoPadrao('decoracao', 'sprite:quadro', 'novo-1'), camada: 1 });
    expect(store.getState().selecionado).toBe('novo-1');
  });

  // @req RF-04 @tipo feliz
  test('test_RF04_todo_objeto_da_biblioteca_pode_ser_colocado_na_parede_ativa', () => {
    const store = criarStoreEditor(fase('12345'));
    const sprites = CATALOGO.filter((s) => s.categoria === 'objeto');
    expect(sprites.map((s) => s.id)).toEqual(expect.arrayContaining(['porta', 'quadro', 'janela', 'relogio', 'giz']));

    for (const sprite of sprites) {
      const id = `obj-${sprite.id}`;
      const resultado = store.getState().adicionarObjeto('decoracao', `sprite:${sprite.id}`, id);
      expect(resultado, sprite.id).toEqual({ ok: true });
      expect(objetosDe(store, 'frente').some((o) => o.id === id && o.imagem === `sprite:${sprite.id}`)).toBe(true);
    }
    expect(objetosDe(store, 'frente')).toHaveLength(sprites.length);
  });

  // @req RF-04 @tipo borda
  test('test_RF04_adicionar_depois_de_trocar_de_aba_coloca_na_nova_parede_ativa', () => {
    const store = criarStoreEditor(fase('12345', { frente: [porta('porta-1')] }));

    store.getState().trocarParede('teto');
    const resultado = store.getState().adicionarObjeto('fala', 'sprite:relogio', 'fala-teto');

    expect(resultado).toEqual({ ok: true });
    expect(objetosDe(store, 'teto').map((o) => o.id)).toEqual(['fala-teto']);
    expect(objetosDe(store, 'frente').map((o) => o.id)).toEqual(['porta-1']);
    expect(store.getState().selecionado).toBe('fala-teto');
  });

  // @req RF-04 @tipo borda
  test('test_RF04_camada_do_novo_objeto_e_a_maior_da_parede_mais_um_mesmo_com_lacunas', () => {
    const store = criarStoreEditor(
      fase('12345', { frente: [emCamada(decoracao('baixo'), 0), emCamada(decoracao('alto'), 3)], direita: [emCamada(decoracao('outra'), 9)] }),
    );

    store.getState().adicionarObjeto('decoracao', 'sprite:janela', 'novo-1');

    const novo = achar(store, 'novo-1');
    expect(novo?.camada).toBe(4);
    expect(ordemVisual(objetosDe(store, 'frente')).at(-1)).toBe('novo-1');
  });

  // @req RF-04 @tipo borda
  test('test_RF04_imagem_enviada_asset_tambem_pode_ser_colocada_na_parede', () => {
    const store = criarStoreEditor(fase('12345'));
    const resultado = store.getState().adicionarObjeto('decoracao', `asset:${UUID_ASSET}`, 'img-1');
    expect(resultado).toEqual({ ok: true });
    expect(achar(store, 'img-1')?.imagem).toBe(`asset:${UUID_ASSET}`);
  });

  // @req RF-04 @tipo negativo
  test('test_RF04_adicionar_com_id_ja_usado_na_fase_e_recusado_sem_efeito', () => {
    const documento = fase('12345', { frente: [porta('porta-1')] });
    const store = criarStoreEditor(structuredClone(documento));

    const resultado = store.getState().adicionarObjeto('decoracao', 'sprite:quadro', 'porta-1');

    esperarRecusaSemEfeito(store, documento, resultado, null);
  });

  // @req RF-04 @tipo negativo
  test('test_RF04_adicionar_com_id_fora_do_formato_do_schema_e_recusado_sem_efeito', () => {
    const documento = fase('12345');
    const store = criarStoreEditor(structuredClone(documento));

    const resultado = store.getState().adicionarObjeto('decoracao', 'sprite:quadro', 'id com espaço');

    esperarRecusaSemEfeito(store, documento, resultado, null);
  });
});

// ---------------------------------------------------------------------------
// RF-04 · adicionarObjeto com posição (LAC-045: item da biblioteca solto no palco)
// O centro do objeto fica no ponto; x em [0, 1 − largura], y em [0, 1 − altura]; largura/altura de objetoPadrao.
// ---------------------------------------------------------------------------
describe('RF-04 · adicionarObjeto no ponto solto', () => {
  const PADRAO = objetoPadrao('decoracao', 'sprite:janela', 'novo-1');

  // @req RF-04 @tipo feliz
  test('test_RF04_adicionar_com_posicao_poe_o_centro_do_objeto_no_ponto_em_um_unico_passo', () => {
    // Pré-condição do ponto escolhido: o objeto padrão cabe centrado em (0.4, 0.6) sem ser limitado.
    expect(PADRAO.largura).toBeLessThanOrEqual(0.8);
    expect(PADRAO.altura).toBeLessThanOrEqual(0.8);
    const documento = fase('12345', { frente: [porta('porta-1')] });
    const store = criarStoreEditor(structuredClone(documento));

    const resultado = store.getState().adicionarObjeto('decoracao', 'sprite:janela', 'novo-1', { x: 0.4, y: 0.6 });

    expect(resultado).toEqual({ ok: true });
    const novo = achar(store, 'novo-1');
    expect(novo?.x).toBeCloseTo(0.4 - PADRAO.largura / 2, 9);
    expect(novo?.y).toBeCloseTo(0.6 - PADRAO.altura / 2, 9);
    expect(novo).toMatchObject({
      imagem: 'sprite:janela',
      largura: PADRAO.largura,
      altura: PADRAO.altura,
      rotacao: PADRAO.rotacao,
      interacao: PADRAO.interacao,
      camada: 1,
    });
    expect(objetosDe(store, 'frente').map((o) => o.id)).toEqual(['porta-1', 'novo-1']);
    expect(store.getState().selecionado).toBe('novo-1');

    store.getState().desfazer();
    expect(store.getState().documento).toEqual(documento);
    expect(store.getState().podeDesfazer()).toBe(false);
  });

  // @req RF-04 @tipo feliz
  test('test_RF04_adicionar_com_posicao_vai_para_a_parede_ativa', () => {
    const store = criarStoreEditor(fase('12345', { frente: [porta('porta-1')] }));
    store.getState().trocarParede('esquerda');

    store.getState().adicionarObjeto('decoracao', 'sprite:janela', 'novo-1', { x: 0.5, y: 0.5 });

    expect(objetosDe(store, 'esquerda').map((o) => o.id)).toEqual(['novo-1']);
    expect(objetosDe(store, 'frente').map((o) => o.id)).toEqual(['porta-1']);
  });

  // @req RF-04 @tipo borda
  test('test_RF04_ponto_perto_da_borda_limita_o_objeto_para_caber_na_parede', () => {
    // Pré-condição: o objeto é mais largo e mais alto que 0,02, então o centro em (0.99, 0.01) passaria da parede.
    expect(PADRAO.largura).toBeGreaterThan(0.02);
    expect(PADRAO.altura).toBeGreaterThan(0.02);
    const store = criarStoreEditor(fase('12345'));

    const resultado = store.getState().adicionarObjeto('decoracao', 'sprite:janela', 'novo-1', { x: 0.99, y: 0.01 });

    expect(resultado).toEqual({ ok: true });
    const novo = achar(store, 'novo-1');
    expect(novo?.x).toBeCloseTo(1 - PADRAO.largura, 9);
    expect(novo?.y).toBeCloseTo(0, 9);
    expect(novo?.x).toBeLessThanOrEqual(1 - PADRAO.largura + 1e-9);
    expect(novo?.y).toBeGreaterThanOrEqual(0);
    expect(novo?.largura).toBe(PADRAO.largura);
    expect(novo?.altura).toBe(PADRAO.altura);
  });

  // @req RF-04 @tipo borda
  test('test_RF04_ponto_no_canto_oposto_limita_x_em_0_e_y_em_1_menos_altura', () => {
    const store = criarStoreEditor(fase('12345'));

    store.getState().adicionarObjeto('decoracao', 'sprite:janela', 'novo-1', { x: 0, y: 1 });

    const novo = achar(store, 'novo-1');
    expect(novo?.x).toBeCloseTo(0, 9);
    expect(novo?.y).toBeCloseTo(1 - PADRAO.altura, 9);
  });

  // @req RF-04 @tipo borda
  test('test_RF04_ponto_que_deixa_o_objeto_encostado_na_borda_nao_e_limitado', () => {
    const store = criarStoreEditor(fase('12345'));

    store.getState().adicionarObjeto('decoracao', 'sprite:janela', 'novo-1', { x: PADRAO.largura / 2, y: PADRAO.altura / 2 });

    const novo = achar(store, 'novo-1');
    expect(novo?.x).toBeCloseTo(0, 9);
    expect(novo?.y).toBeCloseTo(0, 9);
  });

  // @req RF-04 @tipo borda
  test('test_RF04_sem_posicao_o_objeto_continua_igual_ao_objeto_padrao', () => {
    const store = criarStoreEditor(fase('12345'));

    store.getState().adicionarObjeto('decoracao', 'sprite:janela', 'novo-1');

    // A camada da parede vazia não é o assunto aqui; o resto é o objetoPadrao, no centro da parede.
    const { camada: _camada, ...semCamada } = PADRAO;
    expect(achar(store, 'novo-1')).toMatchObject(semCamada);
  });

  // @req RF-04 @tipo negativo
  test('test_RF04_adicionar_com_posicao_e_id_ja_usado_e_recusado_sem_efeito', () => {
    const documento = fase('12345', { frente: [porta('porta-1')] });
    const store = criarStoreEditor(structuredClone(documento));

    const resultado = store.getState().adicionarObjeto('decoracao', 'sprite:janela', 'porta-1', { x: 0.3, y: 0.3 });

    esperarRecusaSemEfeito(store, documento, resultado, null);
  });
});

// ---------------------------------------------------------------------------
// RF-05 · alterarGeometria
// ---------------------------------------------------------------------------
describe('RF-05 · alterarGeometria', () => {
  // @req RF-05 @tipo feliz
  test('test_RF05_mover_redimensionar_e_rotacionar_aplicam_a_geometria_nova', () => {
    const store = criarStoreEditor(fase('12345', { frente: [decoracao('obj-1')] }));

    const resultado = store.getState().alterarGeometria('obj-1', { x: 0.25, y: 0.75, largura: 0.3, altura: 0.2, rotacao: 45 });

    expect(resultado).toEqual({ ok: true });
    expect(achar(store, 'obj-1')).toMatchObject({ x: 0.25, y: 0.75, largura: 0.3, altura: 0.2, rotacao: 45 });
  });

  // @req RF-05 @tipo feliz
  test('test_RF05_geometria_parcial_muda_so_os_campos_informados', () => {
    const original = decoracao('obj-1');
    const store = criarStoreEditor(fase('12345', { frente: [original] }));

    store.getState().alterarGeometria('obj-1', { x: 0.1 });

    expect(achar(store, 'obj-1')).toEqual({ ...original, x: 0.1 });
  });

  // @req RF-05 @tipo borda
  test('test_RF05_valores_fora_de_0_a_1_sao_limitados_aos_extremos', () => {
    const store = criarStoreEditor(fase('12345', { frente: [decoracao('obj-1')] }));

    const resultado = store.getState().alterarGeometria('obj-1', { x: 1.5, y: -0.2, largura: 2, altura: 1.01 });

    expect(resultado).toEqual({ ok: true });
    expect(achar(store, 'obj-1')).toMatchObject({ x: 1, y: 0, largura: 1, altura: 1 });
  });

  // @req RF-05 @tipo borda
  test('test_RF05_valores_exatamente_0_e_1_sao_mantidos', () => {
    const store = criarStoreEditor(fase('12345', { frente: [decoracao('obj-1')] }));

    store.getState().alterarGeometria('obj-1', { x: 0, y: 1, largura: 1, altura: 1 });

    expect(achar(store, 'obj-1')).toMatchObject({ x: 0, y: 1, largura: 1, altura: 1 });
  });

  // @req RF-05 @tipo borda
  test('test_RF05_rotacao_e_normalizada_para_0_ate_360_exclusivo', () => {
    const casos: Array<[number, number]> = [
      [0, 0],
      [359, 359],
      [360, 0],
      [370, 10],
      [720, 0],
      [-90, 270],
      [-360, 0],
    ];
    for (const [entrada, esperado] of casos) {
      const store = criarStoreEditor(fase('12345', { frente: [decoracao('obj-1')] }));
      const resultado = store.getState().alterarGeometria('obj-1', { rotacao: entrada });
      expect(resultado, `rotação ${entrada}`).toEqual({ ok: true });
      const rotacao = achar(store, 'obj-1')?.rotacao ?? Number.NaN;
      expect(rotacao, `rotação ${entrada}`).toBeCloseTo(esperado, 9);
      expect(rotacao).toBeGreaterThanOrEqual(0);
      expect(rotacao).toBeLessThan(360);
    }
  });

  // @req RF-05 @tipo negativo
  test('test_RF05_alterar_geometria_de_objeto_inexistente_e_recusado_com_o_erro_do_contrato', () => {
    const documento = fase('12345', { frente: [decoracao('obj-1')] });
    const store = criarStoreEditor(structuredClone(documento));

    const resultado = store.getState().alterarGeometria('fantasma', { x: 0.2 });

    expect(resultado).toEqual({ ok: false, erros: [{ caminho: ['objetoId'], mensagem: msgInexistente('fantasma') }] });
    expect(store.getState().documento).toEqual(documento);
    expect(store.getState().podeDesfazer()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// RF-05 · mudarCamada (LAC-032)
// ---------------------------------------------------------------------------
describe('RF-05 · mudarCamada', () => {
  // @req RF-05 @tipo feliz
  test('test_RF05_trazer_para_frente_troca_com_o_vizinho_de_cima', () => {
    const store = criarStoreEditor(faseTresCamadas());

    const resultado = store.getState().mudarCamada('a', 'frente');

    expect(resultado).toEqual({ ok: true });
    expect(ordemVisual(objetosDe(store, 'frente'))).toEqual(['b', 'a', 'c']);
    expect(camadas(objetosDe(store, 'frente'))).toEqual({ a: 1, b: 0, c: 2 });
  });

  // @req RF-05 @tipo feliz
  test('test_RF05_levar_para_tras_troca_com_o_vizinho_de_baixo', () => {
    const store = criarStoreEditor(faseTresCamadas());

    const resultado = store.getState().mudarCamada('c', 'tras');

    expect(resultado).toEqual({ ok: true });
    expect(ordemVisual(objetosDe(store, 'frente'))).toEqual(['a', 'c', 'b']);
    expect(camadas(objetosDe(store, 'frente'))).toEqual({ a: 0, b: 2, c: 1 });
  });

  // @req RF-05 @tipo borda
  test('test_RF05_mudar_camada_com_camadas_empatadas_ainda_altera_a_sobreposicao', () => {
    // Todas na camada 0: a ordem visual é a da lista (a atrás, c na frente).
    const store = criarStoreEditor(fase('12345', { frente: [decoracao('a'), decoracao('b'), decoracao('c')] }));
    expect(ordemVisual(objetosDe(store, 'frente'))).toEqual(['a', 'b', 'c']);

    const resultado = store.getState().mudarCamada('a', 'frente');

    expect(resultado).toEqual({ ok: true });
    expect(ordemVisual(objetosDe(store, 'frente'))).toEqual(['b', 'a', 'c']);
    expect(camadas(objetosDe(store, 'frente'))).toEqual({ a: 1, b: 0, c: 2 });
  });

  // @req RF-05 @tipo borda
  test('test_RF05_mudar_camada_renumera_de_0_a_n_menos_1_quando_ha_lacunas', () => {
    const store = criarStoreEditor(
      fase('12345', { frente: [emCamada(decoracao('a'), 0), emCamada(decoracao('b'), 5), emCamada(decoracao('c'), 9)] }),
    );

    store.getState().mudarCamada('b', 'tras');

    expect(ordemVisual(objetosDe(store, 'frente'))).toEqual(['b', 'a', 'c']);
    expect(camadas(objetosDe(store, 'frente'))).toEqual({ a: 1, b: 0, c: 2 });
  });

  // @req RF-05 @tipo borda
  test('test_RF05_mudar_camada_nao_mexe_nas_outras_paredes', () => {
    const store = criarStoreEditor(faseTresCamadas());
    const direitaAntes = structuredClone(objetosDe(store, 'direita'));

    store.getState().mudarCamada('b', 'frente');

    expect(objetosDe(store, 'direita')).toEqual(direitaAntes);
  });

  // @req RF-05 @tipo negativo
  test('test_RF05_trazer_para_frente_o_que_ja_esta_na_frente_e_recusado_sem_passo', () => {
    const documento = faseTresCamadas();
    const store = criarStoreEditor(structuredClone(documento));

    const resultado = store.getState().mudarCamada('c', 'frente');

    expect(resultado).toEqual({ ok: false, erros: [{ caminho: ['camada'], mensagem: MSG_FRENTE }] });
    expect(store.getState().documento).toEqual(documento);
    expect(store.getState().podeDesfazer()).toBe(false);
  });

  // @req RF-05 @tipo negativo
  test('test_RF05_levar_para_tras_o_que_ja_esta_atras_e_recusado_sem_passo', () => {
    const documento = faseTresCamadas();
    const store = criarStoreEditor(structuredClone(documento));

    const resultado = store.getState().mudarCamada('a', 'tras');

    expect(resultado).toEqual({ ok: false, erros: [{ caminho: ['camada'], mensagem: MSG_TRAS }] });
    expect(store.getState().documento).toEqual(documento);
    expect(store.getState().podeDesfazer()).toBe(false);
  });

  // @req RF-05 @tipo borda
  test('test_RF05_objeto_sozinho_na_parede_esta_nos_dois_extremos', () => {
    const documento = faseTresCamadas();
    const store = criarStoreEditor(structuredClone(documento));

    expect(store.getState().mudarCamada('d', 'frente')).toEqual({ ok: false, erros: [{ caminho: ['camada'], mensagem: MSG_FRENTE }] });
    expect(store.getState().mudarCamada('d', 'tras')).toEqual({ ok: false, erros: [{ caminho: ['camada'], mensagem: MSG_TRAS }] });
    expect(store.getState().documento).toEqual(documento);
    expect(store.getState().podeDesfazer()).toBe(false);
  });

  // @req RF-05 @tipo negativo
  test('test_RF05_mudar_camada_de_objeto_inexistente_e_recusado', () => {
    const documento = faseTresCamadas();
    const store = criarStoreEditor(structuredClone(documento));

    const resultado = store.getState().mudarCamada('fantasma', 'frente');

    expect(resultado).toEqual({ ok: false, erros: [{ caminho: ['objetoId'], mensagem: msgInexistente('fantasma') }] });
    expect(store.getState().documento).toEqual(documento);
  });
});

// ---------------------------------------------------------------------------
// RF-05 · duplicarObjeto e excluirObjeto
// ---------------------------------------------------------------------------
describe('RF-05 · duplicarObjeto', () => {
  // @req RF-05 @tipo feliz
  test('test_RF05_duplicar_cria_copia_na_mesma_parede_deslocada_e_na_frente', () => {
    const original: Objeto = { ...fala('fala-1', 'Você: o giz sumiu.'), x: 0.4, y: 0.3, rotacao: 30, camada: 1 };
    const store = criarStoreEditor(fase('12345', { direita: [emCamada(decoracao('d0'), 2), original], frente: [porta('porta-1')] }));

    const resultado = store.getState().duplicarObjeto('fala-1', 'fala-1-copia');

    expect(resultado).toEqual({ ok: true });
    const direita = objetosDe(store, 'direita');
    const copia = direita.find((o) => o.id === 'fala-1-copia');
    expect(copia).toBeDefined();
    expect(copia).toMatchObject({
      imagem: original.imagem,
      largura: original.largura,
      altura: original.altura,
      rotacao: original.rotacao,
      interacao: original.interacao,
    });
    expect(copia?.x !== original.x || copia?.y !== original.y).toBe(true);
    expect(ordemVisual(direita).at(-1)).toBe('fala-1-copia');
    expect(achar(store, 'fala-1')).toEqual(original);
    expect(objetosDe(store, 'frente').map((o) => o.id)).toEqual(['porta-1']);
  });

  // @req RF-05 @tipo borda
  test('test_RF05_duplicar_objeto_no_canto_mantem_a_copia_dentro_de_0_a_1', () => {
    const original: Objeto = { ...decoracao('canto'), x: 1, y: 1 };
    const store = criarStoreEditor(fase('12345', { frente: [original] }));

    const resultado = store.getState().duplicarObjeto('canto', 'canto-copia');

    expect(resultado).toEqual({ ok: true });
    const copia = achar(store, 'canto-copia');
    expect(copia?.x).toBeLessThanOrEqual(1);
    expect(copia?.y).toBeLessThanOrEqual(1);
    expect(objetosDe(store, 'frente')).toHaveLength(2);
  });

  // @req RF-05 @tipo negativo
  test('test_RF05_duplicar_com_novo_id_ja_existente_e_recusado_sem_efeito', () => {
    const documento = fase('12345', { frente: [decoracao('a'), decoracao('b')] });
    const store = criarStoreEditor(structuredClone(documento));

    const resultado = store.getState().duplicarObjeto('a', 'b');

    esperarRecusaSemEfeito(store, documento, resultado, null);
  });

  // @req RF-05 @tipo negativo
  test('test_RF05_duplicar_objeto_inexistente_e_recusado', () => {
    const documento = fase('12345', { frente: [decoracao('a')] });
    const store = criarStoreEditor(structuredClone(documento));

    const resultado = store.getState().duplicarObjeto('fantasma', 'copia');

    expect(resultado).toEqual({ ok: false, erros: [{ caminho: ['objetoId'], mensagem: msgInexistente('fantasma') }] });
    expect(store.getState().documento).toEqual(documento);
  });
});

describe('RF-05 · excluirObjeto', () => {
  // @req RF-05 @tipo feliz
  test('test_RF05_excluir_remove_o_objeto_e_desfaz_a_selecao', () => {
    const store = criarStoreEditor(fase('12345', { frente: [porta('porta-1'), decoracao('quadro-1')] }));
    store.getState().selecionar('quadro-1');

    const resultado = store.getState().excluirObjeto('quadro-1');

    expect(resultado).toEqual({ ok: true });
    expect(objetosDe(store, 'frente').map((o) => o.id)).toEqual(['porta-1']);
    expect(achar(store, 'quadro-1')).toBeUndefined();
    expect(store.getState().selecionado).toBeNull();
  });

  // @req RF-05 @tipo borda
  test('test_RF05_excluir_o_unico_objeto_de_outra_parede_deixa_a_parede_vazia', () => {
    const store = criarStoreEditor(fase('12345', { frente: [porta('porta-1')], teto: [decoracao('lampada-1')] }));

    const resultado = store.getState().excluirObjeto('lampada-1');

    expect(resultado).toEqual({ ok: true });
    expect(objetosDe(store, 'teto')).toEqual([]);
    expect(objetosDe(store, 'frente').map((o) => o.id)).toEqual(['porta-1']);
  });

  // @req RF-05 @tipo negativo
  test('test_RF05_excluir_objeto_inexistente_e_recusado_sem_efeito', () => {
    const documento = fase('12345', { frente: [porta('porta-1')] });
    const store = criarStoreEditor(structuredClone(documento));

    const resultado = store.getState().excluirObjeto('fantasma');

    expect(resultado).toEqual({ ok: false, erros: [{ caminho: ['objetoId'], mensagem: msgInexistente('fantasma') }] });
    expect(store.getState().documento).toEqual(documento);
    expect(store.getState().podeDesfazer()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// RF-07 · tipo do objeto (alterarInteracao)
// ---------------------------------------------------------------------------
describe('RF-07 · alterarInteracao troca o tipo', () => {
  // @req RF-07 @tipo feliz
  test('test_RF07_decoracao_vira_fala_com_texto', () => {
    const store = criarStoreEditor(fase('12345', { frente: [decoracao('obj-1')] }));

    const resultado = store.getState().alterarInteracao('obj-1', { tipo: 'fala', texto: 'Você: a porta rangeu.' });

    expect(resultado).toEqual({ ok: true });
    expect(achar(store, 'obj-1')?.interacao).toEqual({ tipo: 'fala', texto: 'Você: a porta rangeu.' });
  });

  // @req RF-07 @tipo feliz
  test('test_RF07_cada_um_dos_quatro_tipos_pode_ser_aplicado', () => {
    const store = criarStoreEditor(fase('12345', { frente: [decoracao('obj-1')] }));
    const interacoes: Interacao[] = [
      { tipo: 'fala', texto: 'Olá.' },
      { tipo: 'enigma', pergunta: 'Quanto é 3 x 4?', respostas: [12], revela: [1] },
      { tipo: 'porta' },
      { tipo: 'decoracao' },
    ];
    for (const interacao of interacoes) {
      expect(store.getState().alterarInteracao('obj-1', interacao), interacao.tipo).toEqual({ ok: true });
      expect(achar(store, 'obj-1')?.interacao).toEqual(interacao);
    }
  });

  // @req RF-07 @tipo borda
  test('test_RF07_voltar_para_decoracao_remove_os_campos_de_comportamento', () => {
    const store = criarStoreEditor(fase('12345', { frente: [enigma('obj-1', [1, 2], [7])] }));

    const resultado = store.getState().alterarInteracao('obj-1', { tipo: 'decoracao' });

    expect(resultado).toEqual({ ok: true });
    expect(achar(store, 'obj-1')?.interacao).toEqual({ tipo: 'decoracao' });
  });

  // @req RF-07 @tipo negativo
  test('test_RF07_decoracao_com_fala_e_recusada_sem_efeito', () => {
    const documento = fase('12345', { frente: [decoracao('obj-1')] });
    const store = criarStoreEditor(structuredClone(documento));

    const invalida = { tipo: 'decoracao', texto: 'Não devia falar.' } as unknown as Interacao;
    const resultado = store.getState().alterarInteracao('obj-1', invalida);

    esperarRecusaSemEfeito(store, documento, resultado, null);
  });

  // @req RF-07 @tipo negativo
  test('test_RF07_tipo_fora_dos_quatro_e_recusado_sem_efeito', () => {
    const documento = fase('12345', { frente: [decoracao('obj-1')] });
    const store = criarStoreEditor(structuredClone(documento));

    const invalida = { tipo: 'armadilha' } as unknown as Interacao;
    const resultado = store.getState().alterarInteracao('obj-1', invalida);

    esperarRecusaSemEfeito(store, documento, resultado, null);
  });
});

// ---------------------------------------------------------------------------
// RF-08 · campos da interação e senha da fase
// ---------------------------------------------------------------------------
describe('RF-08 · campos de fala e enigma', () => {
  // @req RF-08 @tipo feliz
  test('test_RF08_enigma_grava_pergunta_varias_respostas_dica_e_digitos', () => {
    const store = criarStoreEditor(fase('12345', { fundo: [decoracao('obj-1')] }));
    const interacao: Interacao = {
      tipo: 'enigma',
      pergunta: 'Quanto é 10 + 15 x 20?',
      respostas: [-15, 80],
      dica: 'Multiplique primeiro.',
      revela: [2, 5],
    };

    const resultado = store.getState().alterarInteracao('obj-1', interacao);

    expect(resultado).toEqual({ ok: true });
    expect(achar(store, 'obj-1')?.interacao).toEqual(interacao);
  });

  // @req RF-08 @tipo feliz
  test('test_RF08_fala_grava_o_texto', () => {
    const store = criarStoreEditor(fase('12345', { direita: [fala('obj-1', 'Você: texto antigo.')] }));

    store.getState().alterarInteracao('obj-1', { tipo: 'fala', texto: 'Você: texto novo.' });

    expect(achar(store, 'obj-1')?.interacao).toEqual({ tipo: 'fala', texto: 'Você: texto novo.' });
  });

  // @req RF-08 @tipo borda
  test('test_RF08_enigma_sem_digito_e_aceito', () => {
    const store = criarStoreEditor(fase('12345', { esquerda: [decoracao('obj-1')] }));
    const interacao: Interacao = { tipo: 'enigma', pergunta: 'Quanto é 5 x 3?', respostas: [15], revela: [] };

    const resultado = store.getState().alterarInteracao('obj-1', interacao);

    expect(resultado).toEqual({ ok: true });
    expect(achar(store, 'obj-1')?.interacao).toEqual(interacao);
  });

  // @req RF-08 @tipo negativo
  test('test_RF08_resposta_que_nao_e_numero_e_recusada_sem_efeito', () => {
    const documento = fase('12345', { fundo: [enigma('obj-1', [1], [7])] });
    const store = criarStoreEditor(structuredClone(documento));

    const invalida = { tipo: 'enigma', pergunta: 'Quanto é 4 x 20?', respostas: ['oitenta'], revela: [1] } as unknown as Interacao;
    const resultado = store.getState().alterarInteracao('obj-1', invalida);

    esperarRecusaSemEfeito(store, documento, resultado, null);
  });
});

describe('RF-08 · senha da fase (alterarPropriedadesFase)', () => {
  // @req RF-08 @tipo feliz
  test('test_RF08_senha_de_5_digitos_e_trocada', () => {
    const store = criarStoreEditor(fase('12345', { frente: [porta('porta-1')] }));

    const resultado = store.getState().alterarPropriedadesFase({ senha: '90817' });

    expect(resultado).toEqual({ ok: true });
    expect(store.getState().documento.senha).toBe('90817');
  });

  // @req RF-08 @tipo borda
  test('test_RF08_senha_aceita_exatamente_4_e_exatamente_8_digitos', () => {
    const store = criarStoreEditor(fase('12345', { frente: [porta('porta-1')] }));

    expect(store.getState().alterarPropriedadesFase({ senha: '0123' })).toEqual({ ok: true });
    expect(store.getState().documento.senha).toBe('0123');
    expect(store.getState().alterarPropriedadesFase({ senha: '98765432' })).toEqual({ ok: true });
    expect(store.getState().documento.senha).toBe('98765432');
  });

  // @req RF-08 @tipo negativo
  test('test_RF08_senha_de_3_ou_9_digitos_ou_com_nao_digito_e_recusada_sem_efeito', () => {
    for (const senha of ['123', '123456789', '12a45', '12 45', '']) {
      const documento = fase('12345', { frente: [porta('porta-1')] });
      const store = criarStoreEditor(structuredClone(documento));

      const resultado = store.getState().alterarPropriedadesFase({ senha });

      expect(resultado.ok, `senha "${senha}"`).toBe(false);
      expect(errosDe(resultado).length, `senha "${senha}"`).toBeGreaterThan(0);
      expect(store.getState().documento).toEqual(documento);
      expect(store.getState().podeDesfazer()).toBe(false);
    }
  });

  // @req RF-08 @tipo negativo
  test('test_RF08_encurtar_senha_com_enigma_revelando_posicao_removida_recusa_com_enigmas_afetados', () => {
    const documento = faseValida(); // senha 92139; enigma-teto revela [4, 5]
    const store = criarStoreEditor(structuredClone(documento));

    const resultado = store.getState().alterarPropriedadesFase({ senha: '9213' });

    expect(resultado).toEqual({
      ok: false,
      erros: [{ caminho: ['senha'], mensagem: MSG_SENHA }],
      enigmasAfetados: ['enigma-teto'],
    });
    expect(store.getState().documento).toEqual(documento);
    expect(store.getState().podeDesfazer()).toBe(false);
  });

  // @req RF-08 @tipo borda
  test('test_RF08_encurtar_senha_lista_todos_os_enigmas_afetados', () => {
    const documento = fase('123456', {
      frente: [porta('porta-1'), enigma('enigma-a', [1, 5])],
      fundo: [enigma('enigma-b', [6])],
      teto: [enigma('enigma-c', [2, 3])],
    });
    const store = criarStoreEditor(structuredClone(documento));

    const resultado = store.getState().alterarPropriedadesFase({ senha: '1234' });

    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.erros).toEqual([{ caminho: ['senha'], mensagem: MSG_SENHA }]);
    expect([...(resultado.enigmasAfetados ?? [])].sort()).toEqual(['enigma-a', 'enigma-b']);
    expect(store.getState().documento).toEqual(documento);
  });

  // @req RF-08 @tipo borda
  test('test_RF08_encurtar_senha_sem_enigma_afetado_e_aceito', () => {
    const store = criarStoreEditor(fase('123456', { frente: [porta('porta-1'), enigma('enigma-a', [1, 4])] }));

    const resultado = store.getState().alterarPropriedadesFase({ senha: '4321' });

    expect(resultado).toEqual({ ok: true });
    expect(store.getState().documento.senha).toBe('4321');
  });
});

// ---------------------------------------------------------------------------
// RF-09 · desfazer e refazer (ADR-008: o histórico cobre só o documento)
// ---------------------------------------------------------------------------
describe('RF-09 · histórico', () => {
  // @req RF-09 @tipo feliz
  test('test_RF09_desfazer_devolve_o_objeto_a_posicao_anterior_e_refazer_a_nova', () => {
    const original: Objeto = { ...decoracao('obj-1'), x: 0.2, y: 0.3 };
    const store = criarStoreEditor(fase('12345', { frente: [original] }));

    store.getState().alterarGeometria('obj-1', { x: 0.7, y: 0.6 });
    expect(store.getState().podeDesfazer()).toBe(true);

    store.getState().desfazer();
    expect(achar(store, 'obj-1')).toMatchObject({ x: 0.2, y: 0.3 });
    expect(store.getState().podeRefazer()).toBe(true);

    store.getState().refazer();
    expect(achar(store, 'obj-1')).toMatchObject({ x: 0.7, y: 0.6 });
  });

  // @req RF-09 @tipo feliz
  test('test_RF09_cada_acao_aplicada_e_exatamente_um_passo', () => {
    const documento = fase('12345', { frente: [porta('porta-1')] });
    const store = criarStoreEditor(structuredClone(documento));

    store.getState().adicionarObjeto('decoracao', 'sprite:quadro', 'novo-1');
    const aposAdicionar = structuredClone(store.getState().documento);
    store.getState().alterarGeometria('novo-1', { x: 0.1, y: 0.9, rotacao: 90 });
    store.getState().excluirObjeto('porta-1');

    store.getState().desfazer();
    expect(achar(store, 'porta-1')).toBeDefined();
    expect(achar(store, 'novo-1')).toMatchObject({ x: 0.1, y: 0.9, rotacao: 90 });

    store.getState().desfazer();
    expect(store.getState().documento).toEqual(aposAdicionar);

    store.getState().desfazer();
    expect(store.getState().documento).toEqual(documento);
    expect(store.getState().podeDesfazer()).toBe(false);
  });

  // @req RF-09 @tipo borda
  test('test_RF09_trocar_de_parede_e_selecionar_nao_viram_passo', () => {
    const store = criarStoreEditor(fase('12345', { frente: [porta('porta-1')] }));

    store.getState().trocarParede('teto');
    store.getState().selecionar('porta-1');
    store.getState().selecionar(null);
    store.getState().trocarParede('esquerda');

    expect(store.getState().podeDesfazer()).toBe(false);
    expect(store.getState().podeRefazer()).toBe(false);
  });

  // @req RF-09 @tipo borda
  test('test_RF09_desfazer_nao_volta_a_parede_ativa', () => {
    const store = criarStoreEditor(fase('12345', { frente: [porta('porta-1')] }));

    store.getState().alterarGeometria('porta-1', { x: 0.3 });
    store.getState().trocarParede('direita');
    store.getState().desfazer();

    expect(store.getState().paredeAtiva).toBe('direita');
    expect(achar(store, 'porta-1')?.x).toBe(0.5);
  });

  // @req RF-09 @tipo negativo
  test('test_RF09_acao_recusada_nao_vira_passo', () => {
    const store = criarStoreEditor(faseTresCamadas());

    store.getState().alterarGeometria('fantasma', { x: 0.1 });
    store.getState().mudarCamada('c', 'frente');
    store.getState().alterarPropriedadesFase({ senha: '12' });
    store.getState().alterarInteracao('a', { tipo: 'armadilha' } as unknown as Interacao);

    expect(store.getState().podeDesfazer()).toBe(false);
  });

  // @req RF-09 @tipo negativo
  test('test_RF09_recusa_depois_de_um_passo_nao_apaga_nem_acrescenta_passo', () => {
    const store = criarStoreEditor(faseTresCamadas());
    const antes = structuredClone(store.getState().documento);

    store.getState().alterarGeometria('a', { x: 0.9 });
    store.getState().mudarCamada('c', 'frente'); // recusa
    store.getState().desfazer();

    expect(store.getState().documento).toEqual(antes);
    expect(store.getState().podeDesfazer()).toBe(false);
  });

  // @req RF-09 @tipo negativo
  test('test_RF09_desfazer_e_refazer_sem_historico_nao_mudam_nada', () => {
    const documento = faseValida();
    const store = criarStoreEditor(structuredClone(documento));

    store.getState().desfazer();
    store.getState().refazer();

    expect(store.getState().documento).toEqual(documento);
  });

  // @req RF-09 @tipo borda
  test('test_RF09_carregar_documento_novo_substitui_e_limpa_o_historico', () => {
    const store = criarStoreEditor(fase('12345', { frente: [porta('porta-1')] }));
    store.getState().alterarGeometria('porta-1', { x: 0.1 });
    store.getState().alterarGeometria('porta-1', { x: 0.2 });
    store.getState().desfazer();
    expect(store.getState().podeRefazer()).toBe(true);

    const novo = faseValida();
    store.getState().carregar(structuredClone(novo));

    expect(store.getState().documento).toEqual(novo);
    expect(store.getState().podeDesfazer()).toBe(false);
    expect(store.getState().podeRefazer()).toBe(false);
  });

  // @req RF-09 @tipo borda
  test('test_RF09_alterar_varios_campos_de_geometria_de_uma_vez_e_um_passo_so', () => {
    const original = objeto('obj-1', { tipo: 'decoracao' });
    const store = criarStoreEditor(fase('12345', { frente: [original] }));

    store.getState().alterarGeometria('obj-1', { x: 0.2, y: 0.2, largura: 0.5, altura: 0.5, rotacao: 180 });
    store.getState().desfazer();

    expect(achar(store, 'obj-1')).toEqual(original);
    expect(store.getState().podeDesfazer()).toBe(false);
  });
});
