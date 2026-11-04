/**
 * Suíte do produto (ADR-016). Um projeto por componente, testes só em tests/ (escritos pelo agente 3).
 * O relatório JUnit vai para harness/estado/junit.xml, que o harness lê (baseline_verde, regressão).
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    passWithNoTests: true,
    reporters: ['default', 'junit'],
    outputFile: { junit: 'harness/estado/junit.xml' },
    projects: [
      { test: { name: 'schema', include: ['tests/schema/**/*.test.ts'], environment: 'node' } },
      {
        test: {
          name: 'player',
          include: ['tests/player/**/*.test.{ts,tsx}'],
          environment: 'jsdom',
          setupFiles: ['tests/support/dom.ts'],
        },
      },
      {
        test: {
          name: 'editor',
          include: ['tests/editor/**/*.test.{ts,tsx}'],
          environment: 'jsdom',
          setupFiles: ['tests/support/dom.ts'],
        },
      },
      {
        test: {
          name: 'api',
          include: ['tests/api/**/*.test.ts'],
          environment: 'node',
          // Um banco só no contêiner: arquivos rodam em sequência para não se atropelarem.
          fileParallelism: false,
        },
      },
    ],
  },
});
