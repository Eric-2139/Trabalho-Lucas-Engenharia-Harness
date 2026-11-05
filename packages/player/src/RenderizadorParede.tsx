/**
 * RenderizadorParede (modulos-player.md §1, ADR-006): desenha uma parede no palco Konva.
 * Monta o próprio Stage do tamanho do palco; duas camadas: fundo (sem escuta) e objetos por `camada`.
 * Decoração não tem handler de clique (RF-16). O nó Image existe com largura e altura mesmo
 * sem a imagem carregada, para o clique acertar o objeto.
 */
import { resolverImagem } from '@math-scape/schema';
import type { ObjetoJogo, ParedeJogo, RefImagem } from '@math-scape/schema/contrato';
import { useEffect, useState } from 'react';
import { Image as ImagemKonva, Layer, Stage } from 'react-konva';
import type { PropsRenderizadorParede, Retangulo } from '../contrato/index.ts';
import { paraPixels } from './palco.ts';

/** URL da referência, ou null se ela não resolve: o objeto continua clicável, só sem desenho. */
function urlDaImagem(ref: string | null, baseUrlApi: string): string | null {
  if (ref === null) return null;
  try {
    return resolverImagem(ref as RefImagem, baseUrlApi);
  } catch {
    return null;
  }
}

/** Imagens decodificadas uma vez por URL. */
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

function ordemDeDesenho(objetos: readonly ObjetoJogo[]): ObjetoJogo[] {
  return objetos
    .map((objeto, indice) => ({ objeto, indice }))
    .sort((a, b) => a.objeto.camada - b.objeto.camada || a.indice - b.indice)
    .map(({ objeto }) => objeto);
}

function Fundo({ parede, palco, baseUrlApi }: { parede: ParedeJogo; palco: Retangulo; baseUrlApi: string }) {
  const imagem = useImagem(urlDaImagem(parede.fundo, baseUrlApi));
  if (!parede.fundo) return null;
  return <ImagemKonva image={imagem} x={palco.x} y={palco.y} width={palco.largura} height={palco.altura} />;
}

/** Ícone de dica do legado (packages/player/recursos/icone-dica.png), resolvido pelo Vite. */
const URL_ICONE_DICA = new URL('../recursos/icone-dica.png', import.meta.url).href;
/** Lado do ícone em pixels, encostado no canto superior direito do objeto (RF-17). */
const LADO_ICONE_DICA = 32;

interface PropsObjeto {
  objeto: ObjetoJogo;
  palco: Retangulo;
  baseUrlApi: string;
  aoClicar: (objetoId: string) => void;
}

function Objeto({ objeto, palco, baseUrlApi, aoClicar }: PropsObjeto) {
  const imagem = useImagem(urlDaImagem(objeto.imagem, baseUrlApi));
  const r = paraPixels(objeto, palco);
  const clicavel = objeto.interacao.tipo !== 'decoracao';
  const aoAtivar = clicavel ? () => aoClicar(objeto.id) : undefined;
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

/** Ícone de dica: só existe para enigma com dica (RF-17, LAC-030). */
function IconeDica({ objeto, palco, aoVerDica }: { objeto: ObjetoJogo; palco: Retangulo; aoVerDica: (id: string) => void }) {
  const imagem = useImagem(URL_ICONE_DICA);
  const r = paraPixels(objeto, palco);
  const aoAtivar = () => aoVerDica(objeto.id);
  return (
    <ImagemKonva
      image={imagem}
      x={r.x + r.largura - LADO_ICONE_DICA}
      y={r.y}
      width={LADO_ICONE_DICA}
      height={LADO_ICONE_DICA}
      onClick={aoAtivar}
      onTap={aoAtivar}
    />
  );
}

function temDica(objeto: ObjetoJogo): boolean {
  return objeto.interacao.tipo === 'enigma' && objeto.interacao.dica !== undefined;
}

export function RenderizadorParede({ parede, palco, baseUrlApi, aoClicar, aoVerDica }: PropsRenderizadorParede) {
  const largura = palco.x * 2 + palco.largura;
  const altura = palco.y * 2 + palco.altura;
  return (
    <Stage width={largura} height={altura}>
      <Layer listening={false}>
        <Fundo parede={parede} palco={palco} baseUrlApi={baseUrlApi} />
      </Layer>
      <Layer>
        {ordemDeDesenho(parede.objetos).map((objeto) => (
          <Objeto key={objeto.id} objeto={objeto} palco={palco} baseUrlApi={baseUrlApi} aoClicar={aoClicar} />
        ))}
        {/* Ícones por cima de todos os objetos, para não ficarem cobertos. */}
        {parede.objetos.filter(temDica).map((objeto) => (
          <IconeDica key={`dica-${objeto.id}`} objeto={objeto} palco={palco} aoVerDica={aoVerDica ?? (() => {})} />
        ))}
      </Layer>
    </Stage>
  );
}
