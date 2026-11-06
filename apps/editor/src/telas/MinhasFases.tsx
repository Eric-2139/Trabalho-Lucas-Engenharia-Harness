/**
 * Tela "Minhas fases" (modulos-editor.md §5; RF-02, RF-14, PEND-018).
 * - Lista as fases do criador (`listarFases` ao montar); depois de cada ação aceita a lista é lida de novo.
 * - Cada item mostra o título num elemento próprio e os botões Abrir / Renomear / Duplicar / Excluir;
 *   fase publicada mostra "Publicada" dentro do item.
 * - Nova fase e Renomear abrem um único campo "Título" num <form>, confirmado com Enter.
 * - Excluir fase publicada pede confirmação num role="alertdialog" (Cancelar não muda nada);
 *   excluir é definitivo (ADR-002): não há desfazer, e Ctrl+Z não tem efeito nesta tela.
 * - Importar é um <input type="file">; o arquivo vai a `importarFase` sem alteração (RF-14).
 * - Recusas da Api aparecem num elemento role="alert" com o `erro` do ResultadoHttp.
 */
import type { ResumoFase } from '@math-scape/schema/contrato';
import { type ChangeEvent, type FormEvent, useCallback, useEffect, useId, useRef, useState } from 'react';
import type { PropsMinhasFases } from '../../contrato/telas.ts';
import { ROTULOS_EDITOR } from '../../contrato/telas.ts';

type EdicaoTitulo = { tipo: 'criar' } | { tipo: 'renomear'; id: string };

export function MinhasFases({ cliente, aoAbrir }: PropsMinhasFases) {
  const id = useId();
  const [fases, setFases] = useState<ResumoFase[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [edicao, setEdicao] = useState<EdicaoTitulo | null>(null);
  const [titulo, setTitulo] = useState('');
  const [aExcluir, setAExcluir] = useState<ResumoFase | null>(null);
  const montado = useRef(true);
  const ocupado = useRef(false);

  const carregar = useCallback(async (): Promise<void> => {
    const resultado = await cliente.listarFases();
    if (!montado.current) return;
    if (!resultado.ok) {
      setErro(resultado.erro);
      return;
    }
    setFases(resultado.valor);
  }, [cliente]);

  useEffect(() => {
    montado.current = true;
    void carregar();
    return () => {
      montado.current = false;
    };
  }, [carregar]);

  /** Executa uma ação na Api; se aceita, relê a lista. Devolve se foi aceita. */
  async function executar(acao: () => Promise<{ ok: true } | { ok: false; erro: string }>): Promise<boolean> {
    if (ocupado.current) return false;
    ocupado.current = true;
    setErro(null);
    try {
      const resultado = await acao();
      if (!montado.current) return false;
      if (!resultado.ok) {
        setErro(resultado.erro);
        return false;
      }
      await carregar();
      return true;
    } finally {
      ocupado.current = false;
    }
  }

  function abrirCampoTitulo(nova: EdicaoTitulo, inicial: string): void {
    setEdicao(nova);
    setTitulo(inicial);
  }

  async function aoEnviarTitulo(evento: FormEvent<HTMLFormElement>): Promise<void> {
    evento.preventDefault();
    if (!edicao) return;
    const alvo = edicao;
    const aceito = await executar(() =>
      alvo.tipo === 'criar' ? cliente.criarFase(titulo) : cliente.renomearFase(alvo.id, titulo),
    );
    if (aceito) {
      setEdicao(null);
      setTitulo('');
    }
  }

  function aoExcluir(fase: ResumoFase): void {
    if (fase.publicada) {
      setAExcluir(fase);
      return;
    }
    void executar(() => cliente.excluirFase(fase.id));
  }

  async function confirmarExclusao(): Promise<void> {
    const fase = aExcluir;
    setAExcluir(null);
    if (fase) await executar(() => cliente.excluirFase(fase.id));
  }

  async function aoEscolherArquivo(evento: ChangeEvent<HTMLInputElement>): Promise<void> {
    const campo = evento.target;
    const arquivo = campo.files?.[0];
    if (!arquivo) return;
    await executar(() => cliente.importarFase(arquivo));
    campo.value = '';
  }

  return (
    <main>
      <h1>Minhas fases</h1>

      <button type="button" onClick={() => abrirCampoTitulo({ tipo: 'criar' }, '')}>
        {ROTULOS_EDITOR.novaFase}
      </button>

      <label htmlFor={`${id}-importar`}>{ROTULOS_EDITOR.importar}</label>
      <input
        id={`${id}-importar`}
        type="file"
        accept="application/json,.json"
        onChange={(e) => void aoEscolherArquivo(e)}
      />

      {edicao ? (
        <form onSubmit={(e) => void aoEnviarTitulo(e)}>
          <label htmlFor={`${id}-titulo`}>{ROTULOS_EDITOR.titulo}</label>
          <input
            id={`${id}-titulo`}
            name="titulo"
            type="text"
            required
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
          />
          <button type="button" onClick={() => setEdicao(null)}>
            {ROTULOS_EDITOR.cancelar}
          </button>
        </form>
      ) : null}

      {erro !== null ? <p role="alert">{erro}</p> : null}

      <ul>
        {fases.map((fase) => (
          <li key={fase.id}>
            <span>{fase.titulo}</span>
            {fase.publicada ? <span>{ROTULOS_EDITOR.publicada}</span> : null}
            <button type="button" onClick={() => aoAbrir(fase.id)}>
              {ROTULOS_EDITOR.abrir}
            </button>
            <button type="button" onClick={() => abrirCampoTitulo({ tipo: 'renomear', id: fase.id }, fase.titulo)}>
              {ROTULOS_EDITOR.renomear}
            </button>
            <button type="button" onClick={() => void executar(() => cliente.duplicarFase(fase.id))}>
              {ROTULOS_EDITOR.duplicar}
            </button>
            <button type="button" onClick={() => aoExcluir(fase)}>
              {ROTULOS_EDITOR.excluir}
            </button>
          </li>
        ))}
      </ul>

      {aExcluir ? (
        <div role="alertdialog" aria-modal="true" aria-labelledby={`${id}-excluir-titulo`}>
          <p id={`${id}-excluir-titulo`}>
            {`Excluir a fase publicada "${aExcluir.titulo}"? Ela sai de Escolher Fase e não pode ser restaurada.`}
          </p>
          <button type="button" onClick={() => void confirmarExclusao()}>
            {ROTULOS_EDITOR.confirmar}
          </button>
          <button type="button" onClick={() => setAExcluir(null)}>
            {ROTULOS_EDITOR.cancelar}
          </button>
        </div>
      ) : null}
    </main>
  );
}
