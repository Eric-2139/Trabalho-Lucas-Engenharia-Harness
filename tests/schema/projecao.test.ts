/**
 * Módulo: projeção de jogo do SchemaFase (`projetarParaJogo`; contrato/funcoes.ts, contrato/fase.ts
 * `FaseJogo`; modulos-schema.md §4; ADR-003).
 * Requisito: RNF-04 (respostas e senha nunca vão ao navegador de quem joga): a projeção remove
 * `senha`, `respostas` e `revela`, acrescenta `tamanhoSenha`, mantém a `dica` (RF-17) e todo o
 * resto (posição, imagem, ordem) igual; o resultado passa no `FaseJogo` estrito.
 *
 * Dados sintéticos escritos à mão; `fases-exemplo/escola-01.json` entra só como documento de
 * entrada (nenhum valor esperado é tirado dele).
 */
import { readFileSync } from 'node:fs';
import { projetarParaJogo, validarFase } from '@math-scape/schema';
import { type Fase, FaseJogo, type Objeto, type ObjetoJogo } from '@math-scape/schema/contrato';
import { describe, expect, test } from 'vitest';
import { UUID_ASSET, fase, faseValida } from '../fixtures/fases.ts';

const PAREDES = ['frente', 'direita', 'fundo', 'esquerda', 'teto'] as const;

/** Fase com os 4 tipos, valores variados de posição e imagem, e fundos de parede diferentes. */
function faseEntrada(): Fase {
  const objetos: Record<'frente' | 'fundo' | 'teto', Objeto[]> = {
    frente: [
      {
        id: 'porta-1',
        imagem: 'sprite:porta',
        x: 0.5,
        y: 0.62,
        largura: 0.13,
        altura: 0.426,
        rotacao: 0,
        camada: 2,
        interacao: { tipo: 'porta' },
      },
      {
        id: 'enigma-a',
        imagem: 'sprite:quadro-negro',
        x: 0.2,
        y: 0.35,
        largura: 0.4,
        altura: 0.441,
        rotacao: 12.5,
        camada: 1,
        interacao: {
          tipo: 'enigma',
          pergunta: 'Quanto é 6 x 2?',
          respostas: [12, -3.5],
          dica: 'Some seis com seis.',
          revela: [1, 2],
        },
      },
      {
        id: 'fala-a',
        imagem: 'sprite:relogio',
        x: 0.9,
        y: 0.1,
        largura: 0.07,
        altura: 0.123,
        rotacao: 359,
        camada: 0,
        interacao: { tipo: 'fala', texto: 'Você: o relógio está parado.' },
      },
      {
        id: 'giz_1',
        imagem: 'sprite:giz',
        x: 0,
        y: 1,
        largura: 0.04,
        altura: 0.071,
        rotacao: 90,
        camada: 3,
        interacao: { tipo: 'decoracao' },
      },
    ],
    fundo: [
      {
        id: 'enigma-c',
        imagem: `asset:${UUID_ASSET}`,
        x: 0.33,
        y: 0.44,
        largura: 0.2,
        altura: 0.2,
        rotacao: 45,
        camada: 0,
        interacao: { tipo: 'enigma', pergunta: 'Quanto é 9 - 2?', respostas: [7], revela: [3, 4] },
      },
    ],
    teto: [
      {
        id: 'enigma-b',
        imagem: 'sprite:lampada',
        x: 0.5,
        y: 0.5,
        largura: 0.18,
        altura: 0.048,
        rotacao: 0,
        camada: 0,
        interacao: { tipo: 'enigma', pergunta: 'Quanto é 1 - 1?', respostas: [0], revela: [] },
      },
    ],
  };
  const entrada = fase('5307', objetos);
  entrada.titulo = 'Projeção sintética';
  entrada.paredes.frente.fundo = 'sprite:fundo-sala';
  entrada.paredes.direita.fundo = 'sprite:fundo-sala-lateral';
  entrada.paredes.fundo.fundo = `asset:${UUID_ASSET}`;
  entrada.paredes.teto.fundo = 'sprite:fundo-teto';
  return entrada;
}

