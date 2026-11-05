#!/usr/bin/env bash
# Entrada do contêiner de testes (ADR-016).
#   testes  → roda a suíte (vitest) e devolve o JUnit em /src/harness/estado/junit.xml
#   analise → lint + verificação de tipos (comando_analise do agente 4)
# Códigos de saída: 0 verde · 1 vermelho (falha de teste ou de análise) · 3 falha de ambiente.
set -uo pipefail
MODO="${1:-testes}"

ambiente() { echo "[contêiner de testes] falha de ambiente: $1" >&2; exit 3; }

[ -f /src/package.json ] || ambiente "o repositório não está montado em /src (use -v .:/src)."

# Dependências vêm da imagem; se o lockfile mudou, a imagem está velha.
cmp -s /src/pnpm-lock.yaml /app/pnpm-lock.yaml \
  || ambiente "pnpm-lock.yaml mudou desde a construção da imagem. Rode: pnpm testes:imagem"

# Código do repositório por cima das dependências da imagem (node_modules do host nunca entra).
tar -C /src --exclude=node_modules --exclude=.git --exclude=harness -cf - . | tar -C /app -xf - \
  || ambiente "não foi possível copiar o código para /app."
mkdir -p /app/harness/estado

# Prisma: só depois que o componente Banco tiver o esquema (fase 4).
preparar_prisma() {
  [ -f /app/apps/api/prisma/schema.prisma ] || return 0
  (cd /app/apps/api && pnpm exec prisma generate >/tmp/prisma.log 2>&1) || return 1
  [ "$MODO" = testes ] || return 0
  # Com migrations, aplica-as (CHECK e índices escritos em SQL também são testados, LAC-028);
  # sem migrations ainda, empurra o schema.prisma direto.
  if ls /app/apps/api/prisma/migrations/*/migration.sql >/dev/null 2>&1; then
    (cd /app/apps/api && pnpm exec prisma migrate deploy >>/tmp/prisma.log 2>&1) || return 1
  else
    (cd /app/apps/api && pnpm exec prisma db push --accept-data-loss >>/tmp/prisma.log 2>&1) || return 1
  fi
}

junit_falha_prisma() {
  local destino=/src/harness/estado/junit.xml
  mkdir -p "$(dirname "$destino")"
  {
    echo '<?xml version="1.0" encoding="UTF-8" ?>'
    echo '<testsuites name="vitest tests" tests="1" failures="1"><testsuite name="infra" tests="1" failures="1">'
    echo '<testcase classname="infra" name="preparar_banco_prisma"><failure message="prisma falhou"><![CDATA['
    tail -n 40 /tmp/prisma.log | sed 's/]]>/]] >/g'
    echo ']]></failure></testcase></testsuite></testsuites>'
  } >"$destino"
}

cd /app
case "$MODO" in
  testes)
    su postgres -c "/opt/pgbin/pg_ctl -D /var/lib/pgteste -o '-c listen_addresses=127.0.0.1 -c fsync=off -c full_page_writes=off -k /tmp' -w -s start" >/dev/null \
      || ambiente "o PostgreSQL não subiu."
    su postgres -c "/opt/pgbin/createdb -h 127.0.0.1 math_scape_teste" || ambiente "não foi possível criar o banco de teste."
    if ! preparar_prisma; then
      cat /tmp/prisma.log >&2
      junit_falha_prisma
      exit 1
    fi
    pnpm exec vitest run
    codigo=$?
    [ -f harness/estado/junit.xml ] && cp harness/estado/junit.xml /src/harness/estado/junit.xml
    exit "$codigo"
    ;;
  analise)
    preparar_prisma || { cat /tmp/prisma.log >&2; exit 1; }
    pnpm run --silent lint && pnpm run typecheck
    ;;
  *)
    ambiente "modo desconhecido: $MODO (use testes ou analise)."
    ;;
esac
