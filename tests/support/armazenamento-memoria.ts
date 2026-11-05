/**
 * Armazenamento em memória para os testes da Api (README §3, ADR-010): implementa o
 * contrato `Armazenamento` e registra o que foi gravado e apagado, para os testes
 * conferirem, por exemplo, que excluir a conta apaga os arquivos de imagem (RF-19).
 */
import type { Armazenamento, TipoImagem } from '@math-scape/api/contrato';

export interface ArmazenamentoMemoria extends Armazenamento {
  /** Arquivos presentes agora, por id. */
  readonly arquivos: Map<string, { bytes: Uint8Array; mime: TipoImagem }>;
  /** Ids recebidos por `gravar`, na ordem. */
  readonly gravados: string[];
  /** Ids recebidos por `apagar`, na ordem. */
  readonly apagados: string[];
}

export function criarArmazenamentoMemoria(): ArmazenamentoMemoria {
  const arquivos = new Map<string, { bytes: Uint8Array; mime: TipoImagem }>();
  const gravados: string[] = [];
  const apagados: string[] = [];
  return {
    arquivos,
    gravados,
    apagados,
    async gravar(id, bytes, mime) {
      gravados.push(id);
      arquivos.set(id, { bytes: new Uint8Array(bytes), mime });
    },
    async ler(id) {
      return arquivos.get(id) ?? null;
    },
    async apagar(id) {
      apagados.push(id);
      arquivos.delete(id);
    },
  };
}
