/**
 * Módulo: BibliotecaObjetos (apps/editor/contrato/componentes.ts · PropsBibliotecaObjetos; modulos-editor.md §4;
 * LAC-029, ADR-012).
 * Requisitos:
 * - RF-04: a biblioteca contém porta, quadro, janela, relógio e os objetos da fase original (giz, selo, árvore...),
 *   e escolher um deles (Enter ou clique) o põe na parede ativa como objeto: `aoEscolher('sprite:<id>', 'objeto')`.
 *   Arraste (LAC-045): cada botão de Objetos é draggable e o dragstart grava `sprite:<id>` com o tipo
 *   TIPO_ARRASTE_BIBLIOTECA; o arraste não chama `aoEscolher` (quem recebe é o CanvasParede);
 * - RF-06: imagem enviada pode ser usada como objeto ou como fundo (`aoEscolher('asset:<uuid>', destino)`); enviar
 *   entrega o arquivo a `aoEnviarImagem` (POST /assets); a imagem só entra em "Minhas imagens" quando a Api aceita
 *   (o pai acrescenta a `imagensEnviadas`). A mensagem de recusa da Api é mostrada pela tela de edição (rodada B2).
 *
 * Catálogo real de @math-scape/schema (CATALOGO). Leituras assumidas, que o contrato não fixa (PEND-017):
 * cada seção é uma região (`role="region"`) com o nome ROTULOS_EDITOR.objetos / fundos / minhasImagens; cada sprite
 * é um <button> com o `nome` do catálogo; "Sem fundo" é botão da seção Fundos; em Minhas imagens há um par de botões
 * usarComoObjeto / usarComoFundo por imagem, na ordem de `imagensEnviadas`; o envio é um <input type="file"> com o
 * nome acessível ROTULOS_EDITOR.enviarImagem.
 * Arquivos sintéticos: assinatura do tipo seguida de zeros, sem aleatoriedade; uuids escritos à mão.
 */
import { BibliotecaObjetos } from '@math-scape/app-editor';
import { ROTULOS_EDITOR, TIPO_ARRASTE_BIBLIOTECA } from '@math-scape/app-editor/contrato';
import { LIMITES_CORPO } from '@math-scape/api/contrato';
import { CATALOGO, type RefImagem } from '@math-scape/schema/contrato';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { criarDataTransfer, dispararArraste } from '../support/arraste.ts';

type AoEscolher = (ref: RefImagem | null, destino: 'objeto' | 'fundo') => void;
type AoEnviarImagem = (arquivo: File) => void;

const OBJETOS = CATALOGO.filter((sprite) => sprite.categoria === 'objeto');
const FUNDOS = CATALOGO.filter((sprite) => sprite.categoria === 'fundo');

const UUID_1 = '0f8b6c1e-2a3d-4b5c-8d9e-1a2b3c4d5e6f';
const UUID_2 = '7c1d2e3f-4a5b-4c6d-9e8f-0a1b2c3d4e5f';
const ASSET_1: RefImagem = `asset:${UUID_1}`;
const ASSET_2: RefImagem = `asset:${UUID_2}`;

