/**
 * Módulo: TelaEntrar (apps/editor/contrato/telas.ts · PropsTelaEntrar; modulos-editor.md §5).
 * Requisitos:
 * - RF-01: entrar com e-mail e senha; cadastro com nome, e-mail e senha seguido de login;
 *   `aoEntrar` só com login aceito (ou cadastro aceito seguido de login aceito); a recusa da Api
 *   aparece num elemento role="alert" e não chama `aoEntrar`;
 * - RNF-06: o cadastro pede e envia só nome, e-mail e senha;
 * - RNF-07: formulários operáveis só pelo teclado (Tab chega aos campos e botões, Enter envia).
 *   O foco visível (:focus-visible do tema) não é observável no jsdom e fica para o E2E.
 *
 * Leituras assumidas, que o contrato não fixa (PEND-018): cada formulário é um <form> nativo com os
 * campos rotulados por <label> (ROTULOS_EDITOR.nome / email / senha) e o botão de envio
 * ROTULOS_EDITOR.entrar ou ROTULOS_EDITOR.cadastrar dentro dele. Os testes aceitam as duas
 * apresentações: os dois formulários juntos na tela, ou um botão com o mesmo nome que mostra o outro.
 */
import { TelaEntrar } from '@math-scape/app-editor';
import { ROTULOS_EDITOR } from '@math-scape/app-editor/contrato';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import {
  ERRO_REDE,
  PESSOA_SINTETICA,
  criarClienteTelasFalso,
  recusa,
  textosDosAlertas,
} from '../support/cliente-editor-falso.ts';

type Usuario = ReturnType<typeof userEvent.setup>;
type Modo = 'mouse' | 'teclado';

const P = PESSOA_SINTETICA;
const LOGIN_RECUSADO = 'E-mail ou senha incorretos.';
const EMAIL_REPETIDO = 'Já existe uma conta com este e-mail.';

function montar() {
  const user = userEvent.setup();
  const cliente = criarClienteTelasFalso();
  const aoEntrar = vi.fn<() => void>();
  render(<TelaEntrar cliente={cliente} aoEntrar={aoEntrar} />);
  return { user, cliente, aoEntrar };
}

/** Pressiona Tab até `alvo` receber o foco (no máximo `maximo` vezes). */
async function tabAte(user: Usuario, alvo: Element, maximo = 40): Promise<void> {
  for (let i = 0; i < maximo && document.activeElement !== alvo; i++) await user.tab();
}

