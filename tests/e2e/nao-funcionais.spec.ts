/** Fase 6 · requisitos não funcionais medidos no navegador real (RNF-01, 02, 04, 05, 07). Desempenho: desempenho.spec.ts. */
import { type Page, type Response, expect, test } from '@playwright/test';
import {
  EDITOR, PLAYER, abrirNaEdicao, clicarObjeto, contaNaApi, entrarNoEditor, lerEscola, marca, objetoDe, publicarEscola,
} from './apoio/sistema.ts';

/** Todo corpo de resposta HTTP da página, para inspecionar o que chegou ao navegador. */
function capturarRespostas(page: Page) {
  const corpos: { url: string; corpo: string }[] = [];
  const pendentes: Promise<void>[] = [];
  page.on('response', (r: Response) => {
    pendentes.push(
      r.text().then(
        (corpo) => void corpos.push({ url: r.url(), corpo }),
        () => undefined,
      ),
    );
  });
  return async () => {
    await Promise.all(pendentes);
    return corpos;
  };
}

/** Respostas e senha da Escola, como aparecem em JSON. Valores curtos (15, 40, 55) dariam falso positivo em qualquer corpo. */
const PROIBIDOS = [/"respostas"\s*:/, /"senha"\s*:/, /"revela"\s*:/, /92139/];

function vazamentos(corpos: { url: string; corpo: string }[]): string[] {
  const achados: string[] = [];
  for (const { url, corpo } of corpos) {
    if (url.endsWith('.png') || url.endsWith('.jpg') || url.endsWith('.svg')) continue;
    for (const padrao of PROIBIDOS) if (padrao.test(corpo)) achados.push(`${url} contém ${padrao}`);
  }
  return achados;
}

// @req RNF-04 @tipo negativo
test('test_RNF04_jogo_completo_nao_entrega_resposta_nem_senha_em_nenhuma_resposta_http', async ({ page }) => {
  const { id, fase } = await publicarEscola();
  const corpos = capturarRespostas(page);
  await page.goto(`${PLAYER}/jogar/${id}`);
  await page.getByRole('button', { name: 'Fundo', exact: true }).click();
  await clicarObjeto(page, objetoDe(fase, 'fundo', 'fundo-selo-magico'));
  await page.getByLabel('Sua resposta').fill('80');
  const verificar = page.waitForResponse(/\/verificar/);
  await page.getByRole('button', { name: 'Responder' }).click();
  const retorno = (await (await verificar).json()) as Record<string, unknown>;
  expect(Object.keys(retorno).sort()).toEqual(['correto', 'digitos']);
  await page.getByRole('button', { name: 'Frente', exact: true }).click();
  await clicarObjeto(page, objetoDe(fase, 'frente', 'frente-porta'));
  await page.getByLabel('Senha da porta').fill('11111');
  await page.getByRole('button', { name: 'Responder' }).click();
  await expect(page.getByRole('main')).toContainText('Senha incorreta!');

  const recebidos = await corpos();
  expect(recebidos.some((c) => c.url.includes('/jogo'))).toBe(true);
  expect(recebidos.some((c) => c.url.endsWith('.js'))).toBe(true);
  expect(vazamentos(recebidos)).toEqual([]);
});

// @req RNF-04 @tipo negativo
test('test_RNF04_modo_testar_nao_recebe_resposta_nem_senha_depois_de_entrar_no_teste', async ({ page }) => {
  const fase = lerEscola();
  fase.titulo = `Tráfego ${marca()}`;
  await abrirNaEdicao(page, fase);
  const corpos = capturarRespostas(page);
  await page.getByRole('toolbar', { name: 'Ferramentas' }).getByRole('button', { name: 'Testar' }).click();
  await expect(page.getByRole('button', { name: 'Sair do teste' })).toBeVisible();
  await page.getByRole('button', { name: 'Fundo', exact: true }).click();
  await clicarObjeto(page, objetoDe(fase, 'fundo', 'fundo-selo-magico'));
  await page.getByLabel('Resposta', { exact: true }).fill('80');
  await page.getByRole('button', { name: 'Responder' }).click();
  await expect(page.getByRole('main')).toContainText('Resposta correta!');
  const recebidos = await corpos();
  expect(recebidos.some((c) => c.url.includes('/jogo-teste'))).toBe(true);
  expect(vazamentos(recebidos)).toEqual([]);
});

