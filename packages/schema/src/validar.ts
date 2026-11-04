/**
 * RF-07, RNF-09: valida um documento contra o schema único da fase.
 * Nunca lança: qualquer exceção vira recusa com erro na raiz.
 */
import { Fase } from '../contrato/fase.ts';
import type { ErroValidacao, ResultadoValidacao } from '../contrato/funcoes.ts';

function paraCaminho(caminho: readonly PropertyKey[]): (string | number)[] {
  return caminho.map((parte) => (typeof parte === 'number' ? parte : String(parte)));
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
    const mensagem = erro instanceof Error ? erro.message : 'Documento inválido.';
    return { ok: false, erros: [{ caminho: [], mensagem }] };
  }
}
