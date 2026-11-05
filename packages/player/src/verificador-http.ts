/**
 * VerificadorHttp (modulos-player.md §1, ADR-003): o veredito vem sempre da Api por
 * `POST <baseUrlApi>/fases/:id/verificar`. Em modo 'teste', `?modo=teste` e o cookie da sessão.
 * 200 → corpo; 429 → Limitado; outro status ou erro de rede → rejeita.
 */
import type { CorpoVerificar, RespostaVerificarEnigma, RespostaVerificarPorta } from '@math-scape/schema/contrato';
import type { CriarVerificadorHttp, Limitado } from '../contrato/index.ts';

export const criarVerificadorHttp: CriarVerificadorHttp = ({ baseUrlApi, faseId, modo, fetch }) => {
  const buscar = fetch ?? globalThis.fetch;
  const url = `${baseUrlApi}/fases/${encodeURIComponent(faseId)}/verificar${modo === 'teste' ? '?modo=teste' : ''}`;

  async function verificar<T>(objetoId: string, resposta: string): Promise<T | Limitado> {
    const corpo: CorpoVerificar = { objetoId, resposta };
    const http = await buscar(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(corpo),
      ...(modo === 'teste' ? { credentials: 'include' as const } : {}),
    });

    if (http.status === 429) {
      const { tentarEmSegundos } = (await http.json()) as { tentarEmSegundos?: unknown };
      if (typeof tentarEmSegundos !== 'number') {
        throw new Error('verificar: 429 sem tentarEmSegundos');
      }
      return { limitado: true, tentarEmSegundos };
    }
    if (http.status !== 200) {
      throw new Error(`verificar: a Api respondeu ${http.status}`);
    }
    return (await http.json()) as T;
  }

  return {
    enigma: (objetoId, resposta) => verificar<RespostaVerificarEnigma>(objetoId, resposta),
    porta: (objetoId, senha) => verificar<RespostaVerificarPorta>(objetoId, senha),
  };
};
