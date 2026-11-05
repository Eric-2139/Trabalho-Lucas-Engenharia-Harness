/**
 * TelaJogo (modulos-player.md §2, PEND-012): botões das 5 paredes, palco 16:9 com o
 * RenderizadorParede e a caixa de fala (RF-16). O motor decide o que cada clique faz;
 * decoração devolve `nenhum` e a tela não muda.
 */
import {
  calcularPalco,
  criarPartida,
  criarVerificadorHttp,
  precisaAvisoResolucao,
  RenderizadorParede,
} from '@math-scape/player';
import type { ParedeId } from '@math-scape/schema/contrato';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
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

export function TelaJogo({ faseId, fase, baseUrlApi, verificador }: PropsTelaJogo) {
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
  }

  function aoClicar(objetoId: string) {
    const evento = partida.clicar(objetoId);
    if (evento.tipo === 'fala') definirFala(evento.texto);
    else if (evento.tipo === 'pedirResposta') definirPergunta(evento.pergunta);
    else if (evento.tipo === 'pedirSenha') definirPergunta(null);
    // 'nenhum' (decoração): nada muda (RF-16).
  }

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
    </main>
  );
}
