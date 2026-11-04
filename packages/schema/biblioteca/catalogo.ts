/**
 * Catálogo de sprites (ADR-012). É contrato: o schema aceita `sprite:<id>` só para
 * os ids daqui, e na categoria certa. Fechado na fase 3 a partir do jogo legado
 * (harness/entrada/legado/, Math_Scape_Telas @ f62627e). Acrescentar sprite é
 * decisão de projeto, não da implementação (LAC-027).
 *
 * `largura`/`altura` são o tamanho padrão ao arrastar para a parede, em coordenadas
 * relativas ao palco 16:9 (ADR-006), mantendo a proporção da imagem.
 *
 * Fora do catálogo de propósito: o ícone de interrogação (é o ícone de dica do Player,
 * não um objeto: RF-17, LAC-030), o botão de configurações e o botão da senha (interface do legado).
 */
export type CategoriaSprite = 'objeto' | 'fundo';

export interface SpriteCatalogo {
  readonly id: string;
  readonly nome: string;
  readonly categoria: CategoriaSprite;
  /** Nome do arquivo em `biblioteca/sprites/`, servido em `/sprites/<arquivo>` por Editor e Player. */
  readonly arquivo: string;
  readonly largura: number;
  readonly altura: number;
}

export const CATALOGO: readonly SpriteCatalogo[] = [
  // Inventário mínimo do RF-04
  { id: 'porta', nome: 'Porta', categoria: 'objeto', arquivo: 'porta.png', largura: 0.13, altura: 0.426 },
  // Quadro em branco (SVG): o do legado já traz desenhado o enigma da direita (LAC-033)
  { id: 'quadro', nome: 'Quadro', categoria: 'objeto', arquivo: 'quadro.svg', largura: 0.16, altura: 0.477 },
  { id: 'janela', nome: 'Janela', categoria: 'objeto', arquivo: 'janela.png', largura: 0.14, altura: 0.249 },
  { id: 'relogio', nome: 'Relógio', categoria: 'objeto', arquivo: 'relogio.png', largura: 0.07, altura: 0.123 },
  // Objetos da fase original "Escola" (RF-04, RF-18)
  {
    id: 'quadro-setas',
    nome: 'Quadro com setas (Escola)',
    categoria: 'objeto',
    arquivo: 'quadro-setas.png',
    largura: 0.16,
    altura: 0.477,
  },
  {
    id: 'quadro-negro',
    nome: 'Quadro-negro',
    categoria: 'objeto',
    arquivo: 'quadro-negro.png',
    largura: 0.4,
    altura: 0.441,
  },
  {
    id: 'relogio-antigo',
    nome: 'Relógio antigo',
    categoria: 'objeto',
    arquivo: 'relogio-antigo.png',
    largura: 0.06,
    altura: 0.386,
  },
  {
    id: 'relogio-teto',
    nome: 'Relógio do teto',
    categoria: 'objeto',
    arquivo: 'relogio-teto.png',
    largura: 0.12,
    altura: 0.213,
  },
  { id: 'giz', nome: 'Giz', categoria: 'objeto', arquivo: 'giz.png', largura: 0.04, altura: 0.071 },
  {
    id: 'giz-vermelho',
    nome: 'Giz vermelho',
    categoria: 'objeto',
    arquivo: 'giz-vermelho.png',
    largura: 0.04,
    altura: 0.071,
  },
  { id: 'olho', nome: 'Olho', categoria: 'objeto', arquivo: 'olho.jpg', largura: 0.1, altura: 0.178 },
  {
    id: 'selo-magico',
    nome: 'Selo mágico',
    categoria: 'objeto',
    arquivo: 'selo-magico.png',
    largura: 0.2,
    altura: 0.356,
  },
  {
    id: 'arvore-seca',
    nome: 'Árvore seca',
    categoria: 'objeto',
    arquivo: 'arvore-seca.png',
    largura: 0.18,
    altura: 0.373,
  },
  { id: 'arvore', nome: 'Árvore', categoria: 'objeto', arquivo: 'arvore.png', largura: 0.18, altura: 0.353 },
  { id: 'lampada', nome: 'Lâmpada', categoria: 'objeto', arquivo: 'lampada.png', largura: 0.18, altura: 0.048 },
  // Texto escrito na parede (as perguntas da Escola não tinham imagem própria no legado)
  {
    id: 'inscricao',
    nome: 'Inscrição na parede',
    categoria: 'objeto',
    arquivo: 'inscricao.svg',
    largura: 0.3,
    altura: 0.267,
  },
  // Fundos da Escola: frente e fundo usam a mesma sala; direita e esquerda, a mesma sala lateral
  { id: 'fundo-sala', nome: 'Sala de aula', categoria: 'fundo', arquivo: 'fundo-sala.png', largura: 1, altura: 1 },
  {
    id: 'fundo-sala-lateral',
    nome: 'Sala de aula (lateral)',
    categoria: 'fundo',
    arquivo: 'fundo-sala-lateral.png',
    largura: 1,
    altura: 1,
  },
  { id: 'fundo-teto', nome: 'Teto', categoria: 'fundo', arquivo: 'fundo-teto.png', largura: 1, altura: 1 },
];

export function spriteDoCatalogo(id: string): SpriteCatalogo | undefined {
  return CATALOGO.find((sprite) => sprite.id === id);
}
