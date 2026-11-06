/**
 * Módulo: TelaEdicao (apps/editor/contrato/telas.ts · PropsTelaEdicao, ROTULOS_EDITOR; modulos-editor.md §2 a §5;
 * contratos/editor.md; ADR-002, ADR-008, ADR-009, ADR-011, ADR-013).
 * A tela integra AbasParedes, CanvasParede, BibliotecaObjetos, PainelPropriedades e BarraFerramentas com o store,
 * o salvamento e o cliente. Tudo entra pelas props: cliente falso completo (tests/support/cliente-edicao-falso.ts,
 * que imita a Api sobre uma fase em memória), relógio falso, `gerarId` determinístico e `verificadorTeste` falso.
 * Sem rede e sem tempo real.
 *
 * Requisitos:
 * - RF-03: abre a fase (`abrirFase`), mostra 5 abas; cada aba mostra só os objetos daquela parede;
 * - RF-04: escolher um objeto da biblioteca (clique ou Enter) o põe na parede ativa, com o id de `gerarId`;
 * - RF-06: enviar imagem chama `enviarImagem`; aceita, aparece em Minhas imagens e pode virar objeto ou fundo;
 *   recusada, a mensagem da Api aparece em role="alert" e nada é gravado;
 * - RF-09: Ctrl+Z / Ctrl+Y desfazem e refazem o movimento de um objeto; com o foco num campo de texto não agem;
 * - RF-10: gravação em até 30 s (relógio falso), ao trocar de aba e no botão salvar; indicador acompanha; 409 mostra
 *   "Recarregar a fase", que lê a fase de novo e descarta a alteração local (modulos-editor.md §3, "Saída do conflito");
 * - RF-11: Testar salva antes, chama `jogoTeste`, confere respostas pelo `verificadorTeste`; sair volta à edição sem
 *   mudar o documento;
 * - RF-12: publicação recusada (422) mostra ROTULOS_EDITOR.posicoesSemEnigma com as posições devolvidas;
 * - RF-13: publicar; fase publicada com rascunho diferente mostra "Alterações não publicadas" e "Publicar de novo";
 *   depois de um PUT aceito numa fase publicada, a tela lê a fase de novo (`abrirFase`) para atualizar o aviso;
 * - RF-14: Exportar chama `exportarFase` e entrega o arquivo para download sem alterá-lo;
 * - RNF-01: aviso abaixo de 1280x720 (1279x720 e 1280x719), ausente a partir de 1280x720; a edição continua.
 *
 * O documento é observado pelo que a tela grava (`salvarFase`) e pelo palco: clicar numa fala seleciona-a e o painel
 * mostra o campo ROTULOS_EDITOR.texto com o texto dela; clicar em área vazia mostra Propriedades da fase.
 * Leituras assumidas, que o contrato não fixa (pendência arquitetura aberta nesta rodada):
 * - o palco do editor tem tamanho no jsdom (derivado da janela; o jsdom não faz layout);
 * - modo testar: o jogo é desenhado num palco Konva (RenderizadorParede) e clicar num enigma abre um campo de texto,
 *   enviado com Enter (formulário) ou por um botão de envio, como na TelaJogo; as mensagens são as MENSAGENS do player;
 * - publicação recusada: as posições aparecem como números junto do título ROTULOS_EDITOR.posicoesSemEnigma;
 * - exportar: o arquivo é entregue por URL.createObjectURL ou por um <a download>.
 * Fases sintéticas de tests/fixtures/; ids, textos e uuids escritos à mão, sem aleatoriedade.
 */
import { TelaEdicao } from '@math-scape/app-editor';
import { type ClienteApiEditor, ROTULOS_EDITOR } from '@math-scape/app-editor/contrato';
import { LIMITES_CORPO } from '@math-scape/api/contrato';
import { calcularPalco } from '@math-scape/player';
import { MENSAGENS, type Verificador } from '@math-scape/player/contrato';
import { CATALOGO, type Fase, type FaseJogo, type Objeto, PAREDES, type ParedeId } from '@math-scape/schema/contrato';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type Mock, afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import {
  DATA_URL_PNG,
  UUID_ASSET,
  documentoComPosicoesSemEnigma,
  documentoJogavel,
  documentoSemPorta,
  envelope,
} from '../fixtures/fases-api.ts';
import { acerto, erro as respostaErrada, faseJogo, falaJogo, enigmaJogo, verificadorFalso } from '../fixtures/fases-jogo.ts';
import { enigma, fala, fase, objeto } from '../fixtures/fases.ts';
import { adiado, lerTexto, ok, recusa, textosDosAlertas } from '../support/cliente-editor-falso.ts';
import { type ClienteEdicaoFalso, criarClienteEdicaoFalso, uuidSintetico } from '../support/cliente-edicao-falso.ts';
import { arrastarNoPalco, pontoNoObjeto } from '../support/palco-editor.ts';
import { type Ponto, clicarNoPalco, definirJanela, esperarDesenho, normalizar, palcoDaTela } from '../support/palco-tela.ts';
import { type RelogioFalso, criarRelogioFalso, drenarPromessas } from '../support/relogio-falso.ts';

type Usuario = ReturnType<typeof userEvent.setup>;
type Caixa = Pick<Objeto, 'x' | 'y' | 'largura' | 'altura'>;

const FASE_ID = 'fase-edicao-1';
const REVISAO_INICIAL = 7;

// ---------------------------------------------------------------------------
// Fase sintética: uma fala por parede, cada uma numa posição própria (nenhuma se sobrepõe).
// ---------------------------------------------------------------------------
const POS = {
  a: { x: 0.05, y: 0.1, largura: 0.2, altura: 0.3 },
  b: { x: 0.3, y: 0.1, largura: 0.2, altura: 0.3 },
  c: { x: 0.55, y: 0.1, largura: 0.2, altura: 0.3 },
  d: { x: 0.05, y: 0.55, largura: 0.2, altura: 0.3 },
  e: { x: 0.3, y: 0.55, largura: 0.2, altura: 0.3 },
  /** Nunca ocupada pelas fases destes testes. */
  vazio: { x: 0.78, y: 0.62, largura: 0.18, altura: 0.3 },
} as const;

const POS_PAREDE: Record<ParedeId, Caixa> = {
  frente: POS.a,
  direita: POS.c,
  fundo: POS.b,
  esquerda: POS.d,
  teto: POS.e,
};

const FALAS: Record<ParedeId, string> = {
  frente: 'Você: o quadro está apagado.',
  direita: 'Você: a janela não abre.',
  fundo: 'Você: a estante range quando encosto.',
  esquerda: 'Você: há pó de giz no chão.',
  teto: 'Você: a lâmpada pisca devagar.',
};

function em(o: Objeto, caixa: Caixa): Objeto {
  return { ...o, ...caixa };
}

function documentoSala(): Fase {
  const paraParede = (p: ParedeId) => [em(fala(`fala-${p}`, FALAS[p]), POS_PAREDE[p])];
  return {
    ...fase('92139', {
      frente: paraParede('frente'),
      direita: paraParede('direita'),
      fundo: paraParede('fundo'),
      esquerda: paraParede('esquerda'),
      teto: paraParede('teto'),
    }),
    titulo: 'Sala sintética da edição',
  };
}

const OBJETOS_CATALOGO = CATALOGO.filter((sprite) => sprite.categoria === 'objeto');
const FUNDOS_CATALOGO = CATALOGO.filter((sprite) => sprite.categoria === 'fundo');

function nomeDoSprite(id: string): string {
  const sprite = CATALOGO.find((s) => s.id === id);
  if (!sprite) throw new Error(`sprite ${id} ausente do catálogo`);
  return sprite.nome;
}