/** O que o contrato manda devolver para `faseEntrada()`, escrito à mão. */
function projecaoEsperada(): FaseJogo {
  const objetos: Record<'frente' | 'fundo' | 'teto', ObjetoJogo[]> = {
    frente: [
      {
        id: 'porta-1',
        imagem: 'sprite:porta',
        x: 0.5,
        y: 0.62,
        largura: 0.13,
        altura: 0.426,
        rotacao: 0,
        camada: 2,
        interacao: { tipo: 'porta' },
      },
      {
        id: 'enigma-a',
        imagem: 'sprite:quadro-negro',
        x: 0.2,
        y: 0.35,
        largura: 0.4,
        altura: 0.441,
        rotacao: 12.5,
        camada: 1,
        interacao: { tipo: 'enigma', pergunta: 'Quanto é 6 x 2?', dica: 'Some seis com seis.' },
      },
      {
        id: 'fala-a',
        imagem: 'sprite:relogio',
        x: 0.9,
        y: 0.1,
        largura: 0.07,
        altura: 0.123,
        rotacao: 359,
        camada: 0,
        interacao: { tipo: 'fala', texto: 'Você: o relógio está parado.' },
      },
      {
        id: 'giz_1',
        imagem: 'sprite:giz',
        x: 0,
        y: 1,
        largura: 0.04,
        altura: 0.071,
        rotacao: 90,
        camada: 3,
        interacao: { tipo: 'decoracao' },
      },
    ],
    fundo: [
      {
        id: 'enigma-c',
        imagem: `asset:${UUID_ASSET}`,
        x: 0.33,
        y: 0.44,
        largura: 0.2,
        altura: 0.2,
        rotacao: 45,
        camada: 0,
        interacao: { tipo: 'enigma', pergunta: 'Quanto é 9 - 2?' },
      },
    ],
    teto: [
      {
        id: 'enigma-b',
        imagem: 'sprite:lampada',
        x: 0.5,
        y: 0.5,
        largura: 0.18,
        altura: 0.048,
        rotacao: 0,
        camada: 0,
        interacao: { tipo: 'enigma', pergunta: 'Quanto é 1 - 1?' },
      },
    ],
  };
  return {
    versaoSchema: 1,
    titulo: 'Projeção sintética',
    tamanhoSenha: 4,
    paredes: {
      frente: { fundo: 'sprite:fundo-sala', objetos: objetos.frente },
      direita: { fundo: 'sprite:fundo-sala-lateral', objetos: [] },
      fundo: { fundo: `asset:${UUID_ASSET}`, objetos: objetos.fundo },
      esquerda: { fundo: null, objetos: [] },
      teto: { fundo: 'sprite:fundo-teto', objetos: objetos.teto },
    },
  };
}

/** Chaves de todos os objetos JSON aninhados (para procurar campo proibido em qualquer nível). */
function todasAsChaves(valor: unknown, chaves = new Set<string>()): Set<string> {
  if (Array.isArray(valor)) {
    for (const item of valor) todasAsChaves(item, chaves);
  } else if (valor !== null && typeof valor === 'object') {
    for (const [chave, filho] of Object.entries(valor)) {
      chaves.add(chave);
      todasAsChaves(filho, chaves);
    }
  }
  return chaves;
}

const ARQUIVO_ESCOLA = new URL('../../fases-exemplo/escola-01.json', import.meta.url);

function escola(): Fase {
  const resultado = validarFase(JSON.parse(readFileSync(ARQUIVO_ESCOLA, 'utf8')));
  if (!resultado.ok) throw new Error(`escola-01.json fora do schema: ${JSON.stringify(resultado.erros)}`);
  return resultado.fase;
}