/** Pressiona Tab até o foco dar uma volta na página; devolve os elementos focados na primeira passagem. */
async function primeiraVoltaComTab(user: Usuario, maximo = 40): Promise<Element[]> {
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

/** O <form> cujo botão de envio tem o nome dado e que tem o campo Senha. */
function formularioCom(nomeBotao: string): HTMLFormElement | null {
  for (const botao of screen.queryAllByRole('button', { name: nomeBotao })) {
    const form = botao.closest('form');
    if (form && within(form).queryByLabelText(ROTULOS_EDITOR.senha)) return form;
  }
  return null;
}

/** Devolve o formulário; se ele não está na tela, ativa o botão de mesmo nome que o mostra. */
async function abrirFormulario(user: Usuario, nomeBotao: string, modo: Modo = 'mouse'): Promise<HTMLFormElement> {
  const pronto = formularioCom(nomeBotao);
  if (pronto) return pronto;
  const alternar = screen.getByRole('button', { name: nomeBotao });
  if (modo === 'teclado') {
    await tabAte(user, alternar);
    await user.keyboard('{Enter}');
  } else {
    await user.click(alternar);
  }
  const form = formularioCom(nomeBotao);
  if (!form) throw new Error(`formulário com o botão "${nomeBotao}" e o campo "${ROTULOS_EDITOR.senha}" não apareceu`);
  return form;
}

function campo(form: HTMLElement, rotulo: string): HTMLElement {
  return within(form).getByLabelText(rotulo);
}

function botaoEnviar(form: HTMLElement, nome: string): HTMLElement {
  return within(form).getByRole('button', { name: nome });
}

async function entrarPelaTela(user: Usuario, email: string, senha: string): Promise<void> {
  const form = await abrirFormulario(user, ROTULOS_EDITOR.entrar);
  await user.clear(campo(form, ROTULOS_EDITOR.email));
  await user.type(campo(form, ROTULOS_EDITOR.email), email);
  await user.clear(campo(form, ROTULOS_EDITOR.senha));
  await user.type(campo(form, ROTULOS_EDITOR.senha), senha);
  await user.click(botaoEnviar(form, ROTULOS_EDITOR.entrar));
}

async function cadastrarPelaTela(user: Usuario): Promise<HTMLFormElement> {
  const form = await abrirFormulario(user, ROTULOS_EDITOR.cadastrar);
  await user.type(campo(form, ROTULOS_EDITOR.nome), P.nome);
  await user.type(campo(form, ROTULOS_EDITOR.email), P.email);
  await user.type(campo(form, ROTULOS_EDITOR.senha), P.senha);
  await user.click(botaoEnviar(form, ROTULOS_EDITOR.cadastrar));
  return form;
}

/** Campos que pedem dado ao usuário: inputs (menos botões e ocultos), selects e textareas. */
function camposDeDado(form: HTMLFormElement): Element[] {
  const naoDado = new Set(['submit', 'button', 'reset', 'hidden', 'image']);
  return Array.from(form.querySelectorAll('input, select, textarea')).filter(
    (el) => !(el instanceof HTMLInputElement && naoDado.has(el.type)),
  );
}

async function esperarAlertaCom(texto: string): Promise<void> {
  await waitFor(() => expect(textosDosAlertas().join(' | ')).toContain(texto));
}

// ---------------------------------------------------------------------------
// RF-01 · entrar e cadastrar
// ---------------------------------------------------------------------------
describe('RF-01 · TelaEntrar', () => {
  // @req RF-01 @tipo feliz
  test('test_RF01_login_aceito_envia_email_e_senha_e_chama_aoEntrar', async () => {
    const { user, cliente, aoEntrar } = montar();

    await entrarPelaTela(user, P.email, P.senha);

    await waitFor(() => expect(aoEntrar).toHaveBeenCalledTimes(1));
    expect(cliente.entrar).toHaveBeenCalledTimes(1);
    expect(cliente.entrar).toHaveBeenCalledWith(P.email, P.senha);
    expect(cliente.cadastrar).not.toHaveBeenCalled();
  });

  // @req RF-01 @tipo feliz
  test('test_RF01_cadastro_aceito_faz_login_com_o_mesmo_email_e_senha_e_chama_aoEntrar', async () => {
    const { user, cliente, aoEntrar } = montar();

    await cadastrarPelaTela(user);

    await waitFor(() => expect(aoEntrar).toHaveBeenCalledTimes(1));
    expect(cliente.cadastrar).toHaveBeenCalledTimes(1);
    expect(cliente.cadastrar).toHaveBeenCalledWith(P.nome, P.email, P.senha);
    expect(cliente.entrar).toHaveBeenCalledWith(P.email, P.senha);
  });

  // @req RF-01 @tipo borda
  test('test_RF01_cadastro_aceito_mas_login_recusado_mostra_o_erro_e_nao_entra', async () => {
    const { user, cliente, aoEntrar } = montar();
    cliente.entrar.mockResolvedValueOnce(recusa(401, LOGIN_RECUSADO));

    await cadastrarPelaTela(user);

    await esperarAlertaCom(LOGIN_RECUSADO);
    expect(cliente.cadastrar).toHaveBeenCalledTimes(1);
    expect(aoEntrar).not.toHaveBeenCalled();
  });

  // @req RF-01 @tipo borda
  test('test_RF01_depois_de_um_login_recusado_a_nova_tentativa_aceita_entra_uma_unica_vez', async () => {
    const { user, cliente, aoEntrar } = montar();
    cliente.entrar.mockResolvedValueOnce(recusa(401, LOGIN_RECUSADO));

    await entrarPelaTela(user, P.email, 'senha-errada-sintetica');
    await esperarAlertaCom(LOGIN_RECUSADO);
    expect(aoEntrar).not.toHaveBeenCalled();

    await entrarPelaTela(user, P.email, P.senha);

    await waitFor(() => expect(aoEntrar).toHaveBeenCalledTimes(1));
    expect(cliente.entrar).toHaveBeenCalledTimes(2);
    expect(cliente.entrar).toHaveBeenLastCalledWith(P.email, P.senha);
  });

  // @req RF-01 @tipo borda
  test('test_RF01_sem_resposta_do_servidor_mostra_o_erro_de_rede_e_nao_entra', async () => {
    const { user, cliente, aoEntrar } = montar();
    cliente.entrar.mockResolvedValueOnce(recusa(0, ERRO_REDE));

    await entrarPelaTela(user, P.email, P.senha);

    await esperarAlertaCom(ERRO_REDE);
    expect(aoEntrar).not.toHaveBeenCalled();
  });

  // @req RF-01 @tipo negativo
  test('test_RF01_login_recusado_mostra_o_erro_da_api_em_alerta_e_nao_chama_aoEntrar', async () => {
    const { user, cliente, aoEntrar } = montar();
    cliente.entrar.mockResolvedValueOnce(recusa(401, LOGIN_RECUSADO));

    await entrarPelaTela(user, P.email, 'senha-errada-sintetica');

    await esperarAlertaCom(LOGIN_RECUSADO);
    expect(cliente.entrar).toHaveBeenCalledWith(P.email, 'senha-errada-sintetica');
    expect(aoEntrar).not.toHaveBeenCalled();
  });

  // @req RF-01 @tipo negativo
  test('test_RF01_cadastro_recusado_mostra_o_erro_e_nao_tenta_login', async () => {
    const { user, cliente, aoEntrar } = montar();
    cliente.cadastrar.mockResolvedValueOnce(recusa(409, EMAIL_REPETIDO));

    await cadastrarPelaTela(user);

    await esperarAlertaCom(EMAIL_REPETIDO);
    expect(cliente.entrar).not.toHaveBeenCalled();
    expect(aoEntrar).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// RNF-06 · cadastro só com nome, e-mail e senha
// ---------------------------------------------------------------------------
describe('RNF-06 · dados do cadastro', () => {
  // @req RNF-06 @tipo feliz
  test('test_RNF06_cadastro_envia_a_api_so_nome_email_e_senha', async () => {
    const { user, cliente } = montar();

    await cadastrarPelaTela(user);

    await waitFor(() => expect(cliente.cadastrar).toHaveBeenCalledTimes(1));
    expect(cliente.cadastrar.mock.calls[0]).toEqual([P.nome, P.email, P.senha]);
  });

  // @req RNF-06 @tipo borda
  test('test_RNF06_formulario_de_cadastro_tem_exatamente_os_tres_campos_nome_email_e_senha', async () => {
    const { user } = montar();
    const form = await abrirFormulario(user, ROTULOS_EDITOR.cadastrar);

    const rotulados = [ROTULOS_EDITOR.nome, ROTULOS_EDITOR.email, ROTULOS_EDITOR.senha].map((r) => campo(form, r));
    const dados = camposDeDado(form);

    expect(dados).toHaveLength(3);
    for (const el of rotulados) expect(dados).toContain(el);
  });

  // @req RNF-06 @tipo negativo
  test('test_RNF06_tela_nao_pede_nenhum_outro_dado_pessoal', async () => {
    const { user } = montar();
    await abrirFormulario(user, ROTULOS_EDITOR.cadastrar);

    const outrosDados = /telefone|celular|\bcpf\b|\brg\b|nascimento|endere[cç]o|apelido|g[eê]nero|idade|sobrenome/i;
    expect(screen.queryAllByLabelText(outrosDados)).toHaveLength(0);
    for (const form of Array.from(document.querySelectorAll('form'))) {
      for (const el of camposDeDado(form)) {
        const nome = el.getAttribute('name') ?? '';
        expect(nome, `campo name="${nome}"`).not.toMatch(outrosDados);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// RNF-07 · login pelo teclado
// ---------------------------------------------------------------------------
describe('RNF-07 · TelaEntrar pelo teclado', () => {
  // @req RNF-07 @tipo feliz
  test('test_RNF07_login_so_pelo_teclado_tab_preenche_e_enter_entra', async () => {
    const { user, cliente, aoEntrar } = montar();
    const form = await abrirFormulario(user, ROTULOS_EDITOR.entrar, 'teclado');

    await tabAte(user, campo(form, ROTULOS_EDITOR.email));
    expect(campo(form, ROTULOS_EDITOR.email)).toHaveFocus();
    await user.keyboard(P.email);
    await tabAte(user, campo(form, ROTULOS_EDITOR.senha));
    expect(campo(form, ROTULOS_EDITOR.senha)).toHaveFocus();
    await user.keyboard(P.senha);
    await user.keyboard('{Enter}');

    await waitFor(() => expect(aoEntrar).toHaveBeenCalledTimes(1));
    expect(cliente.entrar).toHaveBeenCalledWith(P.email, P.senha);
  });

  // @req RNF-07 @tipo borda
  test('test_RNF07_cadastro_so_pelo_teclado_tab_preenche_os_tres_campos_e_enter_cadastra', async () => {
    const { user, cliente, aoEntrar } = montar();
    const form = await abrirFormulario(user, ROTULOS_EDITOR.cadastrar, 'teclado');

    for (const [rotulo, valor] of [
      [ROTULOS_EDITOR.nome, P.nome],
      [ROTULOS_EDITOR.email, P.email],
      [ROTULOS_EDITOR.senha, P.senha],
    ] as const) {
      await tabAte(user, campo(form, rotulo));
      expect(campo(form, rotulo), rotulo).toHaveFocus();
      await user.keyboard(valor);
    }
    await user.keyboard('{Enter}');

    await waitFor(() => expect(aoEntrar).toHaveBeenCalledTimes(1));
    expect(cliente.cadastrar).toHaveBeenCalledWith(P.nome, P.email, P.senha);
  });

  // @req RNF-07 @tipo borda
  test('test_RNF07_todos_os_campos_e_botoes_dos_formularios_entram_na_volta_do_tab', async () => {
    const { user } = montar();
    const formularios = Array.from(document.querySelectorAll('form'));
    expect(formularios.length).toBeGreaterThan(0);

    const focados = await primeiraVoltaComTab(user);

    for (const form of formularios) {
      for (const el of [...camposDeDado(form), ...within(form).getAllByRole('button')]) {
        expect(focados, `${el.tagName} ${el.getAttribute('name') ?? el.textContent ?? ''}`).toContain(el);
      }
    }
  });

  // @req RNF-07 @tipo negativo
  test('test_RNF07_so_percorrer_com_tab_nao_envia_nenhum_formulario', async () => {
    const { user, cliente, aoEntrar } = montar();

    await primeiraVoltaComTab(user);

    expect(cliente.entrar).not.toHaveBeenCalled();
    expect(cliente.cadastrar).not.toHaveBeenCalled();
    expect(aoEntrar).not.toHaveBeenCalled();
  });
});
