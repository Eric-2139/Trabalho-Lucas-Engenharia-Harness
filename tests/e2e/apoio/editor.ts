/** Passos repetidos na tela de edição, só por controles que o criador vê. */
import { type Page, expect } from '@playwright/test';

export async function abrirFaseNova(page: Page, titulo: string): Promise<void> {
  await page.getByRole('button', { name: 'Nova fase' }).click();
  await page.getByLabel('Título').fill(titulo);
  await page.getByLabel('Título').press('Enter');
  const item = page.getByRole('listitem').filter({ hasText: titulo });
  await item.getByRole('button', { name: 'Abrir' }).click();
  await expect(page.getByRole('tab', { name: 'Frente' })).toBeVisible();
}

/** Clica no centro do palco, onde objetos novos nascem e a porta inicial fica. */
export async function centroDoPalco(page: Page): Promise<void> {
  const palco = page.locator('.konvajs-content').first();
  const caixa = await palco.boundingBox();
  if (!caixa) throw new Error('palco não encontrado');
  await palco.click({ position: { x: caixa.width / 2, y: caixa.height / 2 } });
}

/** Senha da porta, com nada selecionado (Propriedades da fase). Mantém a seleção atual depois de reaplicar. */
export async function mudarSenhaDaFase(page: Page, senha: string): Promise<void> {
  const palco = page.locator('.konvajs-content').first();
  await palco.click({ position: { x: 3, y: 3 } });
  const painel = page.getByRole('form', { name: 'Propriedades da fase' });
  await painel.getByLabel('Senha').fill(senha);
  await painel.getByRole('button', { name: 'Aplicar' }).click();
  await centroDoPalco(page);
}

export async function configurarEnigmaSelecionado(
  page: Page,
  dados: { pergunta: string; respostas: string; dica?: string; posicoes: number[] },
): Promise<void> {
  await page.getByRole('combobox', { name: 'Tipo' }).selectOption('enigma');
  await page.getByLabel('Pergunta').fill(dados.pergunta);
  await page.getByLabel('Respostas').fill(dados.respostas);
  if (dados.dica) await page.getByLabel('Dica').fill(dados.dica);
  for (const posicao of dados.posicoes) await page.getByLabel(`Posição ${posicao}`).check();
  await page.getByRole('button', { name: 'Aplicar' }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
}
