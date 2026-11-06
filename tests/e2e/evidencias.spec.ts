/** Telas de evidência dos relatórios (docs/testes/evidencias/). Sem asserção de produto: só fotografa o estado descrito. */
import { test } from '@playwright/test';
import { LEGADO, PLAYER, abrirNaEdicao, clicarObjeto, lerEscola, marca, objetoDe, publicarEscola } from './apoio/sistema.ts';

const DESTINO = '/src/docs/testes/evidencias';

test('evidencias_equivalencia_e_telas', async ({ page }) => {
  test.skip(!process.env.GERAR_EVIDENCIAS, 'só quando GERAR_EVIDENCIAS estiver definida');
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(LEGADO);
  await page.screenshot({ path: `${DESTINO}/legado-frente-1920x1080.png` });

  const { id, fase } = await publicarEscola();
  await page.goto(`${PLAYER}/jogar/${id}`);
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: `${DESTINO}/novo-frente-1920x1080.png` });

  await page.setViewportSize({ width: 1280, height: 720 });
  await page.waitForLoadState('networkidle');
  await clicarObjeto(page, objetoDe(fase, 'frente', 'frente-quadro-negro'));
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${DESTINO}/novo-enigma-aberto-1280x720.png` });

  const escola = lerEscola();
  escola.titulo = `Evidência ${marca()}`;
  await abrirNaEdicao(page, escola);
  await page.waitForLoadState('networkidle');
  await clicarObjeto(page, objetoDe(escola, 'frente', 'frente-quadro-negro'));
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${DESTINO}/editor-objeto-selecionado-1280x720.png` });
});
