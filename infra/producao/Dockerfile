# Imagens de produção (fase 8). Contexto: a raiz do repositório.
#   docker build -f infra/producao/Dockerfile --target api -t math-scape-api .
#   docker build -f infra/producao/Dockerfile --target web --build-arg URL_EDITOR=https://editor.exemplo.com -t math-scape-web .
# O ignore deste build é o Dockerfile.dockerignore ao lado (o .dockerignore da raiz é o da imagem de testes).

FROM node:24-bookworm-slim AS base
RUN npm install -g pnpm@10.34.9
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/schema/package.json packages/schema/
COPY packages/player/package.json packages/player/
COPY apps/editor/package.json apps/editor/
COPY apps/player/package.json apps/player/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile
COPY . .

# --- Api: Fastify + Prisma. Aplica as migrations (e o seed, se existir) a cada início.
FROM base AS api
# o generate só lê o esquema; a URL real chega no início do contêiner
RUN cd apps/api && DATABASE_URL=postgresql://construcao@localhost/construcao pnpm exec prisma generate
ENV NODE_ENV=production PORTA=3000 DIRETORIO_ARMAZENAMENTO=/dados/armazenamento
RUN mkdir -p /dados/armazenamento && chown -R node:node /dados /app/apps/api
COPY infra/producao/api-entrada.sh /usr/local/bin/api-entrada
RUN sed -i 's/\r$//' /usr/local/bin/api-entrada && chmod +x /usr/local/bin/api-entrada
USER node
WORKDIR /app/apps/api
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s \
  CMD node -e "fetch('http://127.0.0.1:3000/publicadas').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["api-entrada"]

# --- Builds de produção do Editor e do Player.
FROM base AS builds
ARG URL_EDITOR
RUN test -n "$URL_EDITOR" || (echo "defina --build-arg URL_EDITOR (endereço público do editor)" && exit 1)
ENV VITE_URL_EDITOR=$URL_EDITOR
RUN cd apps/editor && NODE_ENV=production pnpm exec vite build \
 && cd ../player && NODE_ENV=production pnpm exec vite build

# --- Web: Caddy serve os dois apps, faz HTTPS e reescreve /api/* para a Api (ADR-017).
FROM caddy:2-alpine AS web
COPY infra/producao/Caddyfile /etc/caddy/Caddyfile
COPY --from=builds /app/apps/editor/dist /srv/editor
COPY --from=builds /app/apps/player/dist /srv/player
