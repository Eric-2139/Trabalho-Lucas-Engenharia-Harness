#!/usr/bin/env bash
# Suíte com medição de cobertura (fase 5, meta do plano: 80% no schema e no motor de interações).
# Usa a mesma imagem da suíte (ADR-016) e o mesmo preparo de entrada.sh, sem alterá-lo:
#   docker run --rm --network none -v .:/src --entrypoint bash math-scape-testes /src/infra/testes/cobertura.sh
# O relatório fica em coverage/ (ignorado pelo git). Saída: 0 verde e meta atingida; 1 vermelho ou meta não atingida; 3 ambiente.
set -uo pipefail

ambiente() { echo "[cobertura] falha de ambiente: $1" >&2; exit 3; }

[ -f /src/package.json ] || ambiente "o repositório não está montado em /src (use -v .:/src)."
cmp -s /src/pnpm-lock.yaml /app/pnpm-lock.yaml || ambiente "pnpm-lock.yaml mudou desde a construção da imagem. Rode: pnpm testes:imagem"
tar -C /src --exclude=node_modules --exclude=.git --exclude=harness --exclude=coverage -cf - . | tar -C /app -xf - || ambiente "cópia do código falhou."
mkdir -p /app/harness/estado

cd /app
su postgres -c "/opt/pgbin/pg_ctl -D /var/lib/pgteste -o '-c listen_addresses=127.0.0.1 -c fsync=off -c full_page_writes=off -k /tmp' -w -s start" >/dev/null || ambiente "o PostgreSQL não subiu."
su postgres -c "/opt/pgbin/createdb -h 127.0.0.1 math_scape_teste" || ambiente "não foi possível criar o banco de teste."
(cd apps/api && pnpm exec prisma generate && pnpm exec prisma migrate deploy) >/tmp/prisma.log 2>&1 || { cat /tmp/prisma.log >&2; ambiente "o Prisma falhou."; }

pnpm exec vitest run --coverage.enabled \
  --coverage.provider=v8 \
  --coverage.reporter=text --coverage.reporter=json-summary \
  --coverage.reportsDirectory=coverage \
  --coverage.include='packages/*/src/**' --coverage.include='apps/*/src/**' --coverage.include='packages/schema/contrato/**' \
  --coverage.exclude='apps/api/src/gerado/**' --coverage.exclude='**/main.tsx' --coverage.exclude='apps/api/src/servidor.ts'
codigo=$?

mkdir -p /src/coverage && cp coverage/coverage-summary.json /src/coverage/ 2>/dev/null
chown -R "$(stat -c %u:%g /src/package.json)" /src/coverage
[ "$codigo" -eq 0 ] || exit "$codigo"

# Meta do plano (seção 6): 80% de linhas e de ramos no núcleo.
node - <<'FIM'
const r = require('/app/coverage/coverage-summary.json');
const nucleo = { 'packages/schema/src/': 'schema', 'packages/schema/contrato/': 'schema', 'packages/player/src/motor.ts': 'motor', 'packages/player/src/estado-partida.ts': 'estado da partida' };
const soma = {};
for (const [arquivo, c] of Object.entries(r)) {
  for (const [prefixo, nome] of Object.entries(nucleo)) {
    if (!arquivo.includes(prefixo)) continue;
    const s = (soma[nome] ??= { lt: 0, lc: 0, bt: 0, bc: 0 });
    s.lt += c.lines.total; s.lc += c.lines.covered; s.bt += c.branches.total; s.bc += c.branches.covered;
  }
}
let ok = true;
for (const [nome, s] of Object.entries(soma)) {
  const l = (100 * s.lc) / (s.lt || 1), b = (100 * s.bc) / (s.bt || 1);
  console.log(`[núcleo] ${nome}: linhas ${l.toFixed(1)}%  ramos ${b.toFixed(1)}%`);
  if (l < 80 || b < 80) ok = false;
}
process.exit(ok && Object.keys(soma).length === 3 ? 0 : 1);
FIM
