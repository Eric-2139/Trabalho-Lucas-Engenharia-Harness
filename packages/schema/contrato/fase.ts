/**
 * Schema da fase (ADR-001): o contrato entre Editor, Player e Api.
 * Revisão campo a campo: harness/projeto/programa/modulos-schema.md.
 *
 * Regras gerais deste arquivo:
 * - Todo objeto é estrito: campo desconhecido recusa (RF-07: decoração com fala é recusada).
 * - Sem transformações nem valores padrão: o que passa na validação sai igual ao que entrou.
 *   Exportar e importar o mesmo arquivo gera fase igual (RF-14), e o store do editor
 *   compara documentos sem surpresa (ADR-011). Valores padrão ficam em `objetoPadrao`
 *   e `faseInicial`.
 * - Mensagens em português: o editor as mostra ao criador.
 */
import { z } from 'zod';
import { spriteDoCatalogo, type CategoriaSprite } from '../biblioteca/catalogo.ts';

// Mensagens padrão do Zod em português (RNF-07): valem para todo o processo que importa o schema.
z.config(z.locales.ptBR());

export const PAREDES = ['frente', 'direita', 'fundo', 'esquerda', 'teto'] as const;
export const ParedeId = z.enum(PAREDES);
export type ParedeId = z.infer<typeof ParedeId>;

export const TIPOS_INTERACAO = ['decoracao', 'fala', 'enigma', 'porta'] as const;
export type TipoInteracao = (typeof TIPOS_INTERACAO)[number];

/** Limites de projeto (não vêm de requisito; ver modulos-schema.md, D-03). */
export const LIMITES = {
  tituloMax: 80,
  textoMax: 1000,
  respostasMax: 10,
  senhaMin: 4,
  senhaMax: 8,
  senhaPadrao: 5,
  idObjetoMax: 64,
} as const;

const PADRAO_UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
export const PADRAO_REF_ASSET = new RegExp(`^asset:(${PADRAO_UUID})$`);
const PADRAO_REF_SPRITE = /^sprite:([a-z0-9-]+)$/;

function textoNaoVazio(campo: string, max: number) {
  return z
    .string(`${campo} deve ser texto`)
    .max(max, `${campo} aceita no máximo ${max} caracteres`)
    .refine((valor) => valor.trim().length > 0, `${campo} não pode ficar vazio`);
}

/**
 * Referência de imagem (ADR-012): `sprite:<id do catálogo>` ou `asset:<uuid>`.
 * Sprite de fundo só vai em fundo de parede; sprite de objeto só em objeto.
 */
function refImagem(categoria: CategoriaSprite) {
  return z.string('imagem deve ser uma referência').refine(
    (ref) => {
      if (PADRAO_REF_ASSET.test(ref)) return true;
      const sprite = PADRAO_REF_SPRITE.exec(ref);
      return Boolean(sprite?.[1] && spriteDoCatalogo(sprite[1])?.categoria === categoria);
    },
    `imagem deve ser "asset:<uuid>" ou "sprite:<id>" de ${categoria === 'fundo' ? 'fundo' : 'objeto'} do catálogo`,
  );
}
export const RefImagemObjeto = refImagem('objeto');
export const RefImagemFundo = refImagem('fundo');
export type RefImagem = `sprite:${string}` | `asset:${string}`;

/** Posição e tamanho relativos à parede (ADR-006, RNF-02). */
const coordenada = (campo: string) =>
  z.number(`${campo} deve ser número`).min(0, `${campo} mínimo é 0`).max(1, `${campo} máximo é 1`);
const tamanho = (campo: string) =>
  z.number(`${campo} deve ser número`).gt(0, `${campo} deve ser maior que 0`).max(1, `${campo} máximo é 1`);

export const InteracaoDecoracao = z.strictObject({ tipo: z.literal('decoracao') });
export const InteracaoFala = z.strictObject({
  tipo: z.literal('fala'),
  texto: textoNaoVazio('texto da fala', LIMITES.textoMax),
});
export const InteracaoEnigma = z.strictObject({
  tipo: z.literal('enigma'),
  pergunta: textoNaoVazio('pergunta', LIMITES.textoMax),
  /** Respostas numéricas (PEND-008); um enigma pode ter mais de uma (RF-08, fundo da Escola: -15 ou 80). */
  respostas: z
    .array(z.number('resposta deve ser um número'), 'respostas deve ser uma lista')
    .min(1, 'o enigma precisa de ao menos uma resposta')
    .max(LIMITES.respostasMax, `no máximo ${LIMITES.respostasMax} respostas`),
  /** Sem dica, o player não mostra o ícone (RF-17). */
  dica: textoNaoVazio('dica', LIMITES.textoMax).optional(),
  /** Posições da senha (1-based) reveladas ao acertar; pode ser vazio (RF-08, parede esquerda da Escola). */
  revela: z
    .array(
      z.number().int('posição deve ser inteira').min(1, 'posição mínima é 1').max(LIMITES.senhaMax),
      'revela deve ser uma lista',
    )
    .refine((posicoes) => new Set(posicoes).size === posicoes.length, 'uma posição aparece duas vezes em "revela"'),
});
export const InteracaoPorta = z.strictObject({ tipo: z.literal('porta') });

export const Interacao = z.discriminatedUnion(
  'tipo',
  [InteracaoDecoracao, InteracaoFala, InteracaoEnigma, InteracaoPorta],
  {
    error: 'tipo deve ser decoracao, fala, enigma ou porta',
  },
);
export type Interacao = z.infer<typeof Interacao>;
export type InteracaoEnigma = z.infer<typeof InteracaoEnigma>;

