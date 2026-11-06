/**
 * CanvasParede (modulos-editor.md §4, RF-03, ADR-006, ADR-007): Stage react-konva do tamanho do contêiner com o
 * palco 16:9 de `calcularPalco` centralizado. Só a parede ativa do store é montada. Duas camadas: fundo (sem
 * escuta) e objetos por `camada`. Clicar num objeto o seleciona; clicar fora de objeto desfaz a seleção.
 * RF-05: arrastar e o `Transformer` do selecionado mudam só o nó Konva; o store recebe a geometria no fim do gesto
 * (`dragend`/`transformend`), um passo de histórico. `dragBoundFunc`/`boundBoxFunc` prendem ao palco (ADR-011).
 * RF-04 (LAC-045): o Stage fica numa região ROTULOS_EDITOR.palco que aceita o arraste nativo da biblioteca
 * (TIPO_ARRASTE_BIBLIOTECA) e chama `aoSoltar(ref, posicao)` com o ponto em frações da parede, limitado a 0..1.
 */
import { calcularPalco, paraPixels } from '@math-scape/player';
import type { Retangulo } from '@math-scape/player/contrato';
import { resolverImagem } from '@math-scape/schema';
import type { Objeto, RefImagem } from '@math-scape/schema/contrato';
import type Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { Box } from 'konva/lib/shapes/Transformer';
import { type DragEvent, useEffect, useRef, useState } from 'react';
import { Image as ImagemKonva, Layer, Stage, Transformer } from 'react-konva';
import { useStore } from 'zustand';
import {
  type Geometria,
  type PropsCanvasParede,
  ROTULOS_EDITOR,
  TIPO_ARRASTE_BIBLIOTECA,
} from '../../contrato/index.ts';

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

function limitar(valor: number, minimo: number, maximo: number): number {
  return Math.min(Math.max(valor, minimo), Math.max(minimo, maximo));
}

/** Geometria em frações da parede (0..1) a partir do nó Konva no palco; a escala do Transformer vira tamanho. */
function geometriaDoNo(no: Konva.Node, palco: Retangulo): Partial<Geometria> {
  const largura = no.width() * no.scaleX();
  const altura = no.height() * no.scaleY();
  no.scale({ x: 1, y: 1 });
  return {
    x: (no.x() - palco.x) / palco.largura,
    y: (no.y() - palco.y) / palco.altura,
    largura: largura / palco.largura,
    altura: altura / palco.altura,
    rotacao: no.rotation(),
  };
}

interface PropsObjetoNoPalco {
  objeto: Objeto;
  palco: Retangulo;
  baseUrlApi: string;
  aoSelecionar: (objetoId: string) => void;
  /** Fim do gesto (dragend/transformend): devolve false se o store recusou. */
  aoTerminarGesto: (objetoId: string, geometria: Partial<Geometria>) => boolean;
}

function ObjetoNoPalco({ objeto, palco, baseUrlApi, aoSelecionar, aoTerminarGesto }: PropsObjetoNoPalco) {
  const imagem = useImagem(urlDaImagem(objeto.imagem, baseUrlApi));
  const r = paraPixels(objeto, palco);
  const aoAtivar = () => aoSelecionar(objeto.id);

  /** Durante o arraste a posição vive só no nó Konva (ADR-007), presa ao palco (ADR-011). */
  const limitarAoPalco = (posicao: { x: number; y: number }) => ({
    x: limitar(posicao.x, palco.x, palco.x + palco.largura - r.largura),
    y: limitar(posicao.y, palco.y, palco.y + palco.altura - r.altura),
  });

  const aoTerminar = (evento: KonvaEventObject<Event>) => {
    const no = evento.target;
    if (!aoTerminarGesto(objeto.id, geometriaDoNo(no, palco))) {
      // Recusa do store: o nó volta ao que o documento diz.
      no.setAttrs({ x: r.x, y: r.y, width: r.largura, height: r.altura, rotation: objeto.rotacao });
    }
  };

  return (
    <ImagemKonva
      id={objeto.id}
      image={imagem}
      x={r.x}
      y={r.y}
      width={r.largura}
      height={r.altura}
      rotation={objeto.rotacao}
      draggable
      dragBoundFunc={limitarAoPalco}
      onClick={aoAtivar}
      onTap={aoAtivar}
      onDragStart={aoAtivar}
      onDragEnd={aoTerminar}
      onTransformEnd={aoTerminar}
    />
  );
}

