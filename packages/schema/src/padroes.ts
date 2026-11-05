/**
 * Valores padrão da fase (D-01: o schema não tem padrões; eles ficam aqui).
 * RF-02, RF-08, RNF-08: fase inicial com senha de 5 dígitos e uma porta na frente.
 */
import { spriteDoCatalogo } from '../biblioteca/catalogo.ts';
import type { Fase, Parede } from '../contrato/fase.ts';

/** Nenhum requisito define a senha padrão, só o tamanho (5); o criador a troca (modulos-schema.md §4). */
const SENHA_INICIAL = '00000';

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
