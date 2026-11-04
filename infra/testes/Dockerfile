# Imagem da suíte do produto (ADR-016). Construída com rede (pnpm testes:imagem);
# executada sem rede pelo harness: docker run --rm --network none -v .:/src math-scape-testes
FROM node:24-bookworm-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends postgresql ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# PostgreSQL local, já inicializado, sem senha e só no loopback (o contêiner não tem rede).
RUN PGBIN="$(ls -d /usr/lib/postgresql/*/bin)" \
 && ln -s "$PGBIN" /opt/pgbin \
 && mkdir -p /var/lib/pgteste && chown postgres:postgres /var/lib/pgteste \
 && su postgres -c "/opt/pgbin/initdb -D /var/lib/pgteste -A trust -U postgres --no-sync" >/dev/null

RUN npm install -g pnpm@10.34.9

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/schema/package.json packages/schema/
COPY packages/player/package.json packages/player/
COPY apps/editor/package.json apps/editor/
COPY apps/player/package.json apps/player/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile

COPY infra/testes/entrada.sh /usr/local/bin/entrada-testes
RUN sed -i 's/\r$//' /usr/local/bin/entrada-testes && chmod +x /usr/local/bin/entrada-testes

ENV DATABASE_URL=postgresql://postgres@127.0.0.1:5432/math_scape_teste \
    NODE_ENV=test \
    CI=true
ENTRYPOINT ["entrada-testes"]
CMD ["testes"]
