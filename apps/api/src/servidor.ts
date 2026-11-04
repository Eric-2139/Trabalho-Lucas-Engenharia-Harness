// Processo da Api (modulos-api.md). Configuração só por variável de ambiente.
import { construirApp, criarArmazenamentoEmDisco } from './index.ts';

const urlBanco = process.env.DATABASE_URL;
if (!urlBanco) throw new Error('defina DATABASE_URL (ver apps/api/.env.exemplo)');

const app = await construirApp({
  urlBanco,
  armazenamento: criarArmazenamentoEmDisco(process.env.DIRETORIO_ARMAZENAMENTO ?? 'armazenamento'),
  producao: process.env.NODE_ENV === 'production',
});
await app.listen({ port: Number(process.env.PORTA ?? 3000), host: '0.0.0.0' });
