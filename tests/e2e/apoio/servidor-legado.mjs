// Serve o jogo legado como ele era servido: o HTML usa rotas curtas (/F_Roo, /fase_css_F, /Fase_scrip_D) em vez de caminhos de arquivo.
// O mapa abaixo vem das referências de index.html; a pasta do legado não é alterada.
import { createReadStream, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join } from 'node:path';

const raiz = process.env.DIRETORIO_LEGADO;
if (!raiz) throw new Error('defina DIRETORIO_LEGADO');
const porta = Number(process.argv[2] ?? 5175);

const ROTAS = {
  '/': 'index.html',
  '/fase_css': 'css/estilo.css', '/fase_css_F': 'css/frente.css', '/fase_css_D': 'css/direita.css',
  '/fase_css_FU': 'css/fundo.css', '/fase_css_E': 'css/esquerda.css', '/fase_css_T': 'css/teto.css',
  '/Fase_scrip': 'js/script.js', '/Fase_scrip_F': 'js/frente.js', '/Fase_scrip_D': 'js/direita.js',
  '/Fase_scrip_FU': 'js/fundo.js', '/Fase_scrip_E': 'js/esquerda.js', '/Fase_scrip_T': 'js/teto.js',
  '/ico_fase': 'imagens/favicons/favicon-32x32.png',
  '/F_Roo': 'imagens/frente/room.png', '/F_Conf': 'imagens/frente/configuracoes.png', '/F_Door': 'imagens/frente/door.png',
  '/F_Quad': 'imagens/frente/quadro_negro.png', '/F_Giz': 'imagens/frente/giz de quadro.png', '/F_Int': 'imagens/frente/interrogação.png',
  '/F_Rel': 'imagens/frente/relogio.png', '/F_Bot_Fu': 'imagens/frente/botao_futuro.png',
  '/D_Roo': 'imagens/direita/room_2.png', '/D_Quad': 'imagens/direita/quadro.png', '/D_Jan': 'imagens/direita/janela.png',
  '/D_Conf': 'imagens/direita/configuracoes.png', '/D_Int': 'imagens/direita/interrogação.png',
  '/Fu_Roo': 'imagens/fundo/room.png', '/Fu_Jan': 'imagens/fundo/janela.png', '/Fu_ArS': 'imagens/fundo/arvore-seca.png',
  '/Fu_ArvSc': 'imagens/fundo/arvore.png', '/Fu_Pen': 'imagens/fundo/pentagrama.png', '/Fu_Conf': 'imagens/fundo/configuracoes.png',
  '/Fu_Int': 'imagens/fundo/interrogação.png',
  '/E_Roo': 'imagens/esquerda/room_2.png', '/E_Rel_Ant': 'imagens/esquerda/relogio.png', '/E_Conf': 'imagens/esquerda/configuracoes.png',
  '/E_Int': 'imagens/esquerda/interrogação.png', '/E_GizV': 'imagens/esquerda/giz-vermelho.png',
  '/T_tet': 'imagens/teto/teto.png', '/T_Lam': 'imagens/teto/lampada.png', '/T_Conf': 'imagens/teto/configuracoes.png',
  '/T_God': 'imagens/teto/god-eye.jpg', '/T_Int': 'imagens/teto/interrogação.png', '/T_Rel': 'imagens/teto/relogio-teto.png',
};
const TIPOS = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg' };

createServer((req, res) => {
  const caminho = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const arquivo = ROTAS[caminho] && join(raiz, ROTAS[caminho]);
  if (!arquivo || !existsSync(arquivo)) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { 'Content-Type': TIPOS[extname(arquivo)] ?? 'application/octet-stream' });
  createReadStream(arquivo).pipe(res);
}).listen(porta, () => console.log(`legado em ${porta}`));
