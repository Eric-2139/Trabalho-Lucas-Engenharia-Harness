/**
 * Modo testar (modulos-editor.md §5, contrato editor.md; RF-11, ADR-009, PEND-019).
 * Joga a projeção `FaseJogo` de `GET /fases/:id/jogo-teste` com o motor do `packages/player` e o verificador em
 * `modo=teste`; o editor só mostra o veredito (RNF-04). Não toca no store da edição: ao sair, o documento é o mesmo.
 * Palco Konva (`RenderizadorParede`) do tamanho da janela, como na TelaJogo; enigma e porta abrem um único campo num
 * `<form>`; os resultados usam as `MENSAGENS` do player.
 */
import { calcularPalco, criarPartida, RenderizadorParede } from '@math-scape/player';
import type { Verificador } from '@math-scape/player/contrato';
import { type FaseJogo, PAREDES, type ParedeId } from '@math-scape/schema/contrato';
import { type FormEvent, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { ROTULOS_EDITOR } from '../../contrato/telas.ts';
import { NOMES_PAREDES } from '../componentes/AbasParedes.tsx';

/** Tamanho da janela (o jsdom não faz layout; PEND-019). */
function useJanela() {
  const [janela, definirJanela] = useState(() => ({ largura: window.innerWidth, altura: window.innerHeight }));
  useEffect(() => {
    const aoRedimensionar = () => definirJanela({ largura: window.innerWidth, altura: window.innerHeight });
    window.addEventListener('resize', aoRedimensionar);
    return () => window.removeEventListener('resize', aoRedimensionar);
  }, []);
  return janela;
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
  const [fala, definirFala] = useState<string | null>(null);
  const [pergunta, definirPergunta] = useState<string | null>(null);
  const [dica, definirDica] = useState<string | null>(null);
  const [pedido, definirPedido] = useState<{ objetoId: string; modo: 'resposta' | 'senha' } | null>(null);
  const [texto, definirTexto] = useState('');
  const [resultado, definirResultado] = useState<string | null>(null);

  const sala = calcularPalco(janela.largura, janela.altura);
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
    <main>
      <button type="button" onClick={aoSair}>
        {ROTULOS_EDITOR.sairDoTeste}
      </button>
      <nav aria-label="Paredes">
        {PAREDES.map((p) => (
          <button key={p} type="button" aria-pressed={estado.paredeAtiva === p} onClick={() => trocarParede(p)}>
            {NOMES_PAREDES[p]}
          </button>
        ))}
      </nav>
      <RenderizadorParede
        parede={parede}
        palco={palco}
        baseUrlApi={baseUrlApi}
        aoClicar={aoClicar}
        aoVerDica={(id) => definirDica(partida.dica(id))}
      />
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
    </main>
  );
}