// @req RNF-05 @tipo feliz
test('test_RNF05_cookie_de_sessao_e_httponly_e_invisivel_ao_javascript', async ({ page, context }) => {
  const { pessoa } = await contaNaApi();
  await entrarNoEditor(page, pessoa);
  const sessao = (await context.cookies()).find((c) => c.name === 'sid');
  expect(sessao?.httpOnly).toBe(true);
  expect(await page.evaluate(() => document.cookie)).not.toContain('sid');
});

const AVISO_PLAYER = /menor que 1280x720/;

// @req RNF-01 @tipo borda
test('test_RNF01_aviso_de_resolucao_aparece_abaixo_de_1280x720_e_nao_em_1280x720', async ({ page }) => {
  const { id } = await publicarEscola();
  const { pessoa } = await contaNaApi();
  await entrarNoEditor(page, pessoa);
  const lista = await page.request.post(`${EDITOR}/api/fases`, { data: { titulo: 'Tela' } });
  const nova = (await lista.json()) as { id: string };
  for (const url of [`${PLAYER}/jogar/${id}`, `${EDITOR}/fases/${nova.id}`]) {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(url);
    await expect(page.getByRole('button', { name: 'Frente' }).or(page.getByRole('tab', { name: 'Frente' }))).toBeVisible();
    await expect(page.getByText(AVISO_PLAYER)).toHaveCount(0);
    await page.setViewportSize({ width: 1279, height: 720 });
    await expect(page.getByText(AVISO_PLAYER)).toBeVisible();
    await page.setViewportSize({ width: 1280, height: 719 });
    await expect(page.getByText(AVISO_PLAYER)).toBeVisible();
  }
});

for (const [largura, altura] of [[1280, 720], [1920, 1080], [2560, 1440]] as const) {
  // @req RNF-02 @tipo feliz
  test(`test_RNF02_sala_em_16_9_e_objetos_relativos_em_${largura}x${altura}`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: altura });
    const { id, fase } = await publicarEscola();
    await page.goto(`${PLAYER}/jogar/${id}`);
    const caixa = await page.locator('.konvajs-content').first().boundingBox();
    expect(caixa).not.toBeNull();
    expect((caixa?.width ?? 0) / (caixa?.height ?? 1)).toBeCloseTo(16 / 9, 2);
    await clicarObjeto(page, objetoDe(fase, 'frente', 'frente-giz'));
    await expect(page.getByRole('main')).toContainText('giz');
  });

  // @req RNF-02 @tipo borda
  test(`test_RNF02_fala_e_campo_de_resposta_aparecem_sem_rolar_em_${largura}x${altura}`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: altura });
    const { id, fase } = await publicarEscola();
    await page.goto(`${PLAYER}/jogar/${id}`);
    await clicarObjeto(page, objetoDe(fase, 'frente', 'frente-giz'));
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(page.getByText(/giz vai ser/)).toBeInViewport({ timeout: 2000 });
    await clicarObjeto(page, objetoDe(fase, 'frente', 'frente-quadro-negro'));
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(page.getByLabel('Sua resposta')).toBeInViewport({ timeout: 2000 });
    const pagina = await page.evaluate(() => ({ rolaX: document.documentElement.scrollWidth - innerWidth, rolaY: document.documentElement.scrollHeight - innerHeight }));
    expect(pagina).toEqual({ rolaX: 0, rolaY: 0 });
  });
}

