/**
 * Módulo: TelaConta (apps/editor/contrato/telas.ts · PropsTelaConta; modulos-editor.md §5).
 * Requisito RF-19: excluir a própria conta pede confirmação no diálogo role="alertdialog"
 * (botões ROTULOS_EDITOR.confirmar / ROTULOS_EDITOR.cancelar); Cancelar não chama `excluirConta`
 * e a conta continua; Confirmar chama `excluirConta` e, aceito, `aoExcluirConta` (o app volta ao login,
 * a sessão acabou). Recusa da Api aparece em role="alert" e não chama `aoExcluirConta`.
 * O apagamento de nome, e-mail e hash no banco é coberto em tests/api/auth.test.ts.
 */
import { TelaConta } from '@math-scape/app-editor';
import { ROTULOS_EDITOR } from '@math-scape/app-editor/contrato';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import {
  ERRO_REDE,
  adiado,
  criarClienteTelasFalso,
  ok,
  recusa,
  textosDosAlertas,
} from '../support/cliente-editor-falso.ts';

type Usuario = ReturnType<typeof userEvent.setup>;

function montar() {
  const user = userEvent.setup();
  const cliente = criarClienteTelasFalso();
  const aoExcluirConta = vi.fn<() => void>();
  render(<TelaConta cliente={cliente} aoExcluirConta={aoExcluirConta} />);
  return { user, cliente, aoExcluirConta };
}

async function abrirDialogo(user: Usuario): Promise<HTMLElement> {
  await user.click(screen.getByRole('button', { name: ROTULOS_EDITOR.excluirConta }));
  return screen.findByRole('alertdialog');
}

async function responder(user: Usuario, dialogo: HTMLElement, nome: string): Promise<void> {
  await user.click(within(dialogo).getByRole('button', { name: nome }));
}

describe('RF-19 · TelaConta exclui a própria conta', () => {
  // @req RF-19 @tipo feliz
  test('test_RF19_confirmar_exclusao_chama_excluirConta_e_depois_aoExcluirConta', async () => {
    const { user, cliente, aoExcluirConta } = montar();

    const dialogo = await abrirDialogo(user);
    await responder(user, dialogo, ROTULOS_EDITOR.confirmar);

    await waitFor(() => expect(aoExcluirConta).toHaveBeenCalledTimes(1));
    expect(cliente.excluirConta).toHaveBeenCalledTimes(1);
  });

  // @req RF-19 @tipo borda
  test('test_RF19_abrir_o_dialogo_de_confirmacao_ainda_nao_chama_a_api', async () => {
    const { user, cliente, aoExcluirConta } = montar();

    const dialogo = await abrirDialogo(user);

    expect(within(dialogo).getByRole('button', { name: ROTULOS_EDITOR.confirmar })).toBeInTheDocument();
    expect(within(dialogo).getByRole('button', { name: ROTULOS_EDITOR.cancelar })).toBeInTheDocument();
    expect(cliente.excluirConta).not.toHaveBeenCalled();
    expect(aoExcluirConta).not.toHaveBeenCalled();
  });

  // @req RF-19 @tipo borda
  test('test_RF19_aoExcluirConta_so_e_chamado_depois_da_resposta_aceita_da_api', async () => {
    const { user, cliente, aoExcluirConta } = montar();
    const resposta = adiado<Awaited<ReturnType<typeof cliente.excluirConta>>>();
    cliente.excluirConta.mockReturnValueOnce(resposta.promessa);

    const dialogo = await abrirDialogo(user);
    await responder(user, dialogo, ROTULOS_EDITOR.confirmar);
    await waitFor(() => expect(cliente.excluirConta).toHaveBeenCalledTimes(1));
    expect(aoExcluirConta).not.toHaveBeenCalled();

    await act(async () => {
      resposta.resolver(ok(undefined));
    });

    await waitFor(() => expect(aoExcluirConta).toHaveBeenCalledTimes(1));
  });

  // @req RF-19 @tipo borda
  test('test_RF19_cancelar_e_depois_confirmar_exclui_uma_unica_vez', async () => {
    const { user, cliente, aoExcluirConta } = montar();

    await responder(user, await abrirDialogo(user), ROTULOS_EDITOR.cancelar);
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    await responder(user, await abrirDialogo(user), ROTULOS_EDITOR.confirmar);

    await waitFor(() => expect(aoExcluirConta).toHaveBeenCalledTimes(1));
    expect(cliente.excluirConta).toHaveBeenCalledTimes(1);
  });

  // @req RF-19 @tipo negativo
  test('test_RF19_cancelar_nao_chama_excluirConta_e_a_conta_continua', async () => {
    const { user, cliente, aoExcluirConta } = montar();

    await responder(user, await abrirDialogo(user), ROTULOS_EDITOR.cancelar);

    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(cliente.excluirConta).not.toHaveBeenCalled();
    expect(aoExcluirConta).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: ROTULOS_EDITOR.excluirConta })).toBeInTheDocument();
  });

  // @req RF-19 @tipo negativo
  test('test_RF19_exclusao_recusada_pela_api_mostra_o_erro_e_nao_sai_da_conta', async () => {
    const { user, cliente, aoExcluirConta } = montar();
    const erro = 'Erro 500 do servidor.';
    cliente.excluirConta.mockResolvedValueOnce(recusa(500, erro));

    await responder(user, await abrirDialogo(user), ROTULOS_EDITOR.confirmar);

    await waitFor(() => expect(textosDosAlertas().join(' | ')).toContain(erro));
    expect(cliente.excluirConta).toHaveBeenCalledTimes(1);
    expect(aoExcluirConta).not.toHaveBeenCalled();
  });

  // @req RF-19 @tipo negativo
  test('test_RF19_sem_resposta_do_servidor_mostra_o_erro_de_rede_e_nao_sai_da_conta', async () => {
    const { user, cliente, aoExcluirConta } = montar();
    cliente.excluirConta.mockResolvedValueOnce(recusa(0, ERRO_REDE));

    await responder(user, await abrirDialogo(user), ROTULOS_EDITOR.confirmar);

    await waitFor(() => expect(textosDosAlertas().join(' | ')).toContain(ERRO_REDE));
    expect(aoExcluirConta).not.toHaveBeenCalled();
  });
});
