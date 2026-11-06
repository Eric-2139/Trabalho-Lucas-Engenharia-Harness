# Imagem da suíte Playwright (ADR-016: "terá a sua própria"). Reaproveita a imagem da suíte: Node 24, PostgreSQL e dependências do produto.
# Construção, com rede: docker build -f infra/e2e/Dockerfile -t math-scape-e2e tests/e2e
# Execução, sem rede:   docker run --rm --network none -v .:/src math-scape-e2e
FROM math-scape-testes
WORKDIR /e2e
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund \
 && npx playwright install --with-deps chromium firefox msedge \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENTRYPOINT ["bash", "/src/infra/e2e/entrada.sh"]
CMD []
