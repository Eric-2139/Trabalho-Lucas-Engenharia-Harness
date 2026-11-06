/**
 * Módulo: TelaJogo (apps/player/contrato/index.ts · PropsTelaJogo; modulos-player.md §1 RenderizadorParede e §2 app).
 * Requisitos na tela de jogo (o motor já é testado em tests/player/motor.test.ts):
 * - RF-16: clicar numa decoração não mostra fala nem muda o jogo; clicar numa fala com texto T mostra T;
 * - RF-17: enigma com dica D mostra o ícone (clicável e acessível pelo teclado) que exibe D; sem dica, sem ícone;
 * - RF-15: acerto mostra "Resposta correta!" com os dígitos; erro mostra "Resposta Errada!!"; a porta abre só com a senha;
 * - RNF-01: abaixo de 1280x720 aparece um aviso (sem bloquear o jogo);
 * - RNF-02 (LAC-046, Eric em 06/11/2026; rodada E, DEF-05): o palco mede o elemento que o contém (ResizeObserver) e a
 *   sala é o maior 16:9 dentro dele; sem ResizeObserver, a janela é a reserva; com ele, a janela nunca é usada.
 *   O clique continua acertando o objeto com o palco medido no contêiner (RF-16). O layout em colunas e "a página
 *   não rola" não são verificáveis no jsdom (não faz layout): ficam para o teste do sistema (Playwright);
 * - RF-18: a fase original (projeção de fases-exemplo/escola-01.json) é jogável até abrir a porta com 92139.
 *
 * O verificador é sempre um falso injetado (sem rede). O clique em objeto do palco é um clique real no
 * canvas Konva, nas coordenadas de paraPixels (tests/support/palco-tela.ts). Leituras do contrato usadas
 * aqui: os 5 botões de parede têm o nome da parede; o controle de dica é um botão cujo nome tem "dica";
 * a caixa de resposta ou senha é um campo de texto (enviado com Enter num formulário ou pelo botão de envio).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TelaJogo } from '@math-scape/app-player';
import { calcularPalco } from '@math-scape/player';
import { MENSAGENS, type Retangulo, type Verificador } from '@math-scape/player/contrato';
import { projetarParaJogo, respostaConfere, senhaConfere, validarFase } from '@math-scape/schema';
import type { DigitoRevelado, Fase, FaseJogo, ObjetoJogo, ParedeJogo } from '@math-scape/schema/contrato';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import {
  acerto,
  decoracaoJogo,
  enigmaJogo,
  erro,
  FALA_DIREITA,
  FALA_FRENTE,
  faseJogo,
  falaJogo,
  portaJogo,
  verificadorFalso,
} from '../fixtures/fases-jogo.ts';
import {
  clicarObjeto,
  conteudoDoPalco,
  definirJanela,
  esperarDesenho,
  normalizar,
  palcoDaTela,
} from '../support/palco-tela.ts';
import {
  type Medida,
  instalarResizeObserverFalso,
  redimensionarConteiner,
  removerResizeObserver,
  restaurarResizeObserver,
  tamanhoDoElemento,
} from '../support/resize-observer-falso.ts';

type NomeParede = 'frente' | 'direita' | 'fundo' | 'esquerda' | 'teto';
const PAREDES: NomeParede[] = ['frente', 'direita', 'fundo', 'esquerda', 'teto'];
type Usuario = ReturnType<typeof userEvent.setup>;

// ---------------------------------------------------------------------------
// Fases sintéticas: objetos grandes, em posições que não se sobrepõem.
// ---------------------------------------------------------------------------
const POS = {
  a: { x: 0.05, y: 0.1, largura: 0.2, altura: 0.3 },
  b: { x: 0.3, y: 0.1, largura: 0.2, altura: 0.3 },
  c: { x: 0.55, y: 0.1, largura: 0.2, altura: 0.3 },
  d: { x: 0.05, y: 0.55, largura: 0.2, altura: 0.3 },
  e: { x: 0.3, y: 0.55, largura: 0.2, altura: 0.3 },
} as const;

const em = (objeto: ObjetoJogo, pos: (typeof POS)[keyof typeof POS]): ObjetoJogo => ({ ...objeto, ...pos });

const FALA_FUNDO = 'Você: a estante está cheia de cadernos velhos.';
const FALA_ESQUERDA = 'Você: alguém riscou números na mesa.';
const FALA_TETO = 'Você: a lâmpada pisca sem parar.';
const PERGUNTA_B = 'Quanto é 12 x 5?';
const DICA_B = 'Some 12 cinco vezes.';
const PERGUNTA_SEM_DICA = 'Quanto é 81 dividido por 9?';
const PERGUNTA_DIREITA = 'Quanto é 3 ao cubo?';
const DICA_DIREITA = 'Multiplique o 3 por ele mesmo três vezes.';

/** Uma fala por parede; na frente, decoração na posição A (onde a direita tem a sua fala). */
function faseFalas(): FaseJogo {
  return faseJogo({
    frente: [em(decoracaoJogo('decoracao-frente'), POS.a), em(falaJogo('fala-frente', FALA_FRENTE), POS.b)],
    direita: [em(falaJogo('fala-direita', FALA_DIREITA), POS.a)],
    fundo: [em(falaJogo('fala-fundo', FALA_FUNDO), POS.c)],
    esquerda: [em(falaJogo('fala-esquerda', FALA_ESQUERDA), POS.d)],
    teto: [em(falaJogo('fala-teto', FALA_TETO), POS.e)],
  });
}