// ---------------------------------------------------------------------------
// Montagem
// ---------------------------------------------------------------------------
interface OpcoesMontar {
  documento?: Fase;
  publicada?: boolean;
  alteracoesNaoPublicadas?: boolean;
  jogo?: FaseJogo;
  verificador?: Verificador;
}

async function montar(opcoes: OpcoesMontar = {}) {
  const user = userEvent.setup();
  const relogio = criarRelogioFalso();
  const cliente = criarClienteEdicaoFalso({
    faseId: FASE_ID,
    documento: opcoes.documento ?? documentoSala(),
    revisao: REVISAO_INICIAL,
    publicada: opcoes.publicada,
    alteracoesNaoPublicadas: opcoes.alteracoesNaoPublicadas,
    jogo: opcoes.jogo,
  });
  let contador = 0;
  const gerarId = vi.fn(() => {
    contador += 1;
    return `novo-${contador}`;
  });
  const verificador = opcoes.verificador ?? verificadorFalso({}).verificador;
  const aoSair = vi.fn<() => void>();
  render(
    <TelaEdicao
      faseId={FASE_ID}
      cliente={cliente}
      relogio={relogio}
      baseUrlApi="/api"
      gerarId={gerarId}
      verificadorTeste={verificador}
      aoSair={aoSair}
    />,
  );
  await screen.findAllByRole('tab');
  await esperarDesenho();
  return { user, relogio, cliente, gerarId, aoSair };
}

// ---------------------------------------------------------------------------
// Interação e observação
// ---------------------------------------------------------------------------
function aba(parede: ParedeId): HTMLElement {
  const encontrada = screen.getAllByRole('tab')[PAREDES.indexOf(parede)];
  if (!encontrada) throw new Error(`aba ${parede} ausente`);
  return encontrada;
}

function botao(nome: string): HTMLButtonElement {
  return screen.getByRole('button', { name: nome }) as HTMLButtonElement;
}

/** Deixa as respostas do cliente falso chegarem à tela. */
async function assentar(): Promise<void> {
  await act(async () => {
    await drenarPromessas();
  });
}

async function avancar(relogio: RelogioFalso, ms: number): Promise<void> {
  await act(async () => {
    relogio.avancar(ms);
    await drenarPromessas();
  });
}

async function trocarPara(user: Usuario, parede: ParedeId): Promise<void> {
  await user.click(aba(parede));
  await assentar();
  await esperarDesenho();
}

async function clicarSalvar(user: Usuario): Promise<void> {
  await user.click(botao(ROTULOS_EDITOR.salvar));
  await assentar();
}

function regiao(nome: string): HTMLElement {
  return screen.getByRole('region', { name: nome });
}

async function escolherObjeto(user: Usuario, spriteId: string): Promise<void> {
  await user.click(within(regiao(ROTULOS_EDITOR.objetos)).getByRole('button', { name: nomeDoSprite(spriteId) }));
  await assentar();
  await esperarDesenho();
}

function documentoSalvo(cliente: ClienteEdicaoFalso, indice = -1): Fase {
  const chamada = cliente.salvarFase.mock.calls.at(indice);
  if (!chamada) throw new Error('salvarFase não foi chamado');
  return chamada[2];
}

function objetosSalvos(cliente: ClienteEdicaoFalso, parede: ParedeId, indice = -1): Objeto[] {
  return documentoSalvo(cliente, indice).paredes[parede].objetos;
}

/** Ids dos objetos em ordem alfabética (a posição do objeto novo na lista não é contrato). */
function idsDe(objetos: Objeto[]): string[] {
  return objetos.map((o) => o.id).sort();
}

function acharSalvo(cliente: ClienteEdicaoFalso, id: string): Objeto | undefined {
  return Object.values(documentoSalvo(cliente).paredes)
    .flatMap((p) => p.objetos)
    .find((o) => o.id === id);
}

/** Texto da fala selecionada, lido do campo ROTULOS_EDITOR.texto do painel; null sem fala selecionada. */
function textoDoSelecionado(): string | null {
  const campo = screen.queryByLabelText(ROTULOS_EDITOR.texto) as HTMLInputElement | HTMLTextAreaElement | null;
  return campo ? campo.value : null;
}

async function clicarNaPosicao(caixa: Caixa): Promise<void> {
  clicarNoPalco(pontoNoObjeto(caixa, 0.5, 0.5, palcoDaTela()));
  await esperarDesenho();
}

/** Elemento que mostra o texto (com espaços colapsados), sem contar os ancestrais. */
function mostraTexto(texto: string) {
  const alvo = normalizar(texto);
  return (_: string, el: Element | null) =>
    !!el &&
    normalizar(el.textContent ?? '').includes(alvo) &&
    ![...el.children].some((filho) => normalizar(filho.textContent ?? '').includes(alvo));
}

function estaNaTela(texto: string): boolean {
  return screen.queryAllByText(mostraTexto(texto)).length > 0;
}

async function aparece(texto: string): Promise<void> {
  expect((await screen.findAllByText(mostraTexto(texto))).length, `"${texto}" na tela`).toBeGreaterThan(0);
}

async function esperarAlertaCom(texto: string): Promise<void> {
  await waitFor(() => expect(textosDosAlertas().some((t) => t.includes(texto)), `alerta com "${texto}"`).toBe(true));
}

function botoesMinhasImagens(nome: string): HTMLElement[] {
  return within(regiao(ROTULOS_EDITOR.minhasImagens)).queryAllByRole('button', { name: nome });
}

