/**
 * Fase 6 · o criador no navegador real, contra os builds de produção: o que os testes de componente não alcançam
 * (composição em main.tsx, gestos reais no palco, persistência depois de recarregar).
 */
import { expect, test } from '@playwright/test';
import {
  EDITOR, PLAYER, abrirNaEdicao, arrastarNoPalco, clicarObjeto, contaNaApi, entrarNoEditor, faseVazia, importarFase, lerDocumento,
  lerEscola, marca, objetoSimples, pontoDoObjeto, publicarFase,
} from './apoio/sistema.ts';

const PNG_1X1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

const faseComUmObjeto = () => {
  const fase = faseVazia(`Objeto ${marca()}`);
  fase.paredes.frente.objetos.push(objetoSimples('obj-1', 0.4, 0.3));
  return fase;
};
const barra = (page: import('@playwright/test').Page) => page.getByRole('toolbar', { name: 'Ferramentas' });
const salvar = async (page: import('@playwright/test').Page) => {
  await barra(page).getByRole('button', { name: 'Salvar' }).click();
  await expect(barra(page)).toContainText('Salvo');
};

// @req RF-01 @tipo negativo
test('test_RF01_sem_login_o_editor_mostra_o_login_mesmo_em_rota_de_fase', async ({ page }) => {
  await page.goto(`${EDITOR}/fases/qualquer`);
  await expect(page.getByRole('form', { name: 'Entrar' })).toBeVisible();
  await expect(page.getByRole('tab')).toHaveCount(0);
});

