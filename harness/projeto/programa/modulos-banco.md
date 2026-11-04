# Módulos — Banco (`apps/api/prisma`)

Componente Banco · Contrato: `harness/projeto/contratos/banco.md`

Decisões: ADR-002, ADR-004, ADR-010. Processo: ADR-015, ADR-016.

## 1. Arquivos
| Arquivo | Conteúdo |
|---|---|
| `prisma/schema.prisma` | gerador `prisma-client` com `output = "../src/gerado/prisma"`; datasource `postgresql` (a URL vem de `prisma.config.ts`) |
| `prisma/migrations/` | migrations versionadas (`prisma migrate dev`) |
| `prisma/seed.ts` | usuário de sistema + `escola-01.json` publicada (RF-18) |
| `prisma.config.ts` (fora do escopo do agente) | caminho do esquema, das migrations, do seed e `DATABASE_URL` |

Prisma 7: o cliente é gerado como TypeScript em `src/gerado/` (ignorado pelo git) e usa `@prisma/adapter-pg`. O contêiner de testes roda `prisma generate` e, se houver migrations, `prisma migrate deploy` (que aplica também o `CHECK` e o índice parcial escritos em SQL); sem migrations ainda, `prisma db push` (ADR-016, LAC-028). As migrations, portanto, precisam conter tudo o que o contrato garante.

## 2. Modelos (tabelas do contrato banco.md)

| Modelo Prisma | Tabela | Campos | Regras |
|---|---|---|---|
| `Usuario` | `usuarios` | `id` uuid, `nome`, `email` (único), `senhaHash` → `senha_hash`, `criadoEm` | só nome, e-mail e hash (RNF-06); o e-mail é gravado em minúsculas pela Api (equivale ao `citext` do contrato sem exigir extensão) |
| `Sessao` | `sessoes` | `idHash` PK → `id_hash`, `usuarioId`, `criadaEm`, `expiraEm` | `onDelete: Cascade` |
| `Fase` | `fases` | `id` uuid, `donoId`, `titulo`, `documento` Json, `documentoPublicado` Json?, `publicadaEm`?, `revisao` Int, `criadaEm`, `atualizadaEm` | `onDelete: Cascade`; `@@index([donoId])`; índice parcial de `publicada_em` numa migration SQL |
| `Asset` | `assets` | `id` uuid, `donoId`, `arquivo`, `mime`, `bytes` Int, `criadoEm` | `onDelete: Cascade`; `CHECK (bytes <= 5242880)` numa migration SQL |

Nomes em camelCase no Prisma e `@map`/`@@map` para os nomes do contrato (snake_case).

## 3. Seed (RF-18)
- Usuário "Math Scape", e-mail `sistema@math-scape.local`, `senha_hash` que não corresponde a nenhuma senha (ex.: `"!desativado"`, que não é um hash argon2 válido). Não é dado pessoal real.
- Lê `fases-exemplo/escola-01.json`, valida com `validarFase` e grava `documento = documento_publicado` e `publicada_em = agora`. É idempotente: rodar duas vezes não duplica.

## 4. Banco local de desenvolvimento
`infra/dev/docker-compose.yml` sobe um PostgreSQL 17 em `localhost:5432` (usuário `postgres`, sem senha, só para desenvolvimento). Depois: `DATABASE_URL=postgresql://postgres@localhost:5432/math_scape`, `pnpm --filter @math-scape/api prisma migrate dev` e `prisma db seed`.
