/**
 * RF-07, RNF-09: valida um documento contra o schema único da fase.
 * Nunca lança: qualquer exceção vira recusa com erro na raiz.
 */
import { Envelope, Fase } from '../contrato/fase.ts';
import type { ErroValidacao, ResultadoEnvelope, ResultadoValidacao } from '../contrato/funcoes.ts';
import { referenciasDeAsset } from './imagens.ts';

function paraCaminho(caminho: readonly PropertyKey[]): (string | number)[] {
  return caminho.map((parte) => (typeof parte === 'number' ? parte : String(parte)));
}

function erroNaRaiz(erro: unknown): ErroValidacao[] {
  const mensagem = erro instanceof Error ? erro.message : 'Documento inválido.';
  return [{ caminho: [], mensagem }];
}

export function validarFase(json: unknown): ResultadoValidacao {
  try {
    const resultado = Fase.safeParse(json);
    if (resultado.success) {
      return { ok: true, fase: resultado.data };
    }
    const erros: ErroValidacao[] = resultado.error.issues.map((issue) => ({
      caminho: paraCaminho(issue.path),
      mensagem: issue.message,
    }));
    return { ok: false, erros };
  } catch (erro) {
    return { ok: false, erros: erroNaRaiz(erro) };
  }
}

/**
 * RF-14, RNF-09, ADR-013: valida o envelope, depois a fase embutida (erros com prefixo "fase")
 * e, por último, a correspondência exata entre as imagens `asset:` da fase e as de `imagens` (LAC-040).
 */
export function validarEnvelope(json: unknown): ResultadoEnvelope {
  try {
    const envelope = Envelope.safeParse(json);
    if (!envelope.success) {
      const erros: ErroValidacao[] = envelope.error.issues.map((issue) => ({
        caminho: paraCaminho(issue.path),
        mensagem: issue.message,
      }));
      return { ok: false, erros };
    }

    const fase = validarFase(envelope.data.fase);
    if (!fase.ok) {
      const erros = fase.erros.map((erro) => ({ caminho: ['fase', ...erro.caminho], mensagem: erro.mensagem }));
      return { ok: false, erros };
    }

    const imagens = envelope.data.imagens;
    const usadas = referenciasDeAsset(fase.fase);
    const erros: ErroValidacao[] = [];
    for (const uuid of usadas) {
      if (!Object.hasOwn(imagens, uuid)) {
        erros.push({
          caminho: ['imagens', uuid],
          mensagem: `A imagem asset:${uuid} é usada na fase, mas não está no arquivo.`,
        });
      }
    }
    for (const uuid of Object.keys(imagens)) {
      if (!usadas.includes(uuid)) {
        erros.push({ caminho: ['imagens', uuid], mensagem: `A imagem ${uuid} está no arquivo, mas a fase não a usa.` });
      }
    }
    if (erros.length > 0) {
      return { ok: false, erros };
    }
    return { ok: true, fase: fase.fase, imagens };
  } catch (erro) {
    return { ok: false, erros: erroNaRaiz(erro) };
  }
}
