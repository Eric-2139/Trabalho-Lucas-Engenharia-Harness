/**
 * Fase 6 · equivalência com o legado (RF-18, critério de sucesso 1 do plano).
 * O mesmo roteiro roda no jogo antigo e no novo Player com escola-01.json: o legado é o oráculo, e cada caso compara os dois.
 */
import { type Page, expect, test } from '@playwright/test';
import { LEGADO, PLAYER, type Parede, clicarObjeto, objetoDe, publicarEscola } from './apoio/sistema.ts';

const NOME: Record<Parede, string> = { frente: 'Frente', direita: 'Direita', fundo: 'Fundo', esquerda: 'Esquerda', teto: 'Teto' };
const SALA: Record<Parede, number> = { frente: 1, direita: 2, fundo: 3, esquerda: 4, teto: 5 };
const normalizar = (t: string) => t.replace(/\s+/g, ' ').trim();

async function abrirLegado(page: Page, parede: Parede) {
  const alertas: string[] = [];
  page.on('dialog', (d) => {
    alertas.push(d.message());
    void d.accept();
  });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(LEGADO);
  await page.locator('.botoes .botao', { hasText: NOME[parede] }).click();
  return alertas;
}
const salaLegado = (page: Page, parede: Parede) => page.locator(`main > .room:nth-child(${SALA[parede]})`);

/** Uma fase publicada por arquivo basta: as falas e perguntas não contam no limite de tentativas. */
let fase: Awaited<ReturnType<typeof publicarEscola>>;
test.beforeAll(async () => {
  fase = await publicarEscola();
});

async function abrirNovo(page: Page, parede: Parede) {
  await page.goto(`${PLAYER}/jogar/${fase.id}`);
  await page.getByRole('button', { name: NOME[parede], exact: true }).click();
}

const FALAS: [Parede, string, string][] = [
  ['frente', '.relogio-1', 'frente-relogio-1'],
  ['frente', '.relogio-2', 'frente-relogio-2'],
  ['frente', '.giz-quadro', 'frente-giz'],
  ['direita', '.janela-1', 'direita-janela-1'],
  ['direita', '.janela-2', 'direita-janela-2'],
  ['fundo', '.janela-1', 'fundo-janela-1'],
  ['fundo', '.janela-2', 'fundo-janela-2'],
  ['esquerda', '.relogio-antigo', 'esquerda-relogio-antigo'],
  ['esquerda', '.giz-vermelho', 'esquerda-giz-vermelho'],
  ['teto', '.clock', 'teto-olho'],
];

for (const [parede, seletor, id] of FALAS) {
  // @req RF-16 @tipo feliz
  test(`test_RF16_fala_igual_ao_legado_${id}`, async ({ page }) => {
    const alertas = await abrirLegado(page, parede);
    await salaLegado(page, parede).locator(seletor).dispatchEvent('click');
    await expect.poll(() => alertas.length).toBeGreaterThan(0);
    const esperado = normalizar(alertas.join(' '));

    await abrirNovo(page, parede);
    await clicarObjeto(page, objetoDe(fase.fase, parede, id));
    await expect(page.getByRole('main')).toContainText(esperado);
  });
}

const DICAS: [Parede, string, string, string | undefined][] = [
  ['frente', '.interrogacao', 'frente-quadro-negro', undefined],
  ['direita', '.interrogacao-direita', 'direita-quadro-setas', undefined],
  ['fundo', '.interrogacao-fundo', 'fundo-selo-magico', undefined],
  ['esquerda', '.interrogacao-esquerda', 'esquerda-pergunta-horas', 'Ver dica 1'],
  ['teto', '.interrogacao-teto', 'teto-pergunta', undefined],
];

for (const [parede, seletor, id, botao] of DICAS) {
  // @req RF-17 @tipo feliz
  test(`test_RF17_dica_igual_ao_legado_${parede}`, async ({ page }) => {
    const alertas = await abrirLegado(page, parede);
    await salaLegado(page, parede).locator(seletor).dispatchEvent('click');
    await expect.poll(() => alertas.length).toBeGreaterThan(0); // no teto, o clique também sobe ao relógio: a dica é o 1º alerta

    await abrirNovo(page, parede);
    await page.getByRole('button', { name: botao ?? 'Ver dica', exact: true }).click();
    await expect(page.getByRole('main')).toContainText(normalizar(alertas[0] ?? ''));
    expect(objetoDe(fase.fase, parede, id)).toBeTruthy();
  });

  // @req RF-17 @tipo feliz
  test(`test_RF17_icone_de_dica_no_palco_${parede}`, async ({ page }) => {
    await abrirNovo(page, parede);
    const objeto = objetoDe(fase.fase, parede, id);
    const interacao = objeto.interacao as { dica: string };
    // Ícone de 32 px no canto superior direito do objeto.
    const caixa = await page.locator('.konvajs-content').first().boundingBox();
    if (!caixa) throw new Error('sem palco');
    const pos = {
      x: (objeto.x + objeto.largura) * caixa.width - 16,
      y: objeto.y * caixa.height + 16,
    };
    await page.locator('.konvajs-content').first().click({ position: pos });
    await expect(page.getByRole('main')).toContainText(normalizar(interacao.dica).slice(0, 40));
  });
}