// =====================================================================
// RNF-04 · projeção de jogo sem respostas, senha nem revela
// =====================================================================
describe('RNF-04 · projetarParaJogo', () => {
  // @req RNF-04 @tipo feliz
  test('test_RNF04_projecao_remove_senha_respostas_e_revela_e_mantem_todo_o_resto', () => {
    expect(projetarParaJogo(faseEntrada())).toEqual(projecaoEsperada());
  });

  // @req RNF-04 @tipo feliz
  test('test_RNF04_projecao_passa_no_schema_estrito_de_jogo', () => {
    const resultado = FaseJogo.safeParse(projetarParaJogo(faseEntrada()));
    expect(resultado.success, JSON.stringify(resultado.error?.issues)).toBe(true);
    const daFixture = FaseJogo.safeParse(projetarParaJogo(faseValida()));
    expect(daFixture.success, JSON.stringify(daFixture.error?.issues)).toBe(true);
  });

  // @req RNF-04 @tipo borda
  test('test_RNF04_tamanho_da_senha_acompanha_os_limites_de_4_e_8_digitos', () => {
    expect(projetarParaJogo(fase('0000')).tamanhoSenha).toBe(4);
    expect(projetarParaJogo(fase('01234567')).tamanhoSenha).toBe(8);
    expect(projetarParaJogo(fase('92139')).tamanhoSenha).toBe(5);
  });

  // @req RNF-04 @tipo borda
  test('test_RNF04_projecao_mantem_a_dica_e_a_ordem_dos_objetos_em_cada_parede', () => {
    const projecao = projetarParaJogo(faseEntrada());
    expect(projecao.paredes.frente.objetos.map((o) => o.id)).toEqual(['porta-1', 'enigma-a', 'fala-a', 'giz_1']);
    const enigma = projecao.paredes.frente.objetos[1]?.interacao;
    expect(enigma).toEqual({ tipo: 'enigma', pergunta: 'Quanto é 6 x 2?', dica: 'Some seis com seis.' });
    // Enigma sem dica continua sem dica (RF-17: sem ícone).
    expect(projecao.paredes.teto.objetos[0]?.interacao).toEqual({ tipo: 'enigma', pergunta: 'Quanto é 1 - 1?' });
  });

  // @req RNF-04 @tipo borda
  test('test_RNF04_projecao_da_escola_passa_no_schema_estrito_e_mantem_objetos_e_imagens', () => {
    const original = escola();
    const projecao = projetarParaJogo(original);

    const resultado = FaseJogo.safeParse(projecao);
    expect(resultado.success, JSON.stringify(resultado.error?.issues)).toBe(true);
    expect(projecao.tamanhoSenha).toBe(original.senha.length);
    expect(projecao.titulo).toBe(original.titulo);
    for (const parede of PAREDES) {
      expect(projecao.paredes[parede].fundo).toBe(original.paredes[parede].fundo);
      const esperados = original.paredes[parede].objetos.map(({ interacao: _i, ...resto }) => resto);
      const obtidos = projecao.paredes[parede].objetos.map(({ interacao: _i, ...resto }) => resto);
      expect(obtidos).toEqual(esperados);
      original.paredes[parede].objetos.forEach((objeto, indice) => {
        const projetado = projecao.paredes[parede].objetos[indice]?.interacao;
        expect(projetado?.tipo).toBe(objeto.interacao.tipo);
        if (objeto.interacao.tipo === 'enigma') {
          const { respostas: _r, revela: _v, ...semSegredo } = objeto.interacao;
          expect(projetado).toEqual(semSegredo);
        }
      });
    }
  });

  // @req RNF-04 @tipo negativo
  test('test_RNF04_projecao_nao_contem_campo_senha_respostas_nem_revela_em_nenhum_nivel', () => {
    for (const entrada of [faseEntrada(), faseValida(), escola()]) {
      const chaves = todasAsChaves(JSON.parse(JSON.stringify(projetarParaJogo(entrada))));
      expect(chaves.has('senha')).toBe(false);
      expect(chaves.has('respostas')).toBe(false);
      expect(chaves.has('revela')).toBe(false);
    }
  });

  // @req RNF-04 @tipo negativo
  test('test_RNF04_projecao_nao_contem_o_valor_da_senha', () => {
    const entrada = faseValida();
    const serializado = JSON.stringify(projetarParaJogo(entrada));
    expect(serializado).not.toContain(entrada.senha);
    const daEscola = escola();
    expect(JSON.stringify(projetarParaJogo(daEscola))).not.toContain(`"${daEscola.senha}"`);
  });
});
