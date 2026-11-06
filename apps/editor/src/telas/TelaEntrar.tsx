/**
 * Tela de login e cadastro (modulos-editor.md §5; RF-01, RNF-06, RNF-07, PEND-018).
 * Dois <form> nativos lado a lado: entrar (e-mail, senha) e cadastrar (nome, e-mail, senha).
 * Campos rotulados por <label>; Enter num campo envia o formulário (RNF-07).
 * Cadastro aceito é seguido de login com o mesmo e-mail e senha; `aoEntrar` só depois do login aceito.
 * Qualquer recusa da Api aparece num elemento role="alert" com o `erro` do ResultadoHttp.
 */
import { type FormEvent, useId, useRef, useState } from 'react';
import type { PropsTelaEntrar } from '../../contrato/telas.ts';
import { ROTULOS_EDITOR } from '../../contrato/telas.ts';

export function TelaEntrar({ cliente, aoEntrar }: PropsTelaEntrar) {
  const id = useId();
  const [erro, setErro] = useState<string | null>(null);
  const enviando = useRef(false);

  const [emailEntrar, setEmailEntrar] = useState('');
  const [senhaEntrar, setSenhaEntrar] = useState('');
  const [nome, setNome] = useState('');
  const [emailCadastro, setEmailCadastro] = useState('');
  const [senhaCadastro, setSenhaCadastro] = useState('');

  async function entrarCom(email: string, senha: string): Promise<void> {
    const resultado = await cliente.entrar(email, senha);
    if (!resultado.ok) {
      setErro(resultado.erro);
      return;
    }
    aoEntrar();
  }

  async function aoEnviarEntrar(evento: FormEvent<HTMLFormElement>): Promise<void> {
    evento.preventDefault();
    if (enviando.current) return;
    enviando.current = true;
    setErro(null);
    try {
      await entrarCom(emailEntrar, senhaEntrar);
    } finally {
      enviando.current = false;
    }
  }

  async function aoEnviarCadastro(evento: FormEvent<HTMLFormElement>): Promise<void> {
    evento.preventDefault();
    if (enviando.current) return;
    enviando.current = true;
    setErro(null);
    try {
      const cadastro = await cliente.cadastrar(nome, emailCadastro, senhaCadastro);
      if (!cadastro.ok) {
        setErro(cadastro.erro);
        return;
      }
      await entrarCom(emailCadastro, senhaCadastro);
    } finally {
      enviando.current = false;
    }
  }

  return (
    <main>
      <form aria-labelledby={`${id}-titulo-entrar`} onSubmit={(e) => void aoEnviarEntrar(e)}>
        <h2 id={`${id}-titulo-entrar`}>{ROTULOS_EDITOR.entrar}</h2>
        <label htmlFor={`${id}-entrar-email`}>{ROTULOS_EDITOR.email}</label>
        <input
          id={`${id}-entrar-email`}
          name="email"
          type="email"
          autoComplete="email"
          required
          value={emailEntrar}
          onChange={(e) => setEmailEntrar(e.target.value)}
        />
        <label htmlFor={`${id}-entrar-senha`}>{ROTULOS_EDITOR.senha}</label>
        <input
          id={`${id}-entrar-senha`}
          name="senha"
          type="password"
          autoComplete="current-password"
          required
          value={senhaEntrar}
          onChange={(e) => setSenhaEntrar(e.target.value)}
        />
        <button type="submit">{ROTULOS_EDITOR.entrar}</button>
      </form>

      <form aria-labelledby={`${id}-titulo-cadastrar`} onSubmit={(e) => void aoEnviarCadastro(e)}>
        <h2 id={`${id}-titulo-cadastrar`}>{ROTULOS_EDITOR.cadastrar}</h2>
        <label htmlFor={`${id}-cadastro-nome`}>{ROTULOS_EDITOR.nome}</label>
        <input
          id={`${id}-cadastro-nome`}
          name="nome"
          type="text"
          autoComplete="name"
          required
          value={nome}
          onChange={(e) => setNome(e.target.value)}
        />
        <label htmlFor={`${id}-cadastro-email`}>{ROTULOS_EDITOR.email}</label>
        <input
          id={`${id}-cadastro-email`}
          name="email"
          type="email"
          autoComplete="email"
          required
          value={emailCadastro}
          onChange={(e) => setEmailCadastro(e.target.value)}
        />
        <label htmlFor={`${id}-cadastro-senha`}>{ROTULOS_EDITOR.senha}</label>
        <input
          id={`${id}-cadastro-senha`}
          name="senha"
          type="password"
          autoComplete="new-password"
          required
          value={senhaCadastro}
          onChange={(e) => setSenhaCadastro(e.target.value)}
        />
        <button type="submit">{ROTULOS_EDITOR.cadastrar}</button>
      </form>

      {erro !== null ? <p role="alert">{erro}</p> : null}
    </main>
  );
}
