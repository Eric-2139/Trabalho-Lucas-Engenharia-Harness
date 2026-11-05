/**
 * Armazenamento de imagens em disco (ADR-010): um arquivo por id no diretório dado.
 * O tipo é relido pelos bytes ao ler (a gravação só aceita imagem já detectada).
 * Ids com separador de caminho ou fora do formato esperado são recusados.
 */
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { CriarArmazenamentoEmDisco } from '../../contrato/index.ts';
import { detectarTipoImagem } from '../imagens.ts';

const PADRAO_ID_ARQUIVO = /^[0-9A-Za-z-]{1,64}$/;

export const criarArmazenamentoEmDisco: CriarArmazenamentoEmDisco = (diretorio) => {
  const raiz = resolve(diretorio);

  function caminho(id: string): string {
    if (!PADRAO_ID_ARQUIVO.test(id)) throw new Error('id de arquivo inválido');
    return join(raiz, id);
  }

  return {
    async gravar(id, bytes) {
      const destino = caminho(id);
      await mkdir(raiz, { recursive: true });
      await writeFile(destino, bytes);
    },
    async ler(id) {
      let bytes: Uint8Array;
      try {
        bytes = new Uint8Array(await readFile(caminho(id)));
      } catch (erro) {
        if ((erro as { code?: unknown }).code === 'ENOENT') return null;
        throw erro;
      }
      const mime = detectarTipoImagem(bytes);
      return mime ? { bytes, mime } : null;
    },
    async apagar(id) {
      await rm(caminho(id), { force: true });
    },
  };
};
