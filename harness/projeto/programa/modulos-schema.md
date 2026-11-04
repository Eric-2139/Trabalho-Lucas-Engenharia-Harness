# Módulos — SchemaFase (`packages/schema`)

Componente SchemaFase · Contrato: `harness/projeto/contratos/schema.md` · Código do contrato: `packages/schema/contrato/`

Decisões: ADR-001, ADR-002, ADR-003, ADR-006, ADR-011, ADR-012, ADR-013. Processo: ADR-015, ADR-016.

## 1. Módulos

| Arquivo | Módulo | Conteúdo |
|---|---|---|
| `contrato/fase.ts` | Schema da fase | `Fase`, `Parede`, `Objeto`, `Interacao`, `FaseJogo`, `Envelope`, `LIMITES`, `PAREDES` |
| `contrato/funcoes.ts` | Assinaturas | tipos de `validarFase`, `validarJogabilidade`, `projetarParaJogo`, `faseInicial`, `objetoPadrao`, `respostaConfere`, `senhaConfere`, `resolverImagem`, `referenciasDeAsset`, `validarEnvelope` |
| `contrato/api.ts` | Corpos e respostas HTTP | `CorpoCadastro`, `CorpoLogin`, `CorpoSalvarFase`, `CorpoVerificar`, tipos das respostas |
| `biblioteca/catalogo.ts` | Catálogo de sprites | `CATALOGO`, `spriteDoCatalogo` |
| `src/validar.ts` | — | `validarFase`, `validarEnvelope` (`safeParse` + erros por caminho) |
| `src/jogabilidade.ts` | — | `validarJogabilidade` |
| `src/projecao.ts` | — | `projetarParaJogo` |
| `src/padroes.ts` | — | `faseInicial`, `objetoPadrao` |
| `src/comparacao.ts` | — | `respostaConfere`, `senhaConfere` |
| `src/imagens.ts` | — | `resolverImagem`, `referenciasDeAsset` |

Os arquivos de `src/` são a divisão sugerida; o agente 4 pode reorganizá-los, desde que `src/index.ts` exporte tudo com o tipo do contrato.

## 2. Revisão campo a campo

Cada campo do schema, a regra que o código aplica e de onde ela vem. "Decisão de projeto" marca regra que nenhum requisito pede; ela está listada na seção 3 e pode ser mudada pela equipe sem mudar requisito.

### Fase
| Campo | Tipo e regra | Origem |
|---|---|---|
| (objeto) | estrito: campo desconhecido recusa | RF-07, RNF-09, ADR-001 |
| `versaoSchema` | literal `1` | ADR-001 (permite migrar documentos no futuro) |
| `titulo` | texto, 1 a 80 caracteres, não só espaços | ADR-002 (fonte única); limite: D-03 |
| `senha` | `/^\d{4,8}$/`; texto, não número ("0123" é válida e diferente de "123") | RF-08, ADR-003 |
| `paredes` | exatamente `frente`, `direita`, `fundo`, `esquerda`, `teto` | RF-03 |
| (fase toda) | `id` de objeto único na fase inteira, não só na parede | contrato schema.md |
| (fase toda) | toda posição de `revela` ≤ tamanho da senha | contrato schema.md, RF-08 |

Sem `id` de fase no documento: o id é a chave da linha no banco (ADR-002), e o envelope de exportação cria fase nova ao importar (ADR-013).

### Parede
| Campo | Tipo e regra | Origem |
|---|---|---|
| `fundo` | `sprite:` de categoria **fundo**, `asset:<uuid>` ou `null` | RF-06, ADR-012; categoria: D-04 |
| `objetos` | lista de `Objeto` (sem limite de quantidade) | RF-03; RNF-03 mede 50 por parede, não limita |

