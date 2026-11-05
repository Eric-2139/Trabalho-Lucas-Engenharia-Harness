/**
 * Módulo: EscolherFase (apps/player/contrato/index.ts · PropsEscolherFase; modulos-player.md §2, ADR-014).
 * Requisitos:
 * - RF-13: a tela lista as fases publicadas recebidas, uma entrada por fase, na ordem recebida;
 * - RNF-07: textos em português; operável só pelo teclado (Tab percorre as fases, Enter abre),
 *   com elementos nativos (<a href> ou <button>). O foco visível (:focus-visible do tema) não é
 *   observável no jsdom e fica para o E2E.
 */
import { EscolherFase } from '@math-scape/app-player';
import type { FasePublicadaResumo } from '@math-scape/schema/contrato';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';

const FASES: FasePublicadaResumo[] = [
  { id: 'fase-sintetica-1', titulo: 'Sala das frações' },
  { id: 'fase-sintetica-2', titulo: 'Corredor dos primos' },
  { id: 'fase-sintetica-3', titulo: 'Biblioteca das potências' },
];

/** Entradas da lista: links (<a href>) ou botões nativos, um por fase. */
function entradas(): HTMLElement[] {
  const links = screen.queryAllByRole('link');
  return links.length > 0 ? links : screen.queryAllByRole('button');
}

function montar(fases: FasePublicadaResumo[]) {
  const aoAbrir = vi.fn<(id: string) => void>();
  render(<EscolherFase fases={fases} aoAbrir={aoAbrir} />);
  return { aoAbrir };
}

/** Pressiona Tab `vezes` e devolve os elementos que receberam foco, em ordem. */
async function percorrerComTab(user: ReturnType<typeof userEvent.setup>, vezes: number): Promise<Element[]> {
  const focados: Element[] = [];
  for (let i = 0; i < vezes; i++) {
    await user.tab();
    if (document.activeElement && document.activeElement !== document.body) focados.push(document.activeElement);
  }
  return focados;
}

/**
 * Pressiona Tab até o foco dar uma volta completa na página e devolve os elementos focados na
 * primeira passagem, em ordem (PEND-013). O user-event volta ao início depois do último focável
 * (passando por document.body); a coleta para quando um elemento já focado recebe foco de novo.
 */
async function primeiraVoltaComTab(user: ReturnType<typeof userEvent.setup>, maximo = 20): Promise<Element[]> {
  const focados: Element[] = [];
  for (let i = 0; i < maximo; i++) {
    await user.tab();
    const atual = document.activeElement;
    if (!atual || atual === document.body) continue;
    if (focados.includes(atual)) break;
    focados.push(atual);
  }
  return focados;
}

describe('RF-13 · EscolherFase lista as publicadas', () => {
  // @req RF-13 @tipo feliz
  test('test_RF13_mostra_uma_entrada_por_fase_na_ordem_recebida', () => {
    montar(FASES);
    const lista = entradas();
    expect(lista).toHaveLength(FASES.length);
    expect(lista.map((el) => el.textContent?.trim())).toEqual(FASES.map((f) => f.titulo));
  });

  // @req RF-13 @tipo feliz
  test('test_RF13_ativar_uma_entrada_abre_a_fase_correspondente', async () => {
    const user = userEvent.setup();
    const { aoAbrir } = montar(FASES);
    await user.click(screen.getByText('Corredor dos primos'));
    expect(aoAbrir).toHaveBeenCalledTimes(1);
    expect(aoAbrir).toHaveBeenCalledWith('fase-sintetica-2');
  });

  // @req RF-13 @tipo borda
  test('test_RF13_fases_com_o_mesmo_titulo_tem_uma_entrada_cada_e_abrem_pelo_id', async () => {
    const user = userEvent.setup();
    const { aoAbrir } = montar([
      { id: 'fase-gemea-1', titulo: 'Sala repetida' },
      { id: 'fase-gemea-2', titulo: 'Sala repetida' },
    ]);
    const lista = entradas();
    expect(lista).toHaveLength(2);
    await user.click(lista[1] as HTMLElement);
    expect(aoAbrir).toHaveBeenCalledWith('fase-gemea-2');
    expect(aoAbrir).not.toHaveBeenCalledWith('fase-gemea-1');
  });

  // @req RF-13 @tipo borda
  test('test_RF13_uma_unica_fase_publicada_aparece_sozinha', () => {
    montar([{ id: 'fase-unica', titulo: 'Única sala' }]);
    expect(entradas().map((el) => el.textContent?.trim())).toEqual(['Única sala']);
    expect(screen.queryByText('Nenhuma fase publicada ainda.')).not.toBeInTheDocument();
  });

  // @req RF-13 @tipo negativo
  test('test_RF13_lista_vazia_nao_mostra_entrada_e_avisa_que_nao_ha_fase', () => {
    const { aoAbrir } = montar([]);
    expect(entradas()).toHaveLength(0);
    expect(screen.getByText('Nenhuma fase publicada ainda.')).toBeInTheDocument();
    expect(aoAbrir).not.toHaveBeenCalled();
  });
});

