#!/usr/bin/env bash
# Início da Api em produção: migrations, seed (quando existir) e servidor.
set -euo pipefail
: "${DATABASE_URL:?defina DATABASE_URL}"
pnpm exec prisma migrate deploy
# DEF-09: o seed da fase original (prisma/seed.ts) ainda não existe. Quando o Eric criar, ele roda aqui
# a cada início; o contrato (banco.md, seção Seed) exige que seja idempotente.
if [ -f prisma/seed.ts ]; then pnpm exec prisma db seed; else echo "[api] sem prisma/seed.ts (DEF-09): a Escola não é carregada"; fi
exec pnpm exec tsx src/servidor.ts
