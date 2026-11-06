/**
 * Módulo: MinhasFases (apps/editor/contrato/telas.ts · PropsMinhasFases; modulos-editor.md §5).
 * Requisitos:
 * - RF-02: lista as fases do criador (`listarFases` ao montar); criar, abrir, renomear, duplicar e
 *   excluir refletem na lista (depois de cada ação aceita a lista é lida de novo); excluir fase
 *   publicada pede confirmação no diálogo role="alertdialog" (Cancelar não muda nada, Confirmar
 *   chama `excluirFase`); Ctrl+Z não restaura fase excluída; recusa da Api em role="alert";
 * - RF-14: importar envia o arquivo escolhido por `importarFase`, sem alterá-lo; a recusa da Api
 *   (arquivo fora do schema) aparece em role="alert".
 *
 * Leituras assumidas, que o contrato não fixa (PEND-018):
 * - cada fase mostra o título num elemento próprio (texto exato) e, no mesmo item, os botões
 *   ROTULOS_EDITOR.abrir / renomear / duplicar / excluir; fase publicada mostra o texto
 *   ROTULOS_EDITOR.publicada dentro do item;
 * - ROTULOS_EDITOR.novaFase e ROTULOS_EDITOR.renomear abrem (ou focam) um único campo rotulado
 *   ROTULOS_EDITOR.titulo, confirmado com Enter (envio do formulário);
 * - importar é um <input type="file"> com nome acessível ROTULOS_EDITOR.importar;
 * - excluir fase não publicada: o critério não diz se pede confirmação; os testes aceitam os dois casos.
 */
import { MinhasFases } from '@math-scape/app-editor';
import { ROTULOS_EDITOR } from '@math-scape/app-editor/contrato';
import type { ResumoFase } from '@math-scape/schema/contrato';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { documentoJogavel, envelope } from '../fixtures/fases-api.ts';
import {
  ERRO_REDE,
  criarClienteTelasFalso,
  lerTexto,
  recusa,
  resumosSinteticos,
  textosDosAlertas,
} from '../support/cliente-editor-falso.ts';

type Usuario = ReturnType<typeof userEvent.setup>;

const SEMENTE = 2026;

/** Três fases do criador: [rascunho, publicada, outro rascunho]. */
function fasesDoCriador(): [ResumoFase, ResumoFase, ResumoFase] {
  const [a, b, c] = resumosSinteticos(SEMENTE, 3) as [ResumoFase, ResumoFase, ResumoFase];
  return [a, { ...b, publicada: true }, c];
}

async function montar(fases: ResumoFase[]) {
  const user = userEvent.setup();
  const cliente = criarClienteTelasFalso({ fases });
  const aoAbrir = vi.fn<(faseId: string) => void>();
  render(<MinhasFases cliente={cliente} aoAbrir={aoAbrir} />);
  await waitFor(() => expect(cliente.listarFases).toHaveBeenCalled());
  if (fases.length > 0) await screen.findAllByText(fases[0]?.titulo ?? '');
  return { user, cliente, aoAbrir };
}

function botoesAbrir(): HTMLElement[] {
  return screen.queryAllByRole('button', { name: ROTULOS_EDITOR.abrir });
}

/** O menor ancestral do título que tem o botão Abrir: o item da fase na lista. */
function itemDaFase(titulo: string): HTMLElement {
  let el: HTMLElement | null = screen.getByText(titulo);
  while (el && !within(el).queryByRole('button', { name: ROTULOS_EDITOR.abrir })) el = el.parentElement;
  if (!el) throw new Error(`a fase "${titulo}" não tem o botão "${ROTULOS_EDITOR.abrir}" no item`);
  return el;
}

function botaoDoItem(titulo: string, nome: string): HTMLElement {
  return within(itemDaFase(titulo)).getByRole('button', { name: nome });
}

async function digitarTitulo(user: Usuario, titulo: string): Promise<void> {
  const campo = await screen.findByLabelText(ROTULOS_EDITOR.titulo);
  await user.clear(campo);
  await user.type(campo, `${titulo}{Enter}`);
}

