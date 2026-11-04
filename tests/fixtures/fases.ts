/**
 * Fases sintéticas para os testes do SchemaFase. Ids escritos à mão, sem aleatoriedade.
 * Construídas a partir das regras do contrato (packages/schema/contrato/fase.ts),
 * nunca copiadas de fases-exemplo/.
 */
import type {
  ErroValidacao,
  Fase,
  Interacao,
  Objeto,
  ResultadoEnvelope,
  ResultadoValidacao,
} from '@math-scape/schema/contrato';

export type NomeParede = 'frente' | 'direita' | 'fundo' | 'esquerda' | 'teto';

/** uuid sintético (minúsculo, formato válido). */
export const UUID_ASSET = '0f8b6c1e-2a3d-4b5c-8d9e-1a2b3c4d5e6f';
/** data URL PNG mínima que casa com o padrão do envelope. */
export const DATA_URL_PNG = 'data:image/png;base64,iVBORw0KGgo=';

export function objeto(id: string, interacao: Interacao, imagem = 'sprite:quadro'): Objeto {
  return { id, imagem, x: 0.5, y: 0.5, largura: 0.16, altura: 0.4, rotacao: 0, camada: 0, interacao };
}

export function porta(id = 'porta-1'): Objeto {
  return objeto(id, { tipo: 'porta' }, 'sprite:porta');
}

export function decoracao(id: string): Objeto {
  return objeto(id, { tipo: 'decoracao' }, 'sprite:lampada');
}

export function fala(id: string, texto: string): Objeto {
  return objeto(id, { tipo: 'fala', texto }, 'sprite:relogio');
}

export function enigma(id: string, revela: number[], respostas: number[] = [10]): Objeto {
  return objeto(id, { tipo: 'enigma', pergunta: `Quanto vale a conta do ${id}?`, respostas, revela });
}

/** Fase válida com a senha e os objetos dados por parede; paredes omitidas ficam vazias. */
export function fase(senha: string, objetos: Partial<Record<NomeParede, Objeto[]>> = {}): Fase {
  const parede = (nome: NomeParede) => ({ fundo: null, objetos: objetos[nome] ?? [] });
  return {
    versaoSchema: 1,
    titulo: 'Fase sintética',
    senha,
    paredes: {
      frente: parede('frente'),
      direita: parede('direita'),
      fundo: parede('fundo'),
      esquerda: parede('esquerda'),
      teto: parede('teto'),
    },
  };
}

/**
 * Fase válida com os 4 tipos de objeto, senha 92139 e todas as posições ligadas a enigmas
 * ([1, 2] na frente, [3] no fundo, [] na esquerda, [4, 5] no teto).
 */
export function faseValida(): Fase {
  const completa = fase('92139', {
    frente: [
      porta('porta-1'),
      objeto(
        'enigma-frente',
        { tipo: 'enigma', pergunta: 'Quanto é 10 + 15 x 20?', respostas: [-15, 80], dica: 'Multiplique primeiro.', revela: [1, 2] },
        'sprite:quadro-negro',
      ),
    ],
    direita: [fala('fala-direita', 'Você: a janela está trancada.')],
    fundo: [enigma('enigma-fundo', [3], [7])],
    esquerda: [enigma('enigma-esquerda', [], [15])],
    teto: [enigma('enigma-teto', [4, 5], [55]), decoracao('lampada-teto')],
  });
  completa.paredes.frente.fundo = 'sprite:fundo-sala';
  return completa;
}

/** Documento de fase (possivelmente inválido) com um único objeto bruto na parede da frente. */
export function faseComObjeto(objetoBruto: unknown, senha = '92139'): unknown {
  const base = fase(senha);
  return { ...base, paredes: { ...base.paredes, frente: { fundo: null, objetos: [objetoBruto] } } };
}

/** Documento de fase com um objeto na frente cuja interação é a dada (possivelmente inválida). */
export function faseComInteracao(interacao: unknown, senha = '92139'): unknown {
  return faseComObjeto({ ...enigma('obj-1', []), interacao }, senha);
}

/** Documento de fase (sem objetos) com a senha dada, de qualquer tipo. */
export function faseComSenha(senha: unknown): unknown {
  return { ...fase('1234'), senha };
}

export function errosDe(resultado: ResultadoValidacao | ResultadoEnvelope): ErroValidacao[] {
  return resultado.ok ? [] : resultado.erros;
}

/** true se algum erro tem caminho começando pelo prefixo dado. */
export function temErroEm(resultado: ResultadoValidacao | ResultadoEnvelope, prefixo: (string | number)[]): boolean {
  return errosDe(resultado).some((erro) => prefixo.every((parte, indice) => erro.caminho[indice] === parte));
}
