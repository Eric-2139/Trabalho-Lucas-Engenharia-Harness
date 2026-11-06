/**
 * Edição (modulos-editor.md §5, contrato telas.ts · PropsTelaEdicao; RF-03).
 * Abre a fase (`abrirFase`), valida o documento e cria o store; mostra AbasParedes, CanvasParede (só a parede
 * ativa, palco 16:9) e PainelPropriedades (objeto selecionado ou Propriedades da fase).
 * O jsdom não faz layout: o palco usa o tamanho da janela, como na TelaJogo (PEND-019).
 */
import { validarFase } from '@math-scape/schema';
import { useEffect, useState } from 'react';
import { useStore } from 'zustand';
import type { StoreEditor } from '../../contrato/store.ts';
import type { PropsTelaEdicao } from '../../contrato/telas.ts';
import { AbasParedes } from '../componentes/AbasParedes.tsx';
import { CanvasParede } from '../componentes/CanvasParede.tsx';
import { PainelPropriedades } from '../componentes/PainelPropriedades.tsx';
import { criarStoreEditor } from '../store/index.ts';

/** Tamanho da janela, atualizado no `resize`. */
function useJanela() {
  const [janela, definirJanela] = useState(() => ({ largura: window.innerWidth, altura: window.innerHeight }));
  useEffect(() => {
    const aoRedimensionar = () => definirJanela({ largura: window.innerWidth, altura: window.innerHeight });
    window.addEventListener('resize', aoRedimensionar);
    return () => window.removeEventListener('resize', aoRedimensionar);
  }, []);
  return janela;
}

function Edicao({ store, baseUrlApi }: { store: StoreEditor; baseUrlApi: string }) {
  const janela = useJanela();
  const paredeAtiva = useStore(store, (estado) => estado.paredeAtiva);
  const titulo = useStore(store, (estado) => estado.documento.titulo);
  const senha = useStore(store, (estado) => estado.documento.senha);
  const objeto = useStore(store, (estado) =>
    estado.selecionado === null
      ? null
      : (estado.documento.paredes[estado.paredeAtiva].objetos.find((o) => o.id === estado.selecionado) ?? null),
  );

  return (
    <main>
      <AbasParedes paredeAtiva={paredeAtiva} aoTrocar={(parede) => store.getState().trocarParede(parede)} />
      <CanvasParede
        store={store}
        baseUrlApi={baseUrlApi}
        larguraConteiner={janela.largura}
        alturaConteiner={janela.altura}
      />
      <aside>
        <PainelPropriedades objeto={objeto} fase={{ titulo, senha }} store={store} />
      </aside>
    </main>
  );
}

export function TelaEdicao({ faseId, cliente, baseUrlApi }: PropsTelaEdicao) {
  const [store, definirStore] = useState<StoreEditor | null>(null);
  const [erro, definirErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    void cliente.abrirFase(faseId).then((resposta) => {
      if (!ativo) return;
      if (!resposta.ok) {
        definirErro(resposta.erro);
        return;
      }
      const validacao = validarFase(resposta.valor.documento);
      if (!validacao.ok) {
        definirErro(validacao.erros.map((e) => e.mensagem).join(' '));
        return;
      }
      definirStore(criarStoreEditor(validacao.fase));
    });
    return () => {
      ativo = false;
    };
  }, [faseId, cliente]);

  if (erro !== null) return <p role="alert">{erro}</p>;
  if (store === null) return <p>Abrindo a fase…</p>;
  return <Edicao store={store} baseUrlApi={baseUrlApi} />;
}
