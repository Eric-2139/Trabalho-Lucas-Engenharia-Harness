/**
 * Ponto de entrada do app do criador (modulos-editor.md §5, contrato editor.md · Telas; RF-01).
 * Rotas: `/` (Minhas fases), `/fases/:id` (Edição) e `/conta` (Conta). Roteamento sem dependência:
 * `location.pathname`, `history.pushState` e o evento `popstate`, como no app do jogador.
 * Sessão (RF-01): o login não é rota.
 * - Ao abrir o app, `GET /fases`: 401 mostra só o login, qualquer que seja a rota; depois de entrar, a rota pedida abre.
 * - Durante o uso, qualquer 401 do cliente (`aoNaoAutenticado`) mostra o login por cima da tela atual, sem desmontá-la:
 *   a Edição mantém o store e a alteração em memória, com o salvamento em `erro`; cada login aceito ali incrementa
 *   `sessaoRenovada`, e a Edição grava a alteração guardada sem outra ação do criador (PEND-020).
 * - "Sair" e "Excluir conta" voltam ao login.
 * A Api fica em `/api` no mesmo site (ADR-017): um único cliente para o app.
 */
import { estiloTema, tema } from '@math-scape/player';
import { type MouseEvent, type ReactNode, useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import type { Relogio } from '../contrato/index.ts';
import { criarClienteApiEditor } from './cliente-api.ts';
import { mensagens } from './mensagens.ts';
import { MinhasFases } from './telas/MinhasFases.tsx';
import { TelaConta } from './telas/TelaConta.tsx';
import { TelaEdicao } from './telas/TelaEdicao.tsx';
import { TelaEntrar } from './telas/TelaEntrar.tsx';

const BASE_URL_API = '/api';

/** Relógio real do salvamento automático (RF-10); os testes injetam um relógio falso. */
const relogio: Relogio = {
  agora: () => Date.now(),
  agendar(funcao, ms) {
    const id = setTimeout(funcao, ms);
    return () => clearTimeout(id);
  },
};

// ---- Roteamento ----

type Rota = { tipo: 'fases' } | { tipo: 'edicao'; id: string } | { tipo: 'conta' } | { tipo: 'desconhecida' };

function rotaDe(caminho: string): Rota {
  const limpo = caminho.length > 1 ? caminho.replace(/\/+$/, '') : caminho;
  if (limpo === '/') return { tipo: 'fases' };
  if (limpo === '/conta') return { tipo: 'conta' };
  const edicao = /^\/fases\/([^/]+)$/.exec(limpo);
  if (edicao?.[1]) {
    try {
      return { tipo: 'edicao', id: decodeURIComponent(edicao[1]) };
    } catch {
      return { tipo: 'desconhecida' };
    }
  }
  return { tipo: 'desconhecida' };
}

const caminhoEdicao = (id: string) => `/fases/${encodeURIComponent(id)}`;

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

function RotaDesconhecida() {
  return (
    <main>
      <h1>{mensagens.navegacao.paginaNaoEncontrada}</h1>
      <p>
        <LinkInterno para="/">{mensagens.navegacao.voltarMinhasFases}</LinkInterno>
      </p>
    </main>
  );
}

/** Login por cima da tela atual (RF-01): diálogo modal que recebe o foco ao abrir. */
function LoginPorCima({ children }: { children: ReactNode }) {
  const id = useId();
  const titulo = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    titulo.current?.focus();
  }, []);
  return (
    <div className="login-por-cima">
      <div role="dialog" aria-modal="true" aria-labelledby={`${id}-titulo`}>
        <h1 id={`${id}-titulo`} ref={titulo} tabIndex={-1}>
          {mensagens.sessao.rotuloLogin}
        </h1>
        <p>{mensagens.sessao.sessaoExpirada}</p>
        {children}
      </div>
    </div>
  );
}

// ---- Tema comum (ADR-014, RNF-07) ----

const { cores } = tema;
const estiloGlobal = `${estiloTema}
header nav { margin-bottom: 0.75rem; padding: 0.5rem 0.75rem; border-radius: 0.5rem; background: ${cores.superficie}; }
header nav ul { display: flex; gap: 1rem; list-style: none; padding: 0; margin: 0; align-items: center; }
header nav li:last-child { margin-left: auto; }
/* Edição e modo testar (LAC-046): ocupam a altura que sobra da janela (100dvh menos o padding do body) sem rolar. */
#raiz > div:has(> main.edicao), #raiz > div:has(> main.testar) {
  display: flex; flex-direction: column; height: calc(100dvh - 2rem); }
#raiz > div:has(> main.edicao) > header, #raiz > div:has(> main.testar) > header { flex: none; }
main.edicao { flex: 1; min-height: 0; display: grid; gap: 1rem;
  grid-template-columns: 14rem minmax(0, 1fr) 18rem; grid-template-rows: auto minmax(0, 1fr); }
.edicao-topo { grid-column: 1 / -1; }
.edicao-biblioteca, .edicao-painel { min-height: 0; overflow: auto; }
.edicao-palco { position: relative; min-width: 0; min-height: 0; overflow: hidden; }
.edicao-palco > div { position: absolute; inset: 0; }
/* Modo testar: o layout da TelaJogo, palco à esquerda e coluna de 18rem à direita. */
main.testar { flex: 1; min-height: 0; display: grid; gap: 1rem;
  grid-template-columns: minmax(0, 1fr) 18rem; grid-template-rows: minmax(0, 1fr); }
.testar-palco { position: relative; min-width: 0; min-height: 0; overflow: hidden; }
.testar-palco > div { position: absolute; inset: 0; }
.testar-coluna { min-height: 0; overflow: auto; }
.login-por-cima { position: fixed; inset: 0; overflow: auto; background: rgba(0, 0, 0, 0.5); padding: 2rem; }
.login-por-cima [role="dialog"] { background: ${cores.superficie}; max-width: 40rem; margin: 0 auto; padding: 1rem; }
`;