/** Transformer no objeto selecionado da parede ativa (redimensionar e rotacionar, RF-05). */
function Transformador({ camada, selecionado, palco }: { camada: Konva.Layer | null; selecionado: string | null; palco: Retangulo }) {
  const ref = useRef<Konva.Transformer>(null);
  useEffect(() => {
    const transformer = ref.current;
    if (!transformer) return;
    const no = selecionado && camada ? camada.findOne((n: Konva.Node) => n.id() === selecionado) : undefined;
    transformer.nodes(no ? [no] : []);
    transformer.getLayer()?.batchDraw();
  });
  const limiteDaCaixa = (antiga: Box, nova: Box): Box => {
    const fora =
      nova.width < 1 ||
      nova.height < 1 ||
      nova.x < palco.x - 0.5 ||
      nova.y < palco.y - 0.5 ||
      nova.x + nova.width > palco.x + palco.largura + 0.5 ||
      nova.y + nova.height > palco.y + palco.altura + 0.5;
    return fora ? antiga : nova;
  };
  return <Transformer ref={ref} boundBoxFunc={limiteDaCaixa} />;
}

/** O arraste veio da biblioteca (LAC-045)? No `dragover` só os tipos são legíveis, não os dados. */
function veioDaBiblioteca(evento: DragEvent<HTMLElement>): boolean {
  const tipos = evento.dataTransfer?.types;
  return tipos ? Array.from(tipos).includes(TIPO_ARRASTE_BIBLIOTECA) : false;
}

export function CanvasParede({ store, baseUrlApi, larguraConteiner, alturaConteiner, aoSoltar }: PropsCanvasParede) {
  const paredeAtiva = useStore(store, (estado) => estado.paredeAtiva);
  const parede = useStore(store, (estado) => estado.documento.paredes[estado.paredeAtiva]);
  const selecionado = useStore(store, (estado) => estado.selecionado);
  const selecionar = useStore(store, (estado) => estado.selecionar);
  const alterarGeometria = useStore(store, (estado) => estado.alterarGeometria);
  const [camadaObjetos, definirCamadaObjetos] = useState<Konva.Layer | null>(null);
  const palco = calcularPalco(larguraConteiner, alturaConteiner);
  const aoTerminarGesto = (id: string, geometria: Partial<Geometria>) => alterarGeometria(id, geometria).ok;

  /** Clique que não acertou objeto (chegou ao próprio Stage) desfaz a seleção. */
  const aoClicarNoPalco = (evento: KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (evento.target === evento.target.getStage()) selecionar(null);
  };

  const aoArrastarSobre = (evento: DragEvent<HTMLElement>) => {
    if (!veioDaBiblioteca(evento)) return;
    evento.preventDefault();
    evento.dataTransfer.dropEffect = 'copy';
  };

  /** RF-04 (LAC-045): ponto solto → frações da parede 16:9, limitadas a 0..1; quem insere é a Edição. */
  const aoSoltarNaRegiao = (evento: DragEvent<HTMLElement>) => {
    if (!veioDaBiblioteca(evento)) return;
    evento.preventDefault();
    const ref = evento.dataTransfer.getData(TIPO_ARRASTE_BIBLIOTECA) as RefImagem;
    if (!ref) return;
    const caixa = evento.currentTarget.getBoundingClientRect();
    const x = (evento.clientX - caixa.left - palco.x) / palco.largura;
    const y = (evento.clientY - caixa.top - palco.y) / palco.altura;
    aoSoltar?.(ref, { x: limitar(x, 0, 1), y: limitar(y, 0, 1) });
  };

  return (
    <section aria-label={ROTULOS_EDITOR.palco} onDragOver={aoArrastarSobre} onDrop={aoSoltarNaRegiao}>
      <Stage width={larguraConteiner} height={alturaConteiner} onClick={aoClicarNoPalco} onTap={aoClicarNoPalco}>
        <Layer listening={false}>
          <Fundo key={paredeAtiva} fundo={parede.fundo} palco={palco} baseUrlApi={baseUrlApi} />
        </Layer>
        <Layer key={paredeAtiva} ref={definirCamadaObjetos}>
          {ordemDeDesenho(parede.objetos).map((objeto) => (
            <ObjetoNoPalco
              key={objeto.id}
              objeto={objeto}
              palco={palco}
              baseUrlApi={baseUrlApi}
              aoSelecionar={(id) => selecionar(id)}
              aoTerminarGesto={aoTerminarGesto}
            />
          ))}
          <Transformador camada={camadaObjetos} selecionado={selecionado} palco={palco} />
        </Layer>
      </Stage>
    </section>
  );
}