describe('RNF-07 · EscolherFase pelo teclado', () => {
  // @req RNF-07 @tipo feliz
  test('test_RNF07_tab_percorre_as_fases_na_ordem_da_lista', async () => {
    const user = userEvent.setup();
    montar(FASES);
    const lista = entradas();
    const focados = await primeiraVoltaComTab(user);
    const fasesFocadas = focados.filter((el) => lista.includes(el as HTMLElement));
    expect(fasesFocadas).toEqual(lista);
  });

  // @req RNF-07 @tipo feliz
  test('test_RNF07_enter_na_fase_focada_abre_essa_fase', async () => {
    const user = userEvent.setup();
    const { aoAbrir } = montar(FASES);
    const alvo = entradas()[2] as HTMLElement;
    for (let i = 0; i < 20 && document.activeElement !== alvo; i++) await user.tab();
    expect(alvo).toHaveFocus();

    await user.keyboard('{Enter}');

    expect(aoAbrir).toHaveBeenCalledTimes(1);
    expect(aoAbrir).toHaveBeenCalledWith('fase-sintetica-3');
  });

  // @req RNF-07 @tipo borda
  test('test_RNF07_shift_tab_volta_para_a_fase_anterior_e_enter_abre_ela', async () => {
    const user = userEvent.setup();
    const { aoAbrir } = montar(FASES);
    const [primeira, segunda] = entradas() as [HTMLElement, HTMLElement];
    for (let i = 0; i < 20 && document.activeElement !== segunda; i++) await user.tab();
    expect(segunda).toHaveFocus();

    await user.tab({ shift: true });
    expect(primeira).toHaveFocus();
    await user.keyboard('{Enter}');

    expect(aoAbrir).toHaveBeenCalledWith('fase-sintetica-1');
  });

  // @req RNF-07 @tipo borda
  test('test_RNF07_entradas_sao_elementos_nativos_focaveis', () => {
    montar(FASES);
    for (const el of entradas()) {
      const nativo = el.tagName === 'BUTTON' || (el.tagName === 'A' && el.hasAttribute('href'));
      expect(nativo, `${el.tagName} "${el.textContent}"`).toBe(true);
      expect(el.getAttribute('tabindex')).not.toBe('-1');
    }
  });

  // @req RNF-07 @tipo negativo
  test('test_RNF07_so_percorrer_com_tab_nao_abre_nenhuma_fase', async () => {
    const user = userEvent.setup();
    const { aoAbrir } = montar(FASES);
    await percorrerComTab(user, FASES.length + 2);
    expect(aoAbrir).not.toHaveBeenCalled();
  });

  // @req RNF-07 @tipo negativo
  test('test_RNF07_lista_vazia_mostra_a_mensagem_em_portugues_e_nada_focavel_de_fase', async () => {
    const user = userEvent.setup();
    const { aoAbrir } = montar([]);
    expect(screen.getByText('Nenhuma fase publicada ainda.')).toBeInTheDocument();
    await user.keyboard('{Enter}');
    expect(aoAbrir).not.toHaveBeenCalled();
  });
});