// @req RF-01 @tipo feliz
test('test_RF01_senha_errada_e_recusada_e_sair_volta_ao_login', async ({ page }) => {
  const { pessoa } = await contaNaApi();
  await page.goto(EDITOR);
  const form = page.getByRole('form', { name: 'Entrar' });
  await form.getByLabel('E-mail').fill(pessoa.email);
  await form.getByLabel('Senha').fill('senha-que-nao-confere');
  await form.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await entrarNoEditor(page, pessoa);
  await page.getByRole('button', { name: 'Sair' }).click();
  await expect(page.getByRole('form', { name: 'Entrar' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('form', { name: 'Entrar' })).toBeVisible();
});

// @req RF-02 @tipo feliz
test('test_RF02_criar_renomear_duplicar_e_excluir_refletem_na_lista', async ({ page }) => {
  const { pessoa } = await contaNaApi();
  await entrarNoEditor(page, pessoa);
  await page.getByRole('button', { name: 'Nova fase' }).click();
  await page.getByLabel('Título').fill('Primeira');
  await page.getByLabel('Título').press('Enter');
  const item = page.getByRole('listitem').filter({ hasText: 'Primeira' });
  await expect(item).toHaveCount(1);
  await item.getByRole('button', { name: 'Renomear' }).click();
  await page.getByLabel('Título').fill('Renomeada');
  await page.getByLabel('Título').press('Enter');
  const renomeada = page.getByRole('listitem').filter({ hasText: 'Renomeada' });
  await expect(renomeada).toHaveCount(1);
  await renomeada.getByRole('button', { name: 'Duplicar' }).click();
  await expect(page.getByRole('listitem').filter({ hasText: 'Renomeada' })).toHaveCount(2);
  await renomeada.first().getByRole('button', { name: 'Excluir' }).click();
  await expect(page.getByRole('listitem').filter({ hasText: 'Renomeada' })).toHaveCount(1);
});

// @req RF-02 @tipo borda
test('test_RF02_excluir_publicada_pede_confirmacao_e_ctrl_z_nao_restaura', async ({ page }) => {
  const { api, pessoa } = await contaNaApi();
  const fase = faseVazia(`Publicada ${marca()}`, '12345');
  fase.paredes.frente.objetos.push(objetoSimples('e', 0.1, 0.1, { tipo: 'enigma', pergunta: 'p', respostas: [1], revela: [1, 2, 3, 4, 5] }));
  const id = await importarFase(api, fase);
  await publicarFase(api, id);
  await entrarNoEditor(page, pessoa);
  const item = page.getByRole('listitem').filter({ hasText: fase.titulo });
  await item.getByRole('button', { name: 'Excluir' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Cancelar' }).click();
  await expect(item).toHaveCount(1);
  await item.getByRole('button', { name: 'Excluir' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Confirmar' }).click();
  await expect(item).toHaveCount(0);
  await page.keyboard.press('Control+z');
  await expect(item).toHaveCount(0);
  await page.goto(`${PLAYER}/fases`);
  await expect(page.getByRole('heading', { name: 'Escolher fase' })).toBeVisible();
  await expect(page.getByRole('button', { name: fase.titulo })).toHaveCount(0);
});

// @req RF-02 @tipo negativo
test('test_RF02_fase_de_outro_criador_nao_abre_na_interface', async ({ page }) => {
  const dono = await contaNaApi();
  const id = await importarFase(dono.api, faseComUmObjeto());
  const outra = await contaNaApi();
  await entrarNoEditor(page, outra.pessoa);
  await page.goto(`${EDITOR}/fases/${id}`);
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('tab')).toHaveCount(0);
});

// @req RF-03 @tipo feliz
test('test_RF03_cinco_abas_e_cada_uma_mostra_so_os_objetos_da_sua_parede', async ({ page }) => {
  const fase = faseVazia(`Abas ${marca()}`);
  const naFrente = objetoSimples('so-na-frente', 0.4, 0.3);
  fase.paredes.frente.objetos.push(naFrente);
  await abrirNaEdicao(page, fase);
  await expect(page.getByRole('tab')).toHaveText(['Frente', 'Direita', 'Fundo', 'Esquerda', 'Teto']);
  await clicarObjeto(page, naFrente);
  await expect(page.getByRole('combobox', { name: 'Tipo' })).toBeVisible();
  await page.getByRole('tab', { name: 'Direita' }).click();
  await clicarObjeto(page, naFrente);
  await expect(page.getByRole('combobox', { name: 'Tipo' })).toHaveCount(0);
});

// @req RF-03 @tipo borda
test('test_RF03_area_16_9_mantem_a_proporcao_ao_redimensionar_a_janela', async ({ page }) => {
  const fase = faseComUmObjeto();
  await abrirNaEdicao(page, fase);
  for (const [largura, altura] of [[1280, 720], [1600, 700], [1300, 1000]] as const) {
    await page.setViewportSize({ width: largura, height: altura });
    // LAC-046: o palco mede o contêiner entre a biblioteca e o painel, não a janela. Espera ele caber na janela nova.
    await expect.poll(async () => {
      const caixa = await page.locator('.konvajs-content').first().boundingBox();
      return !!caixa && caixa.width > 0 && caixa.x + caixa.width <= largura && caixa.y + caixa.height <= altura;
    }).toBe(true);
    await clicarObjeto(page, fase.paredes.frente.objetos[0]!);
    await expect(page.getByRole('combobox', { name: 'Tipo' })).toBeVisible();
    await clicarObjeto(page, { x: 0.9, y: 0.9, largura: 0.01, altura: 0.01 });
    await expect(page.getByRole('combobox', { name: 'Tipo' })).toHaveCount(0);
  }
});

// @req RF-03 @tipo borda
test('test_RF03_palco_area_de_trabalho_cabe_na_janela_com_a_biblioteca_e_o_painel_a_vista', async ({ page }) => {
  await abrirNaEdicao(page, faseComUmObjeto());
  await expect(page.getByRole('button', { name: 'Porta', exact: true })).toBeInViewport();
  await expect(page.getByRole('form', { name: 'Propriedades da fase' })).toBeInViewport();
});

// @req RF-04 @tipo feliz
test('test_RF04_arrastar_da_biblioteca_ate_a_parede_coloca_o_objeto', async ({ page }) => {
  const { id } = await abrirNaEdicao(page, faseVazia(`Biblioteca ${marca()}`));
  await page.getByRole('button', { name: 'Janela', exact: true }).dragTo(page.locator('.konvajs-content').first(), { targetPosition: { x: 300, y: 200 } });
  await barra(page).getByRole('button', { name: 'Salvar' }).click();
  await expect.poll(async () => (await lerDocumento(page, id)).documento.paredes.frente.objetos.length, { timeout: 3000 }).toBe(1);
});

// @req RF-04 @tipo feliz
test('test_RF04_botao_da_biblioteca_coloca_o_objeto_na_parede_ativa', async ({ page }) => {
  const { id } = await abrirNaEdicao(page, faseVazia(`Biblioteca ${marca()}`));
  await page.getByRole('tab', { name: 'Teto' }).click();
  await page.getByRole('button', { name: 'Giz', exact: true }).click();
  await salvar(page);
  const { documento } = await lerDocumento(page, id);
  expect(documento.paredes.teto.objetos).toHaveLength(1);
  expect(documento.paredes.frente.objetos).toHaveLength(0);
});

// @req RF-05 @tipo feliz
test('test_RF05_mover_redimensionar_e_rotacionar_sao_mantidos_depois_de_recarregar', async ({ page }) => {
  const fase = faseComUmObjeto();
  const objeto = fase.paredes.frente.objetos[0]!;
  const { id } = await abrirNaEdicao(page, fase);

  // Desloca 0,1 da parede em cada eixo; o tamanho do palco em pixels depende do layout (LAC-046).
  const centro = await pontoDoObjeto(page, objeto);
  await arrastarNoPalco(page, centro, await pontoDoObjeto(page, { ...objeto, x: objeto.x + 0.1, y: objeto.y + 0.1 }));
  await salvar(page);
  let lido = (await lerDocumento(page, id)).documento.paredes.frente.objetos[0]!;
  expect(lido.x).toBeCloseTo(0.5, 1);
  expect(lido.y).toBeCloseTo(0.4, 1);

  // Alça inferior direita do Transformer.
  const canto = await pontoDoObjeto(page, lido, 1, 1);
  await arrastarNoPalco(page, canto, { x: canto.x + 60, y: canto.y + 40 });
  await salvar(page);
  const redimensionado = (await lerDocumento(page, id)).documento.paredes.frente.objetos[0]!;
  expect(redimensionado.largura).toBeGreaterThan(lido.largura);
  lido = redimensionado;

  // Alça de rotação: 50 px acima do meio da borda superior.
  const topo = await pontoDoObjeto(page, lido, 0.5, 0);
  await arrastarNoPalco(page, { x: topo.x, y: topo.y - 50 }, { x: topo.x + 120, y: topo.y + 30 });
  await salvar(page);
  const rotacionado = (await lerDocumento(page, id)).documento.paredes.frente.objetos[0]!;
  expect(rotacionado.rotacao).not.toBe(0);

  await page.reload();
  await expect(page.getByRole('tab', { name: 'Frente' })).toBeVisible();
  expect((await lerDocumento(page, id)).documento.paredes.frente.objetos[0]).toEqual(rotacionado);
});

// @req RF-05 @tipo feliz
test('test_RF05_objeto_selecionado_tem_controles_de_excluir_duplicar_e_camada', async ({ page }) => {
  const fase = faseComUmObjeto();
  await abrirNaEdicao(page, fase);
  await clicarObjeto(page, fase.paredes.frente.objetos[0]!);
  await expect(page.getByRole('combobox', { name: 'Tipo' })).toBeVisible();
  const principal = page.getByRole('main');
  await expect(principal.getByRole('button', { name: /excluir/i }), 'excluir objeto').toBeVisible({ timeout: 2000 });
  await expect(principal.getByRole('button', { name: /duplicar/i }), 'duplicar objeto').toBeVisible({ timeout: 2000 });
  await expect(principal.getByRole('button', { name: /frente|trazer|subir/i }), 'mudar camada').toBeVisible({ timeout: 2000 });
});

// @req RF-06 @tipo feliz
test('test_RF06_png_enviado_vira_objeto_e_fundo', async ({ page }) => {
  const { id } = await abrirNaEdicao(page, faseVazia(`Imagem ${marca()}`));
  await page.getByLabel('Enviar imagem').setInputFiles({ name: 'sintetica.png', mimeType: 'image/png', buffer: PNG_1X1 });
  await page.getByRole('button', { name: 'Usar como objeto' }).first().click();
  await page.getByRole('button', { name: 'Usar como fundo' }).last().click();
  await salvar(page);
  const { documento } = await lerDocumento(page, id);
  expect(documento.paredes.frente.objetos[0]?.imagem).toMatch(/^asset:/);
  expect(documento.paredes.frente.fundo).toMatch(/^asset:/);
});

// @req RF-06 @tipo borda
test('test_RF06_imagem_usada_nao_duplica_na_lista_e_continua_utilizavel_depois_de_recarregar', async ({ page }) => {
  const { id } = await abrirNaEdicao(page, faseVazia(`Imagem ${marca()}`));
  await page.getByLabel('Enviar imagem').setInputFiles({ name: 'sintetica.png', mimeType: 'image/png', buffer: PNG_1X1 });
  const usar = page.getByRole('button', { name: 'Usar como objeto' });
  await usar.first().click();
  await expect(usar, 'a imagem aparece uma vez só').toHaveCount(1, { timeout: 2000 });
  await salvar(page);
  await page.reload();
  await expect(page.getByRole('tab', { name: 'Frente' })).toBeVisible();
  await usar.first().click();
  await salvar(page);
  expect((await lerDocumento(page, id)).documento.paredes.frente.objetos).toHaveLength(2);
});

// @req RF-06 @tipo negativo
test('test_RF06_outro_formato_e_mais_de_5_mb_sao_recusados_com_mensagem', async ({ page }) => {
  await abrirNaEdicao(page, faseVazia(`Imagem ${marca()}`));
  const envio = page.getByLabel('Enviar imagem');
  await envio.setInputFiles({ name: 'texto.png', mimeType: 'image/png', buffer: Buffer.from('não é imagem') });
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Usar como objeto' })).toHaveCount(0);
  const grande = Buffer.concat([PNG_1X1, Buffer.alloc(5 * 1024 * 1024 + 1)]);
  await envio.setInputFiles({ name: 'grande.png', mimeType: 'image/png', buffer: grande });
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Usar como objeto' })).toHaveCount(0);
});

// @req RF-08 @tipo negativo
test('test_RF08_senha_de_3_digitos_e_resposta_nao_numerica_sao_recusadas', async ({ page }) => {
  const fase = faseComUmObjeto();
  await abrirNaEdicao(page, fase);
  const painel = page.getByRole('form', { name: 'Propriedades da fase' });
  await painel.getByLabel('Senha').fill('123');
  await painel.getByRole('button', { name: 'Aplicar' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await clicarObjeto(page, fase.paredes.frente.objetos[0]!);
  await page.getByRole('combobox', { name: 'Tipo' }).selectOption('enigma');
  await page.getByLabel('Respostas').fill('oitenta');
  await page.getByRole('button', { name: 'Aplicar' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
});

// @req RF-09 @tipo feliz
test('test_RF09_ctrl_z_devolve_a_posicao_e_ctrl_y_refaz', async ({ page }) => {
  const fase = faseComUmObjeto();
  const objeto = fase.paredes.frente.objetos[0]!;
  const { id } = await abrirNaEdicao(page, fase);
  const centro = await pontoDoObjeto(page, objeto);
  await arrastarNoPalco(page, centro, { x: centro.x + 128, y: centro.y });
  await salvar(page);
  const movido = (await lerDocumento(page, id)).documento.paredes.frente.objetos[0]!;
  expect(movido.x).toBeGreaterThan(objeto.x);
  await page.keyboard.press('Control+z');
  await salvar(page);
  expect((await lerDocumento(page, id)).documento.paredes.frente.objetos[0]!.x).toBeCloseTo(objeto.x, 5);
  await page.keyboard.press('Control+y');
  await salvar(page);
  expect((await lerDocumento(page, id)).documento.paredes.frente.objetos[0]!.x).toBeCloseTo(movido.x, 5);
});

// @req RF-10 @tipo feliz
test('test_RF10_trocar_de_parede_grava_e_a_alteracao_volta_depois_de_recarregar', async ({ page }) => {
  const { id } = await abrirNaEdicao(page, faseVazia(`Salvar ${marca()}`));
  await page.getByRole('button', { name: 'Giz', exact: true }).click();
  await page.getByRole('tab', { name: 'Teto' }).click();
  await expect.poll(async () => (await lerDocumento(page, id)).documento.paredes.frente.objetos.length).toBe(1);
  await page.reload();
  await expect(page.getByRole('tab', { name: 'Frente' })).toBeVisible();
  expect((await lerDocumento(page, id)).documento.paredes.frente.objetos).toHaveLength(1);
});

// @req RF-10 @tipo borda
test('test_RF10_alteracao_e_gravada_sozinha_em_ate_30_segundos', async ({ page }) => {
  await page.clock.install();
  const { id } = await abrirNaEdicao(page, faseVazia(`Salvar ${marca()}`));
  await page.getByRole('button', { name: 'Giz', exact: true }).click();
  expect((await lerDocumento(page, id)).documento.paredes.frente.objetos).toHaveLength(0);
  await page.clock.fastForward(30_000);
  await expect.poll(async () => (await lerDocumento(page, id)).documento.paredes.frente.objetos.length).toBe(1);
});

// @req RF-10 @tipo borda
test('test_RF10_sair_para_minhas_fases_grava_a_alteracao_pendente', async ({ page }) => {
  const { id } = await abrirNaEdicao(page, faseVazia(`Salvar ${marca()}`));
  await page.getByRole('button', { name: 'Giz', exact: true }).click();
  await page.getByRole('link', { name: 'Minhas fases' }).click();
  await expect.poll(async () => (await lerDocumento(page, id)).documento.paredes.frente.objetos.length).toBe(1);
});

// @req RF-11 @tipo feliz
test('test_RF11_modo_testar_confere_no_servidor_e_sair_deixa_a_fase_inalterada', async ({ page }) => {
  const fase = faseVazia(`Testar ${marca()}`);
  const enigma = objetoSimples('e', 0.4, 0.3, { tipo: 'enigma', pergunta: 'Quanto é 2+2?', respostas: [4], revela: [1, 2, 3, 4, 5] });
  fase.paredes.frente.objetos.push(enigma);
  const { id } = await abrirNaEdicao(page, fase);
  const antes = (await lerDocumento(page, id)).documento;
  await barra(page).getByRole('button', { name: 'Testar' }).click();
  await expect(page.getByRole('button', { name: 'Sair do teste' })).toBeVisible();
  await clicarObjeto(page, enigma);
  await page.getByLabel('Resposta', { exact: true }).fill('5');
  await page.getByRole('button', { name: 'Responder' }).click();
  await expect(page.getByRole('main')).toContainText('Resposta Errada!!');
  await page.getByLabel('Resposta', { exact: true }).fill('4');
  await page.getByRole('button', { name: 'Responder' }).click();
  await expect(page.getByRole('main')).toContainText('Resposta correta!');
  await page.getByRole('button', { name: 'Sair do teste' }).click();
  await expect(page.getByRole('tab', { name: 'Frente' })).toBeVisible();
  expect((await lerDocumento(page, id)).documento).toEqual(antes);
});

// @req RF-12 @tipo negativo
test('test_RF12_senha_92139_com_posicoes_2_e_5_sem_enigma_recusa_e_mostra_as_posicoes', async ({ page }) => {
  const fase = faseVazia(`Bloqueio ${marca()}`, '92139');
  fase.paredes.frente.objetos.push(objetoSimples('e', 0.4, 0.3, { tipo: 'enigma', pergunta: 'p', respostas: [1], revela: [1, 3, 4] }));
  await abrirNaEdicao(page, fase);
  await barra(page).getByRole('button', { name: 'Publicar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Posições da senha sem enigma' })).toBeVisible();
  await expect(page.getByRole('main').getByRole('listitem').getByRole('button', { name: /^[25]$/ })).toHaveText(['2', '5']);
  await page.goto(`${PLAYER}/fases`);
  await expect(page.getByRole('heading', { name: 'Escolher fase' })).toBeVisible();
  await expect(page.getByRole('button', { name: fase.titulo })).toHaveCount(0);
});

// @req RF-13 @tipo borda
test('test_RF13_editar_publicada_nao_muda_o_que_o_jogador_ve_ate_publicar_de_novo', async ({ page, context }) => {
  const fase = faseVazia(`Versao ${marca()}`);
  const fala = objetoSimples('f', 0.1, 0.1, { tipo: 'fala', texto: 'texto publicado' });
  fase.paredes.frente.objetos.push(fala, objetoSimples('e', 0.6, 0.1, { tipo: 'enigma', pergunta: 'p', respostas: [1], revela: [1, 2, 3, 4, 5] }));
  const { id, api } = await abrirNaEdicao(page, fase);
  await api.post(`${EDITOR}/api/fases/${id}/publicar`);
  await page.reload();
  await clicarObjeto(page, fala);
  await page.getByLabel('Texto').fill('texto novo');
  await page.getByRole('button', { name: 'Aplicar' }).click();
  await salvar(page);
  await expect(barra(page)).toContainText('Alterações não publicadas');

  const jogador = await context.newPage();
  await jogador.goto(`${PLAYER}/jogar/${id}`);
  await clicarObjeto(jogador, fala);
  await expect(jogador.getByRole('main')).toContainText('texto publicado');

  await barra(page).getByRole('button', { name: 'Publicar de novo' }).click();
  await expect(barra(page)).not.toContainText('Alterações não publicadas');
  await jogador.reload();
  await clicarObjeto(jogador, fala);
  await expect(jogador.getByRole('main')).toContainText('texto novo');
});

// @req RF-14 @tipo feliz
test('test_RF14_exportar_e_importar_pela_interface_gera_fase_igual', async ({ page }) => {
  const fase = lerEscola();
  fase.titulo = `Exportar ${marca()}`;
  const { id } = await abrirNaEdicao(page, fase);
  const original = (await lerDocumento(page, id)).documento;
  const espera = page.waitForEvent('download');
  await barra(page).getByRole('button', { name: 'Exportar' }).click();
  const download = await espera;
  const caminho = await download.path();

  await page.getByRole('link', { name: 'Minhas fases' }).click();
  await page.getByLabel('Importar fase').setInputFiles(caminho);
  const itens = page.getByRole('listitem').filter({ hasText: fase.titulo });
  await expect(itens).toHaveCount(2);
  const lista = (await (await page.request.get(`${EDITOR}/api/fases`)).json()) as { id: string }[];
  const copia = lista.find((f) => f.id !== id);
  expect((await lerDocumento(page, copia!.id)).documento).toEqual(original);
});

// @req RF-14 @tipo negativo
test('test_RF14_arquivo_fora_do_schema_e_recusado', async ({ page }) => {
  const { pessoa } = await contaNaApi();
  await entrarNoEditor(page, pessoa);
  await page.getByLabel('Importar fase').setInputFiles({ name: 'ruim.json', mimeType: 'application/json', buffer: Buffer.from('{"formato":"outro"}') });
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('main').getByRole('listitem')).toHaveCount(0);
});

// @req RF-19 @tipo feliz
test('test_RF19_cancelar_mantem_e_confirmar_exclui_a_conta_e_o_login_passa_a_ser_recusado', async ({ page }) => {
  const { pessoa } = await contaNaApi();
  await entrarNoEditor(page, pessoa);
  await page.getByRole('link', { name: 'Conta' }).click();
  await page.getByRole('button', { name: 'Excluir conta' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Cancelar' }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Excluir conta' })).toBeVisible();
  await page.getByRole('button', { name: 'Excluir conta' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Confirmar' }).click();
  const form = page.getByRole('form', { name: 'Entrar' });
  await expect(form).toBeVisible();
  await form.getByLabel('E-mail').fill(pessoa.email);
  await form.getByLabel('Senha').fill(pessoa.senha);
  await form.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
});

// @req RF-11 @tipo borda
test('test_RF11_modo_testar_usa_os_mesmos_rotulos_do_jogo', async ({ page }) => {
  test.fail(true, 'DEF-07: "Resposta" e "Senha:" no modo testar; "Sua resposta" e "Senha da porta:" no jogo');
  const fase = faseVazia(`Rótulos ${marca()}`);
  const enigma = objetoSimples('e', 0.4, 0.3, { tipo: 'enigma', pergunta: 'p', respostas: [4], revela: [1, 2, 3, 4, 5] });
  fase.paredes.frente.objetos.push(enigma);
  await abrirNaEdicao(page, fase);
  await barra(page).getByRole('button', { name: 'Testar' }).click();
  await expect(page.getByRole('button', { name: 'Sair do teste' })).toBeVisible();
  await clicarObjeto(page, enigma);
  await expect(page.getByLabel('Sua resposta')).toBeVisible({ timeout: 2000 });
});

// @req RF-17 @tipo negativo
test('test_RF17_enigma_sem_dica_nao_tem_controle_de_dica', async ({ page }) => {
  const fase = faseVazia(`Sem dica ${marca()}`);
  fase.paredes.frente.objetos.push(objetoSimples('e', 0.1, 0.1, { tipo: 'enigma', pergunta: 'p', respostas: [1], revela: [1, 2, 3, 4, 5] }));
  const { api } = await contaNaApi();
  const id = await importarFase(api, fase);
  await publicarFase(api, id);
  await page.goto(`${PLAYER}/jogar/${id}`);
  await expect(page.getByRole('button', { name: 'Frente', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /Ver dica/ })).toHaveCount(0);
});