/** Frente: porta (A), enigma com dica (B), decoração (D). Direita: enigma sem dica (B). */
function faseEnigmas(): FaseJogo {
  return faseJogo({
    frente: [
      em(portaJogo('porta-1'), POS.a),
      em(enigmaJogo('enigma-b', PERGUNTA_B, DICA_B), POS.b),
      em(decoracaoJogo('decoracao-frente'), POS.d),
    ],
    direita: [em(enigmaJogo('enigma-sem-dica', PERGUNTA_SEM_DICA), POS.b)],
  });
}

/** Nenhuma dica: enigma sem dica (B), fala (A) e decoração (D) na frente. */
function faseSemDica(): FaseJogo {
  return faseJogo({
    frente: [
      em(falaJogo('fala-frente', FALA_FRENTE), POS.a),
      em(enigmaJogo('enigma-sem-dica', PERGUNTA_SEM_DICA), POS.b),
      em(decoracaoJogo('decoracao-frente'), POS.d),
    ],
  });
}

/** Frente: enigma sem dica (B). Direita: enigma com dica (C). */
function faseDicaNaDireita(): FaseJogo {
  return faseJogo({
    frente: [em(enigmaJogo('enigma-sem-dica', PERGUNTA_SEM_DICA), POS.b)],
    direita: [em(enigmaJogo('enigma-direita', PERGUNTA_DIREITA, DICA_DIREITA), POS.c)],
  });
}

// ---------------------------------------------------------------------------
// Montagem e interação
// ---------------------------------------------------------------------------
async function montar(fase: FaseJogo, verificador: Verificador) {
  const aoConcluir = vi.fn<() => void>();
  const tela = render(
    <TelaJogo faseId="fase-tela-1" fase={fase} baseUrlApi="/api" verificador={verificador} aoConcluir={aoConcluir} />,
  );
  await esperarDesenho();
  return { aoConcluir, ...tela };
}

/** Botão que leva à parede (nome com a palavra da parede; não confunde com o controle de dica). */
function botaoParede(nome: NomeParede): HTMLElement {
  const candidatos = screen
    .getAllByRole('button', { name: new RegExp(`\\b${nome}\\b`, 'i') })
    .filter((b) => !/dica/i.test(`${b.getAttribute('aria-label') ?? ''} ${b.textContent ?? ''}`));
  expect(candidatos, `botão da parede ${nome}`).toHaveLength(1);
  return candidatos[0] as HTMLElement;
}

async function irPara(user: Usuario, nome: NomeParede): Promise<void> {
  await user.click(botaoParede(nome));
  await esperarDesenho();
}

const SELETOR_CAMPO =
  'input:not([type=hidden]):not([type=button]):not([type=submit]):not([type=checkbox]):not([type=radio]), textarea';

/** O campo de resposta ou senha aberto na tela. */
async function campoAberto(): Promise<HTMLInputElement> {
  return waitFor(() => {
    const campo = document.querySelector<HTMLInputElement>(SELETOR_CAMPO);
    if (!campo) throw new Error('Nenhum campo de resposta ou senha aberto.');
    return campo;
  });
}

/** Digita o texto no campo e envia (Enter no formulário, ou o botão de envio). */
async function enviar(user: Usuario, campo: HTMLInputElement, texto: string): Promise<void> {
  await user.clear(campo);
  await user.type(campo, texto);
  if (campo.closest('form')) {
    await user.keyboard('{Enter}');
    return;
  }
  const botao = screen.queryAllByRole('button', { name: /responder|enviar|confirmar|verificar|abrir|tentar|ok/i })[0];
  if (botao) await user.click(botao);
  else await user.keyboard('{Enter}');
}

/** Elemento que mostra o texto (com espaços e quebras colapsados), sem contar os ancestrais. */
function mostraTexto(texto: string) {
  const alvo = normalizar(texto);
  return (_: string, el: Element | null) =>
    !!el &&
    normalizar(el.textContent ?? '').includes(alvo) &&
    ![...el.children].some((filho) => normalizar(filho.textContent ?? '').includes(alvo));
}

/** Espera o texto aparecer na tela (o elemento pode ter outro texto em volta). */
async function aparece(texto: string): Promise<void> {
  expect((await screen.findAllByText(mostraTexto(texto))).length, `"${texto}" na tela`).toBeGreaterThan(0);
}

function estaNaTela(texto: string): boolean {
  return screen.queryAllByText(mostraTexto(texto)).length > 0;
}

function botoesDeDica(): HTMLElement[] {
  return screen.queryAllByRole('button', { name: /dica/i });
}

const AVISO_RESOLUCAO = /1280\s*[x×]\s*720|resolu[çc][ãa]o/i;

beforeEach(() => definirJanela(1280, 720));
afterEach(() => definirJanela(1024, 768));

