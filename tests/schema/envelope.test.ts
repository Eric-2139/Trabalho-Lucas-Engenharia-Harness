/**
 * Módulo: validarEnvelope (packages/schema/contrato/funcoes.ts, ADR-013).
 * Requisito: RNF-09 (documento fora do schema é recusado ao importar; documento válido é aceito).
 * Salvar e publicar pela Api ficam para a rodada da Api.
 */
import { validarEnvelope } from '@math-scape/schema';
import { describe, expect, test } from 'vitest';
import { DATA_URL_PNG, UUID_ASSET, enigma, fase, faseComSenha, faseValida, objeto, porta, temErroEm } from '../fixtures/fases.ts';

function envelope(faseEmbutida: unknown, imagens: Record<string, string> = {}) {
  return { formato: 'math-scape-fase', versao: 1, fase: faseEmbutida, imagens };
}

describe('RNF-09 · importação valida a fase pelo mesmo schema', () => {
  // @req RNF-09 @tipo feliz
  test('test_RNF09_envelope_com_fase_valida_e_aceito', () => {
    expect(validarEnvelope(envelope(faseValida()))).toEqual({ ok: true, fase: faseValida(), imagens: {} });
  });

  // @req RNF-09 @tipo feliz
  test('test_RNF09_envelope_com_imagem_propria_usada_e_aceito', () => {
    const comAsset = fase('1234', {
      frente: [porta(), objeto('quadro-proprio', { tipo: 'decoracao' }, `asset:${UUID_ASSET}`)],
      teto: [enigma('e-teto', [1, 2, 3, 4])],
    });
    const resultado = validarEnvelope(envelope(comAsset, { [UUID_ASSET]: DATA_URL_PNG }));
    expect(resultado).toEqual({ ok: true, fase: comAsset, imagens: { [UUID_ASSET]: DATA_URL_PNG } });
  });

  // @req RNF-09 @tipo borda
  test('test_RNF09_envelope_com_fase_de_senha_com_3_digitos_e_recusado', () => {
    const resultado = validarEnvelope(envelope(faseComSenha('123')));
    expect(resultado.ok).toBe(false);
    expect(temErroEm(resultado, ['fase', 'senha'])).toBe(true);
  });

  // @req RNF-09 @tipo borda
  test('test_RNF09_envelope_com_campo_desconhecido_e_recusado', () => {
    const resultado = validarEnvelope({ ...envelope(faseValida()), autor: 'criador-1' });
    expect(resultado.ok).toBe(false);
  });

  // @req RNF-09 @tipo borda
  test('test_RNF09_entrada_que_nao_e_envelope_e_recusada_sem_excecao', () => {
    for (const entrada of [undefined, null, 42, 'fase', [], {}]) {
      expect(() => validarEnvelope(entrada)).not.toThrow();
      expect(validarEnvelope(entrada).ok).toBe(false);
    }
  });

  // @req RNF-09 @tipo negativo
  test('test_RNF09_envelope_com_fase_fora_do_schema_e_recusado', () => {
    const decoracaoComFala = { ...enigma('obj-1', []), interacao: { tipo: 'decoracao', texto: 'Olá.' } };
    const base = fase('92139');
    const faseInvalida = { ...base, paredes: { ...base.paredes, frente: { fundo: null, objetos: [decoracaoComFala] } } };
    const resultado = validarEnvelope(envelope(faseInvalida));
    expect(resultado.ok).toBe(false);
    expect(temErroEm(resultado, ['fase', 'paredes', 'frente', 'objetos', 0, 'interacao'])).toBe(true);
  });

  // @req RNF-09 @tipo negativo
  test('test_RNF09_fase_sem_envelope_e_recusada_na_importacao', () => {
    const resultado = validarEnvelope(faseValida());
    expect(resultado.ok).toBe(false);
    expect(temErroEm(resultado, ['formato'])).toBe(true);
  });

  // @req RNF-09 @tipo negativo
  test('test_RNF09_envelope_de_outro_formato_ou_versao_e_recusado', () => {
    const outroFormato = validarEnvelope({ ...envelope(faseValida()), formato: 'outro-jogo' });
    expect(outroFormato.ok).toBe(false);
    expect(temErroEm(outroFormato, ['formato'])).toBe(true);
    const outraVersao = validarEnvelope({ ...envelope(faseValida()), versao: 2 });
    expect(outraVersao.ok).toBe(false);
    expect(temErroEm(outraVersao, ['versao'])).toBe(true);
  });
});
