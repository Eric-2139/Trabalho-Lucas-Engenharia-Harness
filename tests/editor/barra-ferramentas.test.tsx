/**
 * Módulo: BarraFerramentas (apps/editor/contrato/componentes.ts · PropsBarraFerramentas; modulos-editor.md §4;
 * PEND-005).
 * Requisitos:
 * - RF-09: botões desfazer e refazer chamam as ações; desabilitados quando não há passo;
 * - RF-10: botão salvar (salvar ao mandar); indicador do estado de salvamento (ROTULOS_EDITOR.estadoSalvamento);
 *   numa fase publicada com rascunho diferente, aviso "alterações não publicadas" com "publicar de novo"
 *   (os jogadores continuam na versão publicada até o criador publicar de novo);
 * - RNF-07: barra operável só pelo teclado, com botões nativos (Tab chega a cada um, Enter/Espaço ativam).
 *   O foco visível (:focus-visible do tema) não é observável no jsdom e fica para o E2E.
 *
 * Leituras assumidas, que o contrato não fixa (PEND-017): o indicador mostra só o texto do estado atual;
 * com `alteracoesNaoPublicadas` aparecem o texto ROTULOS_EDITOR.alteracoesNaoPublicadas e o botão
 * ROTULOS_EDITOR.publicarDeNovo (que chama `aoPublicar`), e sem ele nenhum dos dois.
 */
import { BarraFerramentas } from '@math-scape/app-editor';
import { type EstadoSalvamento, type PropsBarraFerramentas, ROTULOS_EDITOR } from '@math-scape/app-editor/contrato';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';

type Acao = () => void;
type Usuario = ReturnType<typeof userEvent.setup>;

const ESTADOS: EstadoSalvamento[] = ['salvo', 'pendente', 'salvando', 'conflito', 'erro'];

function propsBase(extra: Partial<PropsBarraFerramentas> = {}): PropsBarraFerramentas {
  return {
    estadoSalvamento: 'salvo',
    podeDesfazer: true,
    podeRefazer: true,
    alteracoesNaoPublicadas: false,
    aoDesfazer: vi.fn<Acao>(),
    aoRefazer: vi.fn<Acao>(),
    aoSalvar: vi.fn<Acao>(),
    aoTestar: vi.fn<Acao>(),
    aoPublicar: vi.fn<Acao>(),
    aoExportar: vi.fn<Acao>(),
    ...extra,
  };
}

function montar(extra: Partial<PropsBarraFerramentas> = {}) {
  const props = propsBase(extra);
  const tela = render(<BarraFerramentas {...props} />);
  return { props, ...tela };
}

function botao(nome: string): HTMLButtonElement {
  return screen.getByRole('button', { name: nome }) as HTMLButtonElement;
}

/** Pressiona Tab até o foco dar uma volta na página; devolve os elementos focados na primeira passagem. */
async function primeiraVoltaComTab(user: Usuario, maximo = 30): Promise<Element[]> {
  const focados: Element[] = [];
  for (let i = 0; i < maximo; i++) {
    await user.tab();
    const atual = document.activeElement;
    if (!atual || atual === document.body) {
      if (focados.length > 0) break;
      continue;
    }
    if (focados.includes(atual)) break;
    focados.push(atual);
  }
  return focados;
}

const BOTOES_FIXOS = [
  ROTULOS_EDITOR.desfazer,
  ROTULOS_EDITOR.refazer,
  ROTULOS_EDITOR.salvar,
  ROTULOS_EDITOR.testar,
  ROTULOS_EDITOR.publicar,
  ROTULOS_EDITOR.exportar,
];

