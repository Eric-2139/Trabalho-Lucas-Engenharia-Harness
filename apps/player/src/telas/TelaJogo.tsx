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

  const sala = calcularPalco(janela.largura, janela.altura);
  const palco = { x: 0, y: 0, largura: sala.largura, altura: sala.altura };

  function trocarParede(parede: ParedeId) {
    partida.trocarParede(parede);
    definirFala(null);
  }

  function aoClicar(objetoId: string) {
    const evento = partida.clicar(objetoId);
    if (evento.tipo === 'fala') definirFala(evento.texto);
    // 'nenhum' (decoração): nada muda (RF-16).
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
        parede={fase.paredes[estado.paredeAtiva]}
        palco={palco}
        baseUrlApi={baseUrlApi}
        aoClicar={aoClicar}
      />
      {fala !== null && <p aria-live="polite">{fala}</p>}
    </main>
  );
}
