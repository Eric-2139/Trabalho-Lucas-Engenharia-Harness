/**
 * Acesso ao banco (modulos-api.md §1): cliente Prisma gerado em src/gerado/prisma
 * (gerador `prisma-client`, Prisma 7) com o driver adapter do `pg`.
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { type Prisma, PrismaClient } from './gerado/prisma/client.ts';

export type Banco = PrismaClient;
export type Json = Prisma.InputJsonValue;

export function criarBanco(urlBanco: string): Banco {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: urlBanco }) });
}

/** Documento da fase para coluna JSONB (o documento já foi validado pelo schema). */
export function paraJson(valor: unknown): Json {
  return valor as Json;
}

/** Violação de unicidade do Prisma (P2002), sem depender da classe de erro gerada. */
export function violouUnicidade(erro: unknown): boolean {
  return typeof erro === 'object' && erro !== null && (erro as { code?: unknown }).code === 'P2002';
}
