/**
 * Módulo: PainelPropriedades (apps/editor/contrato/componentes.ts · PropsPainelPropriedades; modulos-editor.md §4;
 * ADR-011, PEND-007).
 * Requisitos:
 * - RF-07: com objeto selecionado, o painel mostra o tipo entre exatamente 4 opções (decoração, fala, enigma, porta);
 *   a decoração não tem campos de comportamento; trocar o tipo aplica uma interação só com os campos do tipo novo;
 * - RF-08: fala grava texto; enigma grava pergunta, uma ou mais respostas numéricas (resposta que não é número é
 *   recusada), dica e zero ou mais dígitos; a senha (da porta e de Propriedades da fase) começa com 5 dígitos, aceita
 *   de 4 a 8 e rejeita 3, 9 ou não dígitos. Sem objeto, o painel é "Propriedades da fase" (título e senha, PEND-007).
 *   Valor inválido mostra o erro e não altera o store (ADR-011).
 *
 * O store é o real (`criarStoreEditor`, contrato público); o painel é montado como na tela de edição: objeto
 * selecionado e título/senha lidos do store a cada mudança. Leituras assumidas, que o contrato não fixa (PEND-017):
 * o tipo é um <select> com o nome ROTULOS_EDITOR.tipo e 4 <option> cujo `value` é o id do tipo; os campos têm
 * <label> ROTULOS_EDITOR.texto / pergunta / respostas (textarea, uma resposta por linha) / dica / senha / titulo;
 * as posições reveladas são caixas de seleção (checkbox) na ordem 1..tamanho da senha; o rascunho é aplicado pelo
 * botão ROTULOS_EDITOR.aplicar; o erro aparece num elemento `role="alert"`.
 * Fases sintéticas de tests/fixtures/fases.ts; ids e textos escritos à mão.
 */
import { PainelPropriedades, criarStoreEditor } from '@math-scape/app-editor';
import { ROTULOS_EDITOR, type StoreEditor } from '@math-scape/app-editor/contrato';
import { faseInicial } from '@math-scape/schema';
import { type Fase, type Objeto, TIPOS_INTERACAO } from '@math-scape/schema/contrato';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useSyncExternalStore } from 'react';
import { describe, expect, test } from 'vitest';
import { decoracao, enigma, fala, fase, porta } from '../fixtures/fases.ts';

type Usuario = ReturnType<typeof userEvent.setup>;

function acharObjeto(documento: Fase, id: string | null): Objeto | null {
  if (id === null) return null;
  for (const parede of Object.values(documento.paredes)) {
    const encontrado = parede.objetos.find((o) => o.id === id);
    if (encontrado) return encontrado;
  }
  return null;
}

/** Painel ligado ao store, como na tela de edição. */
function PainelLigado({ store }: { store: StoreEditor }) {
  const estado = useSyncExternalStore(store.subscribe, store.getState);
  const { titulo, senha } = estado.documento;
  return (
    <PainelPropriedades
      objeto={acharObjeto(estado.documento, estado.selecionado)}
      fase={{ titulo, senha }}
      store={store}
    />
  );
}

function montar(documento: Fase, selecionado: string | null = null) {
  const store = criarStoreEditor(documento);
  if (selecionado !== null) store.getState().selecionar(selecionado);
  render(<PainelLigado store={store} />);
  return store;
}

function objetoNoStore(store: StoreEditor, id: string): Objeto {
  const encontrado = acharObjeto(store.getState().documento, id);
  if (!encontrado) throw new Error(`Objeto ${id} não está no documento.`);
  return encontrado;
}

function seletorTipo(): HTMLSelectElement {
  return screen.getByRole('combobox', { name: ROTULOS_EDITOR.tipo }) as HTMLSelectElement;
}

function campo(rotulo: string): HTMLInputElement {
  return screen.getByLabelText(rotulo) as HTMLInputElement;
}

async function substituir(user: Usuario, rotulo: string, valor: string): Promise<void> {
  await user.clear(campo(rotulo));
  if (valor !== '') await user.type(campo(rotulo), valor);
}

async function aplicar(user: Usuario): Promise<void> {
  await user.click(screen.getByRole('button', { name: ROTULOS_EDITOR.aplicar }));
}

