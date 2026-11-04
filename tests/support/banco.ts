/**
 * Apoio aos testes de integração da Api (ADR-016): o contêiner de testes sobe um
 * PostgreSQL local e exporta DATABASE_URL. Antes de cada teste, `limparBanco`
 * esvazia todas as tabelas, para cada caso começar do zero.
 */
import pg from 'pg';

export function urlBancoDeTeste(): string {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL ausente: rode a suíte pelo contêiner (pnpm testes:conteiner).');
  return url;
}

export async function limparBanco(url = urlBancoDeTeste()): Promise<void> {
  const cliente = new pg.Client({ connectionString: url });
  await cliente.connect();
  try {
    const { rows } = await cliente.query<{ tablename: string }>(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'",
    );
    if (rows.length > 0) {
      const tabelas = rows.map((linha) => `"public"."${linha.tablename}"`).join(', ');
      await cliente.query(`TRUNCATE ${tabelas} RESTART IDENTITY CASCADE`);
    }
  } finally {
    await cliente.end();
  }
}