interface CasoEnigma {
  parede: Parede;
  id: string;
  campo: string;
  botao: string;
  resultado: string;
  certas: string[];
  digitos: string;
}
const ENIGMAS: CasoEnigma[] = [
  { parede: 'frente', id: 'frente-quadro-negro', campo: 'input.resposta', botao: '.botao-resposta', resultado: 'div.res', certas: ['310'], digitos: '3' },
  { parede: 'direita', id: 'direita-quadro-setas', campo: 'input.resposta-direita', botao: '.botao-direita', resultado: 'div.res-direita', certas: ['123'], digitos: '1' },
  { parede: 'fundo', id: 'fundo-selo-magico', campo: 'input.resposta-fundo', botao: '.botao-fundo', resultado: 'div.res-fundo', certas: ['-15', '80'], digitos: '9' },
  { parede: 'esquerda', id: 'esquerda-pergunta-horas', campo: 'input.resposta-esquerda-horas', botao: '.botao-esquerda-horas', resultado: 'div.res-esquerda-horas', certas: ['15'], digitos: '' },
  { parede: 'esquerda', id: 'esquerda-pergunta-minutos', campo: 'input.resposta-esquerda-min', botao: '.botao-esquerda-min', resultado: 'div.res-esquerda-min', certas: ['40'], digitos: '' },
  { parede: 'teto', id: 'teto-pergunta', campo: 'input.resposta-teto', botao: '.botao-teto', resultado: 'div.res-teto', certas: ['55'], digitos: '92' },
];

for (const caso of ENIGMAS) {
  for (const certa of caso.certas) {
    // @req RF-18 @tipo feliz
    test(`test_RF18_${caso.id}_resposta_${certa}_confere_nos_dois_e_revela_${caso.digitos || 'nada'}`, async ({ page }) => {
      await abrirLegado(page, caso.parede);
      const sala = salaLegado(page, caso.parede);
      await sala.locator(caso.campo).fill(certa);
      await sala.locator(caso.botao).click({ force: true });
      const legado = (await sala.locator(caso.resultado).innerText()).toLowerCase();
      expect(legado).not.toContain('errada');
      expect(legado).not.toContain('intacto');
      if (caso.digitos) expect(legado).toContain(`é ${caso.digitos}`);

      await abrirNovo(page, caso.parede);
      await clicarObjeto(page, objetoDe(fase.fase, caso.parede, caso.id));
      await page.getByLabel('Sua resposta').fill(certa);
      await page.getByRole('button', { name: 'Responder' }).click();
      await expect(page.getByRole('main')).toContainText('Resposta correta!');
      for (const digito of caso.digitos) await expect(page.getByText(/^Senha da porta:/)).toContainText(digito);
    });
  }

  // @req RF-18 @tipo negativo
  test(`test_RF18_${caso.id}_resposta_errada_nao_revela_nada_nos_dois`, async ({ page }) => {
    await abrirLegado(page, caso.parede);
    const sala = salaLegado(page, caso.parede);
    await sala.locator(caso.campo).fill('7777');
    await sala.locator(caso.botao).click({ force: true });
    await expect(sala.locator(caso.resultado)).toHaveText(/Errada|intacto/);

    await abrirNovo(page, caso.parede);
    await clicarObjeto(page, objetoDe(fase.fase, caso.parede, caso.id));
    await page.getByLabel('Sua resposta').fill('7777');
    await page.getByRole('button', { name: 'Responder' }).click();
    await expect(page.getByRole('main')).toContainText('Resposta Errada!!');
    await expect(page.getByText(/^Senha da porta:/)).toHaveCount(0);
  });

  // @req RF-18 @tipo feliz
  test(`test_RF18_${caso.id}_pergunta_igual_a_do_legado`, async ({ page }) => {
    await abrirLegado(page, caso.parede);
    const sala = salaLegado(page, caso.parede);
    const seletor: Record<string, string> = {
      'frente-quadro-negro': 'p',
      'direita-quadro-setas': 'p',
      'esquerda-pergunta-horas': '.pergunta-horas',
      'esquerda-pergunta-minutos': '.pergunta-minutos',
      'teto-pergunta': '.pergunta-teto',
      'fundo-selo-magico': '.num-pent-4, .num-pent-23, .num-pent-42, .num-pent-61',
    };
    const trechos = await sala.locator(seletor[caso.id] ?? 'p').allTextContents();
    const legado = normalizar(trechos.join(caso.id === 'fundo-selo-magico' ? ', ' : ' '));

    await abrirNovo(page, caso.parede);
    await clicarObjeto(page, objetoDe(fase.fase, caso.parede, caso.id));
    await expect(page.getByLabel('Sua resposta')).toBeVisible();
    const novo = normalizar(await page.getByRole('main').innerText());
    expect(novo).toContain(legado);
  });
}

