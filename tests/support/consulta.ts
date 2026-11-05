/**
 * Consulta direta ao PostgreSQL do contêiner de testes, para conferir o banco por
 * dentro (nomes de tabela e coluna do contrato `harness/projeto/contratos/banco.md`).
 */
import pg from 'pg';
import { urlBancoDeTeste } from './banco.ts';

export async function consultar<T extends Record<string, unknown> = Record<string, unknown>>(
  sql: string,
  parametros: unknown[] = [],
): Promise<T[]> {
  const cliente = new pg.Client({ connectionString: urlBancoDeTeste() });
  await cliente.connect();
  try {
    const { rows } = await cliente.query<T>(sql, parametros);
    return rows;
  } finally {
    await cliente.end();
  }
}

/** Quantidade de linhas de uma tabela do contrato (opcionalmente filtrada). */
export async function contar(tabela: string, onde = 'TRUE', parametros: unknown[] = []): Promise<number> {
  const linhas = await consultar<{ n: string }>(`SELECT count(*)::text AS n FROM "${tabela}" WHERE ${onde}`, parametros);
  return Number(linhas[0]?.n ?? '0');
}
