#!/usr/bin/env bash
# Entrada da suíte Playwright: sobe banco, Api e os builds de produção do Editor e do Player, e roda os testes.
# Argumentos vão direto ao `playwright test`. Saída: 0 verde · 1 vermelho · 3 falha de ambiente.
set -uo pipefail
ambiente() { echo "[e2e] falha de ambiente: $1" >&2; [ -f /tmp/servicos.log ] && tail -n 40 /tmp/servicos.log >&2; exit 3; }

[ -f /src/package.json ] || ambiente "o repositório não está montado em /src (use -v .:/src)."
cmp -s /src/pnpm-lock.yaml /app/pnpm-lock.yaml || ambiente "pnpm-lock.yaml mudou desde a construção da imagem base."
tar -C /src --exclude=node_modules --exclude=.git --exclude=harness --exclude=coverage --exclude=test-results --exclude=playwright-report -cf - . | tar -C /app -xf - \
  || ambiente "cópia do código falhou."
ln -sfn /e2e/node_modules /app/tests/e2e/node_modules
export DIRETORIO_LEGADO=/src/harness/entrada/legado/5-Jogo_Math_Scape

cd /app
su postgres -c "/opt/pgbin/pg_ctl -D /var/lib/pgteste -o '-c listen_addresses=127.0.0.1 -c fsync=off -c full_page_writes=off -k /tmp' -w -s start" >/dev/null || ambiente "o PostgreSQL não subiu."
su postgres -c "/opt/pgbin/createdb -h 127.0.0.1 math_scape_teste" || ambiente "não foi possível criar o banco."
(cd apps/api && pnpm exec prisma generate && pnpm exec prisma migrate deploy) >/tmp/servicos.log 2>&1 || ambiente "o Prisma falhou."

for app in editor player; do
  (cd "apps/$app" && NODE_ENV=production pnpm exec vite build) >>/tmp/servicos.log 2>&1 || ambiente "o build do $app falhou."
done

(cd apps/api && DIRETORIO_ARMAZENAMENTO=/tmp/armazenamento pnpm exec tsx src/servidor.ts) >>/tmp/servicos.log 2>&1 &
(cd apps/editor && pnpm exec vite preview --port 5173 --strictPort) >>/tmp/servicos.log 2>&1 &
(cd apps/player && pnpm exec vite preview --port 5174 --strictPort) >>/tmp/servicos.log 2>&1 &
node tests/e2e/apoio/servidor-legado.mjs 5175 >>/tmp/servicos.log 2>&1 &

for tentativa in $(seq 1 60); do
  if curl -fs http://localhost:5173/ >/dev/null 2>&1 && curl -fs http://localhost:5174/ >/dev/null 2>&1 \
     && curl -fs http://localhost:5174/api/publicadas >/dev/null 2>&1 && curl -fs http://localhost:5175/ >/dev/null 2>&1; then
    pronto=1; break
  fi
  sleep 1
done
[ "${pronto:-0}" = 1 ] || ambiente "os serviços não responderam em 60 s."

cd /app/tests/e2e
PLAYWRIGHT_BROWSERS_PATH="${PLAYWRIGHT_BROWSERS_PATH:-/root/.cache/ms-playwright}" npx playwright test "$@"
codigo=$?

destino=/src/tests/e2e/resultado
rm -rf "$destino"; mkdir -p "$destino"
cp -r test-results playwright-report resultados.json "$destino"/ 2>/dev/null
chown -R "$(stat -c %u:%g /src/package.json)" "$destino"
[ -d /src/docs/testes/evidencias ] && chown -R "$(stat -c %u:%g /src/package.json)" /src/docs/testes/evidencias
exit "$codigo"