// ---------------------------------------------------------------------------
describe('RF-16 · TelaJogo: falas e decorações', () => {
  // @req RF-16 @tipo feliz
  test('test_RF16_tela_clicar_fala_mostra_o_texto', async () => {
    const { verificador } = verificadorFalso({});
    const fase = faseFalas();
    await montar(fase, verificador);
    expect(estaNaTela(FALA_FRENTE)).toBe(false);

    clicarObjeto(fase.paredes.frente, 'fala-frente');

    await aparece(FALA_FRENTE);
  });

  // @req RF-16 @tipo feliz
  test('test_RF16_tela_botao_de_parede_troca_a_parede_e_a_fala_dela_responde', async () => {
    const user = userEvent.setup();
    const { verificador } = verificadorFalso({});
    const fase = faseFalas();
    await montar(fase, verificador);

    await irPara(user, 'direita');
    clicarObjeto(fase.paredes.direita, 'fala-direita');

    await aparece(FALA_DIREITA);
  });

  // @req RF-16 @tipo borda
  test('test_RF16_tela_os_5_botoes_de_parede_levam_cada_um_a_sua_fala', async () => {
    const user = userEvent.setup();
    const { verificador } = verificadorFalso({});
    const fase = faseFalas();
    await montar(fase, verificador);
    const falas: Record<NomeParede, [string, string]> = {
      direita: ['fala-direita', FALA_DIREITA],
      fundo: ['fala-fundo', FALA_FUNDO],
      esquerda: ['fala-esquerda', FALA_ESQUERDA],
      teto: ['fala-teto', FALA_TETO],
      frente: ['fala-frente', FALA_FRENTE],
    };
    for (const nome of ['direita', 'fundo', 'esquerda', 'teto', 'frente'] as const) {
      const [id, texto] = falas[nome];
      await irPara(user, nome);
      clicarObjeto(fase.paredes[nome], id);
      await aparece(texto);
    }
  });

  // @req RF-16 @tipo borda
  test('test_RF16_tela_fala_de_outra_parede_nao_responde_no_mesmo_lugar_da_parede_ativa', async () => {
    const { verificador, enigma, porta } = verificadorFalso({});
    const fase = faseFalas();
    await montar(fase, verificador);

    // Na frente, a posição A é a decoração; a fala da direita está na mesma posição, mas na outra parede.
    clicarObjeto(fase.paredes.direita, 'fala-direita');
    await esperarDesenho();

    expect(estaNaTela(FALA_DIREITA)).toBe(false);
    expect(enigma).not.toHaveBeenCalled();
    expect(porta).not.toHaveBeenCalled();

    // Controle: o palco já respondia a cliques nesse desenho.
    clicarObjeto(fase.paredes.frente, 'fala-frente');
    await aparece(FALA_FRENTE);
  });

  // @req RF-16 @tipo negativo
  test('test_RF16_tela_clicar_decoracao_nao_mostra_fala_nem_muda_o_jogo', async () => {
    const { verificador, enigma, porta } = verificadorFalso({});
    const fase = faseFalas();
    const { aoConcluir } = await montar(fase, verificador);
    const textoAntes = document.body.textContent;

    clicarObjeto(fase.paredes.frente, 'decoracao-frente');
    await esperarDesenho();

    expect(document.body.textContent).toBe(textoAntes);
    expect(document.querySelector(SELETOR_CAMPO)).toBeNull();
    expect(enigma).not.toHaveBeenCalled();
    expect(porta).not.toHaveBeenCalled();
    expect(aoConcluir).not.toHaveBeenCalled();

    // Controle: no mesmo desenho, o clique na fala ao lado funciona (o clique na decoração chegou ao palco).
    clicarObjeto(fase.paredes.frente, 'fala-frente');
    await aparece(FALA_FRENTE);
  });
});

