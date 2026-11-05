/**
 * MotorInteracoes (modulos-player.md §1, ADR-009): clicar, dica e responder sobre a projeção
 * de jogo. Não conhece React nem a rede; quem confere as respostas é o Verificador injetado (RNF-04).
 */
import type { ObjetoJogo } from '@math-scape/schema/contrato';
import {
  type CriarPartida,
  type EventoClique,
  type Limitado,
  MENSAGENS,
  type ResultadoResposta,
} from '../contrato/index.ts';
import { criarArmazemPartida } from './estado-partida.ts';

function ehLimitado(resposta: object): resposta is Limitado {
  return 'limitado' in resposta && resposta.limitado === true;
}

function limitado(resposta: Limitado): ResultadoResposta {
  return {
    tipo: 'limitado',
    tentarEmSegundos: resposta.tentarEmSegundos,
    mensagem: MENSAGENS.limitado(resposta.tentarEmSegundos),
  };
}

const SEM_PERGUNTA: ResultadoResposta = { tipo: 'falha', mensagem: MENSAGENS.semPergunta };
const FALHA_DE_REDE: ResultadoResposta = { tipo: 'falha', mensagem: MENSAGENS.falhaDeRede };

export const criarPartida: CriarPartida = (fase, verificador) => {
  const armazem = criarArmazemPartida();

  /** Só objetos da parede ativa respondem (RF-16). */
  function objetoNaParedeAtiva(objetoId: string): ObjetoJogo | undefined {
    return fase.paredes[armazem.obter().paredeAtiva].objetos.find((o) => o.id === objetoId);
  }

  async function responderEnigma(objetoId: string, texto: string): Promise<ResultadoResposta> {
    const resposta = await verificador.enigma(objetoId, texto);
    if (ehLimitado(resposta)) return limitado(resposta);
    if (!resposta.correto) return { tipo: 'errado', mensagem: MENSAGENS.respostaErrada };
    const digitos = resposta.digitos;
    armazem.atualizar((atual) => {
      const digitosRevelados = { ...atual.digitosRevelados };
      for (const { posicao, valor } of digitos) digitosRevelados[posicao] = valor;
      const enigmasResolvidos = atual.enigmasResolvidos.includes(objetoId)
        ? atual.enigmasResolvidos
        : [...atual.enigmasResolvidos, objetoId];
      return { ...atual, digitosRevelados, enigmasResolvidos };
    });
    return { tipo: 'correto', digitos, mensagem: MENSAGENS.respostaCorreta(digitos) };
  }

  async function responderPorta(objetoId: string, senha: string): Promise<ResultadoResposta> {
    const resposta = await verificador.porta(objetoId, senha);
    if (ehLimitado(resposta)) return limitado(resposta);
    if (!resposta.aberta) return { tipo: 'senhaIncorreta', mensagem: MENSAGENS.senhaIncorreta };
    armazem.atualizar((atual) => ({ ...atual, concluida: true }));
    return { tipo: 'aberta' };
  }

  return {
    estado: () => armazem.obter(),
    assinar: (ouvinte) => armazem.assinar(ouvinte),
    trocarParede(parede) {
      armazem.atualizar((atual) => ({ ...atual, paredeAtiva: parede }));
    },
    clicar(objetoId): EventoClique {
      const interacao = objetoNaParedeAtiva(objetoId)?.interacao;
      switch (interacao?.tipo) {
        case 'fala':
          return { tipo: 'fala', texto: interacao.texto };
        case 'enigma':
          return { tipo: 'pedirResposta', objetoId, pergunta: interacao.pergunta };
        case 'porta':
          return { tipo: 'pedirSenha', objetoId, tamanhoSenha: fase.tamanhoSenha };
        default:
          // decoração ou objeto inexistente na parede ativa: nada muda (RF-16).
          return { tipo: 'nenhum' };
      }
    },
    dica(objetoId) {
      const interacao = objetoNaParedeAtiva(objetoId)?.interacao;
      return interacao?.tipo === 'enigma' ? (interacao.dica ?? null) : null;
    },
    async responder(objetoId, texto) {
      const tipo = objetoNaParedeAtiva(objetoId)?.interacao.tipo;
      try {
        if (tipo === 'enigma') return await responderEnigma(objetoId, texto);
        if (tipo === 'porta') return await responderPorta(objetoId, texto);
        return SEM_PERGUNTA;
      } catch {
        return FALHA_DE_REDE;
      }
    },
  };
};
