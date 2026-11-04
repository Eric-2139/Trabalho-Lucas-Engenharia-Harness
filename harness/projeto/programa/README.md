# Math Scape — Projeto do Programa (Fase 3)

Versão 1.0 · Responsável: Eric · Entrada: Documento de Arquitetura v1.1 (`harness/projeto/arquitetura.md`), baseline `2026-11-03.1` · Saída para: Fase 4 (Codificação)

A fase 2 disse **quais** componentes existem e **como conversam**. Esta fase diz **em que arquivos** cada um vai morar, **qual é a interface pública** de cada módulo e **como o código vai ser testado**. A interface não fica só no texto: está escrita em TypeScript nas pastas `contrato/`. É ela que o agente 3 lê para escrever os testes, e é contra esses testes que o agente 4 implementa.

| Documento | Conteúdo |
|---|---|
| este arquivo | estrutura do monorepo, regra contrato × implementação, testes, comandos |
| [`modulos-schema.md`](modulos-schema.md) | schema Zod revisado campo a campo, funções do pacote, catálogo |
| [`modulos-player.md`](modulos-player.md) | MotorInteracoes, EstadoPartida, RenderizadorParede, palco, tema, app público |
| [`modulos-editor.md`](modulos-editor.md) | CanvasParede, AbasParedes, BibliotecaObjetos, PainelPropriedades, BarraFerramentas, store, salvamento |
| [`modulos-api.md`](modulos-api.md) | plugins, rotas, sessão, dono, limites, armazenamento |
| [`modulos-banco.md`](modulos-banco.md) | esquema Prisma e seed |

Decisões novas desta fase: ADR-015 (contrato separado da implementação), ADR-016 (suíte em contêiner sem rede) e ADR-017 (Api no mesmo site, sob `/api`).

## 1. Estrutura de pastas

```
math-scape (raiz do repositório)
├─ packages/
│  ├─ schema/                 SchemaFase · @math-scape/schema
│  │  ├─ contrato/            fase.ts (Zod), funcoes.ts (assinaturas), api.ts (corpos e respostas HTTP)
│  │  ├─ biblioteca/          catalogo.ts + sprites/ (ADR-012), fechados na fase 3
│  │  └─ src/                 implementação: validar, jogabilidade, projeção, comparação, envelope
│  └─ player/                 Player (motor) · @math-scape/player
│     ├─ contrato/            motor.ts (Partida, Verificador), palco.ts (palco 16:9, tema)
│     ├─ recursos/            icone-dica.png (ícone de dica, RF-17)
│     └─ src/                 motor, verificador HTTP, palco, RenderizadorParede (Konva), tema.ts
├─ apps/
│  ├─ editor/                 Editor · @math-scape/app-editor (React + Vite + react-konva)
│  │  ├─ contrato/            store.ts, salvamento.ts, componentes.ts
│  │  ├─ src/                 store Zustand+zundo, telas, componentes, cliente HTTP
│  │  └─ index.html, vite.config.ts
│  ├─ player/                 Player (app público) · @math-scape/app-player
│  │  ├─ contrato/            ClienteApiJogo, EscolherFase, TelaJogo
│  │  ├─ src/
│  │  └─ index.html, vite.config.ts
│  └─ api/                    Api + Banco · @math-scape/api (Fastify + Prisma)
│     ├─ contrato/            construirApp, Armazenamento, limites
│     ├─ src/                 app, plugins, rotas, serviços (Api)
│     ├─ prisma/              schema.prisma, migrations, seed.ts (Banco)
│     └─ prisma.config.ts
├─ fases-exemplo/escola-01.json   fase original migrada (RF-18, fase 4)
├─ tests/                     suíte do produto (agente 3)
│  ├─ schema/ player/ editor/ api/
│  ├─ support/                apoio: dom.ts (jest-dom), banco.ts (limpar banco)
│  └─ fixtures/               dados sintéticos
├─ infra/testes/              imagem e entrada do contêiner de testes (ADR-016)
├─ harness/ .claude/          harness dos agentes (fases 1-2)
│  └─ harness/entrada/legado/ jogo legado (Math_Scape_Telas @ f62627e), fonte da migração (RF-18)
├─ docs/ia-log/               log de uso de IA por fase
└─ package.json, pnpm-workspace.yaml, tsconfig.base.json, biome.json, vitest.config.ts
```

Diferenças em relação ao esboço do plano: `packages/player` existe (ADR-009); `docs/adr` é `harness/projeto/decisoes/`, onde o agente 5 lê; o schema segue o contrato da fase 2 (`respostas`, `revela`, `senha` na fase, `imagem: sprite:|asset:`), não o esboço (`digito`, `posicaoNaSenha`, `sprite`, `w`/`h`).

## 2. Contrato × implementação (ADR-015)

