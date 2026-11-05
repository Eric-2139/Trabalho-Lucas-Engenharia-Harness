/**
 * Módulo: fase de exemplo `fases-exemplo/escola-01.json` (dados escritos na fase 4, conferidos
 * com validarFase, validarJogabilidade, respostaConfere e senhaConfere de @math-scape/schema).
 * Requisito: RF-18 (fase original recriada com os mesmos enigmas, respostas, dígitos e senha 92139).
 *
 * Os valores esperados vêm do critério do RF-18, de modulos-schema.md §6 e do legado
 * (harness/entrada/legado/5-Jogo_Math_Scape/index.html e js/*.js), nunca do próprio escola-01.json.
 * Fora do critério e por isso não testados: posições e tamanhos dos objetos, sprites, falas,
 * decorações, dicas, mensagens de acerto do legado e a animação do selo e da árvore.
 */
import { readFileSync } from 'node:fs';
import { respostaConfere, senhaConfere, validarFase, validarJogabilidade } from '@math-scape/schema';
import type { Fase, InteracaoEnigma } from '@math-scape/schema/contrato';
import { describe, expect, test } from 'vitest';

type NomeParede = 'frente' | 'direita' | 'fundo' | 'esquerda' | 'teto';
const PAREDES: NomeParede[] = ['frente', 'direita', 'fundo', 'esquerda', 'teto'];

const ARQUIVO_ESCOLA = new URL('../../fases-exemplo/escola-01.json', import.meta.url);

/** Lê o documento a cada caso, para que a ausência do arquivo falhe cada teste, não o módulo. */
function lerEscola(): unknown {
  return JSON.parse(readFileSync(ARQUIVO_ESCOLA, 'utf8'));
}

function escola(): Fase {
  const resultado = validarFase(lerEscola());
  if (!resultado.ok) {
    throw new Error(`escola-01.json fora do schema: ${JSON.stringify(resultado.erros)}`);
  }
  return resultado.fase;
}

function enigmasDa(fase: Fase, parede: NomeParede): InteracaoEnigma[] {
  return fase.paredes[parede].objetos
    .map((objeto) => objeto.interacao)
    .filter((interacao): interacao is InteracaoEnigma => interacao.tipo === 'enigma');
}

/** O único enigma da parede (no legado, cada parede além da esquerda tem um só). */
function unicoEnigma(fase: Fase, parede: NomeParede): InteracaoEnigma {
  const enigmas = enigmasDa(fase, parede);
  expect(enigmas, `enigmas da parede ${parede}`).toHaveLength(1);
  return enigmas[0] as InteracaoEnigma;
}

/** Texto com espaços e quebras de linha colapsados (o HTML do legado quebra as frases em várias linhas). */
function normalizar(texto: string): string {
  return texto.replace(/\s+/g, ' ').trim();
}

function enigmaDaEsquerda(fase: Fase, trecho: string): InteracaoEnigma {
  const encontrado = enigmasDa(fase, 'esquerda').find((enigma) => normalizar(enigma.pergunta).includes(trecho));
  expect(encontrado, `enigma da esquerda com "${trecho}"`).toBeDefined();
  return encontrado as InteracaoEnigma;
}

const horas = (fase: Fase) => enigmaDaEsquerda(fase, 'descubra as horas do relógio');
const minutos = (fase: Fase) => enigmaDaEsquerda(fase, 'descubra os minutos do relógio');

function digitosRevelados(fase: Fase, enigma: InteracaoEnigma): string {
  return enigma.revela.map((posicao) => fase.senha[posicao - 1]).join('');
}

function ordenadas(respostas: number[]): number[] {
  return [...respostas].sort((a, b) => a - b);
}

