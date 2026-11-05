/**
 * Requisição HTTP que nunca rejeita (LAC-038): traduz a resposta, ou a falta dela, em ResultadoHttp.
 * Genérico: os clientes de Api do app só montam a URL e o método.
 */
import type { ResultadoHttp } from '../contrato/index.ts';
import { mensagens } from './mensagens.ts';

type Fetch = typeof globalThis.fetch;

/** Lê o corpo como JSON; corpo vazio vira undefined; corpo que não é JSON vira o marcador NAO_JSON. */
const NAO_JSON = Symbol('nao-json');

async function lerCorpo(resposta: Response): Promise<unknown> {
  let texto: string;
  try {
    texto = await resposta.text();
  } catch {
    return NAO_JSON;
  }
  if (texto.trim() === '') return undefined;
  try {
    return JSON.parse(texto) as unknown;
  } catch {
    return NAO_JSON;
  }
}

function erroDoServidor(status: number): ResultadoHttp<never> {
  return { ok: false, status, erro: `Erro ${status} do servidor.` };
}

function temErro(corpo: unknown): corpo is { erro: string; detalhes?: unknown } {
  return typeof corpo === 'object' && corpo !== null && typeof (corpo as { erro?: unknown }).erro === 'string';
}

export async function requisitar<T>(fetch: Fetch, url: string, init?: RequestInit): Promise<ResultadoHttp<T>> {
  let resposta: Response;
  try {
    resposta = await fetch(url, init);
  } catch {
    return { ok: false, status: 0, erro: mensagens.http.semRede };
  }

  const corpo = await lerCorpo(resposta);

  if (resposta.ok) {
    if (corpo === NAO_JSON) return erroDoServidor(resposta.status);
    return { ok: true, valor: corpo as T };
  }

  if (temErro(corpo)) {
    return 'detalhes' in corpo
      ? { ok: false, status: resposta.status, erro: corpo.erro, detalhes: corpo.detalhes }
      : { ok: false, status: resposta.status, erro: corpo.erro };
  }
  return erroDoServidor(resposta.status);
}

/** fetch padrão, chamado sem perder o `this` do globalThis. */
export function fetchPadrao(fetch?: Fetch): Fetch {
  return fetch ?? ((entrada, init) => globalThis.fetch(entrada, init));
}
