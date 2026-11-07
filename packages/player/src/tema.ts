/**
 * Tema visual comum a Editor e Player (ADR-014, RNF-07): tokens de cor, tipografia e foco,
 * a razão de contraste WCAG 2.1 usada para conferir cada par texto/fundo (≥ 4,5:1)
 * e a folha de estilo comum dos dois apps. Identidade: quadro-negro e giz.
 */
import type { RazaoContraste, Tema } from '../contrato/index.ts';

const HEX_RRGGBB = /^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/;

/** Canal sRGB de 8 bits → valor linear (WCAG 2.1, luminância relativa). */
function canalLinear(canal8bits: number): number {
  const c = canal8bits / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminanciaRelativa(cor: string): number {
  const partes = HEX_RRGGBB.exec(cor);
  if (!partes) throw new Error(`Cor inválida: "${cor}". Use o formato #rrggbb.`);
  const [r, g, b] = [partes[1], partes[2], partes[3]].map((p) => canalLinear(Number.parseInt(p as string, 16))) as [
    number,
    number,
    number,
  ];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Razão de contraste WCAG 2.1 entre duas cores "#rrggbb" (1 a 21), independente da ordem. */
export const razaoContraste: RazaoContraste = (cor1, cor2) => {
  const l1 = luminanciaRelativa(cor1);
  const l2 = luminanciaRelativa(cor2);
  const clara = Math.max(l1, l2);
  const escura = Math.min(l1, l2);
  return (clara + 0.05) / (escura + 0.05);
};

const cores: Tema['cores'] = {
  fundo: '#14231e',
  superficie: '#1f3530',
  texto: '#f4f1e4',
  textoSuave: '#c3cdc4',
  primaria: '#f2c14e',
  textoSobrePrimaria: '#1b1a12',
  erro: '#ffb3a7',
  sucesso: '#9ee6ae',
  foco: '#f2c14e',
};

export const tema: Tema = {
  cores,
  paresDeContraste: [
    [cores.texto, cores.fundo],
    [cores.texto, cores.superficie],
    [cores.textoSuave, cores.fundo],
    [cores.textoSuave, cores.superficie],
    [cores.textoSobrePrimaria, cores.primaria],
    [cores.primaria, cores.fundo],
    [cores.primaria, cores.superficie],
    [cores.erro, cores.fundo],
    [cores.erro, cores.superficie],
    [cores.sucesso, cores.fundo],
    [cores.sucesso, cores.superficie],
  ],
  fonte: { familia: 'system-ui, "Segoe UI", Roboto, Arial, sans-serif', tamanhoBase: '16px' },
  foco: { largura: '3px', estilo: 'solid' },
};

const { fonte, foco } = tema;

/**
 * Folha de estilo comum: só aparência, por elemento e papel de acessibilidade. O layout de cada tela fica no app.
 * `main:not([class])` são as telas de menu (início, login, Minhas fases, Escolher fase, Conta).
 */
export const estiloTema = `
:root { color-scheme: dark; }
body { margin: 0; padding: 1rem; background: ${cores.fundo}; color: ${cores.texto};
  font-family: ${fonte.familia}; font-size: ${fonte.tamanhoBase}; line-height: 1.5; }
h1, h2, h3 { line-height: 1.2; }
a { color: ${cores.primaria}; text-underline-offset: 0.2em; }
[role="alert"] { color: ${cores.erro}; font-weight: 600; }
:focus-visible { outline: ${foco.largura} ${foco.estilo} ${cores.foco}; outline-offset: 2px; }
button, input, select, textarea { font: inherit; }
button { padding: 0.35rem 0.7rem; border: 1px solid ${cores.textoSuave}; border-radius: 0.4rem; cursor: pointer;
  background: ${cores.superficie}; color: ${cores.texto}; }
button:hover:not(:disabled) { border-color: ${cores.primaria}; }
button:disabled { opacity: 0.55; cursor: not-allowed; }
button[type="submit"], main:not([class]):has(> ul) > h1 + button, [role="alertdialog"] button:first-of-type, [role="tab"][aria-selected="true"] {
  background: ${cores.primaria}; border-color: ${cores.primaria}; color: ${cores.textoSobrePrimaria}; font-weight: 600; }
input, select, textarea { padding: 0.35rem 0.5rem; border: 1px solid ${cores.textoSuave}; border-radius: 0.4rem;
  background: ${cores.fundo}; color: ${cores.texto}; }
input[type="checkbox"] { accent-color: ${cores.primaria}; }
fieldset { border: 1px solid ${cores.textoSuave}; border-radius: 0.4rem; }
form label:has(+ input, + select, + textarea) { display: block; margin: 0.6rem 0 0.2rem; }
form input:not([type="checkbox"]), form select, form textarea { width: 100%; box-sizing: border-box; }
form button { margin-top: 0.75rem; }
fieldset label { display: inline-block; margin-right: 0.6rem; white-space: nowrap; }
[role="tablist"], [role="toolbar"] { display: flex; flex-wrap: wrap; gap: 0.3rem; align-items: center; }
[role="toolbar"] { margin-top: 0.5rem; }
[role="alertdialog"] { margin: 1rem 0; padding: 1rem; border: 1px solid ${cores.primaria}; border-radius: 0.5rem;
  background: ${cores.superficie}; }
[role="alertdialog"] p { margin-top: 0; }
[role="alertdialog"] button + button { margin-left: 0.4rem; }
main:not([class]):not(:has(> ul)) > h1 + button { border-color: ${cores.erro}; color: ${cores.erro}; }
main:not([class]) { max-width: 52rem; margin: 2rem auto; }
main:not([class]) > h1 { margin-top: 0; padding-bottom: 0.6rem; border-bottom: 3px solid ${cores.primaria}; font-size: 2.25rem; }
main:not([class]) > form { max-width: 28rem; margin: 1.5rem 0; padding: 1.25rem; border-radius: 0.5rem; background: ${cores.superficie}; }
main:not([class]):has(> form + form) { display: grid; grid-template-columns: repeat(auto-fit, minmax(20rem, 1fr)); gap: 1.5rem; align-items: start; }
main:not([class]):has(> form + form) > form { margin: 0; max-width: none; }
main:not([class]):has(> form + form) > form > h2 { margin-top: 0; }
main:not([class]):has(> form + form) > [role="alert"] { grid-column: 1 / -1; }
main:not([class]) > label { margin: 0 0.5rem 0 1rem; }
main:not([class]) > ul > li > a:only-child { flex: 1; font-weight: 600; }
main:not([class]) > ul { display: grid; gap: 0.6rem; margin: 1.5rem 0; padding: 0; list-style: none; }
main:not([class]) > ul > li { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; padding: 0.75rem 1rem;
  border-radius: 0.5rem; background: ${cores.superficie}; }
main:not([class]) > ul > li > span:first-child { flex: 1; font-weight: 600; }
main:not([class]) > ul > li > span:first-child + span { padding: 0 0.5rem; border: 1px solid ${cores.sucesso};
  border-radius: 1rem; color: ${cores.sucesso}; font-size: 0.875rem; }
main:not([class]) > ul > li > button:only-child { flex: 1; padding: 0; border: 0; background: transparent; font-weight: 600; text-align: left; }
.edicao-biblioteca, .edicao-painel, .jogo-coluna, .testar-coluna { box-sizing: border-box; padding: 0.75rem; border-radius: 0.5rem;
  background: ${cores.superficie}; }
.edicao-biblioteca ul { display: flex; flex-wrap: wrap; gap: 0.3rem; padding: 0; list-style: none; }
.jogo-coluna nav, .testar-coluna nav { display: flex; flex-wrap: wrap; gap: 0.3rem; }
/* A parede é o conteúdo da fase: continua sobre branco quando não tem imagem de fundo. */
.konvajs-content { background: #ffffff; box-shadow: 0 0.5rem 1.5rem #0b1411; }
/* Botões e cartões: resposta ao passar o mouse, sem animação para quem pede menos movimento. */
@media (prefers-reduced-motion: no-preference) {
  button, main:not([class]) > ul > li, main:not([class]) > ul > li > a { transition: transform 120ms ease, border-color 120ms ease, background-color 120ms ease; }
  main:not([class]) > ul > li:hover { transform: translateY(-2px); }
}
input[type="file"] { padding: 0; border: 0; background: transparent; }
input[type="file"]::file-selector-button { margin-right: 0.6rem; padding: 0.35rem 0.7rem; border: 1px solid ${cores.textoSuave}; border-radius: 0.4rem;
  background: ${cores.superficie}; color: ${cores.texto}; font: inherit; cursor: pointer; }
main:not([class]) > ul > li { border: 1px solid ${cores.superficie}; }
main:not([class]) > ul > li:hover { border-color: ${cores.primaria}; }
main:not([class]) > ul > li > button:last-child:not(:only-child) { color: ${cores.erro}; }
main:not([class]) > ul > li > button:only-child::after { content: "→"; content: "→" / ""; float: right; color: ${cores.primaria}; }
/* Símbolos de matemática ao fundo das telas de menu: só decoração. */
body:has(main:not([class]))::before { content: "π  ∑  √  ∞  ÷  x²  ≠  ∫"; content: "π  ∑  √  ∞  ÷  x²  ≠  ∫" / "";
  position: fixed; inset: auto 0 1.5rem; z-index: -1; overflow: hidden; color: ${cores.superficie}; font-size: clamp(3rem, 9vw, 7rem); text-align: center; white-space: pre; pointer-events: none; }
/* Tela inicial. */
main:not([class]):has(> h1 + p + ul) { max-width: 40rem; margin-top: 12vh; text-align: center; }
main:not([class]):has(> h1 + p + ul) > h1 { display: inline-block; padding: 0 1.5rem 0.5rem; font-size: clamp(3rem, 8vw, 4.5rem); }
main:not([class]):has(> h1 + p + ul) > p { color: ${cores.textoSuave}; font-size: 1.125rem; }
main:not([class]):has(> h1 + p + ul) > ul { grid-template-columns: 1fr 1fr; }
main:not([class]):has(> h1 + p + ul) > ul > li { padding: 0; }
main:not([class]):has(> h1 + p + ul) > ul > li > a { flex: 1; padding: 0.85rem 1rem; border-radius: 0.5rem; text-decoration: none; }
main:not([class]):has(> h1 + p + ul) > ul > li:first-child > a { background: ${cores.primaria}; color: ${cores.textoSobrePrimaria}; }
/* Login: o nome do jogo acima dos dois cartões. */
main:not([class]):has(> form + form)::before { content: "Math Scape"; content: "Math Scape" / ""; grid-column: 1 / -1; padding-bottom: 0.6rem;
  border-bottom: 3px solid ${cores.primaria}; font-size: 2.25rem; line-height: 1.2; }
/* Edição e jogo. */
.edicao-biblioteca h2, .edicao-painel h2 { margin: 0.75rem 0 0.5rem; color: ${cores.textoSuave}; font-size: 0.8125rem; letter-spacing: 0.08em; text-transform: uppercase; }
.edicao-biblioteca h2:first-child, .edicao-painel h2:first-child { margin-top: 0; }
.edicao-biblioteca ul { display: grid; grid-template-columns: 1fr 1fr; margin: 0; }
.edicao-biblioteca li { display: flex; }
.edicao-biblioteca li > button { width: 100%; padding: 0.3rem 0.35rem; font-size: 0.8125rem; }
.edicao-palco { border-radius: 0.5rem; }
`;
