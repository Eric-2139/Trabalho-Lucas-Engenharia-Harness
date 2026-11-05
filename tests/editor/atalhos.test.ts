/**
 * Módulo: Atalhos (apps/editor/contrato/store.ts · AtalhoTeclado; modulos-editor.md §1).
 * Requisito: RF-09 — desfazer e refazer com Ctrl+Z e Ctrl+Y (Cmd no macOS); outra tecla → null.
 */
import { atalhoTeclado } from '@math-scape/app-editor';
import { describe, expect, test } from 'vitest';

type Modificadores = { ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean };

function tecla(key: string, mods: Modificadores = {}) {
  return { key, ctrlKey: mods.ctrlKey ?? false, metaKey: mods.metaKey ?? false, shiftKey: mods.shiftKey ?? false };
}

describe('RF-09 · atalhoTeclado', () => {
  // @req RF-09 @tipo feliz
  test('test_RF09_ctrl_z_desfaz', () => {
    expect(atalhoTeclado(tecla('z', { ctrlKey: true }))).toBe('desfazer');
  });

  // @req RF-09 @tipo feliz
  test('test_RF09_ctrl_y_refaz', () => {
    expect(atalhoTeclado(tecla('y', { ctrlKey: true }))).toBe('refazer');
  });

  // @req RF-09 @tipo borda
  test('test_RF09_cmd_z_no_macos_desfaz', () => {
    expect(atalhoTeclado(tecla('z', { metaKey: true }))).toBe('desfazer');
  });

  // @req RF-09 @tipo borda
  test('test_RF09_cmd_y_no_macos_refaz', () => {
    expect(atalhoTeclado(tecla('y', { metaKey: true }))).toBe('refazer');
  });

  // @req RF-09 @tipo negativo
  test('test_RF09_z_e_y_sem_ctrl_nem_cmd_nao_sao_atalho', () => {
    expect(atalhoTeclado(tecla('z'))).toBeNull();
    expect(atalhoTeclado(tecla('y'))).toBeNull();
    expect(atalhoTeclado(tecla('z', { shiftKey: true }))).toBeNull();
  });

  // @req RF-09 @tipo negativo
  test('test_RF09_ctrl_com_outra_tecla_devolve_null', () => {
    for (const key of ['x', 'c', 'v', 'a', 's', 'Enter', 'Control']) {
      expect(atalhoTeclado(tecla(key, { ctrlKey: true }))).toBeNull();
      expect(atalhoTeclado(tecla(key, { metaKey: true }))).toBeNull();
    }
  });
});