/** Razão de contraste WCAG 2.1 do texto de cada elemento sobre o primeiro fundo opaco atrás dele. */
async function piorContraste(page: Page) {
  return page.evaluate(() => {
    const canal = (v: number) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    const rgb = (t: string) => (t.match(/[\d.]+/g) ?? []).map(Number);
    const lum = ([r = 0, g = 0, b = 0]: number[]) => 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
    const fundo = (el: Element | null): number[] => {
      for (let e = el; e; e = e.parentElement) {
        const c = rgb(getComputedStyle(e).backgroundColor);
        if (c.length === 3 || (c[3] ?? 0) === 1) return c;
      }
      return [255, 255, 255];
    };
    const achados: { texto: string; razao: number; grande: boolean }[] = [];
    for (const el of document.querySelectorAll('h1,h2,h3,p,a,label,button,span,li,strong,legend')) {
      if (!(el as HTMLElement).innerText?.trim() || (el as HTMLButtonElement).disabled) continue;
      const estilo = getComputedStyle(el);
      const a = lum(rgb(estilo.color));
      const b = lum(fundo(el));
      const razao = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      const px = Number.parseFloat(estilo.fontSize);
      const grande = px >= 24 || (px >= 18.66 && Number(estilo.fontWeight) >= 700);
      achados.push({ texto: (el as HTMLElement).innerText.slice(0, 30), razao, grande });
    }
    return achados.filter((x) => x.razao < (x.grande ? 3 : 4.5));
  });
}

// @req RNF-07 @tipo feliz
test('test_RNF07_contraste_e_idioma_no_login_escolher_fase_e_edicao', async ({ page }) => {
  await publicarEscola();
  await page.goto(`${PLAYER}/fases`);
  await expect(page.locator('html')).toHaveAttribute('lang', /^pt/);
  await expect(page.getByRole('heading', { name: 'Escolher fase' })).toBeVisible();
  expect(await piorContraste(page)).toEqual([]);
  await page.goto(EDITOR);
  await expect(page.locator('html')).toHaveAttribute('lang', /^pt/);
  await expect(page.getByRole('form', { name: 'Entrar' })).toBeVisible();
  expect(await piorContraste(page)).toEqual([]);
  const fase = lerEscola();
  fase.titulo = `Contraste ${marca()}`;
  await abrirNaEdicao(page, fase);
  expect(await piorContraste(page)).toEqual([]);
});

const temFocoVisivel = (page: Page) =>
  page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return false;
    const e = getComputedStyle(el);
    return el.matches(':focus-visible') && e.outlineStyle !== 'none' && Number.parseFloat(e.outlineWidth) > 0;
  });

// @req RNF-07 @tipo feliz
test('test_RNF07_login_so_pelo_teclado_com_foco_visivel', async ({ page }) => {
  const { pessoa } = await contaNaApi();
  await page.goto(EDITOR);
  await page.getByRole('form', { name: 'Entrar' }).waitFor();
  await page.keyboard.press('Tab');
  expect(await temFocoVisivel(page)).toBe(true);
  await page.keyboard.type(pessoa.email);
  await page.keyboard.press('Tab');
  expect(await temFocoVisivel(page)).toBe(true);
  await page.keyboard.type(pessoa.senha);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Nova fase' })).toBeVisible();
});

// @req RNF-07 @tipo feliz
test('test_RNF07_escolher_fase_so_pelo_teclado_com_foco_visivel', async ({ page }) => {
  const titulo = `Teclado ${marca()}`;
  await publicarEscola(titulo);
  await page.goto(`${PLAYER}/fases`);
  await page.getByRole('button', { name: titulo }).waitFor();
  for (let i = 0; i < 200; i += 1) {
    await page.keyboard.press('Tab');
    if (await page.getByRole('button', { name: titulo }).evaluate((el) => el === document.activeElement)) break;
  }
  await expect(page.getByRole('button', { name: titulo })).toBeFocused();
  expect(await temFocoVisivel(page)).toBe(true);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/jogar\//);
});

// @req RNF-07 @tipo feliz
test('test_RNF07_barra_do_editor_so_pelo_teclado_com_foco_visivel', async ({ page }) => {
  const fase = lerEscola();
  fase.titulo = `Barra ${marca()}`;
  await abrirNaEdicao(page, fase);
  const salvar = page.getByRole('toolbar', { name: 'Ferramentas' }).getByRole('button', { name: 'Salvar' });
  for (let i = 0; i < 30; i += 1) {
    await page.keyboard.press('Tab');
    if (await salvar.evaluate((el) => el === document.activeElement)) break;
  }
  await expect(salvar).toBeFocused();
  expect(await temFocoVisivel(page)).toBe(true);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('toolbar', { name: 'Ferramentas' })).toContainText('Salvo');
});
