/**
 * Módulo: CanvasParede (apps/editor/contrato/componentes.ts · PropsCanvasParede; modulos-editor.md §4 e
 * "Contrato das telas"; ADR-006, ADR-007, ADR-008, ADR-016).
 * Requisitos:
 * - RF-03: o palco mostra só os objetos da parede ativa do store e mantém a proporção 16:9 (calcularPalco) para
 *   contêineres de tamanhos e proporções diferentes, inclusive ao redimensionar;
 * - RF-05: arrastar move o objeto no documento (o que é salvo e volta ao recarregar), e o fim do arraste chega ao
 *   store como UM passo de histórico; mudar camada altera qual objeto fica por cima; a cópia duplicada aparece na
 *   mesma parede; o objeto excluído some do palco; clicar seleciona.
 *
 * O store é o real (`criarStoreEditor`, contrato público). Clique e arraste são reais no canvas Konva do jsdom
 * (pacote `canvas`, ADR-016), nas coordenadas de calcularPalco/paraPixels (tests/support/palco-tela.ts e
 * palco-editor.ts). Sem teste por pixel: o que se observa é qual objeto o clique seleciona no store.
 * Fases sintéticas de tests/fixtures/fases.ts; objetos grandes e sem rotação, em posições escritas à mão.
 */
import { CanvasParede, criarStoreEditor } from '@math-scape/app-editor';
import type { StoreEditor } from '@math-scape/app-editor/contrato';
import { calcularPalco } from '@math-scape/player';
import { validarFase } from '@math-scape/schema';
import type { Fase, Objeto } from '@math-scape/schema/contrato';
import { act, render } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { decoracao, fase } from '../fixtures/fases.ts';
import { arrastarNoPalco, dentro, pontoNoObjeto } from '../support/palco-editor.ts';
import { clicarNoPalco, esperarDesenho, palcoDaTela, pontoDoObjeto } from '../support/palco-tela.ts';

type Caixa = Pick<Objeto, 'x' | 'y' | 'largura' | 'altura'>;

const POS = {
  a: { x: 0.05, y: 0.1, largura: 0.2, altura: 0.3 },
  b: { x: 0.3, y: 0.3, largura: 0.2, altura: 0.3 },
  c: { x: 0.65, y: 0.1, largura: 0.2, altura: 0.3 },
} as const;

function em(objeto: Objeto, caixa: Caixa, camada = 0): Objeto {
  return { ...objeto, ...caixa, camada };
}

async function montar(documento: Fase, largura = 1280, altura = 720) {
  const store = criarStoreEditor(documento);
  const tela = render(
    <CanvasParede store={store} baseUrlApi="/api" larguraConteiner={largura} alturaConteiner={altura} />,
  );
  await esperarDesenho();
  return { store, ...tela };
}

function paredeAtiva(store: StoreEditor) {
  const estado = store.getState();
  return estado.documento.paredes[estado.paredeAtiva];
}

function acharNoDocumento(store: StoreEditor, id: string): Objeto {
  const encontrado = Object.values(store.getState().documento.paredes)
    .flatMap((parede) => parede.objetos)
    .find((o) => o.id === id);
  if (!encontrado) throw new Error(`Objeto ${id} não está no documento.`);
  return encontrado;
}

/** Ação no store vinda de fora do componente (outro painel, atalho), seguida do redesenho. */
async function noStore(acao: () => void): Promise<void> {
  act(() => acao());
  await esperarDesenho();
}

function clicarObjeto(store: StoreEditor, id: string): void {
  clicarNoPalco(pontoDoObjeto(paredeAtiva(store), id, palcoDaTela()));
}