// ---------------------------------------------------------------------------
describe('RF-17 · TelaJogo: ícone de dica', () => {
  // @req RF-17 @tipo feliz
  test('test_RF17_tela_enigma_com_dica_tem_controle_que_mostra_a_dica', async () => {
    const user = userEvent.setup();
    const { verificador } = verificadorFalso({});
    await montar(faseEnigmas(), verificador);
    expect(estaNaTela(DICA_B)).toBe(false);

    const dicas = botoesDeDica();
    expect(dicas).toHaveLength(1);
    await user.click(dicas[0] as HTMLElement);

    await aparece(DICA_B);
  });

  // @req RF-17 @tipo borda
  test('test_RF17_tela_controle_de_dica_funciona_so_pelo_teclado', async () => {
    const user = userEvent.setup();
    const { verificador } = verificadorFalso({});
    await montar(faseEnigmas(), verificador);
    const [dica] = botoesDeDica();
    expect(dica).toBeDefined();

    for (let i = 0; i < 30 && document.activeElement !== dica; i++) await user.tab();
    expect(dica).toHaveFocus();
    await user.keyboard('{Enter}');

    await aparece(DICA_B);
  });

  // @req RF-17 @tipo borda
  test('test_RF17_tela_icone_aparece_so_na_parede_do_enigma_com_dica', async () => {
    const user = userEvent.setup();
    const { verificador } = verificadorFalso({});
    await montar(faseDicaNaDireita(), verificador);
    expect(botoesDeDica()).toHaveLength(0);

    await irPara(user, 'direita');
    const dicas = botoesDeDica();
    expect(dicas).toHaveLength(1);
    await user.click(dicas[0] as HTMLElement);

    await aparece(DICA_DIREITA);
  });

  // @req RF-17 @tipo negativo
  test('test_RF17_tela_enigma_sem_dica_nao_tem_icone_nem_depois_de_aberto', async () => {
    const { verificador } = verificadorFalso({});
    const fase = faseSemDica();
    await montar(fase, verificador);
    expect(botoesDeDica()).toHaveLength(0);

    clicarObjeto(fase.paredes.frente, 'enigma-sem-dica');
    await aparece(PERGUNTA_SEM_DICA);

    expect(botoesDeDica()).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
describe('RF-15 · TelaJogo: respostas, dígitos e porta', () => {
  // @req RF-15 @tipo feliz
  test('test_RF15_tela_resposta_certa_mostra_resposta_correta_com_o_digito', async () => {
    const user = userEvent.setup();
    const digitos: DigitoRevelado[] = [{ posicao: 4, valor: '3' }];
    const { verificador, enigma } = verificadorFalso({ enigma: acerto(...digitos) });
    const fase = faseEnigmas();
    await montar(fase, verificador);

    clicarObjeto(fase.paredes.frente, 'enigma-b');
    await aparece(PERGUNTA_B);
    await enviar(user, await campoAberto(), '60');

    await aparece(MENSAGENS.respostaCorreta(digitos));
    expect(enigma).toHaveBeenCalledWith('enigma-b', '60');
  });

  // @req RF-15 @tipo feliz
  test('test_RF15_tela_porta_com_senha_aberta_conclui_e_chama_ao_concluir', async () => {
    const user = userEvent.setup();
    const { verificador, porta } = verificadorFalso({ porta: { aberta: true } });
    const fase = faseEnigmas();
    const { aoConcluir } = await montar(fase, verificador);

    clicarObjeto(fase.paredes.frente, 'porta-1');
    await enviar(user, await campoAberto(), '56781');

    await waitFor(() => expect(aoConcluir).toHaveBeenCalledTimes(1));
    expect(porta).toHaveBeenCalledWith('porta-1', '56781');
  });

  // @req RF-15 @tipo borda
  test('test_RF15_tela_acerto_sem_digitos_mostra_so_resposta_correta', async () => {
    const user = userEvent.setup();
    const { verificador } = verificadorFalso({ enigma: acerto() });
    const fase = faseEnigmas();
    await montar(fase, verificador);

    clicarObjeto(fase.paredes.frente, 'enigma-b');
    await enviar(user, await campoAberto(), '60');

    await aparece('Resposta correta!');
    expect(screen.queryByText(/Dígito/)).not.toBeInTheDocument();
  });

  // @req RF-15 @tipo borda
  test('test_RF15_tela_acerto_com_dois_digitos_mostra_os_dois_em_ordem_de_posicao', async () => {
    const user = userEvent.setup();
    const { verificador } = verificadorFalso({
      enigma: acerto({ posicao: 2, valor: '7' }, { posicao: 1, valor: '5' }),
    });
    const fase = faseEnigmas();
    await montar(fase, verificador);

    clicarObjeto(fase.paredes.frente, 'enigma-b');
    await enviar(user, await campoAberto(), '60');

    await aparece('Resposta correta! Dígitos revelados: posição 1 = 5, posição 2 = 7');
  });

  // @req RF-15 @tipo negativo
  test('test_RF15_tela_resposta_errada_mostra_resposta_errada_e_nenhum_digito', async () => {
    const user = userEvent.setup();
    const { verificador, enigma } = verificadorFalso({ enigma: erro() });
    const fase = faseEnigmas();
    await montar(fase, verificador);

    clicarObjeto(fase.paredes.frente, 'enigma-b');
    await enviar(user, await campoAberto(), 'sessenta');

    await aparece('Resposta Errada!!');
    expect(screen.queryByText(/Resposta correta/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Dígito/)).not.toBeInTheDocument();
    expect(enigma).toHaveBeenCalledWith('enigma-b', 'sessenta');
  });

  // @req RF-15 @tipo negativo
  test('test_RF15_tela_senha_errada_nao_abre_a_porta', async () => {
    const user = userEvent.setup();
    const { verificador, porta } = verificadorFalso({ porta: { aberta: false } });
    const fase = faseEnigmas();
    const { aoConcluir } = await montar(fase, verificador);

    clicarObjeto(fase.paredes.frente, 'porta-1');
    await enviar(user, await campoAberto(), '56780');

    await aparece('Senha incorreta!');
    expect(porta).toHaveBeenCalledWith('porta-1', '56780');
    expect(aoConcluir).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
describe('RNF-01 · TelaJogo: aviso de resolução', () => {
  async function montarNaJanela(largura: number, altura: number) {
    definirJanela(largura, altura);
    const { verificador } = verificadorFalso({});
    const fase = faseFalas();
    const montada = await montar(fase, verificador);
    return { fase, ...montada };
  }

  // @req RNF-01 @tipo feliz
  test('test_RNF01_tela_janela_1024x768_mostra_aviso', async () => {
    await montarNaJanela(1024, 768);
    expect(screen.queryAllByText(AVISO_RESOLUCAO).length).toBeGreaterThan(0);
  });

  // @req RNF-01 @tipo feliz
  test('test_RNF01_tela_aviso_nao_bloqueia_o_jogo', async () => {
    const { fase } = await montarNaJanela(1024, 768);
    expect(screen.queryAllByText(AVISO_RESOLUCAO).length).toBeGreaterThan(0);
    for (const nome of PAREDES) expect(botaoParede(nome)).toBeEnabled();

    clicarObjeto(fase.paredes.frente, 'fala-frente');
    await aparece(FALA_FRENTE);
  });

  // @req RNF-01 @tipo borda
  test.each([
    [1279, 720],
    [1280, 719],
  ])('test_RNF01_tela_janela_%ix%i_um_pixel_abaixo_mostra_aviso', async (largura, altura) => {
    await montarNaJanela(largura, altura);
    expect(screen.queryAllByText(AVISO_RESOLUCAO).length).toBeGreaterThan(0);
  });

  // @req RNF-01 @tipo borda
  test('test_RNF01_tela_janela_exatamente_1280x720_nao_mostra_aviso', async () => {
    await montarNaJanela(1280, 720);
    expect(screen.queryAllByText(AVISO_RESOLUCAO)).toHaveLength(0);
  });

  // @req RNF-01 @tipo negativo
  test('test_RNF01_tela_janela_1920x1080_nao_mostra_aviso', async () => {
    await montarNaJanela(1920, 1080);
    expect(screen.queryAllByText(AVISO_RESOLUCAO)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// RF-18: a fase original jogada na tela. Os valores esperados (respostas, dígitos, senha) vêm do
// critério do RF-18; escola-01.json é a entrada conferida, e o verificador falso faz o que a Api faz
// (respostaConfere / senhaConfere sobre o documento completo).
// ---------------------------------------------------------------------------
// No ambiente jsdom, URL é a do jsdom e readFileSync não a aceita: caminho a partir da raiz do projeto (raiz do Vitest).
const ARQUIVO_ESCOLA = join(process.cwd(), 'fases-exemplo', 'escola-01.json');

function escola(): Fase {
  const resultado = validarFase(JSON.parse(readFileSync(ARQUIVO_ESCOLA, 'utf8')));
  if (!resultado.ok) throw new Error(`escola-01.json fora do schema: ${JSON.stringify(resultado.erros)}`);
  return resultado.fase;
}

/** Verificador falso que confere como a Api: sobre o documento completo, com as funções do schema. */
function verificadorDaEscola(fase: Fase) {
  const objetos = PAREDES.flatMap((p) => fase.paredes[p].objetos);
  const enigma = vi.fn(async (objetoId: string, resposta: string) => {
    const interacao = objetos.find((o) => o.id === objetoId)?.interacao;
    if (interacao?.tipo !== 'enigma' || !respostaConfere(resposta, interacao.respostas)) {
      return { correto: false, digitos: [] };
    }
    return {
      correto: true,
      digitos: interacao.revela.map((posicao) => ({ posicao, valor: fase.senha[posicao - 1] ?? '' })),
    };
  });
  const porta = vi.fn(async (objetoId: string, senha: string) => ({
    aberta: objetos.find((o) => o.id === objetoId)?.interacao.tipo === 'porta' && senhaConfere(senha, fase.senha),
  }));
  const verificador: Verificador = { enigma, porta };
  return { verificador, enigma, porta };
}

function enigmasDa(parede: ParedeJogo): ObjetoJogo[] {
  return parede.objetos.filter((o) => o.interacao.tipo === 'enigma');
}

function unicoEnigma(parede: ParedeJogo): ObjetoJogo {
  const enigmas = enigmasDa(parede);
  expect(enigmas).toHaveLength(1);
  return enigmas[0] as ObjetoJogo;
}

function enigmaDaEsquerda(jogo: FaseJogo, trecho: string): ObjetoJogo {
  const encontrado = enigmasDa(jogo.paredes.esquerda).find(
    (o) => o.interacao.tipo === 'enigma' && normalizar(o.interacao.pergunta).includes(trecho),
  );
  expect(encontrado, `enigma da esquerda com "${trecho}"`).toBeDefined();
  return encontrado as ObjetoJogo;
}

function portaDa(parede: ParedeJogo): ObjetoJogo {
  const porta = parede.objetos.find((o) => o.interacao.tipo === 'porta');
  expect(porta).toBeDefined();
  return porta as ObjetoJogo;
}

function perguntaDe(objeto: ObjetoJogo): string {
  return objeto.interacao.tipo === 'enigma' ? objeto.interacao.pergunta : '';
}

/** Abre o enigma no palco (a pergunta aparece) e responde. */
async function responderEnigma(
  user: Usuario,
  parede: ParedeJogo,
  objeto: ObjetoJogo,
  resposta: string,
  espiao: ReturnType<typeof verificadorDaEscola>['enigma'],
) {
  clicarObjeto(parede, objeto.id);
  await aparece(perguntaDe(objeto));
  await enviar(user, await campoAberto(), resposta);
  await waitFor(() => expect(espiao).toHaveBeenLastCalledWith(objeto.id, resposta));
}

/** Abre a porta no palco (sai o modo de resposta: nenhuma pergunta à mostra) e digita a senha. */
async function digitarSenha(user: Usuario, jogo: FaseJogo, senha: string) {
  const porta = portaDa(jogo.paredes.frente);
  const perguntas = PAREDES.flatMap((p) => enigmasDa(jogo.paredes[p])).map(perguntaDe);
  clicarObjeto(jogo.paredes.frente, porta.id);
  const campo = await waitFor(() => {
    for (const pergunta of perguntas) expect(estaNaTela(pergunta), 'pergunta ainda à mostra').toBe(false);
    const aberto = document.querySelector<HTMLInputElement>(SELETOR_CAMPO);
    if (!aberto) throw new Error('Nenhum campo de senha aberto.');
    return aberto;
  });
  await enviar(user, campo, senha);
  return porta;
}

const correta = (...digitos: DigitoRevelado[]) => MENSAGENS.respostaCorreta(digitos);

describe('RF-18 · TelaJogo: fase original jogável', () => {
  // @req RF-18 @tipo feliz
  test(
    'test_RF18_tela_resolvendo_tudo_e_digitando_92139_a_porta_abre',
    async () => {
      const user = userEvent.setup();
      const original = escola();
      const jogo = projetarParaJogo(original);
      const { verificador, enigma, porta } = verificadorDaEscola(original);
      const { aoConcluir } = await montar(jogo, verificador);

      // Esquerda: 15 e 40, sem dígito (dados para o teto).
      await irPara(user, 'esquerda');
      await responderEnigma(user, jogo.paredes.esquerda, enigmaDaEsquerda(jogo, 'horas do relógio'), '15', enigma);
      await aparece('Resposta correta!');
      await responderEnigma(user, jogo.paredes.esquerda, enigmaDaEsquerda(jogo, 'minutos do relógio'), '40', enigma);
      await aparece('Resposta correta!');

      // Teto: 55 → 9 e 2.
      await irPara(user, 'teto');
      await responderEnigma(user, jogo.paredes.teto, unicoEnigma(jogo.paredes.teto), '55', enigma);
      await aparece(correta({ posicao: 1, valor: '9' }, { posicao: 2, valor: '2' }));

      // Direita: 123 → 1.
      await irPara(user, 'direita');
      await responderEnigma(user, jogo.paredes.direita, unicoEnigma(jogo.paredes.direita), '123', enigma);
      await aparece(correta({ posicao: 3, valor: '1' }));

      // Frente: 310 → 3.
      await irPara(user, 'frente');
      await responderEnigma(user, jogo.paredes.frente, unicoEnigma(jogo.paredes.frente), '310', enigma);
      await aparece(correta({ posicao: 4, valor: '3' }));

      // Fundo: 80 → 9.
      await irPara(user, 'fundo');
      await responderEnigma(user, jogo.paredes.fundo, unicoEnigma(jogo.paredes.fundo), '80', enigma);
      await aparece(correta({ posicao: 5, valor: '9' }));

      // Porta, na frente: 92139.
      await irPara(user, 'frente');
      const portaEscola = await digitarSenha(user, jogo, '92139');

      await waitFor(() => expect(aoConcluir).toHaveBeenCalledTimes(1));
      expect(porta).toHaveBeenLastCalledWith(portaEscola.id, '92139');
    },
    60_000,
  );

  // @req RF-18 @tipo borda
  test(
    'test_RF18_tela_fundo_aceita_menos_15_e_revela_o_9',
    async () => {
      const user = userEvent.setup();
      const original = escola();
      const jogo = projetarParaJogo(original);
      const { verificador, enigma } = verificadorDaEscola(original);
      await montar(jogo, verificador);

      await irPara(user, 'fundo');
      await responderEnigma(user, jogo.paredes.fundo, unicoEnigma(jogo.paredes.fundo), '-15', enigma);

      await aparece(correta({ posicao: 5, valor: '9' }));
    },
    30_000,
  );

  // @req RF-18 @tipo negativo
  test(
    'test_RF18_tela_senha_diferente_de_92139_nao_abre_a_porta',
    async () => {
      const user = userEvent.setup();
      const original = escola();
      const jogo = projetarParaJogo(original);
      const { verificador, porta } = verificadorDaEscola(original);
      const { aoConcluir } = await montar(jogo, verificador);

      const portaEscola = await digitarSenha(user, jogo, '92193');

      await aparece('Senha incorreta!');
      expect(porta).toHaveBeenLastCalledWith(portaEscola.id, '92193');
      expect(aoConcluir).not.toHaveBeenCalled();
    },
    30_000,
  );

  // @req RF-18 @tipo negativo
  test(
    'test_RF18_tela_teto_com_resposta_errada_nao_revela_digito',
    async () => {
      const user = userEvent.setup();
      const original = escola();
      const jogo = projetarParaJogo(original);
      const { verificador, enigma } = verificadorDaEscola(original);
      await montar(jogo, verificador);

      await irPara(user, 'teto');
      await responderEnigma(user, jogo.paredes.teto, unicoEnigma(jogo.paredes.teto), '54', enigma);

      await aparece('Resposta Errada!!');
      expect(screen.queryByText(/Dígito/)).not.toBeInTheDocument();
    },
    30_000,
  );
});

// ---------------------------------------------------------------------------
// RNF-02 e RF-16 · palco medido no contêiner (DEF-05; LAC-046, Eric em 06/11/2026)
// O ResizeObserver falso (tests/support/resize-observer-falso.ts) mede o contêiner; a janela fica em 1280x720 (beforeEach
// do arquivo), para que a sala do contêiner e a da janela sejam diferentes. O Stage pode ter o tamanho do contêiner ou o
// da própria sala; o contrato fixa a sala: o maior 16:9 dentro do contêiner (calcularPalco). O falso é removido depois
// de cada caso. Posição em pixels dos elementos da coluna e rolagem da página não são testadas (o jsdom não faz layout).
// ---------------------------------------------------------------------------
const CONTEINER: Medida = { largura: 900, altura: 500 };

/** Diferença de até 1 px (o Stage pode arredondar a medida). */
function perto(obtido: number, esperado: number, rotulo: string): void {
  expect(Math.abs(obtido - esperado), `${rotulo}: ${obtido} ≈ ${esperado}`).toBeLessThanOrEqual(1);
}

/** A sala desenhada é o maior 16:9 do contêiner `m`, e o Stage não passa do contêiner. */
function conferirSalaDoConteiner(m: Medida): void {
  const sala: Retangulo = palcoDaTela();
  const esperada = calcularPalco(m.largura, m.altura);
  perto(sala.largura, esperada.largura, 'largura da sala');
  perto(sala.altura, esperada.altura, 'altura da sala');
  const stage = tamanhoDoElemento(conteudoDoPalco());
  expect(stage.largura, 'largura do Stage').toBeLessThanOrEqual(m.largura + 1);
  expect(stage.altura, 'altura do Stage').toBeLessThanOrEqual(m.altura + 1);
}

async function esperarSalaDoConteiner(m: Medida): Promise<void> {
  await waitFor(() => conferirSalaDoConteiner(m));
}

describe('RNF-02 · TelaJogo: palco medido no contêiner', () => {
  afterEach(() => restaurarResizeObserver());

  // @req RNF-02 @tipo feliz
  test('test_RNF02_tela_com_resize_observer_a_sala_e_o_maior_16_9_do_conteiner_e_nao_da_janela', async () => {
    instalarResizeObserverFalso(CONTEINER);
    const { verificador } = verificadorFalso({});
    await montar(faseFalas(), verificador);

    await esperarSalaDoConteiner(CONTEINER);
    const sala = palcoDaTela();
    expect(sala.largura / sala.altura).toBeCloseTo(16 / 9, 2);
    // Pela janela (1280x720), a sala seria 1280x720.
    expect(sala.largura).toBeLessThan(1279);
    expect(sala.altura).toBeLessThan(719);
  });

  // @req RNF-02 @tipo feliz
  test.each([
    [1280, 720, 960, 660],
    [1920, 1080, 1600, 800],
    [2560, 1440, 1920, 1360],
  ])(
    'test_RNF02_tela_janela_%ix%i_conteiner_%ix%i_sala_16_9_e_objeto_na_posicao_relativa',
    async (larguraJanela, alturaJanela, larguraConteiner, alturaConteiner) => {
      definirJanela(larguraJanela, alturaJanela);
      const conteiner = { largura: larguraConteiner, altura: alturaConteiner };
      instalarResizeObserverFalso(conteiner);
      const { verificador } = verificadorFalso({});
      const fase = faseFalas();
      await montar(fase, verificador);

      await esperarSalaDoConteiner(conteiner);
      const sala = palcoDaTela();
      expect(sala.largura / sala.altura).toBeCloseTo(16 / 9, 2);
      clicarObjeto(fase.paredes.frente, 'fala-frente');
      await aparece(FALA_FRENTE);
    },
  );

  // @req RNF-02 @tipo borda
  test('test_RNF02_tela_conteiner_redimensionado_a_sala_acompanha_e_o_clique_ainda_acerta', async () => {
    instalarResizeObserverFalso(CONTEINER);
    const { verificador } = verificadorFalso({});
    const fase = faseFalas();
    await montar(fase, verificador);
    await esperarSalaDoConteiner(CONTEINER);

    // 640x600: agora a largura limita (sala 640x360); antes, a altura limitava (888,9x500).
    redimensionarConteiner({ largura: 640, altura: 600 });
    await esperarDesenho();

    await esperarSalaDoConteiner({ largura: 640, altura: 600 });
    perto(palcoDaTela().largura, 640, 'largura da sala');
    perto(palcoDaTela().altura, 360, 'altura da sala');
    clicarObjeto(fase.paredes.frente, 'fala-frente');
    await aparece(FALA_FRENTE);
  });

  // @req RNF-02 @tipo borda
  test('test_RNF02_tela_sem_resize_observer_a_janela_e_a_reserva', async () => {
    removerResizeObserver();
    expect(typeof (globalThis as { ResizeObserver?: unknown }).ResizeObserver).toBe('undefined');
    const { verificador } = verificadorFalso({});
    const fase = faseFalas();
    await montar(fase, verificador);

    const antes = tamanhoDoElemento(conteudoDoPalco());
    expect(antes.largura).toBeGreaterThan(0);
    expect(antes.altura).toBeGreaterThan(0);
    expect(antes.largura).toBeLessThanOrEqual(1280);
    expect(antes.altura).toBeLessThanOrEqual(720);

    act(() => definirJanela(1920, 1080));
    await esperarDesenho();

    await waitFor(() => expect(tamanhoDoElemento(conteudoDoPalco())).not.toEqual(antes));
    expect(tamanhoDoElemento(conteudoDoPalco()).largura).toBeLessThanOrEqual(1920);
    expect(tamanhoDoElemento(conteudoDoPalco()).altura).toBeLessThanOrEqual(1080);
    clicarObjeto(fase.paredes.frente, 'fala-frente');
    await aparece(FALA_FRENTE);
  });

  // @req RNF-02 @tipo borda
  test('test_RNF02_tela_pergunta_campo_e_digitos_aparecem_com_o_palco_no_lugar_e_do_mesmo_tamanho', async () => {
    const user = userEvent.setup();
    instalarResizeObserverFalso(CONTEINER);
    const digitos: DigitoRevelado[] = [{ posicao: 4, valor: '3' }];
    const { verificador } = verificadorFalso({ enigma: acerto(...digitos) });
    const fase = faseEnigmas();
    await montar(fase, verificador);
    await esperarSalaDoConteiner(CONTEINER);

    clicarObjeto(fase.paredes.frente, 'enigma-b');
    await aparece(PERGUNTA_B);
    const campo = await campoAberto();

    // A pergunta e o campo ficam na coluna: o palco continua na tela, com a mesma sala, e as paredes continuam.
    conferirSalaDoConteiner(CONTEINER);
    for (const nome of PAREDES) expect(botaoParede(nome)).toBeInTheDocument();

    await enviar(user, campo, '60');
    await aparece(MENSAGENS.respostaCorreta(digitos));
    conferirSalaDoConteiner(CONTEINER);
  });

  // @req RNF-02 @tipo negativo
  test('test_RNF02_tela_com_resize_observer_mudar_a_janela_nao_muda_o_palco', async () => {
    instalarResizeObserverFalso(CONTEINER);
    const { verificador } = verificadorFalso({});
    await montar(faseFalas(), verificador);
    await esperarSalaDoConteiner(CONTEINER);
    const antes = tamanhoDoElemento(conteudoDoPalco());

    act(() => definirJanela(1920, 1080));
    await esperarDesenho();
    expect(tamanhoDoElemento(conteudoDoPalco())).toEqual(antes);

    act(() => definirJanela(1024, 768));
    await esperarDesenho();
    expect(tamanhoDoElemento(conteudoDoPalco())).toEqual(antes);
    conferirSalaDoConteiner(CONTEINER);
  });
});

describe('RF-16 · TelaJogo: falas e decorações com o palco medido no contêiner', () => {
  afterEach(() => restaurarResizeObserver());

  // @req RF-16 @tipo feliz
  test('test_RF16_tela_palco_no_conteiner_clicar_fala_mostra_o_texto', async () => {
    instalarResizeObserverFalso(CONTEINER);
    const { verificador } = verificadorFalso({});
    const fase = faseFalas();
    await montar(fase, verificador);
    await esperarSalaDoConteiner(CONTEINER);
    expect(estaNaTela(FALA_FRENTE)).toBe(false);

    clicarObjeto(fase.paredes.frente, 'fala-frente');

    await aparece(FALA_FRENTE);
  });

  // @req RF-16 @tipo borda
  test('test_RF16_tela_palco_no_conteiner_redimensionado_cada_parede_mostra_a_sua_fala', async () => {
    const user = userEvent.setup();
    instalarResizeObserverFalso(CONTEINER);
    const { verificador } = verificadorFalso({});
    const fase = faseFalas();
    await montar(fase, verificador);
    await esperarSalaDoConteiner(CONTEINER);
    redimensionarConteiner({ largura: 640, altura: 600 });
    await esperarDesenho();
    await esperarSalaDoConteiner({ largura: 640, altura: 600 });

    const falas: Record<Exclude<NomeParede, 'frente'>, [string, string]> = {
      direita: ['fala-direita', FALA_DIREITA],
      fundo: ['fala-fundo', FALA_FUNDO],
      esquerda: ['fala-esquerda', FALA_ESQUERDA],
      teto: ['fala-teto', FALA_TETO],
    };
    for (const nome of ['direita', 'fundo', 'esquerda', 'teto'] as const) {
      const [id, texto] = falas[nome];
      await irPara(user, nome);
      clicarObjeto(fase.paredes[nome], id);
      await aparece(texto);
    }
  });

  // @req RF-16 @tipo negativo
  test('test_RF16_tela_palco_no_conteiner_clicar_decoracao_nao_mostra_fala_nem_muda_o_jogo', async () => {
    instalarResizeObserverFalso(CONTEINER);
    const { verificador, enigma, porta } = verificadorFalso({});
    const fase = faseFalas();
    const { aoConcluir } = await montar(fase, verificador);
    await esperarSalaDoConteiner(CONTEINER);
    const textoAntes = document.body.textContent;

    clicarObjeto(fase.paredes.frente, 'decoracao-frente');
    await esperarDesenho();

    expect(document.body.textContent).toBe(textoAntes);
    expect(document.querySelector(SELETOR_CAMPO)).toBeNull();
    expect(enigma).not.toHaveBeenCalled();
    expect(porta).not.toHaveBeenCalled();
    expect(aoConcluir).not.toHaveBeenCalled();

    // Controle: no mesmo desenho, o clique na fala ao lado funciona.
    clicarObjeto(fase.paredes.frente, 'fala-frente');
    await aparece(FALA_FRENTE);
  });
});