### Objeto
| Campo | Tipo e regra | Origem |
|---|---|---|
| `id` | `[A-Za-z0-9_-]`, até 64 caracteres | D-05 (uuid gerado pelo editor; ids legíveis na Escola) |
| `imagem` | `sprite:` de categoria **objeto** ou `asset:<uuid>` minúsculo | RF-04, RF-06, ADR-012; D-04 |
| `x`, `y` | número em [0, 1] | ADR-006, RNF-02 |
| `largura`, `altura` | número em (0, 1] | ADR-006; zero recusado: objeto invisível e impossível de clicar |
| `rotacao` | graus em [0, 360) | RF-05; intervalo: D-06 |
| `camada` | inteiro ≥ 0; maior fica na frente; empate segue a ordem da lista | RF-05 |
| `interacao` | união discriminada por `tipo` | RF-07 |

Não exige `x + largura ≤ 1`: um objeto pode sair parcialmente da parede, e o palco recorta (D-07).

### Interação
| Tipo | Campos | Origem |
|---|---|---|
| `decoracao` | nenhum (estrito: `texto` recusa) | RF-07, RF-16 |
| `fala` | `texto`: 1 a 1000 caracteres, não só espaços | RF-08, RF-16; limite: D-03 |
| `enigma` | `pergunta`: 1 a 1000; `respostas`: 1 a 10 números finitos (inteiros, negativos e decimais); `dica?`: 1 a 1000; `revela`: posições inteiras 1..8 sem repetição, pode ser `[]` | RF-08, RF-15, RF-17, PEND-008; limites: D-03 |
| `porta` | nenhum; pede a senha da fase | RF-08, ADR-001 |

Respostas repetidas no mesmo enigma não são recusadas (não mudam o resultado). Dois enigmas podem revelar a mesma posição (D-08). Várias portas são permitidas e todas pedem a mesma senha (ADR-001). Fase sem porta é válida e publicável (PEND-007).

### FaseJogo (projeção, RNF-04)
Igual a `Fase`, sem `senha` e com `tamanhoSenha` (4 a 8). O enigma vira `{ tipo, pergunta, dica? }`: sem `respostas` e sem `revela`. O schema da projeção é estrito, então um objeto de jogo com `respostas` é recusado. O teste de RNF-04 pode usá-lo como verificação.

### Envelope (ADR-013)
`{ formato: "math-scape-fase", versao: 1, fase, imagens }`; `imagens` mapeia uuid → `data:image/(png|jpeg|webp);base64,...`. `validarEnvelope` exige que as chaves de `imagens` sejam exatamente os uuids `asset:` usados na fase.

### Regras gerais
- **Sem transformação nem valor padrão no schema**: o documento validado é igual ao recebido (D-01). Exportar e importar dá fase igual (RF-14), e o store do editor compara documentos sem surpresa (ADR-011). Valores padrão ficam em `faseInicial` e `objetoPadrao`.
- **Mensagens em português**: as do contrato estão escritas no schema; as padrão do Zod usam a tradução `pt-BR` (`z.config`), que vale para todo processo que importa o pacote (RNF-07).

## 3. Decisões de projeto desta fase (sem requisito de origem)

| # | Decisão | Por quê |
|---|---|---|
| D-01 | Schema sem transformações nem padrões | ida e volta idêntica (RF-14, ADR-011); ver "fase igual" na seção 4 |
| D-02 | Corpos HTTP (`contrato/api.ts`) no pacote de schema | escritos uma vez para Api, Editor e Player, como a fase (ADR-001) |
| D-03 | Limites: título 80; textos 1000; respostas 10; id 64 | teto contra documento gigante; valores folgados para o uso real |
| D-04 | Sprite de fundo só em fundo; sprite de objeto só em objeto | a biblioteca do editor oferece cada um no lugar certo |
| D-05 | `id` de objeto em `[A-Za-z0-9_-]{1,64}`, gerado por quem chama `objetoPadrao` | o pacote fica sem aleatoriedade, e os testes ficam determinísticos |
| D-06 | Rotação em [0, 360); o editor normaliza | um único valor por ângulo, comparação simples |
| D-07 | Objeto pode sair parcialmente da parede | o arraste limita a posição (ADR-011), não o tamanho girado |
| D-08 | Duas posições iguais em enigmas diferentes são aceitas | não fere RF-12 nem RF-15; proibir só atrapalharia o criador |

