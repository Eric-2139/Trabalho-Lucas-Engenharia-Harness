/**
 * Módulo: faseInicial (packages/schema/contrato/funcoes.ts).
 * Requisito: RF-08 (porta começa com 5 dígitos).
 */
import { faseInicial, validarFase } from '@math-scape/schema';
import { describe, expect, test } from 'vitest';

describe('RF-08 · fase inicial', () => {
  // @req RF-08 @tipo feliz
  test('test_RF08_fase_inicial_comeca_com_senha_de_5_digitos', () => {
    expect(faseInicial('Minha primeira fase').senha).toMatch(/^\d{5}$/);
  });

  // @req RF-08 @tipo feliz
  test('test_RF08_fase_inicial_tem_porta_na_frente_e_passa_no_schema', () => {
    const inicial = faseInicial('Minha primeira fase');
    const portas = inicial.paredes.frente.objetos.filter((objeto) => objeto.interacao.tipo === 'porta');
    expect(portas).toHaveLength(1);
    expect(portas[0]?.id).toBe('porta-1');
    expect(portas[0]?.imagem).toBe('sprite:porta');
    expect(validarFase(inicial).ok).toBe(true);
  });

  // @req RF-08 @tipo borda
  test('test_RF08_fase_inicial_tem_senha_de_5_dentro_do_intervalo_de_4_a_8', () => {
    const tamanho = faseInicial('A').senha.length;
    expect(tamanho).toBe(5);
    expect(tamanho).toBeGreaterThanOrEqual(4);
    expect(tamanho).toBeLessThanOrEqual(8);
  });

  // @req RF-08 @tipo feliz
  test('test_RF08_fase_inicial_so_tem_a_porta', () => {
    const inicial = faseInicial('Minha primeira fase');
    const tipos = Object.values(inicial.paredes).flatMap((parede) => parede.objetos.map((objeto) => objeto.interacao.tipo));
    expect(tipos).toEqual(['porta']);
  });
});
