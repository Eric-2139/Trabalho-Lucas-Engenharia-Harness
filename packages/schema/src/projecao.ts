/**
 * Projeção de jogo (RNF-04, RF-17, ADR-003; modulos-schema.md §4): o que o jogador e o modo
 * testar recebem. Remove `senha`, `respostas` e `revela`; acrescenta `tamanhoSenha`; mantém a
 * `dica` e todo o resto (posição, imagem, ordem dos objetos) igual.
 * Copia campo a campo (lista de permitidos), para que nada além do previsto chegue ao navegador.
 */
import type { Fase, FaseJogo, Interacao, InteracaoJogo, Objeto, ObjetoJogo, Parede, ParedeJogo } from '../contrato/index.ts';

function projetarInteracao(interacao: Interacao): InteracaoJogo {
  switch (interacao.tipo) {
    case 'decoracao':
      return { tipo: 'decoracao' };
    case 'fala':
      return { tipo: 'fala', texto: interacao.texto };
    case 'enigma':
      return interacao.dica === undefined
        ? { tipo: 'enigma', pergunta: interacao.pergunta }
        : { tipo: 'enigma', pergunta: interacao.pergunta, dica: interacao.dica };
    case 'porta':
      return { tipo: 'porta' };
  }
}

function projetarObjeto(objeto: Objeto): ObjetoJogo {
  return {
    id: objeto.id,
    imagem: objeto.imagem,
    x: objeto.x,
    y: objeto.y,
    largura: objeto.largura,
    altura: objeto.altura,
    rotacao: objeto.rotacao,
    camada: objeto.camada,
    interacao: projetarInteracao(objeto.interacao),
  };
}

function projetarParede(parede: Parede): ParedeJogo {
  return { fundo: parede.fundo, objetos: parede.objetos.map(projetarObjeto) };
}

export function projetarParaJogo(fase: Fase): FaseJogo {
  return {
    versaoSchema: fase.versaoSchema,
    titulo: fase.titulo,
    tamanhoSenha: fase.senha.length,
    paredes: {
      frente: projetarParede(fase.paredes.frente),
      direita: projetarParede(fase.paredes.direita),
      fundo: projetarParede(fase.paredes.fundo),
      esquerda: projetarParede(fase.paredes.esquerda),
      teto: projetarParede(fase.paredes.teto),
    },
  };
}
