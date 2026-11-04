/**
 * Assinaturas das funções exportadas por `@math-scape/schema` (contrato schema.md).
 * A implementação fica em `src/` (fase 4, agente 4) e é exportada com exatamente
 * estes tipos. Os testes (agente 3) leem só este arquivo, nunca `src/`.
 */
import type { Fase, FaseJogo, Objeto, RefImagem, TipoInteracao } from './fase.ts';

/** Erro de validação apontando o campo, para o editor e a Api mostrarem onde está o problema. */
export interface ErroValidacao {
  caminho: (string | number)[];
  mensagem: string;
}

export type ResultadoValidacao = { ok: true; fase: Fase } | { ok: false; erros: ErroValidacao[] };

/** RNF-09: recusa todo documento fora do schema. Nunca lança exceção. */
export type ValidarFase = (json: unknown) => ResultadoValidacao;

/**
 * RF-12: lista as posições da senha (1-based, em ordem crescente) que nenhum enigma revela.
 * Não confere porta (PEND-007). Ex.: senha "92139", enigmas revelando [1,3,4] → [2,5].
 */
export type ValidarJogabilidade = (fase: Fase) => { jogavel: boolean; posicoesSemEnigma: number[] };

/**
 * RNF-04, RF-17: remove `senha`, `respostas` e `revela`; acrescenta `tamanhoSenha`;
 * mantém `dica` e todo o resto (posição, imagem, ordem dos objetos) igual.
 */
export type ProjetarParaJogo = (fase: Fase) => FaseJogo;

/**
 * RF-02, RF-08, RNF-08: fase válida com o título dado, senha de 5 dígitos, uma porta
 * (`sprite:porta`, id "porta-1") na parede da frente e as demais paredes vazias.
 * Quem chama garante o título válido (a Api valida com CorpoCriarFase e responde 400 antes).
 */
export type FaseInicial = (titulo: string) => Fase;

/**
 * ADR-011: objeto válido com valores padrão para o tipo. Fala: "Nova fala". Enigma:
 * "Nova pergunta", respostas [0], revela []. Tamanho padrão do sprite no catálogo
 * (asset: 0,2 × 0,2), centralizado na parede, rotação 0, camada 0.
 * O `id` vem de quem chama (o editor usa crypto.randomUUID), para o pacote não depender de aleatoriedade.
 */
export type ObjetoPadrao = (tipo: TipoInteracao, imagem: RefImagem, id: string) => Objeto;

/**
 * RF-15, PEND-008, ADR-003: true se o texto contém exatamente um número e ele é igual a
 * alguma resposta cadastrada. Sinal aceito; vírgula ou ponto como separador decimal; sem
 * separador de milhar. " 80 ", "080", "80,0", "80 graus" → 80; "1.000" → 1;
 * "oitenta", "" ou "80 ou 90" → false.
 */
export type RespostaConfere = (digitada: string, cadastradas: number[]) => boolean;

/** RF-15, RF-08: compara a sequência de dígitos exata após remover espaços ("0123" ≠ "123"). */
export type SenhaConfere = (digitada: string, senha: string) => boolean;

/**
 * ADR-012: URL da imagem. `sprite:<id>` → "/sprites/<arquivo do catálogo>" (servido pelo próprio app);
 * `asset:<uuid>` → "<baseUrlApi>/assets/<uuid>". Lança erro para sprite fora do catálogo.
 */
export type ResolverImagem = (ref: RefImagem, baseUrlApi: string) => string;

/** ADR-010, ADR-013: uuids de todas as referências `asset:` da fase, sem repetição, na ordem em que aparecem. */
export type ReferenciasDeAsset = (fase: Fase) => string[];

export type ResultadoEnvelope =
  | { ok: true; fase: Fase; imagens: Record<string, string> }
  | { ok: false; erros: ErroValidacao[] };

/**
 * RF-14, ADR-013: valida o envelope e a fase dentro dele. Recusa também imagem `asset:` usada
 * na fase sem entrada em `imagens` e entrada em `imagens` que a fase não usa.
 * Não confere o conteúdo binário das imagens: isso é da Api (tipo pelos bytes, até 5 MB).
 * Caminhos dos erros (LAC-040), sempre a partir da raiz do envelope:
 * - estrutura do envelope: o caminho do campo (["formato"], ["imagens", "<chave>"]...);
 * - fase embutida: prefixo "fase" + caminho dentro da fase (["fase", "paredes", "frente", "objetos", 0, "x"]);
 * - imagem usada sem entrada: { caminho: ["imagens", "<uuid>"], mensagem: 'A imagem asset:<uuid> é usada na fase, mas não está no arquivo.' };
 * - entrada sem uso: { caminho: ["imagens", "<uuid>"], mensagem: 'A imagem <uuid> está no arquivo, mas a fase não a usa.' }.
 * A fase só é conferida se a estrutura do envelope passar; as imagens, só se a fase passar.
 */
export type ValidarEnvelope = (json: unknown) => ResultadoEnvelope;