// ---------------------------------------------------------------------------
// RF-03 · só a parede ativa, palco 16:9
// ---------------------------------------------------------------------------
describe('RF-03 · CanvasParede mostra a parede ativa', () => {
  // @req RF-03 @tipo feliz
  test('test_RF03_clique_num_objeto_da_parede_ativa_seleciona_esse_objeto', async () => {
    const { store } = await montar(
      fase('12345', { frente: [em(decoracao('deco-a'), POS.a), em(decoracao('deco-c'), POS.c)] }),
    );

    clicarObjeto(store, 'deco-c');

    expect(store.getState().selecionado).toBe('deco-c');
  });

  // @req RF-03 @tipo negativo
  test('test_RF03_objeto_de_outra_parede_nao_aparece_no_palco_da_parede_ativa', async () => {
    const { store } = await montar(
      fase('12345', { frente: [em(decoracao('frente-c'), POS.c)], direita: [em(decoracao('direita-a'), POS.a)] }),
    );
    expect(store.getState().paredeAtiva).toBe('frente');

    // Onde a direita tem objeto, a frente está vazia.
    clicarNoPalco(pontoNoObjeto(POS.a, 0.5, 0.5, palcoDaTela()));

    expect(store.getState().selecionado).toBeNull();
  });

  // @req RF-03 @tipo feliz
  test('test_RF03_trocar_a_parede_ativa_mostra_os_objetos_da_nova_e_esconde_os_da_anterior', async () => {
    const { store } = await montar(
      fase('12345', { frente: [em(decoracao('frente-c'), POS.c)], direita: [em(decoracao('direita-a'), POS.a)] }),
    );

    await noStore(() => store.getState().trocarParede('direita'));
    clicarNoPalco(pontoNoObjeto(POS.a, 0.5, 0.5, palcoDaTela()));
    expect(store.getState().selecionado).toBe('direita-a');

    await noStore(() => store.getState().selecionar(null));
    clicarNoPalco(pontoNoObjeto(POS.c, 0.5, 0.5, palcoDaTela()));
    expect(store.getState().selecionado).toBeNull();
  });

  /** Objeto perto do canto inferior direito: é onde um palco esticado e um palco 16:9 mais diferem. */
  const CANTO = { x: 0.78, y: 0.6, largura: 0.2, altura: 0.3 } as const;
  const CONTEINERES = [
    [1280, 720],
    [1600, 700],
    [1000, 900],
  ] as const;

  // @req RF-03 @tipo borda
  test('test_RF03_palco_mantem_16_9_em_conteineres_largos_e_altos_ao_redimensionar', async () => {
    const documento = fase('12345', { frente: [em(decoracao('canto'), CANTO)] });
    const { store, rerender } = await montar(documento, 1280, 720);

    for (const [largura, altura] of CONTEINERES) {
      rerender(<CanvasParede store={store} baseUrlApi="/api" larguraConteiner={largura} alturaConteiner={altura} />);
      await esperarDesenho();
      await noStore(() => store.getState().selecionar(null));

      const esperado = calcularPalco(largura, altura);
      const palco = palcoDaTela();
      expect(palco.largura, `${largura}×${altura}`).toBeCloseTo(esperado.largura, 0);
      expect(palco.altura, `${largura}×${altura}`).toBeCloseTo(esperado.altura, 0);
      expect(palco.largura / palco.altura).toBeCloseTo(16 / 9, 2);

      // Canto superior esquerdo do objeto no palco 16:9 (fora dele num palco esticado ao contêiner).
      clicarNoPalco(pontoNoObjeto(CANTO, 0.1, 0.1, palco));
      expect(store.getState().selecionado, `${largura}×${altura}`).toBe('canto');
    }
  });

  // @req RF-03 @tipo negativo
  test('test_RF03_palco_nao_estica_os_objetos_para_ocupar_o_conteiner', async () => {
    for (const [largura, altura] of [
      [1600, 700],
      [1000, 900],
    ] as const) {
      const { store, unmount } = await montar(fase('12345', { frente: [em(decoracao('canto'), CANTO)] }), largura, altura);
      const esticado = { x: 0, y: 0, largura, altura };
      const ponto = pontoNoObjeto(CANTO, 0.9, 0.9, esticado);
      // Pré-condição: o ponto cai no objeto esticado, mas fora do objeto no palco 16:9.
      expect(dentro(retanguloNoPalco16x9(CANTO, largura, altura), ponto)).toBe(false);

      clicarNoPalco(ponto);

      expect(store.getState().selecionado, `${largura}×${altura}`).toBeNull();
      unmount();
    }
  });
});

/** Retângulo em pixels do objeto no palco 16:9 do contêiner. */
function retanguloNoPalco16x9(caixa: Caixa, largura: number, altura: number) {
  const palco = calcularPalco(largura, altura);
  const inicio = pontoNoObjeto(caixa, 0, 0, palco);
  const fim = pontoNoObjeto(caixa, 1, 1, palco);
  return { x: inicio.x, y: inicio.y, largura: fim.x - inicio.x, altura: fim.y - inicio.y };
}

