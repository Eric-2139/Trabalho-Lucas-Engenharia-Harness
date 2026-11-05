/**
 * TelaJogo (modulos-player.md §2, PEND-012): botões das 5 paredes, palco 16:9 com o
 * RenderizadorParede e a caixa de fala (RF-16). O motor decide o que cada clique faz;
 * decoração devolve `nenhum` e a tela não muda. Enigma e porta abrem um único campo de
 * resposta ou senha num `<form>` (RF-15); a porta aberta mostra o fim e chama `aoConcluir`.
 */
import {
  calcularPalco,
  criarPartida,
  criarVerificadorHttp,
  precisaAvisoResolucao,
  RenderizadorParede,
} from '@math-scape/player';
import type { ParedeId } from '@math-scape/schema/contrato';
import { type FormEvent, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { PropsTelaJogo } from '../../contrato/index.ts';
import { mensagens } from '../mensagens.ts';

const PAREDES: readonly ParedeId[] = ['frente', 'direita', 'fundo', 'esquerda', 'teto'];

/** Tamanho da janela (o jsdom não tem ResizeObserver; PEND-012). */
function useJanela() {
  const [janela, definirJanela] = useState(() => ({ largura: window.innerWidth, altura: window.innerHeight }));
  useEffect(() => {
    const aoRedimensionar = () => definirJanela({ largura: window.innerWidth, altura: window.innerHeight });
    window.addEventListener('resize', aoRedimensionar);
    return () => window.removeEventListener('resize', aoRedimensionar);
  }, []);
  return janela;
}

export function TelaJogo({ faseId, fase, baseUrlApi, verificador, aoConcluir }: PropsTelaJogo) {
  const textos = mensagens.jogo;
  const partida = useMemo(
    () => criarPartida(fase, verificador ?? criarVerificadorHttp({ baseUrlApi, faseId, modo: 'jogo' })),
    [fase, verificador, baseUrlApi, faseId],
  );
  const estado = useSyncExternalStore(partida.assinar, partida.estado);
  const janela = useJanela();
  const [fala, definirFala] = useState<string | null>(null);
  const [pergunta, definirPergunta] = useState<string | null>(null);
  const [dica, definirDica] = useState<string | null>(null);
  // Enigma ou porta com o campo aberto; o resultado da última resposta (RF-15).
  const [pedido, definirPedido] = useState<{ objetoId: string; modo: 'resposta' | 'senha' } | null>(null);
  const [texto, definirTexto] = useState('');
  const [resultado, definirResultado] = useState<string | null>(null);

  const sala = calcularPalco(janela.largura, janela.altura);
  const palco = { x: 0, y: 0, largura: sala.largura, altura: sala.altura };
  const parede = fase.paredes[estado.paredeAtiva];
  // Só os enigmas com dica da parede ativa têm controle de dica (RF-17).
  const enigmasComDica = parede.objetos.filter((o) => partida.dica(o.id) !== null);

  function trocarParede(nova: ParedeId) {
    partida.trocarParede(nova);
    definirFala(null);
    definirPergunta(null);
    definirDica(null);
    definirPedido(null);
    definirResultado(null);
  }

  function abrirCampo(objetoId: string, modo: 'resposta' | 'senha') {
    definirPedido({ objetoId, modo });
    definirTexto('');
    definirResultado(null);
  }

  function aoClicar(objetoId: string) {
    const evento = partida.clicar(objetoId);
    if (evento.tipo === 'fala') definirFala(evento.texto);
    else if (evento.tipo === 'pedirResposta') {
      definirPergunta(evento.pergunta);
      abrirCampo(objetoId, 'resposta');
    } else if (evento.tipo === 'pedirSenha') {
      // No modo senha, a pergunta do enigma anterior deixa de aparecer (PEND-012).
      definirPergunta(null);
      abrirCampo(objetoId, 'senha');
    }
    // 'nenhum' (decoração): nada muda (RF-16).
  }

  // A conferência é do verificador (RNF-04); a tela só mostra o veredito e os dígitos.
  async function aoEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!pedido) return;
    const resposta = await partida.responder(pedido.objetoId, texto);
    if (resposta.tipo === 'aberta') {
      definirPedido(null);
      definirResultado(textos.fimDeJogo);
      aoConcluir?.();
      return;
    }
    definirResultado(resposta.mensagem);
  }

  const casasSenha = Array.from({ length: fase.tamanhoSenha }, (_, i) => estado.digitosRevelados[i + 1] ?? '_');
  const algumDigito = Object.keys(estado.digitosRevelados).length > 0;

  function verDica(objetoId: string) {
    definirDica(partida.dica(objetoId));
  }

  return (
    <main>
      {precisaAvisoResolucao(janela.largura, janela.altura) && <p>{textos.avisoResolucao}</p>}
      <nav aria-label={textos.rotuloParedes}>
        {PAREDES.map((parede) => (
          <button
            key={parede}
            type="button"
            aria-pressed={estado.paredeAtiva === parede}
            onClick={() => trocarParede(parede)}
          >
            {textos.paredes[parede]}
          </button>
        ))}
      </nav>
      <RenderizadorParede
        parede={parede}
        palco={palco}
        baseUrlApi={baseUrlApi}
        aoClicar={aoClicar}
        aoVerDica={verDica}
      />
      {enigmasComDica.length > 0 && (
        <div>
          {enigmasComDica.map((objeto, indice) => (
            <button
              key={objeto.id}
              type="button"
              aria-label={textos.verDica(indice + 1, enigmasComDica.length)}
              onClick={() => verDica(objeto.id)}
            >
              {textos.verDica(indice + 1, enigmasComDica.length)}
            </button>
          ))}
        </div>
      )}
      {fala !== null && <p aria-live="polite">{fala}</p>}
      {pergunta !== null && <p aria-live="polite">{pergunta}</p>}
      {dica !== null && <p aria-live="polite">{dica}</p>}
      {pedido !== null && !estado.concluida && (
        <form onSubmit={aoEnviar}>
          <input
            type="text"
            aria-label={pedido.modo === 'senha' ? textos.rotuloSenha : textos.rotuloResposta}
            value={texto}
            onChange={(e) => definirTexto(e.target.value)}
          />
          <button type="submit">{textos.botaoResponder}</button>
        </form>
      )}
      {resultado !== null && <p aria-live="polite">{resultado}</p>}
      {algumDigito && <p>{textos.senhaRevelada(casasSenha)}</p>}
    </main>
  );
}
