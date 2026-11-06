/**
 * Painel de propriedades (modulos-editor.md §4; RF-07, RF-08, ADR-011, PEND-007, PEND-017).
 * Edita num rascunho local; o botão Aplicar só chama o store com valores que passaram na verificação do painel,
 * e o store ainda valida o documento inteiro (validarFase). Qualquer recusa aparece em `role="alert"`.
 * Sem objeto selecionado: "Propriedades da fase" (título e senha).
 */
import { type Interacao, LIMITES, TIPOS_INTERACAO, type TipoInteracao } from '@math-scape/schema/contrato';
import { type FormEvent, useId, useState } from 'react';
import type { PropsPainelPropriedades } from '../../contrato/componentes.ts';
import type { ResultadoAcao } from '../../contrato/store.ts';
import { ROTULOS_EDITOR } from '../../contrato/telas.ts';

const NOMES_TIPO: Record<TipoInteracao, string> = {
  decoracao: 'Decoração',
  fala: 'Fala',
  enigma: 'Enigma',
  porta: 'Porta',
};

const PADRAO_SENHA = new RegExp(`^\\d{${LIMITES.senhaMin},${LIMITES.senhaMax}}$`);
const PADRAO_NUMERO = /^[-+]?\d+(?:[.,]\d+)?$/;
const MSG_SENHA_INVALIDA = `A senha deve ter de ${LIMITES.senhaMin} a ${LIMITES.senhaMax} dígitos, só números.`;
const MSG_SEM_RESPOSTA = 'O enigma precisa de ao menos uma resposta.';

interface Rascunho {
  tipo: TipoInteracao;
  texto: string;
  pergunta: string;
  /** Uma resposta por linha. */
  respostas: string;
  dica: string;
  revela: number[];
  titulo: string;
  senha: string;
}

function rascunhoInicial(props: PropsPainelPropriedades): Rascunho {
  const interacao = props.objeto?.interacao;
  return {
    tipo: interacao?.tipo ?? 'decoracao',
    texto: interacao?.tipo === 'fala' ? interacao.texto : '',
    pergunta: interacao?.tipo === 'enigma' ? interacao.pergunta : '',
    respostas: interacao?.tipo === 'enigma' ? interacao.respostas.join('\n') : '',
    dica: interacao?.tipo === 'enigma' ? (interacao.dica ?? '') : '',
    revela: interacao?.tipo === 'enigma' ? [...interacao.revela] : [],
    titulo: props.fase.titulo,
    senha: props.fase.senha,
  };
}

/** Identifica a origem do rascunho: quando o objeto ou a fase mudam no store, o rascunho recomeça. */
function origemDe(props: PropsPainelPropriedades): string {
  return JSON.stringify([props.objeto?.id ?? null, props.objeto?.interacao ?? null, props.fase.titulo, props.fase.senha]);
}

type Conversao<T> = { ok: true; valor: T } | { ok: false; erro: string };

function converterRespostas(texto: string): Conversao<number[]> {
  const linhas = texto
    .split('\n')
    .map((linha) => linha.trim())
    .filter((linha) => linha !== '');
  if (linhas.length === 0) return { ok: false, erro: MSG_SEM_RESPOSTA };
  const respostas: number[] = [];
  for (const linha of linhas) {
    const valor = Number(linha.replace(',', '.'));
    if (!PADRAO_NUMERO.test(linha) || !Number.isFinite(valor)) {
      return { ok: false, erro: `A resposta "${linha}" não é um número.` };
    }
    respostas.push(valor);
  }
  return { ok: true, valor: respostas };
}

function montarInteracao(rascunho: Rascunho): Conversao<Interacao> {
  switch (rascunho.tipo) {
    case 'decoracao':
      return { ok: true, valor: { tipo: 'decoracao' } };
    case 'porta':
      return { ok: true, valor: { tipo: 'porta' } };
    case 'fala':
      return { ok: true, valor: { tipo: 'fala', texto: rascunho.texto } };
    case 'enigma': {
      const respostas = converterRespostas(rascunho.respostas);
      if (!respostas.ok) return respostas;
      const dica = rascunho.dica.trim() === '' ? {} : { dica: rascunho.dica };
      const revela = [...rascunho.revela].sort((a, b) => a - b);
      return { ok: true, valor: { tipo: 'enigma', pergunta: rascunho.pergunta, respostas: respostas.valor, ...dica, revela } };
    }
  }
}

function mensagemDe(resultado: ResultadoAcao): string | null {
  if (resultado.ok) return null;
  return resultado.erros.map((erro) => erro.mensagem).join(' ');
}

