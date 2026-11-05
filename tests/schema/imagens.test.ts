/**
 * Módulo: imagens do SchemaFase (`resolverImagem`; contrato/funcoes.ts; modulos-schema.md §4 e §5;
 * biblioteca/catalogo.ts; ADR-012).
 * Requisitos: RF-06 (imagem própria `asset:<uuid>` usada como fundo ou objeto vira a URL da Api)
 * e RF-04 (sprites da biblioteca resolvidos pelo catálogo; sprite fora do catálogo lança).
 *
 * Os valores esperados vêm do contrato: sprite → "/sprites/<arquivo do catálogo>",
 * asset → "<baseUrlApi>/assets/<uuid>". Uuids sintéticos fixos.
 */
import { resolverImagem } from '@math-scape/schema';
import { CATALOGO } from '@math-scape/schema/contrato';
import { describe, expect, test } from 'vitest';
import { UUID_ASSET } from '../fixtures/fases.ts';

const OUTRO_UUID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';

// =====================================================================
// RF-06 · imagem própria (asset) resolvida para a URL da Api
// =====================================================================
describe('RF-06 · resolverImagem de imagem própria', () => {
  // @req RF-06 @tipo feliz
  test('test_RF06_asset_resolve_para_assets_na_base_da_api_dos_apps', () => {
    expect(resolverImagem(`asset:${UUID_ASSET}`, '/api')).toBe(`/api/assets/${UUID_ASSET}`);
    expect(resolverImagem(`asset:${OUTRO_UUID}`, '/api')).toBe(`/api/assets/${OUTRO_UUID}`);
  });

  // @req RF-06 @tipo borda
  test('test_RF06_asset_usa_exatamente_a_base_recebida', () => {
    expect(resolverImagem(`asset:${UUID_ASSET}`, 'https://api.exemplo.test')).toBe(
      `https://api.exemplo.test/assets/${UUID_ASSET}`,
    );
    expect(resolverImagem(`asset:${UUID_ASSET}`, '')).toBe(`/assets/${UUID_ASSET}`);
  });

  // @req RF-06 @tipo negativo
  test('test_RF06_asset_nunca_vira_caminho_de_sprite', () => {
    const url = resolverImagem(`asset:${UUID_ASSET}`, '/api');
    expect(url.startsWith('/sprites/')).toBe(false);
    expect(url).not.toContain('asset:');
  });
});

// =====================================================================
// RF-04 · sprites da biblioteca resolvidos pelo catálogo
// =====================================================================
describe('RF-04 · resolverImagem de sprite do catálogo', () => {
  // @req RF-04 @tipo feliz
  test('test_RF04_sprite_de_objeto_resolve_para_o_arquivo_do_catalogo', () => {
    expect(resolverImagem('sprite:porta', '/api')).toBe('/sprites/porta.png');
    expect(resolverImagem('sprite:quadro', '/api')).toBe('/sprites/quadro.svg');
    expect(resolverImagem('sprite:olho', '/api')).toBe('/sprites/olho.jpg');
  });

  // @req RF-04 @tipo borda
  test('test_RF04_todo_sprite_do_catalogo_inclusive_fundos_resolve_sem_depender_da_base', () => {
    for (const sprite of CATALOGO) {
      expect(resolverImagem(`sprite:${sprite.id}`, '/api')).toBe(`/sprites/${sprite.arquivo}`);
      expect(resolverImagem(`sprite:${sprite.id}`, 'https://api.exemplo.test')).toBe(`/sprites/${sprite.arquivo}`);
    }
  });

  // @req RF-04 @tipo negativo
  test('test_RF04_sprite_fora_do_catalogo_lanca_erro', () => {
    expect(() => resolverImagem('sprite:nao-existe', '/api')).toThrow();
    expect(() => resolverImagem('sprite:interrogacao', '/api')).toThrow();
    expect(() => resolverImagem('sprite:PORTA', '/api')).toThrow();
  });
});
