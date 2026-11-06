/**
 * Modo testar (modulos-editor.md §5, contrato editor.md; RF-11, ADR-009, PEND-019).
 * Joga a projeção `FaseJogo` de `GET /fases/:id/jogo-teste` com o motor do `packages/player` e o verificador em
 * `modo=teste`; o editor só mostra o veredito (RNF-04). Não toca no store da edição: ao sair, o documento é o mesmo.
 * Layout da TelaJogo (LAC-046): palco Konva (`RenderizadorParede`) à esquerda, medido no contêiner por
 * `ResizeObserver` (sem ele, a janela é a reserva), e coluna à direita com paredes, fala, pergunta, campo, resultado,
 * dígitos e o botão de sair (classes `testar*`, estilo em main.tsx). Enigma e porta abrem um único campo num
 * `<form>`; os resultados usam as `MENSAGENS` do player.
 */
import { calcularPalco, criarPartida, RenderizadorParede } from '@math-scape/player';
import type { Verificador } from '@math-scape/player/contrato';
import { type FaseJogo, PAREDES, type ParedeId } from '@math-scape/schema/contrato';
import { type FormEvent, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { ROTULOS_EDITOR } from '../../contrato/telas.ts';
import { NOMES_PAREDES } from '../componentes/AbasParedes.tsx';

interface Medida {
  largura: number;
  altura: number;
}

/** Tamanho da janela (o jsdom não faz layout; PEND-019). */
function useJanela(): Medida {
  const [janela, definirJanela] = useState(() => ({ largura: window.innerWidth, altura: window.innerHeight }));
  useEffect(() => {
    const aoRedimensionar = () => definirJanela({ largura: window.innerWidth, altura: window.innerHeight });
    window.addEventListener('resize', aoRedimensionar);
    return () => window.removeEventListener('resize', aoRedimensionar);
  }, []);
  return janela;
}

/**
 * LAC-046: tamanho do elemento que contém o palco, medido por `ResizeObserver`. Sem `ResizeObserver` (jsdom) e antes
 * da primeira medida, devolve a `reserva` (a janela). Com medida, a janela não muda o palco.
 */
function useMedidaDoConteiner(reserva: Medida): [(elemento: HTMLElement | null) => void, Medida] {
  const [elemento, definirElemento] = useState<HTMLElement | null>(null);
  const [medida, definirMedida] = useState<Medida | null>(null);
  useEffect(() => {
    if (elemento === null || typeof ResizeObserver === 'undefined') return;
    const observador = new ResizeObserver((entradas) => {
      const ultima = entradas.at(-1);
      if (!ultima) return;
      const largura = Math.floor(ultima.contentRect.width);
      const altura = Math.floor(ultima.contentRect.height);
      // Contêiner sem tamanho (escondido): mantém a medida anterior para o palco não sumir.
      if (largura > 0 && altura > 0) definirMedida({ largura, altura });
    });
    observador.observe(elemento);
    return () => observador.disconnect();
  }, [elemento]);
  return [definirElemento, medida ?? reserva];
}

export interface PropsModoTestar {
  fase: FaseJogo;
  verificador: Verificador;
  baseUrlApi: string;
  aoSair: () => void;
}

export function ModoTestar({ fase, verificador, baseUrlApi, aoSair }: PropsModoTestar) {
  const partida = useMemo(() => criarPartida(fase, verificador), [fase, verificador]);
  const estado = useSyncExternalStore(partida.assinar, partida.estado);
  const janela = useJanela();
  const [medirPalco, conteinerDoPalco] = useMedidaDoConteiner(janela);
  const [fala, definirFala] = useState<string | null>(null);
  const [pergunta, definirPergunta] = useState<string | null>(null);
  const [dica, definirDica] = useState<string | null>(null);
  const [pedido, definirPedido] = useState<{ objetoId: string; modo: 'resposta' | 'senha' } | null>(null);
  const [texto, definirTexto] = useState('');
  const [resultado, definirResultado] = useState<string | null>(null);

  const sala = calcularPalco(conteinerDoPalco.largura, conteinerDoPalco.altura);
  const palco = { x: 0, y: 0, largura: sala.largura, altura: sala.altura };
  const parede = fase.paredes[estado.paredeAtiva];

  function trocarParede(nova: ParedeId) {
    partida.trocarParede(nova);
    definirFala(null);
    definirPergunta(null);
    definirDica(null);
    definirPedido(null);
    definirResultado(null);
  }

  function aoClicar(objetoId: string) {
    const evento = partida.clicar(objetoId);
    if (evento.tipo === 'fala') definirFala(evento.texto);
    else if (evento.tipo === 'pedirResposta') {
      definirPergunta(evento.pergunta);
      definirPedido({ objetoId, modo: 'resposta' });
      definirTexto('');
      definirResultado(null);
    } else if (evento.tipo === 'pedirSenha') {
      definirPergunta(null);
      definirPedido({ objetoId, modo: 'senha' });
      definirTexto('');
      definirResultado(null);
    }
  }

  async function aoEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!pedido) return;
    const resposta = await partida.responder(pedido.objetoId, texto);
    if (resposta.tipo === 'aberta') {
      definirPedido(null);
      definirResultado('Porta aberta: fim da fase.');
      return;
    }
    definirResultado(resposta.mensagem);
  }

  const digitos = Array.from({ length: fase.tamanhoSenha }, (_, i) => estado.digitosRevelados[i + 1] ?? '_');

  return (
    <main className="testar">
      {/* LAC-046: o elemento medido; o palco fica numa camada absoluta para não mudar a medida do contêiner. */}
      <div className="testar-palco" ref={medirPalco}>
        <div>
          <RenderizadorParede
            parede={parede}
            palco={palco}
            baseUrlApi={baseUrlApi}
            aoClicar={aoClicar}
            aoVerDica={(id) => definirDica(partida.dica(id))}
          />
        </div>
      </div>
      <div className="testar-coluna">
        <nav aria-label="Paredes">
          {PAREDES.map((p) => (
            <button key={p} type="button" aria-pressed={estado.paredeAtiva === p} onClick={() => trocarParede(p)}>
              {NOMES_PAREDES[p]}
            </button>
          ))}
        </nav>
        {fala !== null && <p aria-live="polite">{fala}</p>}
        {pergunta !== null && <p aria-live="polite">{pergunta}</p>}
        {dica !== null && <p aria-live="polite">{dica}</p>}
        {pedido !== null && !estado.concluida && (
          <form onSubmit={aoEnviar}>
            <input
              type="text"
              aria-label={pedido.modo === 'senha' ? 'Senha' : 'Resposta'}
              value={texto}
              onChange={(e) => definirTexto(e.target.value)}
            />
            <button type="submit">Responder</button>
          </form>
        )}
        {resultado !== null && <p aria-live="polite">{resultado}</p>}
        <p>Senha: {digitos.join(' ')}</p>
        <button type="button" onClick={aoSair}>
          {ROTULOS_EDITOR.sairDoTeste}
        </button>
      </div>
    </main>
  );
}
