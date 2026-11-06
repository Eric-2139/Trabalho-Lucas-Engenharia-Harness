/** Fase 6 · fluxo completo do jogador: entrar, escolher fase publicada, resolver e abrir a porta, sem login (RF-01, RF-13, RF-15). */
import { expect, test } from '@playwright/test';
import { PLAYER, type Parede, clicarObjeto, contaNaApi, importarFase, lerEscola, marca, objetoDe, publicarEscola } from './apoio/sistema.ts';

const ROTEIRO: [Parede, string, string, string][] = [
  ['esquerda', 'Esquerda', 'esquerda-pergunta-horas', '15'],
  ['esquerda', 'Esquerda', 'esquerda-pergunta-minutos', '40'],
  ['teto', 'Teto', 'teto-pergunta', '55'],
  ['direita', 'Direita', 'direita-quadro-setas', '123'],
  ['frente', 'Frente', 'frente-quadro-negro', '310'],
  ['fundo', 'Fundo', 'fundo-selo-magico', '80'],
];

// @req RF-13 @tipo feliz
test('test_RF13_jogador_sem_login_escolhe_a_fase_resolve_tudo_ve_92139_e_abre_a_porta', async ({ page }) => {
  const titulo = `Escola ${marca()}`;
  const { id, fase } = await publicarEscola(titulo);

  await page.goto(PLAYER);
  await page.getByRole('link', { name: 'Escolher fase' }).click();
  await page.getByRole('button', { name: titulo }).click();
  await expect(page).toHaveURL(new RegExp(`/jogar/${id}$`));

  for (const [parede, nome, objeto, resposta] of ROTEIRO) {
    await page.getByRole('button', { name: nome, exact: true }).click();
    await clicarObjeto(page, objetoDe(fase, parede, objeto));
    await page.getByLabel('Sua resposta').fill(resposta);
    await page.getByRole('button', { name: 'Responder' }).click();
    await expect(page.getByRole('main')).toContainText('Resposta correta!');
  }
  await expect(page.getByText(/^Senha da porta:/)).toHaveText('Senha da porta: 9 2 1 3 9');

  await page.getByRole('button', { name: 'Frente', exact: true }).click();
  await clicarObjeto(page, objetoDe(fase, 'frente', 'frente-porta'));
  await page.getByLabel('Senha da porta').fill('92139');
  await page.getByRole('button', { name: 'Responder' }).click();
  await expect(page.getByRole('main')).toContainText('A porta abriu! Você escapou da sala.');
  await page.getByRole('link', { name: 'Voltar para Escolher fase' }).click();
  await expect(page).toHaveURL(/\/fases$/);
});

// @req RF-13 @tipo negativo
test('test_RF13_fase_nao_publicada_nao_aparece_e_nao_abre_pelo_link', async ({ page }) => {
  const fase = lerEscola();
  fase.titulo = `Rascunho ${marca()}`;
  const { api } = await contaNaApi();
  const id = await importarFase(api, fase);
  await page.goto(`${PLAYER}/fases`);
  await expect(page.getByRole('heading', { name: 'Escolher fase' })).toBeVisible();
  await expect(page.getByRole('button', { name: fase.titulo })).toHaveCount(0);
  await page.goto(`${PLAYER}/jogar/${id}`);
  await expect(page.getByRole('alert')).toBeVisible();
});

// @req RF-15 @tipo borda
test('test_RF15_comparacao_olha_so_o_numero', async ({ page }) => {
  const { id, fase } = await publicarEscola();
  await page.goto(`${PLAYER}/jogar/${id}`);
  await page.getByRole('button', { name: 'Fundo', exact: true }).click();
  const selo = objetoDe(fase, 'fundo', 'fundo-selo-magico');
  await clicarObjeto(page, selo);
  for (const [texto, mensagem] of [['oitenta', 'Resposta Errada!!'], [' 080 ', 'Resposta correta!'], ['80,0', 'Resposta correta!']] as const) {
    await page.getByLabel('Sua resposta').fill(texto);
    await page.getByRole('button', { name: 'Responder' }).click();
    await expect(page.getByRole('main')).toContainText(mensagem);
  }
});
