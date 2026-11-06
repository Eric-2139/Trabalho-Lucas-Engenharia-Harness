/**
 * Tela "Conta" (modulos-editor.md §5; RF-19, PEND-018).
 * - O botão "Excluir conta" abre a confirmação num role="alertdialog" (nunca window.confirm).
 * - Cancelar fecha o diálogo sem chamar a Api: a conta continua.
 * - Confirmar chama `excluirConta`; só a resposta aceita chama `aoExcluirConta` (o app volta ao login).
 * - Recusa da Api (inclusive sem resposta do servidor) aparece num role="alert" e a tela continua.
 */
import { useEffect, useId, useRef, useState } from 'react';
import type { PropsTelaConta } from '../../contrato/telas.ts';
import { ROTULOS_EDITOR } from '../../contrato/telas.ts';

export function TelaConta({ cliente, aoExcluirConta }: PropsTelaConta) {
  const id = useId();
  const [confirmando, setConfirmando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const montado = useRef(true);
  const ocupado = useRef(false);

  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);

  async function confirmarExclusao(): Promise<void> {
    setConfirmando(false);
    if (ocupado.current) return;
    ocupado.current = true;
    setErro(null);
    try {
      const resultado = await cliente.excluirConta();
      if (!montado.current) return;
      if (!resultado.ok) {
        setErro(resultado.erro);
        return;
      }
      aoExcluirConta();
    } finally {
      ocupado.current = false;
    }
  }

  return (
    <main>
      <h1>Conta</h1>

      <button type="button" onClick={() => setConfirmando(true)}>
        {ROTULOS_EDITOR.excluirConta}
      </button>

      {erro !== null ? <p role="alert">{erro}</p> : null}

      {confirmando ? (
        <div role="alertdialog" aria-modal="true" aria-labelledby={`${id}-excluir-titulo`}>
          <p id={`${id}-excluir-titulo`}>
            Excluir a sua conta? Nome, e-mail, senha e fases são apagados e não podem ser restaurados.
          </p>
          <button type="button" onClick={() => void confirmarExclusao()}>
            {ROTULOS_EDITOR.confirmar}
          </button>
          <button type="button" onClick={() => setConfirmando(false)}>
            {ROTULOS_EDITOR.cancelar}
          </button>
        </div>
      ) : null}
    </main>
  );
}