// ---- App ----

/** `verificando`: `GET /fases` inicial em curso; `ausente`: sem sessão, só o login aparece. */
type Sessao = 'verificando' | 'ativa' | 'ausente';

function App() {
  const caminho = useSyncExternalStore(assinarCaminho, caminhoAtual);
  const rota = rotaDe(caminho);
  const [sessao, definirSessao] = useState<Sessao>('verificando');
  const [loginPorCima, definirLoginPorCima] = useState(false);
  const [erroSair, definirErroSair] = useState<string | null>(null);
  // PEND-020: logins aceitos depois de um 401; a Edição grava a alteração guardada quando o valor muda.
  const [sessaoRenovada, definirSessaoRenovada] = useState(0);
  // Um único cliente para o app (ADR-017); qualquer 401 fora de entrar/cadastrar abre o login por cima.
  const [cliente] = useState(() =>
    criarClienteApiEditor(BASE_URL_API, { aoNaoAutenticado: () => definirLoginPorCima(true) }),
  );

  // RF-01: ao abrir o app, `GET /fases`; 401 leva ao login. Outra falha deixa a tela mostrar o próprio erro.
  useEffect(() => {
    let ativo = true;
    void cliente.listarFases().then((resultado) => {
      if (!ativo) return;
      definirSessao(!resultado.ok && resultado.status === 401 ? 'ausente' : 'ativa');
    });
    return () => {
      ativo = false;
    };
  }, [cliente]);

  function aoEntrar() {
    definirErroSair(null);
    definirLoginPorCima(false);
    definirSessao('ativa');
  }

  /** Login aceito por cima da tela, depois de um 401 (`aoNaoAutenticado`). */
  function aoEntrarDepoisDe401() {
    aoEntrar();
    definirSessaoRenovada((valor) => valor + 1);
  }

  function encerrarSessao() {
    navegar('/');
    definirLoginPorCima(false);
    definirSessao('ausente');
  }

  async function sair() {
    definirErroSair(null);
    const resultado = await cliente.sair();
    if (resultado.ok || resultado.status === 401) {
      encerrarSessao();
      return;
    }
    definirErroSair(resultado.erro);
  }

  let conteudo: ReactNode;
  if (sessao === 'verificando') {
    conteudo = (
      <main>
        <p role="status">{mensagens.navegacao.carregando}</p>
      </main>
    );
  } else if (sessao === 'ausente') {
    conteudo = <TelaEntrar cliente={cliente} aoEntrar={aoEntrar} />;
  } else {
    let tela: ReactNode;
    switch (rota.tipo) {
      case 'fases':
        tela = <MinhasFases cliente={cliente} aoAbrir={(id) => navegar(caminhoEdicao(id))} />;
        break;
      case 'edicao':
        tela = (
          <TelaEdicao
            key={rota.id}
            faseId={rota.id}
            cliente={cliente}
            relogio={relogio}
            baseUrlApi={BASE_URL_API}
            aoSair={() => navegar('/')}
            sessaoRenovada={sessaoRenovada}
          />
        );
        break;
      case 'conta':
        tela = <TelaConta cliente={cliente} aoExcluirConta={encerrarSessao} />;
        break;
      default:
        tela = <RotaDesconhecida />;
    }
    conteudo = (
      <>
        {/* A tela fica montada (e inerte) sob o login: a Edição não perde a alteração em memória (RF-01, RF-10). */}
        <div inert={loginPorCima}>
          <header>
            <nav aria-label={mensagens.navegacao.rotulo}>
              <ul>
                <li>
                  <strong>{mensagens.app.titulo}</strong>
                </li>
                <li>
                  <LinkInterno para="/">{mensagens.navegacao.minhasFases}</LinkInterno>
                </li>
                <li>
                  <LinkInterno para="/conta">{mensagens.navegacao.conta}</LinkInterno>
                </li>
                <li>
                  <button type="button" onClick={() => void sair()}>
                    {mensagens.navegacao.sair}
                  </button>
                </li>
              </ul>
            </nav>
            {erroSair !== null ? <p role="alert">{erroSair}</p> : null}
          </header>
          {tela}
        </div>
        {loginPorCima ? (
          <LoginPorCima>
            <TelaEntrar cliente={cliente} aoEntrar={aoEntrarDepoisDe401} />
          </LoginPorCima>
        ) : null}
      </>
    );
  }

  return (
    <>
      <style>{estiloGlobal}</style>
      {conteudo}
    </>
  );
}

const raiz = document.getElementById('raiz');
if (raiz) createRoot(raiz).render(<App />);
