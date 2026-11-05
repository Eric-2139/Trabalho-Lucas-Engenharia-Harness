/**
 * ADR-010, ADR-012, ADR-013: referências de imagem da fase.
 */
import { spriteDoCatalogo } from '../biblioteca/catalogo.ts';
import { type Fase, PADRAO_REF_ASSET, PAREDES, type RefImagem } from '../contrato/fase.ts';

const PADRAO_REF_SPRITE = /^sprite:([a-z0-9-]+)$/;

/**
 * URL da imagem (ADR-012): `sprite:<id>` → "/sprites/<arquivo do catálogo>", servido pelo próprio app;
 * `asset:<uuid>` → "<baseUrlApi>/assets/<uuid>". Sprite fora do catálogo ou referência malformada lança.
 */
export function resolverImagem(ref: RefImagem, baseUrlApi: string): string {
  const asset = PADRAO_REF_ASSET.exec(ref)?.[1];
  if (asset) return `${baseUrlApi}/assets/${asset}`;
  const idSprite = PADRAO_REF_SPRITE.exec(ref)?.[1];
  const sprite = idSprite === undefined ? undefined : spriteDoCatalogo(idSprite);
  if (!sprite) throw new Error(`imagem fora do catálogo: ${ref}`);
  return `/sprites/${sprite.arquivo}`;
}

/** uuids de todas as referências `asset:` da fase, sem repetição, na ordem em que aparecem. */
export function referenciasDeAsset(fase: Fase): string[] {
  const uuids = new Set<string>();
  const anotar = (ref: string | null) => {
    const uuid = ref === null ? undefined : PADRAO_REF_ASSET.exec(ref)?.[1];
    if (uuid) uuids.add(uuid);
  };
  for (const parede of PAREDES) {
    anotar(fase.paredes[parede].fundo);
    for (const objeto of fase.paredes[parede].objetos) {
      anotar(objeto.imagem);
    }
  }
  return [...uuids];
}
