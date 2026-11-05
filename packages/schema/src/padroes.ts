/**
 * Valores padrão da fase (D-01: o schema não tem padrões; eles ficam aqui).
 * RF-02, RF-08, RNF-08: fase inicial com senha de 5 dígitos e uma porta na frente.
 */
import { spriteDoCatalogo } from '../biblioteca/catalogo.ts';
import type { Fase, Interacao, Objeto, Parede, RefImagem, TipoInteracao } from '../contrato/fase.ts';

/** Nenhum requisito define a senha padrão, só o tamanho (5); o criador a troca (modulos-schema.md §4). */
const SENHA_INICIAL = '00000';

/** Tamanho padrão de imagem que não vem do catálogo (asset), contrato/funcoes.ts. */
const TAMANHO_ASSET = 0.2;

const PADRAO_REF_SPRITE = /^sprite:([a-z0-9-]+)$/;

function interacaoPadrao(tipo: TipoInteracao): Interacao {
  switch (tipo) {
    case 'fala':
      return { tipo: 'fala', texto: 'Nova fala' };
    case 'enigma':
      return { tipo: 'enigma', pergunta: 'Nova pergunta', respostas: [0], revela: [] };
    case 'porta':
      return { tipo: 'porta' };
    default:
      return { tipo: 'decoracao' };
  }
}

/**
 * ADR-011: objeto com valores padrão (contrato/funcoes.ts). Tamanho do sprite no catálogo, ou
 * 0,2 × 0,2 para asset; centralizado; rotação 0; camada 0. Não lança: id ou imagem inválidos
 * são recusados por `validarFase` em quem chama (o store devolve a recusa sem efeito).
 */
export function objetoPadrao(tipo: TipoInteracao, imagem: RefImagem, id: string): Objeto {
  const idSprite = PADRAO_REF_SPRITE.exec(imagem)?.[1];
  const sprite = idSprite === undefined ? undefined : spriteDoCatalogo(idSprite);
  const largura = sprite?.largura ?? TAMANHO_ASSET;
  const altura = sprite?.altura ?? TAMANHO_ASSET;
  return {
    id,
    imagem,
    x: (1 - largura) / 2,
    y: (1 - altura) / 2,
    largura,
    altura,
    rotacao: 0,
    camada: 0,
    interacao: interacaoPadrao(tipo),
  };
}

function paredeVazia(): Parede {
  return { fundo: null, objetos: [] };
}

export function faseInicial(titulo: string): Fase {
  const porta = spriteDoCatalogo('porta');
  if (!porta) throw new Error('sprite "porta" ausente do catálogo');
  return {
    versaoSchema: 1,
    titulo,
    senha: SENHA_INICIAL,
    paredes: {
      frente: {
        fundo: null,
        objetos: [
          {
            id: 'porta-1',
            imagem: 'sprite:porta',
            // x/y são o canto superior esquerdo (ADR-006); centralizar = sobra dividida ao meio.
            x: (1 - porta.largura) / 2,
            y: (1 - porta.altura) / 2,
            largura: porta.largura,
            altura: porta.altura,
            rotacao: 0,
            camada: 0,
            interacao: { tipo: 'porta' },
          },
        ],
      },
      direita: paredeVazia(),
      fundo: paredeVazia(),
      esquerda: paredeVazia(),
      teto: paredeVazia(),
    },
  };
}