// ---------------------------------------------------------------------------
// RF-05 · arrastar, camadas, duplicar, excluir
// ---------------------------------------------------------------------------
describe('RF-05 · CanvasParede edita objetos', () => {
  // @req RF-05 @tipo feliz
  test('test_RF05_arrastar_move_o_objeto_no_documento_em_um_unico_passo_de_historico', async () => {
    const { store } = await montar(fase('12345', { frente: [em(decoracao('movel'), POS.b)] }));
    const palco = palcoDaTela();
    const de = pontoNoObjeto(POS.b, 0.5, 0.5, palco);
    const dx = 0.1 * palco.largura;
    const dy = 0.1 * palco.altura;

    arrastarNoPalco(de, { x: de.x + dx, y: de.y + dy });
    await esperarDesenho();

    const movido = acharNoDocumento(store, 'movel');
    expect(movido.x).toBeCloseTo(POS.b.x + 0.1, 2);
    expect(movido.y).toBeCloseTo(POS.b.y + 0.1, 2);
    expect(movido.largura).toBeCloseTo(POS.b.largura, 5);
    expect(movido.altura).toBeCloseTo(POS.b.altura, 5);
    expect(store.getState().podeDesfazer()).toBe(true);

    await noStore(() => store.getState().desfazer());
    expect(acharNoDocumento(store, 'movel')).toMatchObject({ x: POS.b.x, y: POS.b.y });
    expect(store.getState().podeDesfazer()).toBe(false);
  });

  // @req RF-05 @tipo borda
  test('test_RF05_arraste_com_muitos_movimentos_intermediarios_vira_um_so_passo', async () => {
    const { store } = await montar(fase('12345', { frente: [em(decoracao('movel'), POS.b)] }));
    const palco = palcoDaTela();
    const de = pontoNoObjeto(POS.b, 0.5, 0.5, palco);

    arrastarNoPalco(de, { x: de.x + 0.2 * palco.largura, y: de.y - 0.1 * palco.altura }, 20);
    await esperarDesenho();

    expect(acharNoDocumento(store, 'movel').x).toBeCloseTo(POS.b.x + 0.2, 2);
    expect(acharNoDocumento(store, 'movel').y).toBeCloseTo(POS.b.y - 0.1, 2);
    await noStore(() => store.getState().desfazer());
    expect(acharNoDocumento(store, 'movel')).toMatchObject({ x: POS.b.x, y: POS.b.y });
    expect(store.getState().podeDesfazer()).toBe(false);
  });

  // @req RF-05 @tipo borda
  test('test_RF05_arrastar_alem_da_borda_direita_mantem_o_objeto_dentro_da_parede', async () => {
    const { store } = await montar(fase('12345', { frente: [em(decoracao('movel'), POS.b)] }));
    const palco = palcoDaTela();
    const de = pontoNoObjeto(POS.b, 0.5, 0.5, palco);

    arrastarNoPalco(de, { x: de.x + 2 * palco.largura, y: de.y }, 4);
    await esperarDesenho();

    const movido = acharNoDocumento(store, 'movel');
    expect(movido.x).toBeGreaterThan(POS.b.x);
    expect(movido.x).toBeLessThanOrEqual(1);
    expect(validarFase(store.getState().documento).ok).toBe(true);
  });

  // @req RF-05 @tipo negativo
  test('test_RF05_clique_sem_arrastar_nao_altera_o_documento_nem_cria_passo', async () => {
    const documento = fase('12345', { frente: [em(decoracao('parado'), POS.b)] });
    const { store } = await montar(structuredClone(documento));

    clicarObjeto(store, 'parado');
    await esperarDesenho();

    expect(store.getState().selecionado).toBe('parado');
    expect(store.getState().documento).toEqual(documento);
    expect(store.getState().podeDesfazer()).toBe(false);
  });

  // @req RF-05 @tipo feliz
  test('test_RF05_mudar_camada_altera_qual_objeto_fica_por_cima_na_sobreposicao', async () => {
    const baixo = { x: 0.2, y: 0.2, largura: 0.3, altura: 0.4 };
    const cima = { x: 0.35, y: 0.3, largura: 0.3, altura: 0.4 };
    const { store } = await montar(
      fase('12345', { frente: [em(decoracao('baixo'), baixo, 0), em(decoracao('cima'), cima, 1)] }),
    );
    // Ponto na área comum aos dois.
    const comum = { x: 0.42, y: 0.45, largura: 0, altura: 0 };

    clicarNoPalco(pontoNoObjeto(comum, 0, 0, palcoDaTela()));
    expect(store.getState().selecionado).toBe('cima');

    await noStore(() => {
      expect(store.getState().mudarCamada('baixo', 'frente')).toEqual({ ok: true });
      store.getState().selecionar(null);
    });
    clicarNoPalco(pontoNoObjeto(comum, 0, 0, palcoDaTela()));
    expect(store.getState().selecionado).toBe('baixo');
  });

  // @req RF-05 @tipo feliz
  test('test_RF05_copia_duplicada_aparece_na_mesma_parede_por_cima_do_original', async () => {
    const { store } = await montar(fase('12345', { frente: [em(decoracao('original'), POS.b)] }));

    await noStore(() => {
      expect(store.getState().duplicarObjeto('original', 'copia')).toEqual({ ok: true });
      store.getState().selecionar(null);
    });
    clicarObjeto(store, 'copia');

    expect(store.getState().selecionado).toBe('copia');
  });

  // @req RF-05 @tipo negativo
  test('test_RF05_objeto_excluido_some_do_palco', async () => {
    const { store } = await montar(fase('12345', { frente: [em(decoracao('fica'), POS.a), em(decoracao('sai'), POS.b)] }));

    await noStore(() => {
      expect(store.getState().excluirObjeto('sai')).toEqual({ ok: true });
    });
    clicarNoPalco(pontoNoObjeto(POS.b, 0.5, 0.5, palcoDaTela()));

    expect(store.getState().selecionado).toBeNull();
  });

  // @req RF-05 @tipo negativo
  test('test_RF05_clique_em_area_vazia_da_parede_desfaz_a_selecao', async () => {
    const { store } = await montar(fase('12345', { frente: [em(decoracao('deco-a'), POS.a)] }));
    await noStore(() => store.getState().selecionar('deco-a'));

    clicarNoPalco(pontoNoObjeto(POS.c, 0.5, 0.5, palcoDaTela()));

    expect(store.getState().selecionado).toBeNull();
    expect(store.getState().podeDesfazer()).toBe(false);
  });
});