export function PainelPropriedades(props: PropsPainelPropriedades) {
  const { objeto, fase, store } = props;
  const id = useId();
  const origem = origemDe(props);
  const [origemAtual, setOrigemAtual] = useState(origem);
  const [rascunho, setRascunho] = useState<Rascunho>(() => rascunhoInicial(props));
  const [erro, setErro] = useState<string | null>(null);

  // Ajuste durante a renderização (padrão do React): objeto ou fase mudaram no store → rascunho novo.
  if (origemAtual !== origem) {
    setOrigemAtual(origem);
    setRascunho(rascunhoInicial(props));
    setErro(null);
  }

  function alterar<K extends keyof Rascunho>(campo: K, valor: Rascunho[K]): void {
    setRascunho((atual) => ({ ...atual, [campo]: valor }));
  }

  function alternarPosicao(posicao: number): void {
    setRascunho((atual) => ({
      ...atual,
      revela: atual.revela.includes(posicao) ? atual.revela.filter((p) => p !== posicao) : [...atual.revela, posicao],
    }));
  }

  function aplicarSenhaETitulo(propriedades: { titulo?: string; senha?: string }): string | null {
    if (propriedades.senha !== undefined && !PADRAO_SENHA.test(propriedades.senha)) return MSG_SENHA_INVALIDA;
    if (propriedades.titulo === undefined && propriedades.senha === undefined) return null;
    return mensagemDe(store.getState().alterarPropriedadesFase(propriedades));
  }

  function aplicar(evento: FormEvent): void {
    evento.preventDefault();
    if (objeto === null) {
      const mudancas = {
        ...(rascunho.titulo !== fase.titulo ? { titulo: rascunho.titulo } : {}),
        ...(rascunho.senha !== fase.senha ? { senha: rascunho.senha } : {}),
      };
      setErro(aplicarSenhaETitulo(mudancas));
      return;
    }

    const interacao = montarInteracao(rascunho);
    if (!interacao.ok) {
      setErro(interacao.erro);
      return;
    }
    const mudaSenha = rascunho.tipo === 'porta' && rascunho.senha !== fase.senha;
    if (mudaSenha && !PADRAO_SENHA.test(rascunho.senha)) {
      setErro(MSG_SENHA_INVALIDA);
      return;
    }
    if (JSON.stringify(interacao.valor) !== JSON.stringify(objeto.interacao)) {
      const recusa = mensagemDe(store.getState().alterarInteracao(objeto.id, interacao.valor));
      if (recusa !== null) {
        setErro(recusa);
        return;
      }
    }
    setErro(mudaSenha ? aplicarSenhaETitulo({ senha: rascunho.senha }) : null);
  }

  const campoSenha = (
    <p>
      <label htmlFor={`${id}-senha`}>{ROTULOS_EDITOR.senha}</label>
      <input
        id={`${id}-senha`}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={rascunho.senha}
        onChange={(e) => alterar('senha', e.target.value)}
      />
    </p>
  );

  if (objeto === null) {
    return (
      <form aria-labelledby={`${id}-titulo-painel`} onSubmit={aplicar}>
        <h2 id={`${id}-titulo-painel`}>{ROTULOS_EDITOR.propriedadesDaFase}</h2>
        <p>
          <label htmlFor={`${id}-titulo`}>{ROTULOS_EDITOR.titulo}</label>
          <input
            id={`${id}-titulo`}
            type="text"
            value={rascunho.titulo}
            onChange={(e) => alterar('titulo', e.target.value)}
          />
        </p>
        {campoSenha}
        {erro !== null && <p role="alert">{erro}</p>}
        <button type="submit">{ROTULOS_EDITOR.aplicar}</button>
      </form>
    );
  }

  const posicoes = Array.from({ length: fase.senha.length }, (_, indice) => indice + 1);

  return (
    <form onSubmit={aplicar}>
      <p>
        <label htmlFor={`${id}-tipo`}>{ROTULOS_EDITOR.tipo}</label>
        <select
          id={`${id}-tipo`}
          value={rascunho.tipo}
          onChange={(e) => alterar('tipo', e.target.value as TipoInteracao)}
        >
          {TIPOS_INTERACAO.map((tipo) => (
            <option key={tipo} value={tipo}>
              {NOMES_TIPO[tipo]}
            </option>
          ))}
        </select>
      </p>

      {rascunho.tipo === 'fala' && (
        <p>
          <label htmlFor={`${id}-texto`}>{ROTULOS_EDITOR.texto}</label>
          <textarea id={`${id}-texto`} value={rascunho.texto} onChange={(e) => alterar('texto', e.target.value)} />
        </p>
      )}

      {rascunho.tipo === 'enigma' && (
        <>
          <p>
            <label htmlFor={`${id}-pergunta`}>{ROTULOS_EDITOR.pergunta}</label>
            <textarea
              id={`${id}-pergunta`}
              value={rascunho.pergunta}
              onChange={(e) => alterar('pergunta', e.target.value)}
            />
          </p>
          <p>
            <label htmlFor={`${id}-respostas`}>{ROTULOS_EDITOR.respostas}</label>
            <textarea
              id={`${id}-respostas`}
              value={rascunho.respostas}
              onChange={(e) => alterar('respostas', e.target.value)}
            />
          </p>
          <p>
            <label htmlFor={`${id}-dica`}>{ROTULOS_EDITOR.dica}</label>
            <textarea id={`${id}-dica`} value={rascunho.dica} onChange={(e) => alterar('dica', e.target.value)} />
          </p>
          <fieldset>
            <legend>Posições da senha reveladas ao acertar</legend>
            {posicoes.map((posicao) => (
              <label key={posicao}>
                <input
                  type="checkbox"
                  checked={rascunho.revela.includes(posicao)}
                  onChange={() => alternarPosicao(posicao)}
                />
                {`Posição ${posicao}`}
              </label>
            ))}
          </fieldset>
        </>
      )}

      {rascunho.tipo === 'porta' && campoSenha}

      {erro !== null && <p role="alert">{erro}</p>}
      <button type="submit">{ROTULOS_EDITOR.aplicar}</button>
    </form>
  );
}