## 4. Funções (detalhe das assinaturas de `contrato/funcoes.ts`)

| Função | Comportamento | Requisito |
|---|---|---|
| `validarFase(json)` | `Fase.safeParse`; erros como `{ caminho, mensagem }`; nunca lança | RNF-09, RF-07, RF-08 |
| `validarJogabilidade(fase)` | posições 1..senha.length que nenhum `revela` cobre, em ordem crescente; `jogavel` = lista vazia; não olha porta | RF-12, PEND-007 |
| `projetarParaJogo(fase)` | remove `senha`, `respostas`, `revela`; acrescenta `tamanhoSenha`; mantém o resto e a ordem; o resultado passa em `FaseJogo` | RNF-04, RF-17 |
| `faseInicial(titulo)` | senha `"00000"`, porta `porta-1` (`sprite:porta`, tamanho do catálogo, centralizada) na frente, outras paredes vazias, fundos `null`; recebe título já validado (a Api recusa título vazio com 400) | RF-02, RF-08, RNF-08 |
| `objetoPadrao(tipo, imagem, id)` | ver `contrato/funcoes.ts`; o resultado sempre passa em `Objeto` | ADR-011 |
| `respostaConfere(digitada, cadastradas)` | extrai os números do texto (`-?\d+([.,]\d+)?`); exatamente um → compara com as respostas; zero ou dois ou mais → false | RF-15, PEND-008 |
| `senhaConfere(digitada, senha)` | remove espaços e compara a sequência exata | RF-15 |
| `resolverImagem(ref, baseUrlApi)` | sprite → `/sprites/<arquivo>`; asset → `<baseUrlApi>/assets/<uuid>` (quem chama passa a base; nos apps, `/api`) | ADR-012 |
| `referenciasDeAsset(fase)` | uuids `asset:` de fundos e objetos, sem repetição; usada pela Api para conferir o dono das imagens e montar o envelope | ADR-013 |
| `validarEnvelope(json)` | `Envelope` + `Fase` + correspondência exata de imagens; erros com caminho a partir da raiz do envelope (`["fase", ...]` para a fase, `["imagens", "<uuid>"]` para as imagens) e mensagens fixas em `contrato/funcoes.ts` | RF-14, RNF-09 |

**"Fase igual" no RF-14**: a fase importada tem o mesmo documento da exportada, exceto que cada `asset:<uuid>` é trocado pelo uuid do asset novo do importador (troca um para um, mesma imagem byte a byte). Sprites, textos, posições, senha, respostas e a ordem dos objetos ficam idênticos (ADR-013).

`faseInicial` usa a senha `"00000"`, porque nenhum requisito define a senha padrão, só o tamanho (5). O criador a troca em Propriedades da fase, e `validarJogabilidade` já exige enigmas para as 5 posições antes de publicar.

## 5. Catálogo (ADR-012, LAC-027, LAC-030)
`biblioteca/catalogo.ts` e as imagens de `biblioteca/sprites/` foram **fechados nesta fase** a partir do jogo legado (`harness/entrada/legado/5-Jogo_Math_Scape/imagens/`). O catálogo é contrato: o schema aceita `sprite:` só com os ids dele, e acrescentar sprite é decisão de projeto. Por isso `biblioteca/` não está no escopo do agente 4.

| Grupo | Ids |
|---|---|
| Mínimo do RF-04 | `porta`, `quadro` (em branco, SVG), `janela`, `relogio` |
| Objetos da Escola | `quadro-setas` (o quadro do legado, com o desenho das contas da direita), `quadro-negro`, `relogio-antigo`, `relogio-teto`, `giz`, `giz-vermelho`, `olho`, `selo-magico`, `arvore-seca`, `arvore`, `lampada` |
| Texto na parede | `inscricao` (SVG): as perguntas da Escola eram texto escrito na parede, sem imagem própria |
| Fundos | `fundo-sala` (frente e fundo usam a mesma imagem), `fundo-sala-lateral` (direita e esquerda), `fundo-teto` |