/** Bytes iniciais de cada formato aceito (o resto do arquivo é zero). */
const ASSINATURAS = {
  'image/png': [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  'image/jpeg': [0xff, 0xd8, 0xff, 0xe0],
  'image/webp': [0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50],
} as const;
const EXTENSOES = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' } as const;

function arquivoSintetico(tipo: keyof typeof ASSINATURAS, tamanho = 64): File {
  const bytes = new Uint8Array(Math.max(tamanho, ASSINATURAS[tipo].length));
  bytes.set(ASSINATURAS[tipo]);
  return new File([bytes], `imagem-sintetica.${EXTENSOES[tipo]}`, { type: tipo });
}

function montar(imagensEnviadas: RefImagem[] = []) {
  const aoEscolher = vi.fn<AoEscolher>();
  const aoEnviarImagem = vi.fn<AoEnviarImagem>();
  render(
    <BibliotecaObjetos
      catalogo={CATALOGO}
      imagensEnviadas={imagensEnviadas}
      aoEscolher={aoEscolher}
      aoEnviarImagem={aoEnviarImagem}
    />,
  );
  return { aoEscolher, aoEnviarImagem };
}

function secao(nome: string): HTMLElement {
  return screen.getByRole('region', { name: nome });
}

function campoEnviar(): HTMLInputElement {
  return screen.getByLabelText(ROTULOS_EDITOR.enviarImagem) as HTMLInputElement;
}

// ---------------------------------------------------------------------------
// RF-04 · objetos do catálogo
// ---------------------------------------------------------------------------
describe('RF-04 · seção Objetos', () => {
  // @req RF-04 @tipo feliz
  test('test_RF04_secao_objetos_lista_porta_quadro_janela_relogio_e_os_objetos_da_escola', () => {
    montar();
    const objetos = secao(ROTULOS_EDITOR.objetos);
    const ids = OBJETOS.map((sprite) => sprite.id);
    expect(ids).toEqual(
      expect.arrayContaining(['porta', 'quadro', 'janela', 'relogio', 'giz', 'selo-magico', 'arvore']),
    );

    for (const sprite of OBJETOS) {
      expect(within(objetos).getByRole('button', { name: sprite.nome }), sprite.id).toBeInTheDocument();
    }
  });

  // @req RF-04 @tipo feliz
  test('test_RF04_enter_num_objeto_da_biblioteca_o_escolhe_como_objeto', async () => {
    const user = userEvent.setup();
    const { aoEscolher } = montar();
    const nomePorta = OBJETOS.find((sprite) => sprite.id === 'porta')?.nome ?? 'sprite porta ausente do catálogo';
    const porta = within(secao(ROTULOS_EDITOR.objetos)).getByRole('button', { name: nomePorta });
    act(() => porta.focus());

    await user.keyboard('{Enter}');

    expect(aoEscolher).toHaveBeenCalledTimes(1);
    expect(aoEscolher).toHaveBeenCalledWith('sprite:porta', 'objeto');
  });

  // @req RF-04 @tipo borda
  test('test_RF04_cada_objeto_do_catalogo_escolhido_vai_como_objeto_com_a_propria_referencia', async () => {
    const user = userEvent.setup();
    const { aoEscolher } = montar();
    const objetos = secao(ROTULOS_EDITOR.objetos);

    for (const sprite of OBJETOS) {
      await user.click(within(objetos).getByRole('button', { name: sprite.nome }));
      expect(aoEscolher, sprite.id).toHaveBeenLastCalledWith(`sprite:${sprite.id}`, 'objeto');
    }
    expect(aoEscolher).toHaveBeenCalledTimes(OBJETOS.length);
  });

  // @req RF-04 @tipo negativo
  test('test_RF04_fundos_nao_aparecem_como_objeto_e_objetos_nao_aparecem_como_fundo', () => {
    montar();
    const objetos = secao(ROTULOS_EDITOR.objetos);
    const fundos = secao(ROTULOS_EDITOR.fundos);

    for (const sprite of FUNDOS) {
      expect(within(objetos).queryByRole('button', { name: sprite.nome }), sprite.id).toBeNull();
      expect(within(fundos).getByRole('button', { name: sprite.nome }), sprite.id).toBeInTheDocument();
    }
    for (const sprite of OBJETOS) {
      expect(within(fundos).queryByRole('button', { name: sprite.nome }), sprite.id).toBeNull();
    }
  });

  // @req RF-04 @tipo negativo
  test('test_RF04_escolher_um_fundo_do_catalogo_nunca_insere_objeto', async () => {
    const user = userEvent.setup();
    const { aoEscolher } = montar();
    const fundos = secao(ROTULOS_EDITOR.fundos);

    for (const sprite of FUNDOS) {
      await user.click(within(fundos).getByRole('button', { name: sprite.nome }));
      expect(aoEscolher, sprite.id).toHaveBeenLastCalledWith(`sprite:${sprite.id}`, 'fundo');
    }
    expect(aoEscolher.mock.calls.some(([, destino]) => destino === 'objeto')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// RF-04 · arraste da seção Objetos (LAC-045, Eric em 06/11/2026)
// Cada botão de Objetos é draggable; no dragstart grava `sprite:<id>` no dataTransfer com o tipo
// TIPO_ARRASTE_BIBLIOTECA. Quem recebe é o CanvasParede; a biblioteca não chama aoEscolher no arraste.
// ---------------------------------------------------------------------------
describe('RF-04 · arrastar um objeto da biblioteca', () => {
  function botaoDoSprite(id: string): HTMLElement {
    const sprite = OBJETOS.find((s) => s.id === id);
    if (!sprite) throw new Error(`sprite ${id} ausente do catálogo`);
    return within(secao(ROTULOS_EDITOR.objetos)).getByRole('button', { name: sprite.nome });
  }

  // @req RF-04 @tipo feliz
  test('test_RF04_cada_objeto_da_secao_objetos_e_arrastavel', () => {
    montar();
    const objetos = secao(ROTULOS_EDITOR.objetos);

    for (const sprite of OBJETOS) {
      expect(within(objetos).getByRole('button', { name: sprite.nome }), sprite.id).toHaveAttribute('draggable', 'true');
    }
  });

  // @req RF-04 @tipo feliz
  test('test_RF04_dragstart_da_janela_grava_a_referencia_com_o_tipo_da_biblioteca', () => {
    const { aoEscolher } = montar();
    const transferencia = criarDataTransfer();

    dispararArraste(botaoDoSprite('janela'), 'dragStart', transferencia);

    expect(transferencia.getData(TIPO_ARRASTE_BIBLIOTECA)).toBe('sprite:janela');
    expect(transferencia.types).toContain(TIPO_ARRASTE_BIBLIOTECA);
    expect(aoEscolher).not.toHaveBeenCalled();
  });

  // @req RF-04 @tipo borda
  test('test_RF04_cada_objeto_arrastado_grava_a_propria_referencia', () => {
    const { aoEscolher } = montar();

    for (const sprite of OBJETOS) {
      const transferencia = criarDataTransfer();
      const botao = within(secao(ROTULOS_EDITOR.objetos)).getByRole('button', { name: sprite.nome });
      dispararArraste(botao, 'dragStart', transferencia);
      dispararArraste(botao, 'dragEnd', transferencia);
      expect(transferencia.getData(TIPO_ARRASTE_BIBLIOTECA), sprite.id).toBe(`sprite:${sprite.id}`);
    }
    expect(aoEscolher).not.toHaveBeenCalled();
  });

  // @req RF-04 @tipo negativo
  test('test_RF04_arrastar_e_soltar_fora_do_palco_nao_chama_aoEscolher', () => {
    const { aoEscolher } = montar();
    const transferencia = criarDataTransfer();
    const porta = botaoDoSprite('porta');

    dispararArraste(porta, 'dragStart', transferencia);
    dispararArraste(porta, 'dragEnd', transferencia);

    expect(aoEscolher).not.toHaveBeenCalled();
  });

  // @req RF-04 @tipo negativo
  test('test_RF04_clique_depois_de_um_arraste_continua_escolhendo_no_centro_uma_unica_vez', async () => {
    const user = userEvent.setup();
    const { aoEscolher } = montar();
    const quadro = botaoDoSprite('quadro');
    dispararArraste(quadro, 'dragStart', criarDataTransfer());

    await user.click(quadro);

    expect(aoEscolher).toHaveBeenCalledTimes(1);
    expect(aoEscolher).toHaveBeenCalledWith('sprite:quadro', 'objeto');
  });
});

// ---------------------------------------------------------------------------
// RF-06 · fundos e imagens enviadas
// ---------------------------------------------------------------------------
describe('RF-06 · Minhas imagens e envio', () => {
  // @req RF-06 @tipo feliz
  test('test_RF06_imagem_enviada_pode_ser_usada_como_objeto_ou_como_fundo', async () => {
    const user = userEvent.setup();
    const { aoEscolher } = montar([ASSET_1, ASSET_2]);
    const minhas = secao(ROTULOS_EDITOR.minhasImagens);
    const comoObjeto = within(minhas).getAllByRole('button', { name: ROTULOS_EDITOR.usarComoObjeto });
    const comoFundo = within(minhas).getAllByRole('button', { name: ROTULOS_EDITOR.usarComoFundo });
    expect(comoObjeto).toHaveLength(2);
    expect(comoFundo).toHaveLength(2);

    await user.click(comoObjeto[1] as HTMLElement);
    expect(aoEscolher).toHaveBeenLastCalledWith(ASSET_2, 'objeto');

    await user.click(comoFundo[0] as HTMLElement);
    expect(aoEscolher).toHaveBeenLastCalledWith(ASSET_1, 'fundo');
    expect(aoEscolher).toHaveBeenCalledTimes(2);
  });

  // @req RF-06 @tipo feliz
  test('test_RF06_enviar_uma_imagem_png_entrega_o_arquivo_ao_envio', async () => {
    const user = userEvent.setup();
    const { aoEnviarImagem, aoEscolher } = montar();
    const arquivo = arquivoSintetico('image/png');

    await user.upload(campoEnviar(), arquivo);

    expect(aoEnviarImagem).toHaveBeenCalledTimes(1);
    expect(aoEnviarImagem).toHaveBeenCalledWith(arquivo);
    expect(aoEscolher).not.toHaveBeenCalled();
  });

  // @req RF-06 @tipo borda
  test('test_RF06_png_jpg_e_webp_de_exatamente_5_MB_sao_entregues_ao_envio', async () => {
    const user = userEvent.setup();
    const { aoEnviarImagem } = montar();

    for (const tipo of ['image/png', 'image/jpeg', 'image/webp'] as const) {
      const arquivo = arquivoSintetico(tipo, LIMITES_CORPO.asset);
      expect(arquivo.size).toBe(LIMITES_CORPO.asset);
      await user.upload(campoEnviar(), arquivo);
      expect(aoEnviarImagem, tipo).toHaveBeenLastCalledWith(arquivo);
    }
    expect(aoEnviarImagem).toHaveBeenCalledTimes(3);
  });

  // @req RF-06 @tipo borda
  test('test_RF06_sem_fundo_tira_o_fundo_da_parede_ativa', async () => {
    const user = userEvent.setup();
    const { aoEscolher } = montar();

    await user.click(within(secao(ROTULOS_EDITOR.fundos)).getByRole('button', { name: ROTULOS_EDITOR.semFundo }));

    expect(aoEscolher).toHaveBeenCalledTimes(1);
    expect(aoEscolher).toHaveBeenCalledWith(null, 'fundo');
  });

  // @req RF-06 @tipo borda
  test('test_RF06_sem_imagem_enviada_minhas_imagens_so_oferece_o_envio', () => {
    montar([]);
    const minhas = secao(ROTULOS_EDITOR.minhasImagens);

    expect(within(minhas).queryAllByRole('button', { name: ROTULOS_EDITOR.usarComoObjeto })).toHaveLength(0);
    expect(within(minhas).queryAllByRole('button', { name: ROTULOS_EDITOR.usarComoFundo })).toHaveLength(0);
    expect(campoEnviar()).toBeInTheDocument();
  });

  // @req RF-06 @tipo negativo
  test('test_RF06_enviar_nao_acrescenta_a_imagem_sem_a_api_aceitar', async () => {
    const user = userEvent.setup();
    const { aoEscolher } = montar([ASSET_1]);

    await user.upload(campoEnviar(), arquivoSintetico('image/webp'));

    const minhas = secao(ROTULOS_EDITOR.minhasImagens);
    expect(within(minhas).getAllByRole('button', { name: ROTULOS_EDITOR.usarComoObjeto })).toHaveLength(1);
    expect(within(minhas).getAllByRole('button', { name: ROTULOS_EDITOR.usarComoFundo })).toHaveLength(1);
    expect(aoEscolher).not.toHaveBeenCalled();
  });
});