async function criarPelaTela(user: Usuario, titulo: string): Promise<void> {
  await user.click(screen.getByRole('button', { name: ROTULOS_EDITOR.novaFase }));
  await digitarTitulo(user, titulo);
}

/** Clica em Excluir; se a tela pedir confirmação, confirma. */
async function excluirConfirmandoSePedir(user: Usuario, titulo: string): Promise<void> {
  await user.click(botaoDoItem(titulo, ROTULOS_EDITOR.excluir));
  const dialogo = screen.queryByRole('alertdialog');
  if (dialogo) await user.click(within(dialogo).getByRole('button', { name: ROTULOS_EDITOR.confirmar }));
}

async function esperarAlertaCom(texto: string): Promise<void> {
  await waitFor(() => expect(textosDosAlertas().join(' | ')).toContain(texto));
}

function campoImportar(): HTMLElement {
  return screen.getByLabelText(ROTULOS_EDITOR.importar);
}

function arquivoJson(conteudo: string, nome = 'fase-sintetica.json'): File {
  return new File([conteudo], nome, { type: 'application/json' });
}

// ---------------------------------------------------------------------------
// RF-02 · lista, criar, abrir, renomear, duplicar
// ---------------------------------------------------------------------------
describe('RF-02 · MinhasFases lista e ações', () => {
  // @req RF-02 @tipo feliz
  test('test_RF02_lista_as_fases_do_criador_lidas_de_listarFases', async () => {
    const fases = fasesDoCriador();
    const { cliente } = await montar(fases);

    for (const f of fases) expect(screen.getByText(f.titulo)).toBeInTheDocument();
    expect(botoesAbrir()).toHaveLength(fases.length);
    expect(cliente.listarFases).toHaveBeenCalledTimes(1);
  });

  // @req RF-02 @tipo feliz
  test('test_RF02_abrir_chama_aoAbrir_com_o_id_da_fase', async () => {
    const fases = fasesDoCriador();
    const { user, aoAbrir } = await montar(fases);

    await user.click(botaoDoItem(fases[2].titulo, ROTULOS_EDITOR.abrir));

    expect(aoAbrir).toHaveBeenCalledTimes(1);
    expect(aoAbrir).toHaveBeenCalledWith(fases[2].id);
  });

  // @req RF-02 @tipo feliz
  test('test_RF02_criar_fase_envia_o_titulo_e_a_lista_relida_mostra_a_nova_fase', async () => {
    const fases = fasesDoCriador();
    const { user, cliente } = await montar(fases);
    const titulo = 'Torre dos decimais';

    await criarPelaTela(user, titulo);

    expect(await screen.findByText(titulo)).toBeInTheDocument();
    expect(cliente.criarFase).toHaveBeenCalledTimes(1);
    expect(cliente.criarFase).toHaveBeenCalledWith(titulo);
    expect(cliente.listarFases.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(botoesAbrir()).toHaveLength(fases.length + 1);
  });

  // @req RF-02 @tipo feliz
  test('test_RF02_renomear_envia_o_novo_titulo_e_a_lista_mostra_so_o_novo', async () => {
    const fases = fasesDoCriador();
    const { user, cliente } = await montar(fases);
    const novo = 'Porão das equações';

    await user.click(botaoDoItem(fases[0].titulo, ROTULOS_EDITOR.renomear));
    await digitarTitulo(user, novo);

    expect(await screen.findByText(novo)).toBeInTheDocument();
    expect(cliente.renomearFase).toHaveBeenCalledWith(fases[0].id, novo);
    expect(screen.queryByText(fases[0].titulo)).toBeNull();
    expect(cliente.listarFases.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  // @req RF-02 @tipo feliz
  test('test_RF02_duplicar_chama_duplicarFase_e_a_copia_aparece_na_lista', async () => {
    const fases = fasesDoCriador();
    const { user, cliente } = await montar(fases);

    await user.click(botaoDoItem(fases[1].titulo, ROTULOS_EDITOR.duplicar));

    expect(await screen.findByText(`${fases[1].titulo} (cópia)`)).toBeInTheDocument();
    expect(cliente.duplicarFase).toHaveBeenCalledWith(fases[1].id);
    expect(screen.getByText(fases[1].titulo)).toBeInTheDocument();
    expect(botoesAbrir()).toHaveLength(fases.length + 1);
  });

  // @req RF-02 @tipo feliz
  test('test_RF02_excluir_fase_nao_publicada_tira_a_fase_da_lista', async () => {
    const fases = fasesDoCriador();
    const { user, cliente } = await montar(fases);

    await excluirConfirmandoSePedir(user, fases[0].titulo);

    await waitFor(() => expect(screen.queryByText(fases[0].titulo)).toBeNull());
    expect(cliente.excluirFase).toHaveBeenCalledTimes(1);
    expect(cliente.excluirFase).toHaveBeenCalledWith(fases[0].id);
    expect(botoesAbrir()).toHaveLength(fases.length - 1);
  });

  // @req RF-02 @tipo borda
  test('test_RF02_lista_vazia_nao_tem_fase_e_criar_a_primeira_mostra_uma_fase', async () => {
    const { user, cliente } = await montar([]);
    await waitFor(() => expect(cliente.listarFases).toHaveBeenCalledTimes(1));
    expect(botoesAbrir()).toHaveLength(0);

    await criarPelaTela(user, 'Primeira sala');

    expect(await screen.findByText('Primeira sala')).toBeInTheDocument();
    expect(botoesAbrir()).toHaveLength(1);
  });

  // @req RF-02 @tipo borda
  test('test_RF02_so_a_fase_publicada_tem_a_marca_publicada', async () => {
    const fases = fasesDoCriador();
    await montar(fases);

    expect(within(itemDaFase(fases[1].titulo)).getByText(ROTULOS_EDITOR.publicada)).toBeInTheDocument();
    expect(within(itemDaFase(fases[0].titulo)).queryByText(ROTULOS_EDITOR.publicada)).toBeNull();
    expect(within(itemDaFase(fases[2].titulo)).queryByText(ROTULOS_EDITOR.publicada)).toBeNull();
  });

  // @req RF-02 @tipo borda
  test('test_RF02_fases_com_o_mesmo_titulo_abrem_cada_uma_pelo_seu_id', async () => {
    const [a, b] = resumosSinteticos(SEMENTE + 1, 2) as [ResumoFase, ResumoFase];
    const gemeas = [a, { ...b, titulo: a.titulo }];
    const { user, aoAbrir } = await montar(gemeas);

    const botoes = botoesAbrir();
    expect(botoes).toHaveLength(2);
    for (const botao of botoes) await user.click(botao);

    expect(aoAbrir).toHaveBeenCalledTimes(2);
    expect(aoAbrir.mock.calls.map(([id]) => id).sort()).toEqual([a.id, b.id].sort());
  });

  // @req RF-02 @tipo negativo
  test('test_RF02_renomear_recusado_mostra_o_erro_e_o_titulo_antigo_continua', async () => {
    const fases = fasesDoCriador();
    const { user, cliente } = await montar(fases);
    const erro = 'Fase não encontrada.';
    cliente.renomearFase.mockResolvedValueOnce(recusa(404, erro));

    await user.click(botaoDoItem(fases[2].titulo, ROTULOS_EDITOR.renomear));
    await digitarTitulo(user, 'Título que não pegou');

    await esperarAlertaCom(erro);
    expect(screen.getByText(fases[2].titulo)).toBeInTheDocument();
    expect(screen.queryByText('Título que não pegou')).toBeNull();
  });

  // @req RF-02 @tipo negativo
  test('test_RF02_criar_recusado_mostra_o_erro_e_nenhuma_fase_nova_aparece', async () => {
    const fases = fasesDoCriador();
    const { user, cliente } = await montar(fases);
    const erro = 'Não foi possível criar a fase.';
    cliente.criarFase.mockResolvedValueOnce(recusa(400, erro));

    await criarPelaTela(user, 'Sala recusada');

    await esperarAlertaCom(erro);
    expect(screen.queryByText('Sala recusada')).toBeNull();
    expect(botoesAbrir()).toHaveLength(fases.length);
  });

  // @req RF-02 @tipo negativo
  test('test_RF02_falha_ao_listar_mostra_o_erro_e_nenhuma_fase', async () => {
    const cliente = criarClienteTelasFalso({ fases: fasesDoCriador() });
    cliente.listarFases.mockResolvedValue(recusa(0, ERRO_REDE));
    const aoAbrir = vi.fn<(faseId: string) => void>();
    render(<MinhasFases cliente={cliente} aoAbrir={aoAbrir} />);

    await esperarAlertaCom(ERRO_REDE);
    expect(botoesAbrir()).toHaveLength(0);
    expect(aoAbrir).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// RF-02 · excluir fase publicada pede confirmação
// ---------------------------------------------------------------------------
describe('RF-02 · exclusão de fase publicada', () => {
  // @req RF-02 @tipo borda
  test('test_RF02_excluir_publicada_abre_o_dialogo_e_ainda_nao_chama_a_api', async () => {
    const fases = fasesDoCriador();
    const { user, cliente } = await montar(fases);

    await user.click(botaoDoItem(fases[1].titulo, ROTULOS_EDITOR.excluir));

    const dialogo = await screen.findByRole('alertdialog');
    expect(within(dialogo).getByRole('button', { name: ROTULOS_EDITOR.confirmar })).toBeInTheDocument();
    expect(within(dialogo).getByRole('button', { name: ROTULOS_EDITOR.cancelar })).toBeInTheDocument();
    expect(cliente.excluirFase).not.toHaveBeenCalled();
  });

  // @req RF-02 @tipo borda
  test('test_RF02_confirmar_exclusao_da_publicada_chama_excluirFase_e_ela_sai_da_lista', async () => {
    const fases = fasesDoCriador();
    const { user, cliente } = await montar(fases);

    await user.click(botaoDoItem(fases[1].titulo, ROTULOS_EDITOR.excluir));
    const dialogo = await screen.findByRole('alertdialog');
    await user.click(within(dialogo).getByRole('button', { name: ROTULOS_EDITOR.confirmar }));

    await waitFor(() => expect(screen.queryByText(fases[1].titulo)).toBeNull());
    expect(cliente.excluirFase).toHaveBeenCalledTimes(1);
    expect(cliente.excluirFase).toHaveBeenCalledWith(fases[1].id);
    expect(cliente.listarFases.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  // @req RF-02 @tipo negativo
  test('test_RF02_cancelar_exclusao_da_publicada_nao_chama_a_api_e_nada_muda', async () => {
    const fases = fasesDoCriador();
    const { user, cliente } = await montar(fases);

    await user.click(botaoDoItem(fases[1].titulo, ROTULOS_EDITOR.excluir));
    const dialogo = await screen.findByRole('alertdialog');
    await user.click(within(dialogo).getByRole('button', { name: ROTULOS_EDITOR.cancelar }));

    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(cliente.excluirFase).not.toHaveBeenCalled();
    for (const f of fases) expect(screen.getByText(f.titulo)).toBeInTheDocument();
    expect(botoesAbrir()).toHaveLength(fases.length);
  });

  // @req RF-02 @tipo negativo
  test('test_RF02_ctrl_z_nao_restaura_fase_excluida', async () => {
    const fases = fasesDoCriador();
    const { user, cliente } = await montar(fases);

    await user.click(botaoDoItem(fases[1].titulo, ROTULOS_EDITOR.excluir));
    const dialogo = await screen.findByRole('alertdialog');
    await user.click(within(dialogo).getByRole('button', { name: ROTULOS_EDITOR.confirmar }));
    await waitFor(() => expect(screen.queryByText(fases[1].titulo)).toBeNull());

    await user.keyboard('{Control>}z{/Control}');

    await waitFor(() => expect(cliente.listarFases.mock.calls.length).toBeGreaterThanOrEqual(2));
    expect(screen.queryByText(fases[1].titulo)).toBeNull();
    expect(cliente.criarFase).not.toHaveBeenCalled();
    expect(cliente.duplicarFase).not.toHaveBeenCalled();
    expect(cliente.importarFase).not.toHaveBeenCalled();
    expect(cliente.fases.map((f) => f.id)).not.toContain(fases[1].id);
  });

  // @req RF-02 @tipo negativo
  test('test_RF02_exclusao_recusada_pela_api_mostra_o_erro_e_a_fase_continua_na_lista', async () => {
    const fases = fasesDoCriador();
    const { user, cliente } = await montar(fases);
    const erro = 'Fase não encontrada.';
    cliente.excluirFase.mockResolvedValueOnce(recusa(404, erro));

    await excluirConfirmandoSePedir(user, fases[0].titulo);

    await esperarAlertaCom(erro);
    expect(screen.getByText(fases[0].titulo)).toBeInTheDocument();
    expect(botoesAbrir()).toHaveLength(fases.length);
  });
});

// ---------------------------------------------------------------------------
// RF-14 · importar fase
// ---------------------------------------------------------------------------
describe('RF-14 · importar em MinhasFases', () => {
  // @req RF-14 @tipo feliz
  test('test_RF14_importar_envia_o_arquivo_e_a_lista_relida_mostra_a_fase_importada', async () => {
    const fases = fasesDoCriador();
    const { user, cliente } = await montar(fases);
    const arquivo = arquivoJson(JSON.stringify(envelope(documentoJogavel('Sala importada'))));

    await user.upload(campoImportar(), arquivo);

    expect(await screen.findByText('Fase importada 1')).toBeInTheDocument();
    expect(cliente.importarFase).toHaveBeenCalledTimes(1);
    expect(cliente.listarFases.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(botoesAbrir()).toHaveLength(fases.length + 1);
  });

  // @req RF-14 @tipo borda
  test('test_RF14_arquivo_importado_vai_a_api_sem_nenhuma_alteracao', async () => {
    const { user, cliente } = await montar(fasesDoCriador());
    const conteudo = JSON.stringify(envelope(documentoJogavel('Sala com acentuação: ção, ã, é')), null, 2);
    const arquivo = arquivoJson(conteudo);

    await user.upload(campoImportar(), arquivo);

    await waitFor(() => expect(cliente.importarFase).toHaveBeenCalledTimes(1));
    const enviado = cliente.importarFase.mock.calls[0]?.[0];
    expect(enviado).toBeInstanceOf(Blob);
    expect(await lerTexto(enviado as Blob)).toBe(conteudo);
  });

  // @req RF-14 @tipo borda
  test('test_RF14_arquivo_vazio_e_recusado_e_nenhuma_fase_nova_aparece', async () => {
    const fases = fasesDoCriador();
    const { user, cliente } = await montar(fases);
    cliente.importarFase.mockResolvedValueOnce(recusa(400, 'O arquivo não é uma fase válida.'));

    await user.upload(campoImportar(), arquivoJson('', 'vazia.json'));

    await waitFor(() => expect(textosDosAlertas().join('').trim()).not.toBe(''));
    expect(screen.queryByText('Fase importada 1')).toBeNull();
    expect(botoesAbrir()).toHaveLength(fases.length);
  });

  // @req RF-14 @tipo negativo
  test('test_RF14_arquivo_fora_do_schema_recusado_mostra_o_erro_da_api_e_a_lista_nao_muda', async () => {
    const fases = fasesDoCriador();
    const { user, cliente, aoAbrir } = await montar(fases);
    const erro = 'O arquivo não é uma fase válida.';
    cliente.importarFase.mockResolvedValueOnce(recusa(400, erro));
    const foraDoSchema = arquivoJson(JSON.stringify({ formato: 'math-scape-fase', versao: 1, fase: { titulo: 'sem paredes' } }));

    await user.upload(campoImportar(), foraDoSchema);

    await esperarAlertaCom(erro);
    expect(cliente.importarFase).toHaveBeenCalledTimes(1);
    expect(botoesAbrir()).toHaveLength(fases.length);
    expect(aoAbrir).not.toHaveBeenCalled();
  });
});
