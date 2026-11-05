/**
 * Imagens (modulos-api.md §1; ADR-010, ADR-013): tipo pelos bytes iniciais, não pela
 * extensão nem pelo tipo declarado; conversão entre bytes e data URL do envelope.
 */
import type { TipoImagem } from '../contrato/index.ts';

function comecaCom(bytes: Uint8Array, assinatura: readonly number[], inicio = 0): boolean {
  if (bytes.length < inicio + assinatura.length) return false;
  return assinatura.every((byte, i) => bytes[inicio + i] === byte);
}

const PNG = [0x89, 0x50, 0x4e, 0x47] as const;
const JPEG = [0xff, 0xd8, 0xff] as const;
/** "RIFF" nos bytes 0-3 e "WEBP" nos bytes 8-11. */
const RIFF = [0x52, 0x49, 0x46, 0x46] as const;
const WEBP = [0x57, 0x45, 0x42, 0x50] as const;

/** PNG `89 50 4E 47`, JPEG `FF D8 FF`, WebP `RIFF....WEBP`; qualquer outra coisa → null. */
export function detectarTipoImagem(bytes: Uint8Array): TipoImagem | null {
  if (comecaCom(bytes, PNG)) return 'image/png';
  if (comecaCom(bytes, JPEG)) return 'image/jpeg';
  if (comecaCom(bytes, RIFF) && comecaCom(bytes, WEBP, 8)) return 'image/webp';
  return null;
}

/** Bytes de uma data URL base64 (o formato já foi conferido por `validarEnvelope`). */
export function bytesDaDataUrl(dataUrl: string): Uint8Array {
  return new Uint8Array(Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64'));
}

export function dataUrlDe(bytes: Uint8Array, mime: TipoImagem): string {
  return `data:${mime};base64,${Buffer.from(bytes).toString('base64')}`;
}