// @req RF-18 @tipo feliz
test('test_RF18_senha_92139_abre_a_porta_nos_dois_e_senha_errada_mostra_erro_nos_dois', async ({ page }) => {
  const alertas = await abrirLegado(page, 'frente');
  const sala = salaLegado(page, 'frente');
  await sala.locator('.input').fill('11111');
  await sala.locator('.button').click({ force: true });
  await expect.poll(() => alertas.at(-1)).toBe('Senha incorreta!');
  await sala.locator('.input').fill('92139');
  await sala.locator('.button').click({ force: true });
  await expect.poll(() => alertas.at(-1)).toContain('Meus parabéns');

  const nova = await publicarEscola();
  await page.goto(`${PLAYER}/jogar/${nova.id}`);
  await clicarObjeto(page, objetoDe(nova.fase, 'frente', 'frente-porta'));
  await page.getByLabel('Senha da porta').fill('11111');
  await page.getByRole('button', { name: 'Responder' }).click();
  await expect(page.getByRole('main')).toContainText('Senha incorreta!');
  await page.getByLabel('Senha da porta').fill('92139');
  await page.getByRole('button', { name: 'Responder' }).click();
  await expect(page.getByRole('main')).toContainText('A porta abriu!');
});

// @req RF-16 @tipo negativo
test('test_RF16_decoracao_nao_reage_ao_clique', async ({ page }) => {
  await abrirNovo(page, 'fundo');
  const antes = await page.getByRole('main').innerText();
  await clicarObjeto(page, objetoDe(fase.fase, 'fundo', 'fundo-arvore-seca'), 0.1, 0.9);
  expect(await page.getByRole('main').innerText()).toBe(antes);
  await page.getByRole('button', { name: 'Teto', exact: true }).click();
  const antesTeto = await page.getByRole('main').innerText();
  await clicarObjeto(page, objetoDe(fase.fase, 'teto', 'teto-lampada-1'));
  expect(await page.getByRole('main').innerText()).toBe(antesTeto);
});

// DIF-01 (docs/testes/relatorio-defeitos.md): falas do legado sem correspondente no Player. O RF-18 não as exige, por isso
// é pedido de decisão à analista, não defeito. test.fail documenta a diferença: se a fala voltar, o caso avisa.
const FALAS_PERDIDAS: [Parede, string, string][] = [
  ['frente', '.porta', 'frente-porta'],
  ['fundo', '.pentagrama', 'fundo-selo-magico'],
  ['esquerda', '.pergunta-horas', 'esquerda-pergunta-horas'],
  ['esquerda', '.pergunta-minutos', 'esquerda-pergunta-minutos'],
];
for (const [parede, seletor, id] of FALAS_PERDIDAS) {
  // @req RF-18 @tipo borda
  test(`test_RF18_diferenca_DIF01_fala_do_legado_em_${id}`, async ({ page }) => {
    test.fail(true, 'DIF-01: fala do legado ausente no Player');
    const alertas = await abrirLegado(page, parede);
    await salaLegado(page, parede).locator(seletor).dispatchEvent('click');
    await expect.poll(() => alertas.length).toBeGreaterThan(0);
    const esperado = normalizar(alertas.join(' '));
    await abrirNovo(page, parede);
    await clicarObjeto(page, objetoDe(fase.fase, parede, id));
    await expect(page.getByRole('main')).toContainText(esperado, { timeout: 2000 });
  });
}