export const Objeto = z.strictObject({
  id: z
    .string('id deve ser texto')
    .regex(/^[A-Za-z0-9_-]+$/, 'id aceita só letras, números, "-" e "_"')
    .max(LIMITES.idObjetoMax),
  imagem: RefImagemObjeto,
  x: coordenada('x'),
  y: coordenada('y'),
  largura: tamanho('largura'),
  altura: tamanho('altura'),
  /** Graus no intervalo [0, 360); o editor normaliza antes de aplicar. */
  rotacao: z.number('rotação deve ser número').min(0).lt(360, 'rotação deve ser menor que 360'),
  /** Maior fica na frente (RF-05); empate desenha na ordem da lista. */
  camada: z.number('camada deve ser número').int('camada deve ser inteira').min(0),
  interacao: Interacao,
});
export type Objeto = z.infer<typeof Objeto>;

export const Parede = z.strictObject({
  fundo: RefImagemFundo.nullable(),
  objetos: z.array(Objeto, 'objetos deve ser uma lista'),
});
export type Parede = z.infer<typeof Parede>;

export const Fase = z
  .strictObject({
    versaoSchema: z.literal(1, 'versão de schema não suportada'),
    /** Fonte única do título (ADR-002). */
    titulo: textoNaoVazio('título', LIMITES.tituloMax),
    /** 4 a 8 dígitos (RF-08); a porta compara dígito a dígito (ADR-003). */
    senha: z.string('senha deve ser texto').regex(/^\d{4,8}$/, 'a senha tem de 4 a 8 dígitos'),
    paredes: z.strictObject({
      frente: Parede,
      direita: Parede,
      fundo: Parede,
      esquerda: Parede,
      teto: Parede,
    }),
  })
  .superRefine((fase, ctx) => {
    const vistos = new Set<string>();
    for (const parede of PAREDES) {
      fase.paredes[parede].objetos.forEach((objeto, indice) => {
        const caminho = ['paredes', parede, 'objetos', indice];
        if (vistos.has(objeto.id)) {
          ctx.addIssue({ code: 'custom', path: [...caminho, 'id'], message: `id "${objeto.id}" repetido na fase` });
        }
        vistos.add(objeto.id);
        if (objeto.interacao.tipo !== 'enigma') return;
        for (const posicao of objeto.interacao.revela) {
          if (posicao > fase.senha.length) {
            ctx.addIssue({
              code: 'custom',
              path: [...caminho, 'interacao', 'revela'],
              message: `a posição ${posicao} não existe numa senha de ${fase.senha.length} dígitos`,
            });
          }
        }
      });
    }
  });
export type Fase = z.infer<typeof Fase>;

// ---------------------------------------------------------------------------
// Projeção de jogo (ADR-003, RNF-04): o que o jogador e o modo testar recebem.
// Sem senha, sem respostas, sem revela. A dica fica (RF-17).
// ---------------------------------------------------------------------------
export const InteracaoEnigmaJogo = z.strictObject({
  tipo: z.literal('enigma'),
  pergunta: z.string(),
  dica: z.string().optional(),
});
export const InteracaoJogo = z.discriminatedUnion('tipo', [
  InteracaoDecoracao,
  InteracaoFala,
  InteracaoEnigmaJogo,
  InteracaoPorta,
]);
export type InteracaoJogo = z.infer<typeof InteracaoJogo>;

export const ObjetoJogo = Objeto.extend({ interacao: InteracaoJogo });
export type ObjetoJogo = z.infer<typeof ObjetoJogo>;

export const ParedeJogo = z.strictObject({ fundo: RefImagemFundo.nullable(), objetos: z.array(ObjetoJogo) });
export type ParedeJogo = z.infer<typeof ParedeJogo>;

export const FaseJogo = z.strictObject({
  versaoSchema: z.literal(1),
  titulo: z.string(),
  tamanhoSenha: z.number().int().min(LIMITES.senhaMin).max(LIMITES.senhaMax),
  paredes: z.strictObject({
    frente: ParedeJogo,
    direita: ParedeJogo,
    fundo: ParedeJogo,
    esquerda: ParedeJogo,
    teto: ParedeJogo,
  }),
});
export type FaseJogo = z.infer<typeof FaseJogo>;

// ---------------------------------------------------------------------------
// Envelope de exportação (ADR-013)
// ---------------------------------------------------------------------------
export const TIPOS_IMAGEM = ['image/png', 'image/jpeg', 'image/webp'] as const;
export const PADRAO_DATA_URL = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/;

export const Envelope = z.strictObject({
  formato: z.literal('math-scape-fase', 'arquivo não é uma fase do Math Scape'),
  versao: z.literal(1, 'versão de arquivo não suportada'),
  /** Validada à parte por `Fase`; em validarEnvelope os erros dela levam o prefixo "fase" (["fase", "paredes", ...], LAC-040). */
  fase: z.unknown(),
  /** uuid do asset → data URL; contém exatamente as imagens `asset:` usadas na fase. */
  imagens: z.record(
    z.string().regex(new RegExp(`^${PADRAO_UUID}$`), 'chave de imagem deve ser o uuid do asset'),
    z.string().regex(PADRAO_DATA_URL, 'imagem embutida deve ser PNG, JPG ou WebP em base64'),
  ),
});
export type Envelope = z.infer<typeof Envelope>;
