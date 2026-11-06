/**
 * BibliotecaObjetos (modulos-editor.md §4, LAC-029, ADR-012, RF-04, RF-06, PEND-017): três seções `role="region"`.
 * - Objetos: sprites de categoria 'objeto'; o botão (clique ou Enter) chama `aoEscolher('sprite:<id>', 'objeto')`.
 * - Fundos: sprites de categoria 'fundo' e "Sem fundo" (`aoEscolher(null, 'fundo')`).
 * - Minhas imagens: um par usar como objeto / usar como fundo por referência, na ordem de `imagensEnviadas`, e o
 *   campo de envio, que só entrega o arquivo a `aoEnviarImagem`. A imagem entra na lista quando o pai a acrescenta
 *   (a Api aceitou); formato e tamanho são decididos pela Api (RF-06), e a recusa é mostrada pela tela de edição.
 */
import type { RefImagem, SpriteCatalogo } from '@math-scape/schema/contrato';
import { type ChangeEvent, type ReactNode, useId } from 'react';
import { type PropsBibliotecaObjetos, ROTULOS_EDITOR, TIPO_ARRASTE_BIBLIOTECA } from '../../contrato/index.ts';

const TIPOS_ACEITOS = 'image/png,image/jpeg,image/webp';

function Secao({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id}>
      <h3 id={id}>{rotulo}</h3>
      {children}
    </section>
  );
}

function refSprite(sprite: SpriteCatalogo): RefImagem {
  return `sprite:${sprite.id}`;
}

export function BibliotecaObjetos({ catalogo, imagensEnviadas, aoEscolher, aoEnviarImagem }: PropsBibliotecaObjetos) {
  const idEnvio = useId();
  const objetos = catalogo.filter((sprite) => sprite.categoria === 'objeto');
  const fundos = catalogo.filter((sprite) => sprite.categoria === 'fundo');

  function aoSelecionarArquivo(evento: ChangeEvent<HTMLInputElement>): void {
    const campo = evento.currentTarget;
    const arquivo = campo.files?.[0];
    if (arquivo) aoEnviarImagem(arquivo);
    // Permite enviar de novo o mesmo arquivo (ex.: depois de uma recusa).
    campo.value = '';
  }

  return (
    <div>
      <Secao rotulo={ROTULOS_EDITOR.objetos}>
        <ul>
          {objetos.map((sprite) => (
            <li key={sprite.id}>
              <button
                type="button"
                draggable
                onDragStart={(evento) => {
                  // LAC-045: quem recebe é o palco (CanvasParede.aoSoltar); o arraste não chama aoEscolher.
                  evento.dataTransfer.setData(TIPO_ARRASTE_BIBLIOTECA, refSprite(sprite));
                  evento.dataTransfer.effectAllowed = 'copy';
                }}
                onClick={() => aoEscolher(refSprite(sprite), 'objeto')}
              >
                {sprite.nome}
              </button>
            </li>
          ))}
        </ul>
      </Secao>

      <Secao rotulo={ROTULOS_EDITOR.fundos}>
        <ul>
          <li>
            <button type="button" onClick={() => aoEscolher(null, 'fundo')}>
              {ROTULOS_EDITOR.semFundo}
            </button>
          </li>
          {fundos.map((sprite) => (
            <li key={sprite.id}>
              <button type="button" onClick={() => aoEscolher(refSprite(sprite), 'fundo')}>
                {sprite.nome}
              </button>
            </li>
          ))}
        </ul>
      </Secao>

      <Secao rotulo={ROTULOS_EDITOR.minhasImagens}>
        <ul>
          {imagensEnviadas.map((ref, indice) => (
            <li key={ref}>
              <span>{`Imagem ${indice + 1}`}</span>
              <button type="button" onClick={() => aoEscolher(ref, 'objeto')}>
                {ROTULOS_EDITOR.usarComoObjeto}
              </button>
              <button type="button" onClick={() => aoEscolher(ref, 'fundo')}>
                {ROTULOS_EDITOR.usarComoFundo}
              </button>
            </li>
          ))}
        </ul>
        <label htmlFor={idEnvio}>{ROTULOS_EDITOR.enviarImagem}</label>
        <input id={idEnvio} type="file" accept={TIPOS_ACEITOS} onChange={aoSelecionarArquivo} />
      </Secao>
    </div>
  );
}