/** Bytes iniciais de cada formato (o resto do arquivo é zero). */
const ASSINATURAS = {
  'image/png': [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  'image/gif': [0x47, 0x49, 0x46, 0x38, 0x39, 0x61],
} as const;

/** Arquivo .png sintético; `conteudo` escolhe a assinatura real dos bytes (um GIF disfarçado de PNG, por exemplo). */
function arquivoPng(tamanho = 64, conteudo: keyof typeof ASSINATURAS = 'image/png'): File {
  const bytes = new Uint8Array(Math.max(tamanho, ASSINATURAS[conteudo].length));
  bytes.set(ASSINATURAS[conteudo]);
  return new File([bytes], 'imagem-sintetica.png', { type: 'image/png' });
}

function campoEnviarImagem(): HTMLInputElement {
  return screen.getByLabelText(ROTULOS_EDITOR.enviarImagem) as HTMLInputElement;
}

beforeEach(() => definirJanela(1600, 900));
afterEach(() => definirJanela(1024, 768));

// ---------------------------------------------------------------------------
// RF-03 · abas e parede ativa
// ---------------------------------------------------------------------------
describe('RF-03 · TelaEdicao: cinco abas, cada uma com os objetos da sua parede', () => {
  // @req RF-03 @tipo feliz
  test('test_RF03_tela_abre_a_fase_e_mostra_5_abas_com_a_frente_ativa', async () => {
    const { cliente } = await montar();

    expect(cliente.abrirFase).toHaveBeenCalledTimes(1);
    expect(cliente.abrirFase).toHaveBeenCalledWith(FASE_ID);
    const abas = screen.getAllByRole('tab');
    expect(abas).toHaveLength(5);
    expect(abas.map((a) => a.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false', 'false', 'false']);

    await clicarNaPosicao(POS_PAREDE.frente);
    expect(textoDoSelecionado()).toBe(FALAS.frente);
  });

  // @req RF-03 @tipo feliz
  test('test_RF03_tela_trocar_de_aba_mostra_os_objetos_da_outra_parede', async () => {
    const { user } = await montar();

    await trocarPara(user, 'direita');

    expect(aba('direita')).toHaveAttribute('aria-selected', 'true');
    expect(aba('frente')).toHaveAttribute('aria-selected', 'false');
    await clicarNaPosicao(POS_PAREDE.direita);
    expect(textoDoSelecionado()).toBe(FALAS.direita);
  });

  // @req RF-03 @tipo borda
  test('test_RF03_tela_em_cada_uma_das_5_abas_so_o_objeto_daquela_parede_responde', async () => {
    const { user } = await montar();

    for (const parede of PAREDES) {
      await trocarPara(user, parede);
      await clicarNaPosicao(POS_PAREDE[parede]);
      expect(textoDoSelecionado(), `aba ${parede}`).toBe(FALAS[parede]);

      for (const outra of PAREDES.filter((p) => p !== parede)) {
        await clicarNaPosicao(POS_PAREDE[outra]);
        expect(textoDoSelecionado(), `aba ${parede}, posição da fala de ${outra}`).toBeNull();
      }
    }
  });

  // @req RF-03 @tipo negativo
  test('test_RF03_tela_objeto_da_frente_nao_aparece_na_aba_direita', async () => {
    const { user } = await montar();
    await trocarPara(user, 'direita');

    await clicarNaPosicao(POS_PAREDE.frente);

    expect(textoDoSelecionado()).toBeNull();
    expect(estaNaTela(ROTULOS_EDITOR.propriedadesDaFase)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// RF-04 · biblioteca → parede ativa
// ---------------------------------------------------------------------------
describe('RF-04 · TelaEdicao: objeto da biblioteca vai para a parede ativa', () => {
  // @req RF-04 @tipo feliz
  test('test_RF04_tela_clicar_em_porta_coloca_a_porta_na_parede_ativa_com_o_id_gerado', async () => {
    const { user, cliente, gerarId } = await montar();

    await escolherObjeto(user, 'porta');
    await clicarSalvar(user);

    expect(gerarId).toHaveBeenCalledTimes(1);
    const novo = objetosSalvos(cliente, 'frente').find((o) => o.id === 'novo-1');
    expect(novo).toMatchObject({ id: 'novo-1', imagem: 'sprite:porta', interacao: { tipo: 'decoracao' } });
    expect(idsDe(objetosSalvos(cliente, 'frente'))).toEqual(['fala-frente', 'novo-1']);
  });

  // @req RF-04 @tipo feliz
  test('test_RF04_tela_enter_num_objeto_da_biblioteca_o_coloca_na_parede_ativa', async () => {
    const { user, cliente } = await montar();
    await trocarPara(user, 'fundo');
    const relogioSprite = within(regiao(ROTULOS_EDITOR.objetos)).getByRole('button', { name: nomeDoSprite('relogio') });
    act(() => relogioSprite.focus());

    await user.keyboard('{Enter}');
    await assentar();
    await clicarSalvar(user);

    expect(objetosSalvos(cliente, 'fundo').find((o) => o.id === 'novo-1')).toMatchObject({ imagem: 'sprite:relogio' });
    expect(idsDe(objetosSalvos(cliente, 'frente'))).toEqual(['fala-frente']);
  });

  // @req RF-04 @tipo borda
  test('test_RF04_tela_cada_objeto_do_catalogo_entra_na_parede_ativa_com_ids_em_sequencia', async () => {
    const { user, cliente, gerarId } = await montar();
    await trocarPara(user, 'teto');
    const esperado = OBJETOS_CATALOGO.map((sprite, i) => ({ id: `novo-${i + 1}`, imagem: `sprite:${sprite.id}` }));
    expect(OBJETOS_CATALOGO.map((s) => s.id)).toEqual(
      expect.arrayContaining(['porta', 'quadro', 'janela', 'relogio', 'giz', 'selo-magico', 'arvore']),
    );

    for (const sprite of OBJETOS_CATALOGO) await escolherObjeto(user, sprite.id);
    await clicarSalvar(user);

    expect(gerarId).toHaveBeenCalledTimes(OBJETOS_CATALOGO.length);
    const novos = objetosSalvos(cliente, 'teto')
      .filter((o) => o.id.startsWith('novo-'))
      .sort((a, b) => Number(a.id.slice('novo-'.length)) - Number(b.id.slice('novo-'.length)));
    expect(novos.map((o) => ({ id: o.id, imagem: o.imagem }))).toEqual(esperado);
    for (const parede of PAREDES.filter((p) => p !== 'teto')) {
      expect(idsDe(objetosSalvos(cliente, parede)), parede).toEqual([`fala-${parede}`]);
    }
  });

  // @req RF-04 @tipo negativo
  test('test_RF04_tela_escolher_um_fundo_nao_cria_objeto_nem_pede_id', async () => {
    const { user, cliente, gerarId } = await montar();
    const fundo = FUNDOS_CATALOGO[0];
    if (!fundo) throw new Error('catálogo sem fundos');

    await user.click(within(regiao(ROTULOS_EDITOR.fundos)).getByRole('button', { name: fundo.nome }));
    await assentar();
    await clicarSalvar(user);

    expect(gerarId).not.toHaveBeenCalled();
    expect(idsDe(objetosSalvos(cliente, 'frente'))).toEqual(['fala-frente']);
    expect(documentoSalvo(cliente).paredes.frente.fundo).toBe(`sprite:${fundo.id}`);
  });
});

// ---------------------------------------------------------------------------
// RF-06 · enviar imagem
// ---------------------------------------------------------------------------
describe('RF-06 · TelaEdicao: imagens enviadas', () => {
  // @req RF-06 @tipo feliz
  test('test_RF06_tela_imagem_aceita_aparece_em_minhas_imagens_e_vira_objeto_da_parede_ativa', async () => {
    const { user, cliente } = await montar();
    const arquivo = arquivoPng();
    expect(botoesMinhasImagens(ROTULOS_EDITOR.usarComoObjeto)).toHaveLength(0);

    await user.upload(campoEnviarImagem(), arquivo);
    await assentar();

    expect(cliente.enviarImagem).toHaveBeenCalledTimes(1);
    expect(cliente.enviarImagem).toHaveBeenCalledWith(arquivo);
    await waitFor(() => expect(botoesMinhasImagens(ROTULOS_EDITOR.usarComoObjeto)).toHaveLength(1));

    await user.click(botoesMinhasImagens(ROTULOS_EDITOR.usarComoObjeto)[0] as HTMLElement);
    await assentar();
    await clicarSalvar(user);

    expect(objetosSalvos(cliente, 'frente').find((o) => o.id === 'novo-1')).toMatchObject({
      imagem: `asset:${uuidSintetico(1)}`,
    });
  });

  // @req RF-06 @tipo feliz
  test('test_RF06_tela_imagem_aceita_vira_fundo_da_parede_ativa', async () => {
    const { user, cliente } = await montar();
    await trocarPara(user, 'direita');

    await user.upload(campoEnviarImagem(), arquivoPng());
    await waitFor(() => expect(botoesMinhasImagens(ROTULOS_EDITOR.usarComoFundo)).toHaveLength(1));
    await user.click(botoesMinhasImagens(ROTULOS_EDITOR.usarComoFundo)[0] as HTMLElement);
    await assentar();
    await clicarSalvar(user);

    const salvo = documentoSalvo(cliente);
    expect(salvo.paredes.direita.fundo).toBe(`asset:${uuidSintetico(1)}`);
    expect(salvo.paredes.frente.fundo).toBeNull();
  });

  // @req RF-06 @tipo borda
  test('test_RF06_tela_png_de_exatamente_5_MB_vai_para_a_api_e_entra_em_minhas_imagens', async () => {
    const { user, cliente } = await montar();
    const arquivo = arquivoPng(LIMITES_CORPO.asset);
    expect(arquivo.size).toBe(LIMITES_CORPO.asset);

    await user.upload(campoEnviarImagem(), arquivo);
    await assentar();

    expect(cliente.enviarImagem).toHaveBeenCalledWith(arquivo);
    await waitFor(() => expect(botoesMinhasImagens(ROTULOS_EDITOR.usarComoObjeto)).toHaveLength(1));
  });

  // @req RF-06 @tipo borda
  test('test_RF06_tela_imagem_ja_usada_na_fase_aparece_em_minhas_imagens_e_a_enviada_se_soma', async () => {
    const documento = documentoSala();
    documento.paredes.fundo.fundo = `asset:${UUID_ASSET}`;
    const { user } = await montar({ documento });
    expect(botoesMinhasImagens(ROTULOS_EDITOR.usarComoObjeto)).toHaveLength(1);
    expect(botoesMinhasImagens(ROTULOS_EDITOR.usarComoFundo)).toHaveLength(1);

    await user.upload(campoEnviarImagem(), arquivoPng());

    await waitFor(() => expect(botoesMinhasImagens(ROTULOS_EDITOR.usarComoObjeto)).toHaveLength(2));
    expect(botoesMinhasImagens(ROTULOS_EDITOR.usarComoFundo)).toHaveLength(2);
  });

  // @req RF-06 @tipo negativo
  test('test_RF06_tela_imagem_acima_de_5_MB_recusada_mostra_a_mensagem_e_nada_e_gravado', async () => {
    const { user, cliente } = await montar();
    const mensagem = 'A imagem passa de 5 MB.';
    cliente.enviarImagem.mockResolvedValueOnce(recusa(413, mensagem));
    const arquivo = arquivoPng(LIMITES_CORPO.asset + 1);

    await user.upload(campoEnviarImagem(), arquivo);
    await assentar();

    // A recusa pode vir da Api (mensagem dela) ou de uma conferência antes do envio; em ambos os casos há mensagem.
    await waitFor(() => expect(textosDosAlertas().length).toBeGreaterThan(0));
    if (cliente.enviarImagem.mock.calls.length > 0) await esperarAlertaCom(mensagem);
    expect(botoesMinhasImagens(ROTULOS_EDITOR.usarComoObjeto)).toHaveLength(0);
    await clicarSalvar(user);
    expect(cliente.salvarFase).not.toHaveBeenCalled();
  });

  // @req RF-06 @tipo negativo
  test('test_RF06_tela_formato_recusado_pela_api_mostra_a_mensagem_e_nao_entra_em_minhas_imagens', async () => {
    const { user, cliente } = await montar();
    const mensagem = 'Formato não aceito: envie PNG, JPG ou WebP.';
    cliente.enviarImagem.mockResolvedValueOnce(recusa(415, mensagem));

    await user.upload(campoEnviarImagem(), arquivoPng(64, 'image/gif'));
    await assentar();

    await esperarAlertaCom(mensagem);
    expect(botoesMinhasImagens(ROTULOS_EDITOR.usarComoObjeto)).toHaveLength(0);
    expect(botoesMinhasImagens(ROTULOS_EDITOR.usarComoFundo)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// RF-09 · Ctrl+Z / Ctrl+Y
// ---------------------------------------------------------------------------
describe('RF-09 · TelaEdicao: desfazer e refazer pelo teclado', () => {
  const MOVIDA = { ...POS.a, x: POS.a.x + 0.1 };

  /** Arrasta a fala da frente 10% da largura para a direita e grava. */
  async function moverFalaDaFrente(user: Usuario, cliente: ClienteEdicaoFalso): Promise<void> {
    const palco = palcoDaTela();
    const de = pontoNoObjeto(POS.a, 0.5, 0.5, palco);
    arrastarNoPalco(de, { x: de.x + 0.1 * palco.largura, y: de.y });
    await esperarDesenho();
    await clicarSalvar(user);
    expect(acharSalvo(cliente, 'fala-frente')?.x).toBeCloseTo(MOVIDA.x, 2);
  }

  // @req RF-09 @tipo feliz
  test('test_RF09_tela_ctrl_z_devolve_o_objeto_movido_e_ctrl_y_o_leva_de_novo', async () => {
    const { user, cliente } = await montar();
    await moverFalaDaFrente(user, cliente);

    await user.keyboard('{Control>}z{/Control}');
    await assentar();
    await clicarSalvar(user);
    expect(cliente.salvarFase).toHaveBeenCalledTimes(2);
    expect(acharSalvo(cliente, 'fala-frente')?.x).toBeCloseTo(POS.a.x, 5);

    await user.keyboard('{Control>}y{/Control}');
    await assentar();
    await clicarSalvar(user);
    expect(cliente.salvarFase).toHaveBeenCalledTimes(3);
    expect(acharSalvo(cliente, 'fala-frente')?.x).toBeCloseTo(MOVIDA.x, 2);
  });

  // @req RF-09 @tipo borda
  test('test_RF09_tela_com_foco_num_campo_de_texto_ctrl_z_nao_desfaz_o_documento', async () => {
    const { user, cliente } = await montar();
    await moverFalaDaFrente(user, cliente);
    await clicarNaPosicao(MOVIDA);
    const campo = screen.getByLabelText(ROTULOS_EDITOR.texto);
    await user.click(campo);
    expect(campo).toHaveFocus();

    await user.keyboard('{Control>}z{/Control}');
    await assentar();

    expect(botao(ROTULOS_EDITOR.desfazer)).toBeEnabled();
    await clicarSalvar(user);
    expect(cliente.salvarFase).toHaveBeenCalledTimes(1);
  });

  // @req RF-09 @tipo borda
  test('test_RF09_tela_cmd_z_no_macos_tambem_desfaz', async () => {
    const { user, cliente } = await montar();
    await moverFalaDaFrente(user, cliente);

    await user.keyboard('{Meta>}z{/Meta}');
    await assentar();
    await clicarSalvar(user);

    expect(cliente.salvarFase).toHaveBeenCalledTimes(2);
    expect(acharSalvo(cliente, 'fala-frente')?.x).toBeCloseTo(POS.a.x, 5);
  });

  // @req RF-09 @tipo negativo
  test('test_RF09_tela_z_sem_ctrl_nao_desfaz', async () => {
    const { user, cliente } = await montar();
    await moverFalaDaFrente(user, cliente);

    await user.keyboard('z');
    await assentar();

    expect(botao(ROTULOS_EDITOR.desfazer)).toBeEnabled();
    await clicarSalvar(user);
    expect(cliente.salvarFase).toHaveBeenCalledTimes(1);
  });

  // @req RF-09 @tipo negativo
  test('test_RF09_tela_ctrl_z_logo_ao_abrir_nao_muda_nada', async () => {
    const { user, cliente } = await montar();
    expect(botao(ROTULOS_EDITOR.desfazer)).toBeDisabled();

    await user.keyboard('{Control>}z{/Control}');
    await assentar();
    await clicarSalvar(user);

    expect(cliente.salvarFase).not.toHaveBeenCalled();
    await clicarNaPosicao(POS.a);
    expect(textoDoSelecionado()).toBe(FALAS.frente);
  });
});

// ---------------------------------------------------------------------------
// RF-10 · salvamento
// ---------------------------------------------------------------------------
describe('RF-10 · TelaEdicao: salvamento', () => {
  // @req RF-10 @tipo feliz
  test('test_RF10_tela_trocar_de_aba_com_alteracao_pendente_grava_na_hora', async () => {
    const { user, cliente } = await montar();
    await escolherObjeto(user, 'porta');
    expect(cliente.salvarFase).not.toHaveBeenCalled();

    await trocarPara(user, 'direita');

    await waitFor(() => expect(cliente.salvarFase).toHaveBeenCalledTimes(1));
    const chamada = cliente.salvarFase.mock.calls[0];
    expect(chamada?.[0]).toBe(FASE_ID);
    expect(chamada?.[1]).toBe(REVISAO_INICIAL);
    expect(idsDe(objetosSalvos(cliente, 'frente'))).toEqual(['fala-frente', 'novo-1']);
  });

  // @req RF-10 @tipo feliz
  test('test_RF10_tela_alteracao_e_gravada_em_ate_30_s_pelo_relogio', async () => {
    const { user, relogio, cliente } = await montar();
    await escolherObjeto(user, 'janela');
    expect(cliente.salvarFase).not.toHaveBeenCalled();

    await avancar(relogio, 30_000);

    expect(cliente.salvarFase).toHaveBeenCalledTimes(1);
    expect(idsDe(objetosSalvos(cliente, 'frente'))).toEqual(['fala-frente', 'novo-1']);
    await screen.findByText(ROTULOS_EDITOR.estadoSalvamento.salvo);
  });

  // @req RF-10 @tipo feliz
  test('test_RF10_tela_indicador_passa_por_pendente_salvando_e_salvo', async () => {
    const { user, cliente } = await montar();
    expect(screen.getByText(ROTULOS_EDITOR.estadoSalvamento.salvo)).toBeInTheDocument();
    const resposta = adiado<Awaited<ReturnType<ClienteApiEditor['salvarFase']>>>();
    cliente.salvarFase.mockImplementationOnce(() => resposta.promessa);

    await escolherObjeto(user, 'quadro');
    await screen.findByText(ROTULOS_EDITOR.estadoSalvamento.pendente);

    await user.click(botao(ROTULOS_EDITOR.salvar));
    await screen.findByText(ROTULOS_EDITOR.estadoSalvamento.salvando);

    await act(async () => {
      resposta.resolver(ok({ revisao: REVISAO_INICIAL + 1 }));
      await drenarPromessas();
    });
    await screen.findByText(ROTULOS_EDITOR.estadoSalvamento.salvo);
    expect(screen.queryByText(ROTULOS_EDITOR.estadoSalvamento.pendente)).toBeNull();
    expect(screen.queryByText(ROTULOS_EDITOR.estadoSalvamento.salvando)).toBeNull();
  });

  // @req RF-10 @tipo borda
  test('test_RF10_tela_nova_alteracao_nao_adia_o_prazo_de_30_s_da_primeira', async () => {
    const { user, relogio, cliente } = await montar();
    await escolherObjeto(user, 'porta');
    await avancar(relogio, 20_000);
    await escolherObjeto(user, 'janela');

    await avancar(relogio, 10_000);
    expect(cliente.salvarFase.mock.calls.length).toBeGreaterThanOrEqual(1);
    expect(idsDe(objetosSalvos(cliente, 'frente'))).toContain('novo-1');

    await avancar(relogio, 30_000);
    expect(idsDe(objetosSalvos(cliente, 'frente'))).toEqual(['fala-frente', 'novo-1', 'novo-2']);
  });

  // @req RF-10 @tipo borda
  test('test_RF10_tela_proxima_gravacao_usa_a_revisao_devolvida_pela_anterior', async () => {
    const { user, cliente } = await montar();
    await escolherObjeto(user, 'porta');
    await clicarSalvar(user);
    await escolherObjeto(user, 'janela');
    await clicarSalvar(user);

    expect(cliente.salvarFase.mock.calls.map(([, revisao]) => revisao)).toEqual([
      REVISAO_INICIAL,
      REVISAO_INICIAL + 1,
    ]);
    await screen.findByText(ROTULOS_EDITOR.estadoSalvamento.salvo);
  });

  // @req RF-10 @tipo negativo
  test('test_RF10_tela_sem_alteracao_nao_grava_ao_trocar_de_aba_nem_com_o_tempo', async () => {
    const { user, relogio, cliente } = await montar();

    await trocarPara(user, 'fundo');
    await avancar(relogio, 60_000);
    await clicarSalvar(user);

    expect(cliente.salvarFase).not.toHaveBeenCalled();
  });

  // @req RF-10 @tipo negativo
  test('test_RF10_tela_conflito_mostra_recarregar_que_le_a_fase_de_novo_e_descarta_a_alteracao_local', async () => {
    const { user, cliente } = await montar();
    const daOutraAba = documentoSala();
    daOutraAba.paredes.direita.objetos.push(em(fala('fala-outra-aba', 'Você: alguém mexeu aqui.'), POS.e));
    cliente.gravarDeOutraAba(daOutraAba);

    await escolherObjeto(user, 'porta');
    await clicarSalvar(user);

    await screen.findByText(ROTULOS_EDITOR.estadoSalvamento.conflito);
    expect(cliente.salvarFase).toHaveBeenCalledTimes(1);

    await user.click(await screen.findByRole('button', { name: ROTULOS_EDITOR.recarregarFase }));
    await assentar();
    await esperarDesenho();

    expect(cliente.abrirFase).toHaveBeenCalledTimes(2);
    expect(cliente.abrirFase).toHaveBeenLastCalledWith(FASE_ID);
    await escolherObjeto(user, 'janela');
    await clicarSalvar(user);

    expect(cliente.salvarFase).toHaveBeenCalledTimes(2);
    expect(cliente.salvarFase.mock.calls[1]?.[1]).toBe(REVISAO_INICIAL + 1);
    expect(idsDe(objetosSalvos(cliente, 'frente'))).toEqual(['fala-frente', 'novo-2']);
    expect(idsDe(objetosSalvos(cliente, 'direita'))).toEqual(['fala-direita', 'fala-outra-aba']);
    await screen.findByText(ROTULOS_EDITOR.estadoSalvamento.salvo);
  });

  // @req RF-10 @tipo negativo
  test('test_RF10_tela_em_conflito_o_automatico_nao_grava_mais', async () => {
    const { user, relogio, cliente } = await montar();
    cliente.gravarDeOutraAba(documentoSala());
    await escolherObjeto(user, 'porta');
    await clicarSalvar(user);
    await screen.findByText(ROTULOS_EDITOR.estadoSalvamento.conflito);

    await escolherObjeto(user, 'janela');
    await avancar(relogio, 30_000);
    await avancar(relogio, 60_000);

    expect(cliente.salvarFase).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: ROTULOS_EDITOR.recarregarFase })).toBeInTheDocument();
  });

  // @req RF-10 @tipo negativo
  test('test_RF10_tela_erro_ao_salvar_mostra_o_estado_e_guarda_a_alteracao_para_a_proxima_tentativa', async () => {
    const { user, cliente } = await montar();
    cliente.salvarFase.mockResolvedValueOnce(recusa(500, 'Erro 500 do servidor.'));
    await escolherObjeto(user, 'porta');

    await clicarSalvar(user);
    await screen.findByText(ROTULOS_EDITOR.estadoSalvamento.erro);

    await clicarSalvar(user);
    expect(cliente.salvarFase).toHaveBeenCalledTimes(2);
    expect(idsDe(objetosSalvos(cliente, 'frente'))).toEqual(['fala-frente', 'novo-1']);
    await screen.findByText(ROTULOS_EDITOR.estadoSalvamento.salvo);
  });
});

// ---------------------------------------------------------------------------
// RF-11 · modo testar
// ---------------------------------------------------------------------------
const PERGUNTA_TESTE = 'Quanto é 6 x 9 + 2?';

/** Frente: fala (A) e enigma (B) que revela a posição 1. */
function documentoTestavel(): Fase {
  return {
    ...fase('92139', {
      frente: [
        em(fala('fala-frente', FALAS.frente), POS.a),
        em(objeto('enigma-teste', { tipo: 'enigma', pergunta: PERGUNTA_TESTE, respostas: [56], revela: [1] }), POS.b),
      ],
    }),
    titulo: 'Sala sintética do teste',
  };
}

/** Projeção de `documentoTestavel` (sem respostas nem senha, RNF-04). */
function jogoTestavel(): FaseJogo {
  return faseJogo({
    frente: [
      { ...falaJogo('fala-frente', FALAS.frente), ...POS.a },
      { ...enigmaJogo('enigma-teste', PERGUNTA_TESTE), ...POS.b },
    ],
  });
}

const SELETOR_CAMPO =
  'input:not([type=hidden]):not([type=button]):not([type=submit]):not([type=checkbox]):not([type=radio]):not([type=file]), textarea';

function camposDeTexto(): Element[] {
  return [...document.querySelectorAll(SELETOR_CAMPO)];
}

function palcos(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>('.konvajs-content')];
}

/** Clique de mouse no ponto (x, y) de um palco Konva dado. */
function clicarEm(el: HTMLElement, ponto: Ponto): void {
  const base = { clientX: ponto.x, clientY: ponto.y, bubbles: true, cancelable: true, button: 0 };
  const ponteiro = { pointerId: 1, pointerType: 'mouse', isPrimary: true };
  fireEvent.pointerDown(el, { ...base, ...ponteiro, buttons: 1 });
  fireEvent.mouseDown(el, { ...base, buttons: 1 });
  fireEvent.pointerUp(el, { ...base, ...ponteiro, buttons: 0 });
  fireEvent.mouseUp(el, { ...base, buttons: 0 });
}

/** Entra no modo testar e devolve os palcos que existiam antes (para achar o palco do jogo). */
async function entrarNoTeste(user: Usuario): Promise<HTMLElement[]> {
  const antes = palcos();
  await user.click(botao(ROTULOS_EDITOR.testar));
  await screen.findByRole('button', { name: ROTULOS_EDITOR.sairDoTeste });
  await esperarDesenho();
  return antes;
}

/** No modo testar: clica no objeto do jogo e responde no campo que se abre. */
async function responderNoTeste(user: Usuario, palcosAntes: HTMLElement[], caixa: Caixa, texto: string) {
  const todos = palcos();
  const palcoJogo = todos.find((el) => !palcosAntes.includes(el)) ?? todos.at(-1);
  if (!palcoJogo) throw new Error('O modo testar não tem palco Konva.');
  const retangulo = calcularPalco(Number.parseFloat(palcoJogo.style.width), Number.parseFloat(palcoJogo.style.height));
  const camposAntes = camposDeTexto();

  clicarEm(palcoJogo, pontoNoObjeto(caixa, 0.5, 0.5, retangulo));
  const campo = await waitFor(() => {
    const novo = camposDeTexto().find((el) => !camposAntes.includes(el));
    if (!novo) throw new Error('Nenhum campo de resposta aberto no modo testar.');
    return novo as HTMLInputElement;
  });

  await user.clear(campo);
  await user.type(campo, texto);
  if (campo.closest('form')) {
    await user.keyboard('{Enter}');
  } else {
    const envio = screen.queryAllByRole('button', { name: /responder|enviar|confirmar|verificar|tentar|ok/i })[0];
    if (envio) await user.click(envio);
    else await user.keyboard('{Enter}');
  }
  await assentar();
}

async function sairDoTeste(user: Usuario): Promise<void> {
  await user.click(botao(ROTULOS_EDITOR.sairDoTeste));
  await screen.findAllByRole('tab');
  await esperarDesenho();
}

describe('RF-11 · TelaEdicao: modo testar', () => {
  // @req RF-11 @tipo feliz
  test('test_RF11_tela_testar_grava_a_alteracao_pendente_antes_de_pedir_o_jogo_de_teste', async () => {
    const { user, cliente } = await montar({ documento: documentoTestavel(), jogo: jogoTestavel() });
    await escolherObjeto(user, 'porta');

    await entrarNoTeste(user);

    expect(cliente.salvarFase).toHaveBeenCalledTimes(1);
    expect(idsDe(objetosSalvos(cliente, 'frente'))).toEqual(['enigma-teste', 'fala-frente', 'novo-1']);
    expect(cliente.jogoTeste).toHaveBeenCalledTimes(1);
    expect(cliente.jogoTeste).toHaveBeenCalledWith(FASE_ID);
    const ordemSalvar = cliente.salvarFase.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY;
    const ordemJogo = cliente.jogoTeste.mock.invocationCallOrder[0] ?? Number.NEGATIVE_INFINITY;
    expect(ordemSalvar).toBeLessThan(ordemJogo);
  });

  // @req RF-11 @tipo feliz
  test('test_RF11_tela_resposta_no_modo_testar_vai_ao_verificador_e_sair_volta_com_a_fase_inalterada', async () => {
    const { verificador, enigma: verificarEnigma } = verificadorFalso({ enigma: acerto({ posicao: 1, valor: '9' }) });
    const { user, cliente } = await montar({ documento: documentoTestavel(), jogo: jogoTestavel(), verificador });
    const palcosAntes = await entrarNoTeste(user);

    await responderNoTeste(user, palcosAntes, POS.b, '56');

    expect(verificarEnigma).toHaveBeenCalledWith('enigma-teste', '56');
    await aparece(MENSAGENS.respostaCorreta([{ posicao: 1, valor: '9' }]));

    await sairDoTeste(user);
    expect(screen.queryByRole('button', { name: ROTULOS_EDITOR.sairDoTeste })).toBeNull();
    expect(screen.getAllByRole('tab')).toHaveLength(5);
    await clicarSalvar(user);
    expect(cliente.salvarFase).not.toHaveBeenCalled();
    expect(botao(ROTULOS_EDITOR.desfazer)).toBeDisabled();
  });

  // @req RF-11 @tipo borda
  test('test_RF11_tela_testar_sem_alteracao_pendente_nao_grava_e_pede_o_jogo', async () => {
    const { user, cliente } = await montar({ documento: documentoTestavel(), jogo: jogoTestavel() });

    await entrarNoTeste(user);

    expect(cliente.salvarFase).not.toHaveBeenCalled();
    expect(cliente.jogoTeste).toHaveBeenCalledWith(FASE_ID);
  });

  // @req RF-11 @tipo borda
  test('test_RF11_tela_alteracao_feita_antes_de_testar_continua_igual_depois_de_sair', async () => {
    const { user, cliente } = await montar({ documento: documentoTestavel(), jogo: jogoTestavel() });
    await escolherObjeto(user, 'janela');
    await entrarNoTeste(user);
    const gravadoAoEntrar = structuredClone(documentoSalvo(cliente));

    await sairDoTeste(user);
    await escolherObjeto(user, 'relogio');
    await clicarSalvar(user);

    const depois = documentoSalvo(cliente);
    const semONovo = depois.paredes.frente.objetos.filter((o) => o.id !== 'novo-2');
    expect({ ...depois, paredes: { ...depois.paredes, frente: { ...depois.paredes.frente, objetos: semONovo } } }).toEqual(
      gravadoAoEntrar,
    );
    expect(depois.paredes.frente.objetos.find((o) => o.id === 'novo-2')).toMatchObject({ imagem: 'sprite:relogio' });
  });

  // @req RF-11 @tipo negativo
  test('test_RF11_tela_jogo_de_teste_recusado_mostra_o_erro_e_fica_na_edicao', async () => {
    const { verificador, enigma: verificarEnigma } = verificadorFalso({});
    const { user, cliente } = await montar({ documento: documentoTestavel(), jogo: jogoTestavel(), verificador });
    const mensagem = 'Fase não encontrada.';
    cliente.jogoTeste.mockResolvedValueOnce(recusa(404, mensagem));

    await user.click(botao(ROTULOS_EDITOR.testar));
    await assentar();

    await esperarAlertaCom(mensagem);
    expect(screen.queryByRole('button', { name: ROTULOS_EDITOR.sairDoTeste })).toBeNull();
    expect(screen.getAllByRole('tab')).toHaveLength(5);
    expect(verificarEnigma).not.toHaveBeenCalled();
  });

  // @req RF-11 @tipo negativo
  test('test_RF11_tela_resposta_errada_no_teste_nao_muda_a_fase', async () => {
    const { verificador } = verificadorFalso({ enigma: respostaErrada() });
    const { user, cliente } = await montar({ documento: documentoTestavel(), jogo: jogoTestavel(), verificador });
    const palcosAntes = await entrarNoTeste(user);

    await responderNoTeste(user, palcosAntes, POS.b, '57');
    await aparece(MENSAGENS.respostaErrada);
    await sairDoTeste(user);
    await clicarSalvar(user);

    expect(cliente.salvarFase).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// RF-12 · publicação recusada
// ---------------------------------------------------------------------------
const ERRO_PUBLICACAO = 'A fase não pode ser publicada: há posições da senha sem enigma.';

/** Números mostrados junto do título ROTULOS_EDITOR.posicoesSemEnigma (o menor bloco que contém título e números). */
async function posicoesListadas(): Promise<number[]> {
  const titulo = ROTULOS_EDITOR.posicoesSemEnigma;
  const [elemento] = await screen.findAllByText(mostraTexto(titulo));
  const semTitulo = (el: Element) => normalizar(el.textContent ?? '').replace(titulo, '');
  let bloco: Element | null = elemento ?? null;
  while (bloco && !/\d/.test(semTitulo(bloco))) bloco = bloco.parentElement;
  if (!bloco) throw new Error('nenhuma posição aparece junto do título');
  const numeros = [...semTitulo(bloco).matchAll(/\d+/g)].map((m) => Number(m[0]));
  return [...new Set(numeros)].sort((a, b) => a - b);
}

async function publicar(user: Usuario): Promise<void> {
  await user.click(botao(ROTULOS_EDITOR.publicar));
  await assentar();
}

describe('RF-12 · TelaEdicao: publicação bloqueada por posição sem enigma', () => {
  // @req RF-12 @tipo feliz
  test('test_RF12_tela_fase_com_todas_as_posicoes_ligadas_publica_sem_lista', async () => {
    const { user, cliente } = await montar({ documento: documentoJogavel('Sala sintética jogável') });

    await publicar(user);

    expect(cliente.publicarFase).toHaveBeenCalledTimes(1);
    expect(cliente.publicarFase).toHaveBeenCalledWith(FASE_ID);
    expect(estaNaTela(ROTULOS_EDITOR.posicoesSemEnigma)).toBe(false);
    expect(textosDosAlertas()).toEqual([]);
  });

  // @req RF-12 @tipo negativo
  test('test_RF12_tela_senha_92139_com_posicoes_2_e_5_sem_enigma_mostra_as_posicoes_2_e_5', async () => {
    const { user, cliente } = await montar({ documento: documentoComPosicoesSemEnigma('Sala sintética incompleta') });
    cliente.publicarFase.mockResolvedValueOnce({
      ok: false,
      status: 422,
      recusa: { erro: ERRO_PUBLICACAO, posicoesSemEnigma: [2, 5] },
    });

    await publicar(user);

    expect(await posicoesListadas()).toEqual([2, 5]);
  });

  // @req RF-12 @tipo borda
  test('test_RF12_tela_fase_sem_porta_publica_sem_lista', async () => {
    const { user, cliente } = await montar({ documento: documentoSemPorta('Sala sintética sem porta') });

    await publicar(user);

    expect(cliente.publicarFase).toHaveBeenCalledWith(FASE_ID);
    expect(estaNaTela(ROTULOS_EDITOR.posicoesSemEnigma)).toBe(false);
  });

  // @req RF-12 @tipo borda
  test('test_RF12_tela_posicoes_nos_extremos_da_senha_de_8_digitos_aparecem_1_e_8', async () => {
    const documento = {
      ...fase('20482048', { frente: [enigma('enigma-meio', [2, 3, 4, 5, 6, 7], [11])] }),
      titulo: 'Sala sintética de oito dígitos',
    };
    const { user, cliente } = await montar({ documento });
    cliente.publicarFase.mockResolvedValueOnce({
      ok: false,
      status: 422,
      recusa: { erro: ERRO_PUBLICACAO, posicoesSemEnigma: [1, 8] },
    });

    await publicar(user);

    expect(await posicoesListadas()).toEqual([1, 8]);
  });

  // @req RF-12 @tipo negativo
  test('test_RF12_tela_outra_falha_ao_publicar_mostra_o_erro_sem_lista_de_posicoes', async () => {
    const { user, cliente } = await montar({ documento: documentoJogavel('Sala sintética jogável') });
    cliente.publicarFase.mockResolvedValueOnce(recusa(500, 'Erro 500 do servidor.'));

    await publicar(user);

    await esperarAlertaCom('Erro 500 do servidor.');
    expect(estaNaTela(ROTULOS_EDITOR.posicoesSemEnigma)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// RF-13 · publicar e publicar de novo
// ---------------------------------------------------------------------------
describe('RF-13 · TelaEdicao: publicar e alterações não publicadas', () => {
  // @req RF-13 @tipo feliz
  test('test_RF13_tela_publicar_fase_nao_publicada_chama_a_api_sem_aviso_de_alteracoes', async () => {
    const { user, cliente } = await montar({ documento: documentoJogavel('Sala sintética jogável') });
    expect(estaNaTela(ROTULOS_EDITOR.alteracoesNaoPublicadas)).toBe(false);

    await publicar(user);

    expect(cliente.publicarFase).toHaveBeenCalledWith(FASE_ID);
    expect(cliente.servidor.publicada).toBe(true);
    expect(estaNaTela(ROTULOS_EDITOR.alteracoesNaoPublicadas)).toBe(false);
    expect(screen.queryByRole('button', { name: ROTULOS_EDITOR.publicarDeNovo })).toBeNull();
  });

  // @req RF-13 @tipo feliz
  test('test_RF13_tela_fase_publicada_com_rascunho_diferente_oferece_publicar_de_novo', async () => {
    const { user, cliente } = await montar({
      documento: documentoJogavel('Sala sintética jogável'),
      publicada: true,
      alteracoesNaoPublicadas: true,
    });
    expect(estaNaTela(ROTULOS_EDITOR.alteracoesNaoPublicadas)).toBe(true);

    await user.click(botao(ROTULOS_EDITOR.publicarDeNovo));
    await assentar();

    expect(cliente.publicarFase).toHaveBeenCalledTimes(1);
    expect(cliente.publicarFase).toHaveBeenCalledWith(FASE_ID);
    await waitFor(() => expect(estaNaTela(ROTULOS_EDITOR.alteracoesNaoPublicadas)).toBe(false));
  });

  // @req RF-13 @tipo borda
  test('test_RF13_tela_put_aceito_em_fase_publicada_le_a_fase_de_novo_e_mostra_o_aviso', async () => {
    const { user, cliente } = await montar({
      documento: documentoJogavel('Sala sintética jogável'),
      publicada: true,
      alteracoesNaoPublicadas: false,
    });
    expect(estaNaTela(ROTULOS_EDITOR.alteracoesNaoPublicadas)).toBe(false);
    expect(screen.queryByRole('button', { name: ROTULOS_EDITOR.publicarDeNovo })).toBeNull();

    await escolherObjeto(user, 'janela');
    await clicarSalvar(user);

    await waitFor(() => expect(cliente.abrirFase).toHaveBeenCalledTimes(2));
    await aparece(ROTULOS_EDITOR.alteracoesNaoPublicadas);
    expect(screen.getByRole('button', { name: ROTULOS_EDITOR.publicarDeNovo })).toBeInTheDocument();
  });

  // @req RF-13 @tipo negativo
  test('test_RF13_tela_fase_nao_publicada_nao_mostra_aviso_depois_de_salvar', async () => {
    const { user, cliente } = await montar({ documento: documentoJogavel('Sala sintética jogável') });

    await escolherObjeto(user, 'janela');
    await clicarSalvar(user);

    expect(cliente.salvarFase).toHaveBeenCalledTimes(1);
    expect(estaNaTela(ROTULOS_EDITOR.alteracoesNaoPublicadas)).toBe(false);
    expect(screen.queryByRole('button', { name: ROTULOS_EDITOR.publicarDeNovo })).toBeNull();
  });

  // @req RF-13 @tipo negativo
  test('test_RF13_tela_publicar_de_novo_recusado_mantem_o_aviso_e_mostra_o_erro', async () => {
    const { user, cliente } = await montar({
      documento: documentoJogavel('Sala sintética jogável'),
      publicada: true,
      alteracoesNaoPublicadas: true,
    });
    cliente.publicarFase.mockResolvedValueOnce(recusa(500, 'Erro 500 do servidor.'));

    await user.click(botao(ROTULOS_EDITOR.publicarDeNovo));
    await assentar();

    await esperarAlertaCom('Erro 500 do servidor.');
    expect(estaNaTela(ROTULOS_EDITOR.alteracoesNaoPublicadas)).toBe(true);
    expect(screen.getByRole('button', { name: ROTULOS_EDITOR.publicarDeNovo })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// RF-14 · exportar
// ---------------------------------------------------------------------------
function textoDeDataUrl(href: string): string {
  const virgula = href.indexOf(',');
  const cabecalho = href.slice(0, virgula);
  const corpo = href.slice(virgula + 1);
  if (!cabecalho.endsWith(';base64')) return decodeURIComponent(corpo);
  return new TextDecoder().decode(Uint8Array.from(atob(corpo), (c) => c.charCodeAt(0)));
}

describe('RF-14 · TelaEdicao: exportar', () => {
  type CriarUrl = (objeto: Blob | MediaSource) => string;
  let criarUrl: Mock<CriarUrl>;
  let linksClicados: HTMLAnchorElement[];
  let espiaoClique: { mockRestore(): void } | null = null;
  const originais = { criar: URL.createObjectURL, revogar: URL.revokeObjectURL };

  beforeEach(() => {
    linksClicados = [];
    let n = 0;
    criarUrl = vi.fn<CriarUrl>(() => {
      n += 1;
      return `blob:arquivo-sintetico-${n}`;
    });
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, writable: true, value: criarUrl });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, writable: true, value: vi.fn() });
    // Sem navegação real no jsdom: o clique no link de download só é registrado.
    espiaoClique = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      linksClicados.push(this);
    });
  });

  afterEach(() => {
    espiaoClique?.mockRestore();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, writable: true, value: originais.criar });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, writable: true, value: originais.revogar });
  });

  function linksDeDownload(): HTMLAnchorElement[] {
    const presentes = [...document.querySelectorAll<HTMLAnchorElement>('a[download]')];
    return [...linksClicados, ...presentes].filter((a) => a.hasAttribute('download'));
  }

  function houveEntrega(): boolean {
    return criarUrl.mock.calls.length > 0 || linksDeDownload().length > 0;
  }

  /** Conteúdos entregues para download (Blob passado a createObjectURL ou data URL num <a download>). */
  async function conteudosEntregues(): Promise<string[]> {
    const textos: string[] = [];
    for (const [arquivo] of criarUrl.mock.calls) if (arquivo instanceof Blob) textos.push(await lerTexto(arquivo));
    for (const link of linksDeDownload()) if (link.href.startsWith('data:')) textos.push(textoDeDataUrl(link.href));
    return textos;
  }

  async function exportar(user: Usuario): Promise<void> {
    await user.click(botao(ROTULOS_EDITOR.exportar));
    await assentar();
  }

  // @req RF-14 @tipo feliz
  test('test_RF14_tela_exportar_chama_a_api_e_entrega_o_envelope_para_download', async () => {
    const { user, cliente } = await montar();
    const esperado = JSON.stringify(envelope(cliente.servidor.documento));

    await exportar(user);

    expect(cliente.exportarFase).toHaveBeenCalledTimes(1);
    expect(cliente.exportarFase).toHaveBeenCalledWith(FASE_ID);
    await waitFor(() => expect(houveEntrega()).toBe(true));
    expect(await conteudosEntregues()).toContain(esperado);
  });

  // @req RF-14 @tipo borda
  test('test_RF14_tela_arquivo_entregue_e_identico_ao_da_api_com_imagem_embutida_e_acentos', async () => {
    const { user, cliente } = await montar();
    const documento = { ...documentoSala(), titulo: 'Sótão das frações — versão ímpar' };
    documento.paredes.fundo.fundo = `asset:${UUID_ASSET}`;
    const texto = JSON.stringify(envelope(documento, { [UUID_ASSET]: DATA_URL_PNG }), null, 2);
    cliente.exportarFase.mockResolvedValueOnce(ok(new Blob([texto], { type: 'application/json' })));

    await exportar(user);

    await waitFor(() => expect(houveEntrega()).toBe(true));
    expect(await conteudosEntregues()).toContain(texto);
  });

  // @req RF-14 @tipo negativo
  test('test_RF14_tela_exportar_recusado_mostra_o_erro_e_nao_baixa_nada', async () => {
    const { user, cliente } = await montar();
    const mensagem = 'Esta fase pertence a outro criador.';
    cliente.exportarFase.mockResolvedValueOnce(recusa(403, mensagem));

    await exportar(user);

    await esperarAlertaCom(mensagem);
    expect(criarUrl).not.toHaveBeenCalled();
    expect(linksDeDownload()).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// RNF-01 · aviso de resolução
// ---------------------------------------------------------------------------
describe('RNF-01 · TelaEdicao: aviso abaixo de 1280x720', () => {
  function avisoNaTela(): boolean {
    return estaNaTela(ROTULOS_EDITOR.avisoResolucao);
  }

  // @req RNF-01 @tipo feliz
  test('test_RNF01_tela_edicao_janela_1024x768_mostra_o_aviso', async () => {
    definirJanela(1024, 768);
    await montar();
    expect(avisoNaTela()).toBe(true);
  });

  // @req RNF-01 @tipo feliz
  test('test_RNF01_tela_edicao_com_o_aviso_a_edicao_continua', async () => {
    definirJanela(1024, 768);
    const { user, cliente } = await montar();
    expect(avisoNaTela()).toBe(true);

    await escolherObjeto(user, 'porta');
    await trocarPara(user, 'direita');

    expect(aba('direita')).toHaveAttribute('aria-selected', 'true');
    await waitFor(() => expect(cliente.salvarFase).toHaveBeenCalledTimes(1));
    expect(idsDe(objetosSalvos(cliente, 'frente'))).toEqual(['fala-frente', 'novo-1']);
  });

  // @req RNF-01 @tipo borda
  test.each([
    [1279, 720],
    [1280, 719],
  ])('test_RNF01_tela_edicao_janela_%ix%i_um_pixel_abaixo_mostra_o_aviso', async (largura, altura) => {
    definirJanela(largura, altura);
    await montar();
    expect(avisoNaTela()).toBe(true);
  });

  // @req RNF-01 @tipo borda
  test('test_RNF01_tela_edicao_janela_exatamente_1280x720_nao_mostra_o_aviso', async () => {
    definirJanela(1280, 720);
    await montar();
    expect(avisoNaTela()).toBe(false);
  });

  // @req RNF-01 @tipo borda
  test('test_RNF01_tela_edicao_reduzir_a_janela_para_1279x720_faz_o_aviso_aparecer', async () => {
    definirJanela(1280, 720);
    await montar();
    expect(avisoNaTela()).toBe(false);

    act(() => definirJanela(1279, 720));

    await waitFor(() => expect(avisoNaTela()).toBe(true));
  });

  // @req RNF-01 @tipo negativo
  test('test_RNF01_tela_edicao_janela_1920x1080_nao_mostra_o_aviso', async () => {
    definirJanela(1920, 1080);
    await montar();
    expect(avisoNaTela()).toBe(false);
  });
});
