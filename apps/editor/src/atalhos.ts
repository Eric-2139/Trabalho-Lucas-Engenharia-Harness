import type { AtalhoTeclado } from '../contrato/index.ts';

/**
 * RF-09: Ctrl+Z → 'desfazer'; Ctrl+Y → 'refazer' (Cmd no macOS). Qualquer outra combinação → null.
 * A tecla é comparada sem caixa (Caps Lock ligado gera 'Z'); com Shift não é atalho.
 * RF-05 (LAC-044): Delete ou Backspace sem Ctrl nem Cmd → 'excluir'.
 */
export const atalhoTeclado: AtalhoTeclado = (evento) => {
  const comCtrlOuCmd = evento.ctrlKey || evento.metaKey;
  if (!comCtrlOuCmd && (evento.key === 'Delete' || evento.key === 'Backspace')) return 'excluir';
  if (!comCtrlOuCmd || evento.shiftKey) return null;
  const tecla = evento.key.toLowerCase();
  if (tecla === 'z') return 'desfazer';
  if (tecla === 'y') return 'refazer';
  return null;
};