| Pasta | O que tem | Quem escreve | Agente 3 lê? |
|---|---|---|---|
| `*/contrato/` | tipos, schemas Zod, assinaturas | arquiteto (fase 3) | sim |
| `packages/schema/biblioteca/` | catálogo e imagens dos sprites | arquiteto (é contrato: o schema valida as imagens por ele, LAC-027) | sim |
| `packages/player/recursos/` | ícone de dica | arquiteto | sim |
| `harness/entrada/legado/` | jogo legado, só leitura | arquiteto (cópia do Math_Scape_Telas) | sim |
| `*/src/` | implementação | agente 4 (fase 4) | **não** (bloqueado no gate) |
| `apps/api/prisma/` | esquema, migrations, seed | agente 4 (Banco) | **não** |
| `fases-exemplo/` | fase original | agente 4 (migração) | sim (é dado do RF-18) |
| `tests/` | testes | agente 3 | — |
| manifestos, configs, `infra/` | dependências e ferramentas | arquiteto | — |

Cada `src/index.ts` exporta o contrato e as implementações com o tipo do contrato:

```ts
export const validarFase: ValidarFase = (json) => { /* fase 4 */ };
```

Até a fase 4, cada função é um stub que lança `"<nome>: não implementado (fase 4)"`. Assim a suíte compila e os testes do agente 3 ficam vermelhos com uma mensagem clara.

Escopo de escrita do agente 4 (`arquivos_previstos`): SchemaFase `packages/schema/src/**`, `fases-exemplo/**` · Player `packages/player/src/**`, `apps/player/src/**`, `apps/player/index.html`, `apps/player/public/**` · Editor `apps/editor/src/**`, `apps/editor/index.html`, `apps/editor/public/**` · Api `apps/api/src/**` · Banco `apps/api/prisma/**`.

## 3. Testes (ADR-016)

- Um projeto Vitest por componente (`vitest.config.ts`): `schema` e `api` em Node; `player` e `editor` em jsdom com Testing Library.
- **Arquivo por módulo, não por requisito** (`tests/schema/fase.test.ts`, `tests/player/motor.test.ts`). O id do requisito vai no nome do caso (`test_RF15_enigma_aceita_80_virgula_0`) e na anotação `@req RF-15 @tipo borda`. Um arquivo chamado pelo requisito faria o harness atribuir todos os casos dele ao requisito.
- Testes importam pelo pacote (`@math-scape/schema`, `@math-scape/player`, `@math-scape/app-editor`, `@math-scape/app-player`, `@math-scape/api`) e tipos pelo subcaminho `/contrato`.
- Api: `construirApp({ urlBanco: urlBancoDeTeste(), armazenamento })` + `app.inject(...)`; `limparBanco()` antes de cada caso; armazenamento em memória escrito em `tests/support/`.
- Tempo e aleatoriedade sempre injetados (`Relogio` do salvamento; `id` em `objetoPadrao`), ou `vi.useFakeTimers()`. A P4 do agente 3 bloqueia `Date.now()`, `Math.random()` e `setTimeout` nos testes.
- Playwright (equivalência com o legado, E2E, 30 fps) é da fase 6 e não roda no contêiner da suíte.

## 4. Comandos

| Comando | O que faz |
|---|---|
| `pnpm install` | instala as dependências (pnpm 10; os scripts de instalação permitidos estão em `pnpm-workspace.yaml`) |
| `pnpm dev` | sobe editor, player e Api em modo desenvolvimento (precisa de PostgreSQL local, ver `modulos-banco.md`) |
| `pnpm test` | Vitest no host (testes da Api exigem `DATABASE_URL`) |
| `pnpm testes:imagem` | constrói a imagem `math-scape-testes`; refaça a cada mudança do `pnpm-lock.yaml` |
| `pnpm testes:conteiner` | a suíte exatamente como o harness a roda: sem rede, com PostgreSQL |
| `pnpm analise` | lint (Biome) + tipos (TypeScript) |
| `pnpm format` | formata o código (o agente 4 não formata; a análise só cobra o lint) |

## 5. Convenções
- Nomes de domínio em português, como nos requisitos (`fase`, `parede`, `enigma`, `revela`); componentes React em PascalCase; arquivos em kebab-case.
- Textos de interface em português, num arquivo de mensagens por app (`src/mensagens.ts`), com o tema comum (ADR-014).
- Sem segredo no código: configuração por variável de ambiente (`DATABASE_URL`, `PORTA`, `DIRETORIO_ARMAZENAMENTO`).
- **Mudou o schema, atualiza os testes**: alteração em `packages/schema/contrato/` é decisão de projeto. Ela atualiza `modulos-schema.md`, passa por `/verificar-rastreabilidade` e volta ao agente 3 antes do agente 4.

## 6. Ordem de implementação na fase 4
Segue o plano: (1) esqueleto e CI, já entregues nesta fase; (2) `packages/schema` (RF-07, RF-08, RF-12, RF-15, RNF-09); (3) migração de `escola-01.json` (RF-18); (4) `packages/player` + `apps/player` com a Escola (RF-16, RF-17, RNF-02); (5) editor (RF-03 a RF-11); (6) Api e Banco (RF-01, RF-02, RF-06, RF-13, RF-14, RF-19, RNF-04 a RNF-06); (7) telas restantes. Para cada requisito, o agente 3 escreve os testes (`/gerar-testes RF-NN`) **antes** do agente 4 (`/implementar-requisito RF-NN`).
