// Configuração do Prisma 7 (componente Banco, ADR-002). O esquema e o seed ficam em prisma/ (fase 4).
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations', seed: 'tsx prisma/seed.ts' },
  datasource: { url: env('DATABASE_URL') },
});