describe('RF-18 · fase original (escola-01.json)', () => {
  // @req RF-18 @tipo feliz
  test('test_RF18_escola_passa_no_schema_com_senha_92139', () => {
    const resultado = validarFase(lerEscola());
    expect(resultado.ok).toBe(true);
    expect(escola().senha).toBe('92139');
  });

  // @req RF-18 @tipo feliz
  test('test_RF18_escola_e_jogavel', () => {
    expect(validarJogabilidade(escola())).toEqual({ jogavel: true, posicoesSemEnigma: [] });
  });

  // @req RF-18 @tipo feliz
  test('test_RF18_mesmos_enigmas_por_parede', () => {
    const fase = escola();
    const quantidade = Object.fromEntries(PAREDES.map((parede) => [parede, enigmasDa(fase, parede).length]));
    expect(quantidade).toEqual({ frente: 1, direita: 1, fundo: 1, esquerda: 2, teto: 1 });
  });

  // @req RF-18 @tipo feliz
  test('test_RF18_teto_55_revela_92_nas_posicoes_1_e_2', () => {
    const fase = escola();
    const teto = unicoEnigma(fase, 'teto');
    expect(teto.respostas).toEqual([55]);
    expect(respostaConfere('55', teto.respostas)).toBe(true);
    expect(teto.revela).toEqual([1, 2]);
    expect(digitosRevelados(fase, teto)).toBe('92');
  });

  // @req RF-18 @tipo feliz
  test('test_RF18_direita_123_revela_1_na_posicao_3', () => {
    const fase = escola();
    const direita = unicoEnigma(fase, 'direita');
    expect(direita.respostas).toEqual([123]);
    expect(respostaConfere('123', direita.respostas)).toBe(true);
    expect(direita.revela).toEqual([3]);
    expect(digitosRevelados(fase, direita)).toBe('1');
  });

  // @req RF-18 @tipo feliz
  test('test_RF18_frente_310_revela_3_na_posicao_4', () => {
    const fase = escola();
    const frente = unicoEnigma(fase, 'frente');
    expect(frente.respostas).toEqual([310]);
    expect(respostaConfere('310', frente.respostas)).toBe(true);
    expect(frente.revela).toEqual([4]);
    expect(digitosRevelados(fase, frente)).toBe('3');
  });

  // @req RF-18 @tipo feliz
  test('test_RF18_fundo_revela_9_na_posicao_5', () => {
    const fase = escola();
    const fundo = unicoEnigma(fase, 'fundo');
    expect(fundo.revela).toEqual([5]);
    expect(digitosRevelados(fase, fundo)).toBe('9');
  });

  // @req RF-18 @tipo feliz
  test('test_RF18_resolvendo_tudo_os_digitos_formam_92139_e_a_porta_abre', () => {
    const fase = escola();
    const digitoPorPosicao = new Map<number, string>();
    for (const parede of PAREDES) {
      for (const enigma of enigmasDa(fase, parede)) {
        const resposta = enigma.respostas[0] as number;
        expect(respostaConfere(String(resposta), enigma.respostas)).toBe(true);
        for (const posicao of enigma.revela) {
          digitoPorPosicao.set(posicao, fase.senha[posicao - 1] as string);
        }
      }
    }
    const digitada = [1, 2, 3, 4, 5].map((posicao) => digitoPorPosicao.get(posicao) ?? '?').join('');
    expect(digitada).toBe('92139');
    expect(senhaConfere(digitada, fase.senha)).toBe(true);
  });

  // @req RF-18 @tipo feliz
  test('test_RF18_perguntas_com_o_texto_do_legado', () => {
    const fase = escola();
    const frente = normalizar(unicoEnigma(fase, 'frente').pergunta);
    expect(frente).toContain('Bem-vindo a sua primeira (ou última) aula');
    expect(frente).toContain('para conseguir o terceiro dígito da porta');
    expect(frente).toContain('10 + 15 x 20 =');

    const direita = normalizar(unicoEnigma(fase, 'direita').pergunta);
    expect(direita).toContain('Respeite as regras de cálculo de equações!!');
    expect(direita).toContain('→ ? =');

    const fundo = normalizar(unicoEnigma(fase, 'fundo').pergunta);
    expect(fundo).toMatch(/(^|\D)4\D+23\D+42\D+61(\D|$)/);

    const teto = normalizar(unicoEnigma(fase, 'teto').pergunta);
    expect(teto).toContain('eu sempre estive aqui observando o seu progresso');
    expect(teto).toContain('Horas + Minutos =');

    expect(normalizar(horas(fase).pergunta)).toContain('(40 - 15 - 20) x 10 - 35 =');
    expect(normalizar(minutos(fase).pergunta)).toContain('(60 - 20 + 10) ÷ 2 + 15 =');
  });

  // @req RF-18 @tipo borda
  test('test_RF18_fundo_aceita_as_duas_respostas_menos_15_e_80', () => {
    const fundo = unicoEnigma(escola(), 'fundo');
    expect(ordenadas(fundo.respostas)).toEqual([-15, 80]);
    expect(respostaConfere('-15', fundo.respostas)).toBe(true);
    expect(respostaConfere('80', fundo.respostas)).toBe(true);
  });

  // @req RF-18 @tipo borda
  test('test_RF18_esquerda_15_e_40_sem_digito', () => {
    const fase = escola();
    const enigmaHoras = horas(fase);
    const enigmaMinutos = minutos(fase);
    expect(enigmaHoras.respostas).toEqual([15]);
    expect(enigmaHoras.revela).toEqual([]);
    expect(respostaConfere('15', enigmaHoras.respostas)).toBe(true);
    expect(enigmaMinutos.respostas).toEqual([40]);
    expect(enigmaMinutos.revela).toEqual([]);
    expect(respostaConfere('40', enigmaMinutos.respostas)).toBe(true);
  });

  // @req RF-18 @tipo borda
  test('test_RF18_uma_so_porta_e_ela_fica_na_frente', () => {
    const fase = escola();
    const portas = PAREDES.flatMap((parede) =>
      fase.paredes[parede].objetos.filter((objeto) => objeto.interacao.tipo === 'porta').map(() => parede),
    );
    expect(portas).toEqual(['frente']);
  });

  // @req RF-18 @tipo negativo
  test('test_RF18_resposta_errada_nao_confere_em_nenhuma_parede', () => {
    const fase = escola();
    expect(respostaConfere('300', unicoEnigma(fase, 'frente').respostas)).toBe(false);
    expect(respostaConfere('3', unicoEnigma(fase, 'frente').respostas)).toBe(false);
    expect(respostaConfere('124', unicoEnigma(fase, 'direita').respostas)).toBe(false);
    expect(respostaConfere('92', unicoEnigma(fase, 'teto').respostas)).toBe(false);
    expect(respostaConfere('15', unicoEnigma(fase, 'fundo').respostas)).toBe(false);
    expect(respostaConfere('-80', unicoEnigma(fase, 'fundo').respostas)).toBe(false);
  });

  // @req RF-18 @tipo negativo
  test('test_RF18_respostas_da_esquerda_trocadas_nao_conferem', () => {
    const fase = escola();
    expect(respostaConfere('40', horas(fase).respostas)).toBe(false);
    expect(respostaConfere('15', minutos(fase).respostas)).toBe(false);
  });

  // @req RF-18 @tipo negativo
  test('test_RF18_senha_errada_nao_abre_a_porta', () => {
    const senha = escola().senha;
    expect(senhaConfere('92193', senha)).toBe(false);
    expect(senhaConfere('9213', senha)).toBe(false);
    expect(senhaConfere('921390', senha)).toBe(false);
    expect(senhaConfere('', senha)).toBe(false);
  });
});
