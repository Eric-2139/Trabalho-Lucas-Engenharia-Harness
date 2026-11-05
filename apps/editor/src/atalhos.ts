import type { AtalhoTeclado } from '../contrato/index.ts';

/**
 * RF-09: Ctrl+Z → 'desfazer'; Ctrl+Y → 'refazer' (Cmd no macOS). Qualquer outra combinação → null.
 * A tecla é comparada sem caixa (Caps Lock ligado gera 'Z'); com Shift não é atalho.
 */
export const atalhoTeclado: AtalhoTeclado = (evento) => {
  if (!(evento.ctrlKey || evento.metaKey) || evento.shiftKey) return null;
  const tecla = evento.key.toLowerCase();
  if (tecla === 'z') return 'desfazer';
  if (tecla === 'y') return 'refazer';
  return null;
};