// ---------------------------------------------------------------------------
// RF-09 · desfazer e refazer
// ---------------------------------------------------------------------------
describe('RF-09 · desfazer e refazer na barra', () => {
  // @req RF-09 @tipo feliz
  test('test_RF09_botoes_desfazer_e_refazer_chamam_as_acoes', async () => {
    const user = userEvent.setup();
    const { props } = montar();

    await user.click(botao(ROTULOS_EDITOR.desfazer));
    expect(props.aoDesfazer).toHaveBeenCalledTimes(1);
    expect(props.aoRefazer).not.toHaveBeenCalled();

    await user.click(botao(ROTULOS_EDITOR.refazer));
    expect(props.aoRefazer).toHaveBeenCalledTimes(1);
    expect(props.aoDesfazer).toHaveBeenCalledTimes(1);
  });

  // @req RF-09 @tipo borda
  test('test_RF09_so_um_dos_dois_disponivel_desabilita_apenas_o_outro', () => {
    const { rerender } = montar({ podeDesfazer: true, podeRefazer: false });
    expect(botao(ROTULOS_EDITOR.desfazer)).toBeEnabled();
    expect(botao(ROTULOS_EDITOR.refazer)).toBeDisabled();

    rerender(<BarraFerramentas {...propsBase({ podeDesfazer: false, podeRefazer: true })} />);
    expect(botao(ROTULOS_EDITOR.desfazer)).toBeDisabled();
    expect(botao(ROTULOS_EDITOR.refazer)).toBeEnabled();
  });

  // @req RF-09 @tipo negativo
  test('test_RF09_sem_passo_desfazer_e_refazer_ficam_desabilitados_e_o_clique_nao_chama_nada', async () => {
    const user = userEvent.setup();
    const { props } = montar({ podeDesfazer: false, podeRefazer: false });
    expect(botao(ROTULOS_EDITOR.desfazer)).toBeDisabled();
    expect(botao(ROTULOS_EDITOR.refazer)).toBeDisabled();

    await user.click(botao(ROTULOS_EDITOR.desfazer));
    await user.click(botao(ROTULOS_EDITOR.refazer));

    expect(props.aoDesfazer).not.toHaveBeenCalled();
    expect(props.aoRefazer).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// RF-10 · salvar, indicador e alterações não publicadas
// ---------------------------------------------------------------------------
describe('RF-10 · salvamento na barra', () => {
  // @req RF-10 @tipo feliz
  test('test_RF10_botao_salvar_chama_aoSalvar', async () => {
    const user = userEvent.setup();
    const { props } = montar({ estadoSalvamento: 'pendente' });

    await user.click(botao(ROTULOS_EDITOR.salvar));

    expect(props.aoSalvar).toHaveBeenCalledTimes(1);
  });

  // @req RF-10 @tipo feliz
  test('test_RF10_indicador_mostra_salvo_depois_de_gravar', () => {
    montar({ estadoSalvamento: 'salvo' });
    expect(screen.getByText(ROTULOS_EDITOR.estadoSalvamento.salvo)).toBeInTheDocument();
  });

  // @req RF-10 @tipo borda
  test('test_RF10_indicador_acompanha_cada_um_dos_5_estados_de_salvamento', () => {
    const { rerender } = montar({ estadoSalvamento: 'salvo' });
    for (const estado of ESTADOS) {
      rerender(<BarraFerramentas {...propsBase({ estadoSalvamento: estado })} />);
      expect(screen.getByText(ROTULOS_EDITOR.estadoSalvamento[estado]), estado).toBeInTheDocument();
    }
  });

  // @req RF-10 @tipo negativo
  test('test_RF10_indicador_em_erro_nao_diz_que_esta_salvo', () => {
    montar({ estadoSalvamento: 'erro' });

    expect(screen.getByText(ROTULOS_EDITOR.estadoSalvamento.erro)).toBeInTheDocument();
    for (const estado of ESTADOS.filter((e) => e !== 'erro')) {
      expect(screen.queryByText(ROTULOS_EDITOR.estadoSalvamento[estado]), estado).toBeNull();
    }
  });

  // @req RF-10 @tipo feliz
  test('test_RF10_fase_publicada_com_alteracoes_mostra_o_aviso_e_publicar_de_novo', async () => {
    const user = userEvent.setup();
    const { props } = montar({ alteracoesNaoPublicadas: true });

    expect(screen.getByText(ROTULOS_EDITOR.alteracoesNaoPublicadas)).toBeInTheDocument();
    await user.click(botao(ROTULOS_EDITOR.publicarDeNovo));

    expect(props.aoPublicar).toHaveBeenCalledTimes(1);
  });

  // @req RF-10 @tipo negativo
  test('test_RF10_sem_alteracoes_nao_publicadas_nao_ha_aviso_nem_publicar_de_novo', () => {
    montar({ alteracoesNaoPublicadas: false });

    expect(screen.queryByText(ROTULOS_EDITOR.alteracoesNaoPublicadas)).toBeNull();
    expect(screen.queryByRole('button', { name: ROTULOS_EDITOR.publicarDeNovo })).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// RNF-07 · teclado
// ---------------------------------------------------------------------------
describe('RNF-07 · barra pelo teclado', () => {
  // @req RNF-07 @tipo feliz
  test('test_RNF07_tab_alcanca_todos_os_botoes_da_barra_e_enter_salva', async () => {
    const user = userEvent.setup();
    const { props } = montar();

    const focados = await primeiraVoltaComTab(user);
    for (const nome of BOTOES_FIXOS) expect(focados, nome).toContain(botao(nome));

    // Tab até o Salvar e Enter.
    act(() => (document.activeElement as HTMLElement | null)?.blur());
    for (let i = 0; i < focados.length && document.activeElement !== botao(ROTULOS_EDITOR.salvar); i++) {
      await user.tab();
    }
    expect(document.activeElement).toBe(botao(ROTULOS_EDITOR.salvar));
    await user.keyboard('{Enter}');
    expect(props.aoSalvar).toHaveBeenCalledTimes(1);
  });

  // @req RNF-07 @tipo borda
  test('test_RNF07_controles_da_barra_sao_botoes_nativos_e_espaco_tambem_ativa', async () => {
    const user = userEvent.setup();
    const { props } = montar({ alteracoesNaoPublicadas: true });
    for (const nome of [...BOTOES_FIXOS, ROTULOS_EDITOR.publicarDeNovo]) {
      expect(botao(nome).tagName, nome).toBe('BUTTON');
    }

    act(() => botao(ROTULOS_EDITOR.exportar).focus());
    await user.keyboard(' ');
    act(() => botao(ROTULOS_EDITOR.testar).focus());
    await user.keyboard('{Enter}');

    expect(props.aoExportar).toHaveBeenCalledTimes(1);
    expect(props.aoTestar).toHaveBeenCalledTimes(1);
  });

  // @req RNF-07 @tipo negativo
  test('test_RNF07_botao_desabilitado_fica_fora_do_tab_e_so_percorrer_nao_aciona_nada', async () => {
    const user = userEvent.setup();
    const { props } = montar({ podeDesfazer: false, podeRefazer: true });

    const focados = await primeiraVoltaComTab(user);

    expect(focados).not.toContain(botao(ROTULOS_EDITOR.desfazer));
    expect(focados).toContain(botao(ROTULOS_EDITOR.refazer));
    for (const acao of [props.aoDesfazer, props.aoRefazer, props.aoSalvar, props.aoTestar, props.aoPublicar, props.aoExportar]) {
      expect(acao).not.toHaveBeenCalled();
    }
  });
});
