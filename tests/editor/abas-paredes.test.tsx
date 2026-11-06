/**
 * Módulo: AbasParedes (apps/editor/contrato/componentes.ts · PropsAbasParedes; modulos-editor.md §4).
 * Requisitos:
 * - RF-03: existem 5 abas, na ordem frente, direita, fundo, esquerda, teto; a ativa tem aria-selected="true";
 *   escolher uma aba chama `aoTrocar` com a parede dela;
 * - RNF-07: operável só pelo teclado (botões nativos; Tab chega às abas, setas navegam, Enter/Espaço ativam).
 *   O foco visível (:focus-visible do tema) não é observável no jsdom e fica para o E2E.
 *
 * O contrato não fixa o nome acessível de cada aba: os testes identificam a aba pela posição (a ordem é contrato).
 * Leitura assumida (PEND-017): as setas movem o foco para a aba vizinha (ArrowRight → próxima, ArrowLeft → anterior).
 */
import { AbasParedes } from '@math-scape/app-editor';
import { PAREDES, type ParedeId } from '@math-scape/schema/contrato';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, test, vi } from 'vitest';

type AoTrocar = (parede: ParedeId) => void;

/** Abas ligadas a um estado, como na tela de edição: trocar atualiza a parede ativa. */
function Controlado({ inicial, aoTrocar }: { inicial: ParedeId; aoTrocar: AoTrocar }) {
  const [parede, setParede] = useState<ParedeId>(inicial);
  return (
    <AbasParedes
      paredeAtiva={parede}
      aoTrocar={(nova) => {
        aoTrocar(nova);
        setParede(nova);
      }}
    />
  );
}

function montar(inicial: ParedeId = 'frente') {
  const aoTrocar = vi.fn<AoTrocar>();
  render(<Controlado inicial={inicial} aoTrocar={aoTrocar} />);
  return { aoTrocar };
}

function abas(): HTMLElement[] {
  return screen.getAllByRole('tab');
}

function selecionadas(): number[] {
  return abas()
    .map((aba, indice) => (aba.getAttribute('aria-selected') === 'true' ? indice : -1))
    .filter((indice) => indice >= 0);
}

describe('RF-03 · cinco abas de parede', () => {
  // @req RF-03 @tipo feliz
  test('test_RF03_cinco_abas_na_ordem_frente_direita_fundo_esquerda_teto', async () => {
    const user = userEvent.setup();
    const aoTrocar = vi.fn<AoTrocar>();
    render(<AbasParedes paredeAtiva="frente" aoTrocar={aoTrocar} />);

    expect(abas()).toHaveLength(5);
    for (const [indice, parede] of PAREDES.entries()) {
      await user.click(abas()[indice] as HTMLElement);
      expect(aoTrocar).toHaveBeenLastCalledWith(parede);
    }
    expect(aoTrocar.mock.calls.map(([parede]) => parede).filter((p) => p !== 'frente')).toEqual([
      'direita',
      'fundo',
      'esquerda',
      'teto',
    ]);
  });

  // @req RF-03 @tipo borda
  test('test_RF03_cada_uma_das_5_paredes_quando_ativa_e_a_unica_aba_selecionada', () => {
    for (const [indice, parede] of PAREDES.entries()) {
      const { unmount } = render(<AbasParedes paredeAtiva={parede} aoTrocar={vi.fn<AoTrocar>()} />);
      expect(selecionadas(), parede).toEqual([indice]);
      unmount();
    }
  });

  // @req RF-03 @tipo negativo
  test('test_RF03_depois_de_trocar_a_aba_anterior_deixa_de_estar_selecionada', async () => {
    const user = userEvent.setup();
    const { aoTrocar } = montar('frente');
    expect(selecionadas()).toEqual([0]);

    await user.click(abas()[2] as HTMLElement);

    expect(aoTrocar).toHaveBeenCalledWith('fundo');
    expect(selecionadas()).toEqual([2]);
    expect(abas()[0]).not.toHaveAttribute('aria-selected', 'true');
  });
});

describe('RNF-07 · abas pelo teclado', () => {
  // @req RNF-07 @tipo feliz
  test('test_RNF07_abas_sao_botoes_nativos_e_tab_seta_e_enter_trocam_de_parede', async () => {
    const user = userEvent.setup();
    const { aoTrocar } = montar('frente');
    for (const aba of abas()) expect(aba.tagName).toBe('BUTTON');

    await user.tab();
    const inicio = abas().indexOf(document.activeElement as HTMLElement);
    expect(inicio, 'Tab deve levar o foco a uma aba').toBeGreaterThanOrEqual(0);
    expect(inicio).toBeLessThan(4);

    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(abas()[inicio + 1]);

    await user.keyboard('{Enter}');
    expect(aoTrocar).toHaveBeenLastCalledWith(PAREDES[inicio + 1]);
    expect(selecionadas()).toEqual([inicio + 1]);
  });

  // @req RNF-07 @tipo borda
  test('test_RNF07_seta_para_a_esquerda_a_partir_do_teto_e_espaco_ativam_a_esquerda', async () => {
    const user = userEvent.setup();
    const { aoTrocar } = montar('teto');
    const teto = abas()[4] as HTMLElement;
    act(() => teto.focus());

    await user.keyboard('{ArrowLeft}');
    expect(document.activeElement).toBe(abas()[3]);

    await user.keyboard(' ');
    expect(aoTrocar).toHaveBeenLastCalledWith('esquerda');
    expect(selecionadas()).toEqual([3]);
  });

  // @req RNF-07 @tipo negativo
  test('test_RNF07_so_levar_o_foco_com_tab_nao_troca_de_parede', async () => {
    const user = userEvent.setup();
    const { aoTrocar } = montar('direita');

    await user.tab();

    expect(abas()).toContain(document.activeElement);
    expect(aoTrocar).not.toHaveBeenCalled();
    expect(selecionadas()).toEqual([1]);
  });
});
