/**
 * CanvasParede (modulos-editor.md §4, RF-03, ADR-006, ADR-007): Stage react-konva do tamanho do contêiner com o
 * palco 16:9 de `calcularPalco` centralizado. Só a parede ativa do store é montada. Duas camadas: fundo (sem
 * escuta) e objetos por `camada`. Clicar num objeto o seleciona; clicar fora de objeto desfaz a seleção.
 */
import { calcularPalco, paraPixels } from '@math-scape/player';
import type { Retangulo } from '@math-scape/player/contrato';
import { resolverImagem } from '@math-scape/schema';
import type { Objeto, RefImagem } from '@math-scape/schema/contrato';
import type { KonvaEventObject } from 'konva/lib/Node';
import { useEffect, useState } from 'react';
import { Image as ImagemKonva, Layer, Stage } from 'react-konva';
import { useStore } from 'zustand';
import type { PropsCanvasParede } from '../../contrato/index.ts';

/** URL da referência, ou null se ela não resolve: o objeto continua clicável, só sem desenho. */
function urlDaImagem(ref: string | null, baseUrlApi: string): string | null {
  if (ref === null) return null;
  try {
    return resolverImagem(ref as RefImagem, baseUrlApi);
  } catch {
    return null;
  }
}

/** Imagens decodificadas uma vez por URL (ADR-007). */
const cache = new Map<string, HTMLImageElement>();

function useImagem(url: string | null): HTMLImageElement | undefined {
  const [imagem, definirImagem] = useState<HTMLImageElement | undefined>(() => {
    const el = url ? cache.get(url) : undefined;
    return el?.complete && el.naturalWidth > 0 ? el : undefined;
  });
  useEffect(() => {
    if (!url) {
      definirImagem(undefined);
      return;
    }
    let el = cache.get(url);
    if (!el) {
      el = new window.Image();
      el.src = url;
      cache.set(url, el);
    }
    if (el.complete && el.naturalWidth > 0) {
      definirImagem(el);
      return;
    }
    const alvo = el;
    const aoCarregar = () => definirImagem(alvo);
    alvo.addEventListener('load', aoCarregar);
    return () => alvo.removeEventListener('load', aoCarregar);
  }, [url]);
  return imagem;
}

/** Por `camada`; empate desenha na ordem da lista. */
function ordemDeDesenho(objetos: readonly Objeto[]): Objeto[] {
  return objetos
    .map((objeto, indice) => ({ objeto, indice }))
    .sort((a, b) => a.objeto.camada - b.objeto.camada || a.indice - b.indice)
    .map(({ objeto }) => objeto);
}

function Fundo({ fundo, palco, baseUrlApi }: { fundo: string | null; palco: Retangulo; baseUrlApi: string }) {
  const imagem = useImagem(urlDaImagem(fundo, baseUrlApi));
  if (!fundo) return null;
  return <ImagemKonva image={imagem} x={palco.x} y={palco.y} width={palco.largura} height={palco.altura} />;
}

interface PropsObjetoNoPalco {
  objeto: Objeto;
  palco: Retangulo;
  baseUrlApi: string;
  aoSelecionar: (objetoId: string) => void;
}

function ObjetoNoPalco({ objeto, palco, baseUrlApi, aoSelecionar }: PropsObjetoNoPalco) {
  const imagem = useImagem(urlDaImagem(objeto.imagem, baseUrlApi));
  const r = paraPixels(objeto, palco);
  const aoAtivar = () => aoSelecionar(objeto.id);
  return (
    <ImagemKonva
      image={imagem}
      x={r.x}
      y={r.y}
      width={r.largura}
      height={r.altura}
      rotation={objeto.rotacao}
      onClick={aoAtivar}
      onTap={aoAtivar}
    />
  );
}

export function CanvasParede({ store, baseUrlApi, larguraConteiner, alturaConteiner }: PropsCanvasParede) {
  const paredeAtiva = useStore(store, (estado) => estado.paredeAtiva);
  const parede = useStore(store, (estado) => estado.documento.paredes[estado.paredeAtiva]);
  const selecionar = useStore(store, (estado) => estado.selecionar);
  const palco = calcularPalco(larguraConteiner, alturaConteiner);

  /** Clique que não acertou objeto (chegou ao próprio Stage) desfaz a seleção. */
  const aoClicarNoPalco = (evento: KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (evento.target === evento.target.getStage()) selecionar(null);
  };

  return (
    <Stage width={larguraConteiner} height={alturaConteiner} onClick={aoClicarNoPalco} onTap={aoClicarNoPalco}>
      <Layer listening={false}>
        <Fundo key={paredeAtiva} fundo={parede.fundo} palco={palco} baseUrlApi={baseUrlApi} />
      </Layer>
      <Layer key={paredeAtiva}>
        {ordemDeDesenho(parede.objetos).map((objeto) => (
          <ObjetoNoPalco
            key={objeto.id}
            objeto={objeto}
            palco={palco}
            baseUrlApi={baseUrlApi}
            aoSelecionar={(id) => selecionar(id)}
          />
        ))}
      </Layer>
    </Stage>
  );
}
