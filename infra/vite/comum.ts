/**
 * Configuração comum dos apps Vite (Editor e Player).
 * - /api → Api local, sem o prefixo (ADR-017: mesmo site, cookie SameSite=Lax).
 * - /sprites/* → packages/schema/biblioteca/sprites (ADR-012), no dev e no build.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { Plugin, UserConfig } from 'vite';

const DIRETORIO_SPRITES = resolve(import.meta.dirname, '../../packages/schema/biblioteca/sprites');
const TIPOS: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' };

function sprites(): Plugin {
  const arquivos = () => (existsSync(DIRETORIO_SPRITES) ? readdirSync(DIRETORIO_SPRITES).filter((f) => !f.startsWith('.')) : []);
  return {
    name: 'math-scape-sprites',
    configureServer(servidor) {
      servidor.middlewares.use('/sprites', (req, res, proximo) => {
        const nome = decodeURIComponent((req.url ?? '').replace(/^\//, '').split('?')[0] ?? '');
        if (!arquivos().includes(nome)) return proximo();
        res.setHeader('Content-Type', TIPOS[nome.slice(nome.lastIndexOf('.')).toLowerCase()] ?? 'application/octet-stream');
        res.end(readFileSync(join(DIRETORIO_SPRITES, nome)));
      });
    },
    generateBundle() {
      for (const nome of arquivos()) {
        this.emitFile({ type: 'asset', fileName: `sprites/${nome}`, source: readFileSync(join(DIRETORIO_SPRITES, nome)) });
      }
    },
  };
}

export function configuracaoComum(porta: number): UserConfig {
  return {
    plugins: [sprites()],
    server: {
      port: porta,
      proxy: { '/api': { target: 'http://localhost:3000', rewrite: (caminho) => caminho.replace(/^\/api/, '') } },
    },
    build: { target: ['chrome120', 'edge120', 'firefox120'] },
  };
}
