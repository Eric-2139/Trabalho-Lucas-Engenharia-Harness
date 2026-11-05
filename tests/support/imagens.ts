/**
 * Apoio aos testes de imagens da Api (contrato api.md §Imagens; modulos-api.md §2 Assets; ADR-010):
 * arquivos sintéticos com a assinatura de cada tipo e o envio multipart de um arquivo.
 * Bytes fixos, sem aleatoriedade; o restante do arquivo é preenchido com zeros.
 */
import type { App, Resposta } from './api.ts';
import { comSessao } from './api.ts';

/** Assinaturas dos bytes iniciais (modulos-api.md §2): PNG `89 50 4E 47`, JPEG `FF D8 FF`, WebP `RIFF....WEBP`. */
const ASSINATURAS = {
  png: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52],
  jpeg: [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01],
  // "RIFF" + tamanho (little-endian, fixo) + "WEBP" + "VP8 "
  webp: [0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20],
  // Fora do aceito: GIF ("GIF89a") e texto puro.
  gif: [0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00],
  texto: [...Buffer.from('texto sintético, não é imagem', 'utf8')],
} as const;

export type TipoSintetico = keyof typeof ASSINATURAS;

/** Arquivo sintético do tipo dado com exatamente `tamanho` bytes (mínimo: a própria assinatura). */
export function arquivoSintetico(tipo: TipoSintetico, tamanho = 64): Buffer {
  const assinatura = ASSINATURAS[tipo];
  const bytes = Buffer.alloc(Math.max(tamanho, assinatura.length));
  Buffer.from(assinatura).copy(bytes);
  return bytes;
}

const FRONTEIRA = '----fronteira-sintetica-imagens-0001';

export interface ArquivoEnviado {
  bytes: Buffer;
  nome?: string;
  tipoDeclarado?: string;
}

/** Corpo multipart com um arquivo no campo `arquivo`. */
export function corpoMultipart(arquivo: ArquivoEnviado): Buffer {
  const nome = arquivo.nome ?? 'imagem-sintetica.png';
  const tipo = arquivo.tipoDeclarado ?? 'image/png';
  return Buffer.concat([
    Buffer.from(
      `--${FRONTEIRA}\r\nContent-Disposition: form-data; name="arquivo"; filename="${nome}"\r\nContent-Type: ${tipo}\r\n\r\n`,
    ),
    arquivo.bytes,
    Buffer.from(`\r\n--${FRONTEIRA}--\r\n`),
  ]);
}

/** `POST /assets` (multipart, 1 arquivo); `sid` indefinido envia sem sessão. */
export function enviarAsset(app: App, sid: string | undefined, arquivo: ArquivoEnviado): Promise<Resposta> {
  return app.inject({
    method: 'POST',
    url: '/assets',
    ...(sid === undefined ? {} : { cookies: comSessao(sid) }),
    headers: { 'content-type': `multipart/form-data; boundary=${FRONTEIRA}` },
    payload: corpoMultipart(arquivo),
  });
}

/** `GET /assets/:id`, sem sessão (a imagem de fase publicada é pública por URL, ADR-010). */
export function lerAsset(app: App, id: string): Promise<Resposta> {
  return app.inject({ method: 'GET', url: `/assets/${id}` });
}

/** Envia um PNG sintético e devolve o id; lança se o envio não der 201. */
export async function enviarPngSintetico(app: App, sid: string): Promise<string> {
  const res = await enviarAsset(app, sid, { bytes: arquivoSintetico('png') });
  if (res.statusCode !== 201) {
    throw new Error(`preparo do teste falhou em enviar imagem: HTTP ${res.statusCode} ${res.body}`);
  }
  return (res.json() as { id: string }).id;
}
