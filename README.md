# Math Scape

Escape room de matemática reescrito como plataforma de fases. Cada fase é um documento JSON validado por um schema único. No **Editor**, qualquer pessoa monta uma sala arrastando objetos; o **Player** roda as fases publicadas; e a **Api** guarda as fases e confere as respostas no servidor, sem que nenhuma resposta ou senha chegue ao navegador.

Trabalho de Engenharia de Software feito em cascata, com IA em todas as fases. Os documentos de cada fase estão em `docs/` e `harness/`, e o `CLAUDE.md` explica o harness dos agentes.

| Para quem | Documento |
|---|---|
| Quem joga ou cria fases | [Manual do usuário](docs/operacao/manual-do-usuario.md) |
| Quem implanta e opera | [Implantação e operação](docs/operacao/implantacao.md) · [Plano de manutenção](docs/operacao/plano-manutencao.md) |
| Quem desenvolve | Este README · [`CLAUDE.md`](CLAUDE.md) · [arquitetura](harness/projeto/arquitetura.md) · [projeto do programa](harness/projeto/programa/README.md) |
| Quem testa | [Plano de testes](docs/testes/plano-de-testes.md) · [Relatório do sistema](docs/testes/relatorio-teste-sistema.md) · [Aceitação](docs/aceitacao/checklist-aceitacao.md) |

## Estrutura

```
packages/schema   schema Zod da fase, regras e biblioteca de sprites (usado por todos)
packages/player   motor do jogo e renderização (Konva), usado pelo Player e pelo modo testar
apps/editor       React + react-konva + Zustand/zundo        (dev: 5173)
apps/player       React, telas públicas e jogo              (dev: 5174)
apps/api          Fastify + Prisma + PostgreSQL              (dev: 3000)
fases-exemplo/    escola-01.json, a fase original migrada do legado
tests/            Vitest (unidade e integração) e tests/e2e (Playwright)
infra/            dev (banco), testes e e2e (contêineres do CI), producao (implantação)
```

## Rodar localmente

Requer Node 24 ou mais, pnpm 10 e Docker.

```bash
pnpm install
docker compose -f infra/dev/docker-compose.yml up -d
cp apps/api/.env.exemplo apps/api/.env
(cd apps/api && pnpm exec prisma generate && pnpm exec prisma migrate deploy)
pnpm dev
```

Depois, abra o Editor em http://localhost:5173 e o Player em http://localhost:5174. No desenvolvimento, o Vite encaminha `/api` para a Api (ADR-017).

Para jogar a fase original (enquanto o seed não existe, DEF-09), crie uma conta no Editor, importe `docs/aceitacao/materiais/escola-01-importar.json` em Minhas fases e publique.

## Testar

| Comando | O quê |
|---|---|
| `pnpm test` | Vitest no host (precisa do `DATABASE_URL` do banco local) |
| `pnpm testes:imagem` e `pnpm testes:conteiner` | A suíte inteira no contêiner sem rede, como o CI e o harness rodam |
| `docker build -f infra/e2e/Dockerfile -t math-scape-e2e tests/e2e && docker run --rm --network none -v .:/src math-scape-e2e` | Playwright: equivalência com o legado, fluxos e não funcionais (depois do `pnpm testes:imagem`) |
| `pnpm analise` | Biome e TypeScript |
| `node --test ".claude/testes-harness/*.test.js"` | Testes do próprio harness |

## Publicar

A produção é uma pilha Docker Compose em `infra/producao/` com PostgreSQL, Api, Caddy (HTTPS, Editor, Player e reescrita de `/api`) e backup diário:

```bash
cp infra/producao/.env.exemplo infra/producao/.env   # SITE_PLAYER, SITE_EDITOR, SENHA_BANCO
docker compose -f infra/producao/docker-compose.yml --env-file infra/producao/.env up -d --build
node infra/producao/verificar-implantacao.mjs https://<SITE_PLAYER> https://<SITE_EDITOR>
```

O CI (`.github/workflows/ci.yml`) roda a cada push. O CD (`cd.yml`) publica as imagens no GHCR quando a `main` passa e implanta por SSH se o servidor estiver configurado. Os detalhes estão em [implantação e operação](docs/operacao/implantacao.md).
