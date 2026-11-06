/**
 * Fase 6 · RNF-03 (ADR-007, PEND-006): arrastar com 50 objetos numa parede mantém pelo menos 30 quadros por segundo.
 * Aqui o relógio é a própria medida: os quadros são contados com requestAnimationFrame e performance.now, no navegador.
 * O número vale para a máquina do teste; o relatório registra CPU, memória e navegador.
 */
import { writeFileSync } from 'node:fs';
import { cpus, totalmem } from 'node:os';
import { expect, test } from '@playwright/test';
import { abrirNaEdicao, faseVazia, marca, objetoSimples, pontoDoObjeto } from './apoio/sistema.ts';

// @req RNF-03 @tipo borda
test('test_RNF03_arrastar_com_50_objetos_mantem_30_quadros_por_segundo', async ({ page, browserName }, info) => {
  const fase = faseVazia(`Desempenho ${marca()}`);
  for (let i = 0; i < 50; i += 1) {
    fase.paredes.frente.objetos.push(objetoSimples(`o-${i}`, 0.05 + (i % 10) * 0.08, 0.05 + Math.floor(i / 10) * 0.12, { tipo: 'decoracao' }, i));
  }
  const alvo = fase.paredes.frente.objetos[49]!;
  await abrirNaEdicao(page, fase);

  const conteudo = page.locator('.konvajs-content').first();
  await conteudo.scrollIntoViewIfNeeded();
  const caixa = await conteudo.boundingBox();
  if (!caixa) throw new Error('sem palco');
  const inicio = await pontoDoObjeto(page, alvo);

  await page.evaluate(() => {
    const m = { quadros: [] as number[], ativo: true };
    (window as unknown as { medida: typeof m }).medida = m;
    const passo = (t: number) => {
      m.quadros.push(t);
      if (m.ativo) requestAnimationFrame(passo);
    };
    requestAnimationFrame(passo);
  });

  await page.mouse.move(caixa.x + inicio.x, caixa.y + inicio.y);
  await page.mouse.down();
  for (let i = 1; i <= 240; i += 1) {
    const fase2 = i / 240;
    await page.mouse.move(caixa.x + inicio.x - 500 * Math.sin(fase2 * Math.PI), caixa.y + inicio.y - 200 * Math.sin(fase2 * 2 * Math.PI));
  }
  await page.mouse.up();

  const quadros = await page.evaluate(() => {
    const m = (window as unknown as { medida: { quadros: number[]; ativo: boolean } }).medida;
    m.ativo = false;
    return m.quadros;
  });
  const intervalos = quadros.slice(1).map((t, i) => t - (quadros[i] as number)).sort((a, b) => a - b);
  const duracao = (quadros.at(-1) as number) - (quadros[0] as number);
  const fps = (1000 * intervalos.length) / duracao;
  const p95 = intervalos[Math.floor(intervalos.length * 0.95)] as number;
  const medida = {
    navegador: browserName,
    versao: page.context().browser()?.version(),
    cpu: cpus()[0]?.model,
    nucleos: cpus().length,
    memoria_gb: Math.round(totalmem() / 1024 ** 3),
    gpu: 'nenhuma (renderização por software, contêiner sem interface)',
    quadros: intervalos.length,
    duracao_ms: Math.round(duracao),
    fps_medio: Number(fps.toFixed(1)),
    intervalo_p95_ms: Number(p95.toFixed(1)),
    fps_no_p95: Number((1000 / p95).toFixed(1)),
  };
  writeFileSync(info.outputPath('medida.json'), JSON.stringify(medida, null, 2));
  await info.attach('medida', { body: JSON.stringify(medida), contentType: 'application/json' });
  console.log('[RNF-03]', JSON.stringify(medida));
  expect(medida.fps_medio).toBeGreaterThanOrEqual(30);
});
