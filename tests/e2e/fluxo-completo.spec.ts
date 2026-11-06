/** Fase 6 · RNF-01 parte 1: o fluxo criar → publicar → jogar concluído, só pela interface, nos três navegadores (ADR-006). */
import { expect, test } from '@playwright/test';
import { EDITOR, PLAYER, marca, pessoaNova } from './apoio/sistema.ts';
import { abrirFaseNova, centroDoPalco, configurarEnigmaSelecionado, mudarSenhaDaFase } from './apoio/editor.ts';

// @req RNF-01 @tipo feliz
test('test_RNF01_criar_testar_publicar_e_jogar_uma_fase_nova_pela_interface', async ({ page }) => {
  const pessoa = pessoaNova();
  const titulo = `Sala ${test.info().project.name} ${marca()}`;

  await page.goto(EDITOR);
  const cadastro = page.getByRole('form', { name: 'Cadastrar' });
  await cadastro.getByLabel('Nome').fill(pessoa.nome);
  await cadastro.getByLabel('E-mail').fill(pessoa.email);
  await cadastro.getByLabel('Senha').fill(pessoa.senha);
  await cadastro.getByRole('button', { name: 'Cadastrar' }).click();

  await abrirFaseNova(page, titulo);

  // Um objeto em cada parede além da frente, para o fluxo passar pelas 5.
  for (const aba of ['Direita', 'Fundo', 'Esquerda', 'Teto']) {
    await page.getByRole('tab', { name: aba }).click();
    await page.getByRole('button', { name: 'Janela', exact: true }).click();
    await expect(page.getByRole('combobox', { name: 'Tipo' })).toBeVisible();
  }

  await mudarSenhaDaFase(page, '12345');

  // Enigma que revela as 5 posições, na parede do teto.
  await configurarEnigmaSelecionado(page, { pergunta: 'Quanto é 6 x 7?', respostas: '42', dica: 'Tabuada do 6', posicoes: [1, 2, 3, 4, 5] });

  // Modo testar: a resposta é conferida no servidor.
  await page.getByRole('button', { name: 'Testar' }).click();
  await expect(page.getByRole('button', { name: 'Sair do teste' })).toBeVisible();
  await page.getByRole('button', { name: 'Teto', exact: true }).click();
  await centroDoPalco(page);
  await page.getByLabel('Resposta', { exact: true }).fill('42');
  await page.getByRole('button', { name: 'Responder' }).click();
  await expect(page.getByRole('main')).toContainText('Resposta correta!');
  await page.getByRole('button', { name: 'Sair do teste' }).click();

  await page.getByRole('toolbar', { name: 'Ferramentas' }).getByRole('button', { name: 'Publicar', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);

  await page.goto(`${PLAYER}/fases`);
  await page.getByRole('button', { name: titulo }).click();
  await page.getByRole('button', { name: 'Teto', exact: true }).click();
  await centroDoPalco(page);
  await page.getByLabel('Sua resposta').fill('42');
  await page.getByRole('button', { name: 'Responder' }).click();
  await expect(page.getByText(/^Senha da porta:/)).toHaveText('Senha da porta: 1 2 3 4 5');

  await page.getByRole('button', { name: 'Frente', exact: true }).click();
  await centroDoPalco(page);
  await page.getByLabel('Senha da porta').fill('12345');
  await page.getByRole('button', { name: 'Responder' }).click();
  await expect(page.getByRole('main')).toContainText('A porta abriu!');
});
