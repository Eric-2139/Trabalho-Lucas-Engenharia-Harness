/**
 * Módulo: schema da fase + validarFase (packages/schema/contrato/fase.ts e funcoes.ts).
 * Requisitos: RF-07 (tipos de objeto), RF-08 (configuração de fala, enigma e porta), RNF-09 (schema único).
 */
import { validarFase } from '@math-scape/schema';
import { describe, expect, test } from 'vitest';
import {
  decoracao,
  enigma,
  fala,
  fase,
  faseComInteracao,
  faseComObjeto,
  faseComSenha,
  faseValida,
  objeto,
  porta,
  temErroEm,
} from '../fixtures/fases.ts';

const INTERACAO = ['paredes', 'frente', 'objetos', 0, 'interacao'];

describe('RF-07 · tipos de objeto', () => {
  // @req RF-07 @tipo feliz
  test('test_RF07_aceita_cada_um_dos_4_tipos', () => {
    const interacoes = [
      { tipo: 'decoracao' },
      { tipo: 'fala', texto: 'Olá, jogador.' },
      { tipo: 'enigma', pergunta: 'Quanto é 2 + 2?', respostas: [4], revela: [1] },
      { tipo: 'porta' },
    ];
    for (const interacao of interacoes) {
      expect(validarFase(faseComInteracao(interacao)).ok).toBe(true);
    }
  });

  // @req RF-07 @tipo feliz
  test('test_RF07_aceita_fase_com_os_4_tipos_juntos', () => {
    const resultado = validarFase(faseValida());
    expect(resultado.ok).toBe(true);
  });

  // @req RF-07 @tipo borda
  test('test_RF07_decoracao_so_com_tipo_e_aceita', () => {
    const resultado = validarFase(faseComObjeto(decoracao('lampada-1')));
    expect(resultado.ok).toBe(true);
  });

  // @req RF-07 @tipo borda
  test('test_RF07_recusa_decoracao_com_texto_vazio', () => {
    const resultado = validarFase(faseComInteracao({ tipo: 'decoracao', texto: '' }));
    expect(resultado.ok).toBe(false);
    expect(temErroEm(resultado, INTERACAO)).toBe(true);
  });

  // @req RF-07 @tipo borda
  test('test_RF07_recusa_decoracao_com_campos_de_enigma', () => {
    const resultado = validarFase(faseComInteracao({ tipo: 'decoracao', respostas: [1], revela: [] }));
    expect(resultado.ok).toBe(false);
    expect(temErroEm(resultado, INTERACAO)).toBe(true);
  });

  // @req RF-07 @tipo borda
  test('test_RF07_recusa_tipo_com_maiuscula', () => {
    const resultado = validarFase(faseComInteracao({ tipo: 'Decoracao' }));
    expect(resultado.ok).toBe(false);
    expect(temErroEm(resultado, INTERACAO)).toBe(true);
  });

  // @req RF-07 @tipo negativo
  test('test_RF07_recusa_decoracao_com_fala', () => {
    const resultado = validarFase(faseComInteracao({ tipo: 'decoracao', texto: 'Eu não deveria falar.' }));
    expect(resultado.ok).toBe(false);
    expect(temErroEm(resultado, INTERACAO)).toBe(true);
  });

  // @req RF-07 @tipo negativo
  test('test_RF07_recusa_tipo_fora_dos_quatro', () => {
    const resultado = validarFase(faseComInteracao({ tipo: 'botao' }));
    expect(resultado.ok).toBe(false);
    expect(temErroEm(resultado, INTERACAO)).toBe(true);
  });

  // @req RF-07 @tipo negativo
  test('test_RF07_recusa_objeto_sem_tipo', () => {
    const semTipo = validarFase(faseComInteracao({ texto: 'Sem tipo.' }));
    expect(semTipo.ok).toBe(false);
    const { interacao: _interacao, ...semInteracao } = decoracao('lampada-1');
    const resultado = validarFase(faseComObjeto(semInteracao));
    expect(resultado.ok).toBe(false);
  });
});