Fora do catálogo, de propósito: o **ícone de interrogação**, que é o ícone de dica desenhado pelo Player junto do enigma com dica (`packages/player/recursos/icone-dica.png`). Ele não é um objeto que se coloca na parede, porque o RF-17 diz que não existe objeto de dica separado (LAC-030). Também ficam de fora o botão de configurações e o botão de senha, que eram interface do legado.

## 6. Migração da fase original (fase 4, RF-18, LAC-031)
Fonte: `harness/entrada/legado/5-Jogo_Math_Scape/` (cópia do Math_Scape_Telas, commit `f62627e`, origem em `.origem`). Textos das perguntas, falas e dicas: `index.html` e `js/*.js`; posições e tamanhos: `css/*.css`. O agente 4 escreve `fases-exemplo/escola-01.json` com:

| Parede | Fundo | Enigmas (sprite · respostas → revela) | Dica (`dica` do enigma) |
|---|---|---|---|
| frente | `fundo-sala` | `quadro-negro` · `[310]` → `[4]`; a pergunta é o texto do quadro ("Bem-vindo a sua primeira (ou última) aula… 10 + 15 x 20 =") | "Voz desconhecida: Realize primeiro a multiplicação, depois a adição" |
| direita | `fundo-sala-lateral` | `quadro-setas` · `[123]` → `[3]`; pergunta: "Respeite as regras de cálculo de equações!! → ? =" (o resto da conta está desenhado no sprite, como no legado) | dica de `dica_direita()` |
| fundo | `fundo-sala` | `selo-magico` · `[-15, 80]` → `[5]` (a pergunta inclui a sequência 4, 23, 42, 61) | dica de `dica_fundo()` |
| esquerda | `fundo-sala-lateral` | duas `inscricao`: horas `[15]` → `[]` e minutos `[40]` → `[]` | a mesma dica de `dica_esquerda()` nos **dois** enigmas (vale para as duas contas) |
| teto | `fundo-teto` | `inscricao` · `[55]` → `[1, 2]` | dica de `dica_teto()` |

- Senha `92139`; uma porta (`porta`) na frente.
- **Falas** (tipo `fala`): os objetos com `alert` no legado: os dois relógios e o giz da frente, as janelas da direita e do fundo, o relógio antigo e o giz vermelho da esquerda, e o olho do teto (as duas falas, de "Você" e do Tet, num texto só). O texto mantém o narrador como no legado ("Você: …", "Tet: …").
- **Decorações**: lâmpadas, árvore seca e tudo o que não reage a clique no legado.
- Perguntas com o texto exato do legado (critério do RF-18), inclusive onde o legado conta "pedaços" da senha e não posições: a pergunta da frente diz "terceiro dígito" e revela a posição 4, cujo valor é o dígito 3. O comportamento (dígito 3 na posição 4 de 92139) é o do legado.
- As mensagens de acerto próprias de cada enigma no legado ("O terceiro digito da senha é 3", "Resposta correta, olhe para cima", "O selo foi quebrado…") não são migradas: o schema não tem esse campo, e o Player mostra `MENSAGENS.respostaCorreta(digitos)` (`packages/player/contrato/motor.ts`): "Resposta correta!" e, se houver, os dígitos por posição. O RF-18 não exige essas mensagens.
- Um objeto tem um só tipo (RF-07). Por isso não são migradas as falas que o legado dava a objetos que aqui são enigma ou porta: a fala da porta ("Por que \"Saída?\"…", a porta pede a senha), a do selo (que é o enigma do fundo) e as das duas perguntas da esquerda.
- Fora (versão 2, PEND-09 da equipe): relógio animado do teto (vira decoração `relogio-teto`), sumiço do selo e troca da árvore.
