/// <reference types="vite/client" />
/**
 * Ponto de entrada do app do jogador (modulos-player.md §2): rotas `/`, `/fases` e `/jogar/:id`.
 * Roteamento sem dependência: `location.pathname`, `history.pushState` e o evento `popstate`.
 * A Api fica em `/api` no mesmo site (ADR-017).
 */
import { tema } from '@math-scape/player';
import { type MouseEvent, type ReactNode, useEffect, useState, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import type { ResultadoHttp } from '../contrato/index.ts';
import { criarClienteApiJogo } from './cliente-api.ts';
import { mensagens } from './mensagens.ts';
import { EscolherFase } from './telas/EscolherFase.tsx';
import { TelaInicial } from './telas/TelaInicial.tsx';
import { TelaJogo } from './telas/TelaJogo.tsx';

const BASE_URL_API = '/api';
/** O editor roda em outra porta no dev; em produção, configurável por VITE_URL_EDITOR. */
const URL_EDITOR: string = import.meta.env.VITE_URL_EDITOR || 'http://localhost:5173';

const api = criarClienteApiJogo(BASE_URL_API);

// ---- Roteamento ----

type Rota = { tipo: 'inicial' } | { tipo: 'fases' } | { tipo: 'jogar'; id: string } | { tipo: 'desconhecida' };

function rotaDe(caminho: string): Rota {
  const limpo = caminho.length > 1 ? caminho.replace(/\/+$/, '') : caminho;
  if (limpo === '/') return { tipo: 'inicial' };
  if (limpo === '/fases') return { tipo: 'fases' };
  const jogar = /^\/jogar\/([^/]+)$/.exec(limpo);
  if (jogar?.[1]) {
    try {
      return { tipo: 'jogar', id: decodeURIComponent(jogar[1]) };
    } catch {
      return { tipo: 'desconhecida' };
    }
  }
  return { tipo: 'desconhecida' };
}

const caminhoJogar = (id: string) => `/jogar/${encodeURIComponent(id)}`;

const ouvintes = new Set<() => void>();

function assinarCaminho(aviso: () => void) {
  ouvintes.add(aviso);
  window.addEventListener('popstate', aviso);
  return () => {
    ouvintes.delete(aviso);
    window.removeEventListener('popstate', aviso);
  };
}

const caminhoAtual = () => window.location.pathname;

function navegar(caminho: string) {
  if (caminho === window.location.pathname) return;
  window.history.pushState(null, '', caminho);
  window.scrollTo(0, 0);
  for (const aviso of ouvintes) aviso();
}

/** Clique simples em link interno navega sem recarregar; Ctrl/Shift/botão do meio seguem o padrão. */
function aoClicarLink(evento: MouseEvent<HTMLAnchorElement>) {
  if (evento.button !== 0 || evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.altKey) return;
  const destino = evento.currentTarget.getAttribute('href');
  if (!destino?.startsWith('/')) return;
  evento.preventDefault();
  navegar(destino);
}

function LinkInterno({ para, children }: { para: string; children: ReactNode }) {
  return (
    <a href={para} onClick={aoClicarLink}>
      {children}
    </a>
  );
}

// ---- Carga da Api ----

type Carga<T> = { estado: 'carregando' } | ResultadoHttp<T>;

function useCarga<T>(carregar: () => Promise<ResultadoHttp<T>>, chave: string): Carga<T> {
  const [carga, definirCarga] = useState<Carga<T>>({ estado: 'carregando' });
  // biome-ignore lint/correctness/useExhaustiveDependencies: recarrega só quando a chave (rota) muda.
  useEffect(() => {
    let ativo = true;
    definirCarga({ estado: 'carregando' });
    void carregar().then((resultado) => {
      if (ativo) definirCarga(resultado);
    });
    return () => {
      ativo = false;
    };
  }, [chave]);
  return carga;
}

/** Carregando ou falha da Api: mensagem acessível e um link de volta. */
interface PropsEstadoCarga {
  carga: Carga<unknown>;
  voltarPara: string;
  textoVoltar: string;
}

function EstadoCarga({ carga, voltarPara, textoVoltar }: PropsEstadoCarga) {
  if ('estado' in carga) {
    return (
      <main>
        <p role="status">{mensagens.navegacao.carregando}</p>
      </main>
    );
  }
  if (carga.ok) return null;
  return (
    <main>
      <p role="alert">{carga.erro}</p>
      <p>
        <LinkInterno para={voltarPara}>{textoVoltar}</LinkInterno>
      </p>
    </main>
  );
}

// ---- Rotas ----

function RotaFases() {
  const carga = useCarga(() => api.listarPublicadas(), 'fases');
  if ('estado' in carga || !carga.ok) {
    return <EstadoCarga carga={carga} voltarPara="/" textoVoltar={mensagens.navegacao.voltarInicio} />;
  }
  return <EscolherFase fases={carga.valor} aoAbrir={(id) => navegar(caminhoJogar(id))} />;
}

function RotaJogo({ id }: { id: string }) {
  const carga = useCarga(() => api.obterJogo(id), id);
  const [concluida, definirConcluida] = useState(false);
  if ('estado' in carga || !carga.ok) {
    return <EstadoCarga carga={carga} voltarPara="/fases" textoVoltar={mensagens.navegacao.voltarFases} />;
  }
  return (
    <>
      <TelaJogo faseId={id} fase={carga.valor} baseUrlApi={BASE_URL_API} aoConcluir={() => definirConcluida(true)} />
      {/* Fim de jogo: a mensagem fica na tela e o jogador volta a Escolher Fase pelo link. */}
      {concluida && (
        <p>
          <LinkInterno para="/fases">{mensagens.navegacao.voltarFases}</LinkInterno>
        </p>
      )}
    </>
  );
}

function RotaDesconhecida() {
  return (
    <main>
      <h1>{mensagens.navegacao.paginaNaoEncontrada}</h1>
      <p>
        <LinkInterno para="/">{mensagens.navegacao.voltarInicio}</LinkInterno>
      </p>
    </main>
  );
}

// ---- Tema comum (ADR-014, RNF-07) ----

const { cores, fonte, foco } = tema;
const estiloGlobal = `
body { margin: 0; padding: 1rem; background: ${cores.fundo}; color: ${cores.texto};
  font-family: ${fonte.familia}; font-size: ${fonte.tamanhoBase}; }
a { color: ${cores.primaria}; }
[role="alert"] { color: ${cores.erro}; }
:focus-visible { outline: ${foco.largura} ${foco.estilo} ${cores.foco}; outline-offset: 2px; }
`;

function App() {
  const caminho = useSyncExternalStore(assinarCaminho, caminhoAtual);
  const rota = rotaDe(caminho);
  let tela: ReactNode;
  switch (rota.tipo) {
    case 'inicial':
      tela = <TelaInicial urlEditor={URL_EDITOR} aoClicarLink={aoClicarLink} />;
      break;
    case 'fases':
      tela = <RotaFases />;
      break;
    case 'jogar':
      tela = <RotaJogo key={rota.id} id={rota.id} />;
      break;
    default:
      tela = <RotaDesconhecida />;
  }
  return (
    <>
      <style>{estiloGlobal}</style>
      {tela}
    </>
  );
}

const raiz = document.getElementById('raiz');
if (raiz) createRoot(raiz).render(<App />);