describe('RF-08 · configuração de fala, enigma e porta', () => {
  // @req RF-08 @tipo feliz
  test('test_RF08_fala_grava_o_texto', () => {
    const documento = fase('92139', { direita: [fala('fala-1', 'Você: que sala estranha.')] });
    const resultado = validarFase(documento);
    expect(resultado.ok).toBe(true);
    expect(resultado.ok && resultado.fase.paredes.direita.objetos[0]?.interacao).toEqual({
      tipo: 'fala',
      texto: 'Você: que sala estranha.',
    });
  });

  // @req RF-08 @tipo feliz
  test('test_RF08_enigma_grava_pergunta_respostas_dica_e_digitos', () => {
    const interacao = {
      tipo: 'enigma' as const,
      pergunta: 'Qual o próximo termo de 4, 23, 42, 61?',
      respostas: [-15, 80],
      dica: 'Some 19 a cada termo.',
      revela: [2, 5],
    };
    const documento = fase('92139', { fundo: [objeto('selo-1', interacao, 'sprite:selo-magico')] });
    const resultado = validarFase(documento);
    expect(resultado.ok).toBe(true);
    expect(resultado.ok && resultado.fase.paredes.fundo.objetos[0]?.interacao).toEqual(interacao);
  });

  // @req RF-08 @tipo feliz
  test('test_RF08_porta_aceita_senha_de_5_digitos', () => {
    const resultado = validarFase(fase('92139', { frente: [porta()] }));
    expect(resultado.ok).toBe(true);
  });

  // @req RF-08 @tipo borda
  test('test_RF08_senha_de_4_digitos_aceita', () => {
    expect(validarFase(faseComSenha('1234')).ok).toBe(true);
  });

  // @req RF-08 @tipo borda
  test('test_RF08_senha_de_8_digitos_aceita', () => {
    expect(validarFase(faseComSenha('12345678')).ok).toBe(true);
  });

  // @req RF-08 @tipo borda
  test('test_RF08_senha_de_3_digitos_recusada', () => {
    const resultado = validarFase(faseComSenha('123'));
    expect(resultado.ok).toBe(false);
    expect(temErroEm(resultado, ['senha'])).toBe(true);
  });

  // @req RF-08 @tipo borda
  test('test_RF08_senha_de_9_digitos_recusada', () => {
    const resultado = validarFase(faseComSenha('123456789'));
    expect(resultado.ok).toBe(false);
    expect(temErroEm(resultado, ['senha'])).toBe(true);
  });

  // @req RF-08 @tipo borda
  test('test_RF08_senha_com_zero_a_esquerda_aceita', () => {
    expect(validarFase(faseComSenha('0123')).ok).toBe(true);
  });

  // @req RF-08 @tipo borda
  test('test_RF08_enigma_com_zero_digitos_aceito', () => {
    const resultado = validarFase(fase('92139', { esquerda: [enigma('horas', [], [15]), enigma('minutos', [], [40])] }));
    expect(resultado.ok).toBe(true);
  });

  // @req RF-08 @tipo borda
  test('test_RF08_enigma_com_uma_resposta_aceito', () => {
    expect(validarFase(fase('92139', { teto: [enigma('teto-1', [1, 2], [55])] })).ok).toBe(true);
  });

  // @req RF-08 @tipo borda
  test('test_RF08_enigma_com_respostas_negativa_e_decimal_aceito', () => {
    expect(validarFase(fase('92139', { fundo: [enigma('fundo-1', [3], [-15, 0.5])] })).ok).toBe(true);
  });

  // @req RF-08 @tipo borda
  test('test_RF08_enigma_sem_resposta_recusado', () => {
    const resultado = validarFase(faseComObjeto(enigma('vazio-1', [1], [])));
    expect(resultado.ok).toBe(false);
    expect(temErroEm(resultado, [...INTERACAO, 'respostas'])).toBe(true);
  });

  // @req RF-08 @tipo negativo
  test('test_RF08_resposta_que_nao_e_numero_recusada', () => {
    const interacao = { tipo: 'enigma', pergunta: 'Quanto é 40 + 40?', respostas: ['80'], revela: [1] };
    const resultado = validarFase(faseComInteracao(interacao));
    expect(resultado.ok).toBe(false);
    expect(temErroEm(resultado, [...INTERACAO, 'respostas'])).toBe(true);
  });

  // @req RF-08 @tipo negativo
  test('test_RF08_resposta_por_extenso_recusada', () => {
    const interacao = { tipo: 'enigma', pergunta: 'Quanto é 40 + 40?', respostas: [80, 'oitenta'], revela: [1] };
    expect(validarFase(faseComInteracao(interacao)).ok).toBe(false);
  });

  // @req RF-08 @tipo negativo
  test('test_RF08_senha_com_nao_digitos_recusada', () => {
    for (const senha of ['12a45', '12 45', '-1234', '12.45', 'abcde']) {
      const resultado = validarFase(faseComSenha(senha));
      expect(resultado.ok).toBe(false);
      expect(temErroEm(resultado, ['senha'])).toBe(true);
    }
  });
});

describe('RNF-09 · toda fase é validada por um schema único', () => {
  // @req RNF-09 @tipo feliz
  test('test_RNF09_documento_valido_e_aceito_sem_alteracao', () => {
    const documento = faseValida();
    expect(validarFase(documento)).toEqual({ ok: true, fase: faseValida() });
  });

  // @req RNF-09 @tipo borda
  test('test_RNF09_fase_minima_com_paredes_vazias_e_aceita', () => {
    expect(validarFase(fase('1234')).ok).toBe(true);
  });

  // @req RNF-09 @tipo borda
  test('test_RNF09_campo_desconhecido_na_raiz_e_recusado', () => {
    const resultado = validarFase({ ...faseValida(), id: 'fase-1' });
    expect(resultado.ok).toBe(false);
  });

  // @req RNF-09 @tipo borda
  test('test_RNF09_entrada_que_nao_e_fase_e_recusada_sem_excecao', () => {
    for (const entrada of [undefined, null, 42, 'fase', [], {}]) {
      expect(() => validarFase(entrada)).not.toThrow();
      expect(validarFase(entrada).ok).toBe(false);
    }
  });

  // @req RNF-09 @tipo negativo
  test('test_RNF09_fase_sem_uma_das_paredes_e_recusada', () => {
    const base = faseValida();
    const { teto: _teto, ...quatroParedes } = base.paredes;
    const resultado = validarFase({ ...base, paredes: quatroParedes });
    expect(resultado.ok).toBe(false);
    expect(temErroEm(resultado, ['paredes'])).toBe(true);
  });

  // @req RNF-09 @tipo negativo
  test('test_RNF09_objeto_fora_da_parede_e_recusado', () => {
    const resultado = validarFase(faseComObjeto({ ...enigma('fora-1', [1]), x: 1.5 }));
    expect(resultado.ok).toBe(false);
    expect(temErroEm(resultado, ['paredes', 'frente', 'objetos', 0, 'x'])).toBe(true);
  });

  // @req RNF-09 @tipo negativo
  test('test_RNF09_versao_de_schema_desconhecida_e_recusada', () => {
    const resultado = validarFase({ ...faseValida(), versaoSchema: 2 });
    expect(resultado.ok).toBe(false);
    expect(temErroEm(resultado, ['versaoSchema'])).toBe(true);
  });
});
