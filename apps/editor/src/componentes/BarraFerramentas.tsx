/**
 * Barra de ferramentas do editor (modulos-editor.md §4; RF-09, RF-10, RF-13, RF-14, RNF-07, PEND-005, PEND-017).
 * Só botões nativos: Tab chega a cada um, Enter/Espaço ativam, e o desabilitado sai do Tab (RNF-07).
 * O foco visível vem do :focus-visible do tema.
 * O indicador mostra só o texto do estado de salvamento atual. Com `alteracoesNaoPublicadas`, aparecem o aviso
 * e o botão "Publicar de novo", que chama `aoPublicar`.
 */
import type { PropsBarraFerramentas } from '../../contrato/componentes.ts';
import { ROTULOS_EDITOR } from '../../contrato/telas.ts';

export function BarraFerramentas(props: PropsBarraFerramentas) {
  return (
    <div role="toolbar" aria-label="Ferramentas">
      <button type="button" onClick={props.aoDesfazer} disabled={!props.podeDesfazer}>
        {ROTULOS_EDITOR.desfazer}
      </button>
      <button type="button" onClick={props.aoRefazer} disabled={!props.podeRefazer}>
        {ROTULOS_EDITOR.refazer}
      </button>
      <button type="button" onClick={props.aoSalvar}>
        {ROTULOS_EDITOR.salvar}
      </button>
      <span role="status">{ROTULOS_EDITOR.estadoSalvamento[props.estadoSalvamento]}</span>
      <button type="button" onClick={props.aoTestar}>
        {ROTULOS_EDITOR.testar}
      </button>
      <button type="button" onClick={props.aoPublicar}>
        {ROTULOS_EDITOR.publicar}
      </button>
      <button type="button" onClick={props.aoExportar}>
        {ROTULOS_EDITOR.exportar}
      </button>
      {props.alteracoesNaoPublicadas ? (
        <>
          <span>{ROTULOS_EDITOR.alteracoesNaoPublicadas}</span>
          <button type="button" onClick={props.aoPublicar}>
            {ROTULOS_EDITOR.publicarDeNovo}
          </button>
        </>
      ) : null}
    </div>
  );
}
