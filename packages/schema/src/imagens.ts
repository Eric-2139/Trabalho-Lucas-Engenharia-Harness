/**
 * ADR-010, ADR-012, ADR-013: referências de imagem da fase.
 */
import { type Fase, PADRAO_REF_ASSET, PAREDES } from '../contrato/fase.ts';

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