/** Recusa: o painel mostra um erro e o documento do store fica igual, sem passo de histórico. */
function esperarRecusa(store: StoreEditor, antes: Fase): void {
  const alerta = screen.getByRole('alert');
  expect(alerta.textContent?.trim().length ?? 0).toBeGreaterThan(0);
  expect(store.getState().documento).toEqual(antes);
  expect(store.getState().podeDesfazer()).toBe(false);
}

// ---------------------------------------------------------------------------
// RF-07 · tipo do objeto
// ---------------------------------------------------------------------------
describe('RF-07 · tipo do objeto no painel', () => {
  // @req RF-07 @tipo feliz
  test('test_RF07_objeto_selecionado_mostra_o_tipo_atual_entre_exatamente_4_opcoes', () => {
    montar(fase('12345', { direita: [fala('fala-1', 'Você: a porta rangeu.')] }), 'fala-1');

    const seletor = seletorTipo();
    expect(seletor).toHaveValue('fala');
    const valores = within(seletor)
      .getAllByRole('option')
      .map((opcao) => (opcao as HTMLOptionElement).value);
    expect([...valores].sort()).toEqual([...TIPOS_INTERACAO].sort());
  });

  // @req RF-07 @tipo feliz
  test('test_RF07_trocar_decoracao_para_fala_com_texto_aplica_no_documento', async () => {
    const user = userEvent.setup();
    const store = montar(fase('12345', { frente: [decoracao('deco-1')] }), 'deco-1');

    await user.selectOptions(seletorTipo(), 'fala');
    await substituir(user, ROTULOS_EDITOR.texto, 'Você: tem algo escrito atrás do quadro.');
    await aplicar(user);

    expect(objetoNoStore(store, 'deco-1').interacao).toEqual({
      tipo: 'fala',
      texto: 'Você: tem algo escrito atrás do quadro.',
    });
  });

  // @req RF-07 @tipo borda
  test('test_RF07_decoracao_nao_mostra_campos_de_comportamento', () => {
    montar(fase('12345', { frente: [decoracao('deco-1')] }), 'deco-1');

    expect(seletorTipo()).toHaveValue('decoracao');
    for (const rotulo of [
      ROTULOS_EDITOR.texto,
      ROTULOS_EDITOR.pergunta,
      ROTULOS_EDITOR.respostas,
      ROTULOS_EDITOR.dica,
      ROTULOS_EDITOR.senha,
    ]) {
      expect(screen.queryByLabelText(rotulo), rotulo).toBeNull();
    }
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
  });

  // @req RF-07 @tipo negativo
  test('test_RF07_trocar_fala_para_decoracao_nao_leva_o_texto_junto', async () => {
    const user = userEvent.setup();
    const store = montar(fase('12345', { direita: [fala('fala-1', 'Você: a porta rangeu.')] }), 'fala-1');

    await user.selectOptions(seletorTipo(), 'decoracao');
    await aplicar(user);

    expect(objetoNoStore(store, 'fala-1').interacao).toEqual({ tipo: 'decoracao' });
  });

  // @req RF-07 @tipo negativo
  test('test_RF07_sem_objeto_selecionado_nao_ha_seletor_de_tipo', () => {
    montar(fase('12345', { frente: [decoracao('deco-1')] }));

    expect(screen.queryByRole('combobox', { name: ROTULOS_EDITOR.tipo })).toBeNull();
    expect(screen.getByText(ROTULOS_EDITOR.propriedadesDaFase)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// RF-08 · fala e enigma
// ---------------------------------------------------------------------------
describe('RF-08 · campos de fala e enigma', () => {
  // @req RF-08 @tipo feliz
  test('test_RF08_fala_grava_o_texto_digitado', async () => {
    const user = userEvent.setup();
    const store = montar(fase('12345', { direita: [fala('fala-1', 'Você: a porta rangeu.')] }), 'fala-1');
    expect(campo(ROTULOS_EDITOR.texto)).toHaveValue('Você: a porta rangeu.');

    await substituir(user, ROTULOS_EDITOR.texto, 'Você: o relógio parou às três.');
    await aplicar(user);

    expect(objetoNoStore(store, 'fala-1').interacao).toEqual({ tipo: 'fala', texto: 'Você: o relógio parou às três.' });
  });

  // @req RF-08 @tipo feliz
  test('test_RF08_enigma_grava_pergunta_varias_respostas_numericas_e_dica', async () => {
    const user = userEvent.setup();
    const store = montar(fase('12345', { fundo: [enigma('enigma-1', [])] }), 'enigma-1');

    await substituir(user, ROTULOS_EDITOR.pergunta, 'Quanto é 7 x 8 menos 1?');
    await user.clear(campo(ROTULOS_EDITOR.respostas));
    await user.type(campo(ROTULOS_EDITOR.respostas), '55{Enter}-15{Enter}80');
    await substituir(user, ROTULOS_EDITOR.dica, 'Faça a multiplicação primeiro.');
    await aplicar(user);

    expect(objetoNoStore(store, 'enigma-1').interacao).toEqual({
      tipo: 'enigma',
      pergunta: 'Quanto é 7 x 8 menos 1?',
      respostas: [55, -15, 80],
      dica: 'Faça a multiplicação primeiro.',
      revela: [],
    });
  });

  // @req RF-08 @tipo borda
  test('test_RF08_enigma_com_uma_unica_resposta_e_sem_digito_revelado_e_aceito', async () => {
    const user = userEvent.setup();
    const store = montar(fase('12345', { frente: [decoracao('deco-1')] }), 'deco-1');

    await user.selectOptions(seletorTipo(), 'enigma');
    await substituir(user, ROTULOS_EDITOR.pergunta, 'Quanto é 81 dividido por 9?');
    await substituir(user, ROTULOS_EDITOR.respostas, '9');
    for (const caixa of screen.getAllByRole('checkbox')) {
      if ((caixa as HTMLInputElement).checked) await user.click(caixa);
    }
    await aplicar(user);

    const interacao = objetoNoStore(store, 'deco-1').interacao;
    expect(interacao).toMatchObject({ tipo: 'enigma', pergunta: 'Quanto é 81 dividido por 9?', respostas: [9], revela: [] });
  });

  // @req RF-08 @tipo borda
  test('test_RF08_posicoes_reveladas_vao_de_1_ao_tamanho_da_senha', async () => {
    const user = userEvent.setup();
    const store = montar(fase('12345', { fundo: [enigma('enigma-1', [])] }), 'enigma-1');

    const caixas = screen.getAllByRole('checkbox');
    expect(caixas).toHaveLength(5);
    await user.click(caixas[0] as HTMLElement);
    await user.click(caixas[4] as HTMLElement);
    await aplicar(user);

    const interacao = objetoNoStore(store, 'enigma-1').interacao;
    expect(interacao.tipo).toBe('enigma');
    expect(interacao.tipo === 'enigma' ? [...interacao.revela].sort() : []).toEqual([1, 5]);
  });

  // @req RF-08 @tipo negativo
  test('test_RF08_resposta_que_nao_e_numero_mostra_erro_e_nao_altera_o_documento', async () => {
    const user = userEvent.setup();
    const documento = fase('12345', { fundo: [enigma('enigma-1', [], [10])] });
    const store = montar(structuredClone(documento), 'enigma-1');

    await substituir(user, ROTULOS_EDITOR.respostas, 'dez');
    await aplicar(user);

    esperarRecusa(store, documento);
  });

  // @req RF-08 @tipo negativo
  test('test_RF08_enigma_sem_nenhuma_resposta_mostra_erro_e_nao_altera_o_documento', async () => {
    const user = userEvent.setup();
    const documento = fase('12345', { fundo: [enigma('enigma-1', [], [10])] });
    const store = montar(structuredClone(documento), 'enigma-1');

    await substituir(user, ROTULOS_EDITOR.respostas, '');
    await aplicar(user);

    esperarRecusa(store, documento);
  });
});

// ---------------------------------------------------------------------------
// RF-08 · senha (porta e Propriedades da fase)
// ---------------------------------------------------------------------------
describe('RF-08 · senha da fase', () => {
  // @req RF-08 @tipo borda
  test('test_RF08_porta_da_fase_inicial_mostra_a_senha_de_5_digitos', () => {
    const documento = faseInicial('Fase sintética do painel');
    montar(documento, 'porta-1');

    expect(seletorTipo()).toHaveValue('porta');
    const senha = campo(ROTULOS_EDITOR.senha);
    expect(senha.value).toMatch(/^\d{5}$/);
    expect(senha).toHaveValue(documento.senha);
  });

  // @req RF-08 @tipo feliz
  test('test_RF08_senha_editada_pela_porta_altera_a_senha_da_fase', async () => {
    const user = userEvent.setup();
    const store = montar(fase('12345', { frente: [porta('porta-1')] }), 'porta-1');

    await substituir(user, ROTULOS_EDITOR.senha, '246813');
    await aplicar(user);

    expect(store.getState().documento.senha).toBe('246813');
  });

  // @req RF-08 @tipo feliz
  test('test_RF08_sem_selecao_propriedades_da_fase_mostra_titulo_e_senha_atuais', () => {
    const documento = fase('92139', { frente: [porta('porta-1')] });
    montar(documento);

    expect(screen.getByText(ROTULOS_EDITOR.propriedadesDaFase)).toBeInTheDocument();
    expect(campo(ROTULOS_EDITOR.titulo)).toHaveValue(documento.titulo);
    expect(campo(ROTULOS_EDITOR.senha)).toHaveValue('92139');
  });

  // @req RF-08 @tipo borda
  test('test_RF08_senha_de_4_e_de_8_digitos_e_aceita_em_propriedades_da_fase', async () => {
    const user = userEvent.setup();
    const store = montar(fase('12345'));

    await substituir(user, ROTULOS_EDITOR.senha, '4071');
    await aplicar(user);
    expect(store.getState().documento.senha).toBe('4071');

    await substituir(user, ROTULOS_EDITOR.senha, '80604020');
    await aplicar(user);
    expect(store.getState().documento.senha).toBe('80604020');
  });

  // @req RF-08 @tipo negativo
  test('test_RF08_senha_de_3_digitos_mostra_erro_e_nao_altera_a_senha', async () => {
    const user = userEvent.setup();
    const documento = fase('12345');
    const store = montar(structuredClone(documento));

    await substituir(user, ROTULOS_EDITOR.senha, '123');
    await aplicar(user);

    esperarRecusa(store, documento);
  });

  // @req RF-08 @tipo negativo
  test('test_RF08_senha_de_9_digitos_nunca_chega_ao_documento', async () => {
    const user = userEvent.setup();
    const store = montar(fase('12345'));

    await substituir(user, ROTULOS_EDITOR.senha, '123456789');
    await aplicar(user);

    const senha = store.getState().documento.senha;
    expect(senha).not.toBe('123456789');
    expect(senha).toMatch(/^\d{4,8}$/);
    // Se o campo aceitou os 9 dígitos, a recusa tem de aparecer e a senha fica a anterior.
    if (campo(ROTULOS_EDITOR.senha).value === '123456789') {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(senha).toBe('12345');
    }
  });

  // @req RF-08 @tipo negativo
  test('test_RF08_senha_com_caractere_que_nao_e_digito_nunca_chega_ao_documento', async () => {
    const user = userEvent.setup();
    const store = montar(fase('12345'));

    await substituir(user, ROTULOS_EDITOR.senha, '12a45');
    await aplicar(user);

    const senha = store.getState().documento.senha;
    expect(senha).toMatch(/^\d{4,8}$/);
    // Se o campo aceitou a letra, a recusa tem de aparecer e a senha fica a anterior.
    if (/\D/.test(campo(ROTULOS_EDITOR.senha).value)) {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(senha).toBe('12345');
    }
  });

  // @req RF-08 @tipo negativo
  test('test_RF08_encurtar_a_senha_com_enigma_na_ultima_posicao_mostra_erro_e_mantem_a_senha', async () => {
    const user = userEvent.setup();
    const documento = fase('12345', { fundo: [enigma('enigma-ultimo', [5])] });
    const store = montar(structuredClone(documento));

    await substituir(user, ROTULOS_EDITOR.senha, '1234');
    await aplicar(user);

    esperarRecusa(store, documento);
  });
});
