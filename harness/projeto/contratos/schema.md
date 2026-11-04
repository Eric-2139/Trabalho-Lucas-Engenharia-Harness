# Contrato — SchemaFase (`packages/schema`)

Decisões: ADR-001, ADR-002, ADR-003, ADR-006, ADR-011, ADR-012, ADR-013. Consumidores: Editor, Player, Api, Banco (seed).

## Tipos

O schema Zod definitivo foi escrito na fase 3 em `packages/schema/contrato/fase.ts`, e as assinaturas em `contrato/funcoes.ts`. A revisão campo a campo e as decisões de projeto D-01 a D-08 estão em `harness/projeto/programa/modulos-schema.md`. O esboço abaixo é o resumo.

```ts
type Parede = 'frente' | 'direita' | 'fundo' | 'esquerda' | 'teto';

type Interacao =
  | { tipo: 'decoracao' }                                   // sem campos de comportamento (RF-07, RF-16)
  | { tipo: 'fala'; texto: string }                          // texto não vazio
  | { tipo: 'enigma'; pergunta: string; respostas: number[]; // números, length >= 1 (RF-08, RF-15, PEND-008)
      dica?: string;                                         // ícone de dica só se existir (RF-17)
      revela: number[] }                                     // posições 1..senha.length, sem repetição; pode ser [] (RF-08)
  | { tipo: 'porta' };                                       // pede a senha da fase

interface Objeto {
  id: string; imagem: RefImagem;                             // ADR-012
  x: number; y: number; largura: number; altura: number;     // 0..1, relativos à parede (RNF-02)
  rotacao: number;                                           // graus, padrão 0
  camada: number;                                            // inteiro; maior fica na frente (RF-05)
  interacao: Interacao;
}

type RefImagem = `sprite:${string}` | `asset:${string}`;     // sprite: id do catálogo; asset: uuid de upload

interface Fase {
  versaoSchema: 1;
  titulo: string;                                            // fonte única do título (ADR-002)
  senha: string;                                             // /^\d{4,8}$/, padrão de 5 dígitos (RF-08)
  paredes: Record<Parede, { fundo: RefImagem | null; objetos: Objeto[] }>;
}

// Projeção enviada ao jogador e ao modo testar (RNF-04)
interface FaseJogo {
  versaoSchema: 1; titulo: string; tamanhoSenha: number;
  paredes: Record<Parede, { fundo: RefImagem | null; objetos: ObjetoJogo[] }>;
}
// ObjetoJogo = Objeto, exceto que o enigma vira { tipo: 'enigma'; pergunta; dica?: string }
// (a dica é texto exibível, RF-17; sem respostas, sem revela) e não existe campo senha.
```

Regras do schema: objetos estritos (campo desconhecido recusa); `id` de objeto único na fase; posições de `revela` dentro de `1..senha.length`.

## Funções exportadas

| Função | Entrada | Saída | Requisito |
|---|---|---|---|
| `validarFase(json)` | qualquer valor | `{ ok: true, fase } \| { ok: false, erros[] }` | RNF-09 |
| `validarJogabilidade(fase)` | `Fase` válida | `{ jogavel, posicoesSemEnigma: number[] }` | RF-12 |
| `projetarParaJogo(fase)` | `Fase` válida | `FaseJogo`: sem `senha`, sem `respostas`, sem `revela`; com `tamanhoSenha` e o texto da `dica` | RNF-04, RF-17 |
| `faseInicial(titulo)` | texto | `Fase` válida: senha de 5 dígitos, uma porta (`sprite:porta`) na parede da frente, demais paredes vazias | RF-02, RF-08, RNF-08 |
| `objetoPadrao(tipo, ref, id)` | tipo + imagem + id (gerado por quem chama) | `Objeto` válido com valores padrão (ADR-011) | RF-08, RF-10 |
| `respostaConfere(digitada, cadastradas)` | texto + números | boolean; exige **exatamente um** número no texto (sinal aceito; vírgula ou ponto decimal; sem separador de milhar): " 80 ", "080", "80,0", "80 graus" → 80; "1.000" → 1; sem número ou com dois números → false (PEND-008, ADR-003) | RF-15 |
| `senhaConfere(digitada, senha)` | texto + senha | boolean; sequência de dígitos exata após remover espaços ("0123" ≠ "123") | RF-15, RF-08 |
| `resolverImagem(ref, baseUrlApi)` | `RefImagem` | sprite → `/sprites/<arquivo>`; asset → `<baseUrlApi>/assets/<uuid>` | RF-04, RF-06, RF-18 |
| `referenciasDeAsset(fase)` | `Fase` válida | uuids das referências `asset:` (para a Api conferir o dono e montar a exportação) | RF-06, RF-14 |
| `validarEnvelope(json)` | arquivo exportado | `{ ok, fase, imagens }` ou erros (ADR-013) | RF-14 |

## Catálogo de sprites (ADR-012)
`packages/schema/biblioteca/catalogo.ts` + `packages/schema/biblioteca/sprites/`, fechados na fase 3 a partir do legado: porta, quadro (em branco), janela, relógio; da Escola: quadro com setas (o quadro do legado, com o desenho do enigma da direita), quadro-negro, relógio antigo, relógio do teto, giz, giz vermelho, olho, selo mágico, árvore seca, árvore, lâmpada, inscrição na parede e 3 fundos (sala, sala lateral, teto). O ícone de interrogação não é sprite do catálogo: é o ícone de dica do Player (RF-17).

Exemplo do RF-12: senha `92139`, enigmas revelando `[1,3,4]` → `posicoesSemEnigma = [2,5]`.

## Arquivo de exemplo
`fases-exemplo/escola-01.json`: fase original (RF-18), migrada de `harness/entrada/legado/` conforme `harness/projeto/programa/modulos-schema.md` §6. Esquerda: enigmas 15 e 40 com `revela: []`; teto 55 → `[1,2]`; direita 123 → `[3]`; frente 310 → `[4]`; fundo `[-15, 80]` → `[5]`; senha `92139`.
