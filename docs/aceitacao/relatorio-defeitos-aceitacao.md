# Relatório de defeitos da aceitação — Math Scape (fase 7)

Responsável: Yuri Martinelli · Destino: Eric (correções) · Commit analisado: `8a236d6` · Data: 06/11/2026

Defeitos encontrados na fase 7, no mesmo formato do [relatório de defeitos da Sarah](../testes/relatorio-defeitos.md). A numeração continua a dela (DEF-01 a DEF-08). O plano pede que cada defeito volte ao Eric com o caso que falha anexado.

## Resumo

| ID | Prioridade | Requisito | Defeito | Como verificar | Situação |
|---|---|---|---|---|---|
| DEF-09 | **Alta** | RF-18 | A fase original não entra no banco: o `prisma/seed.ts` especificado no projeto nunca foi criado | Banco limpo → `prisma db seed` falha e Escolher Fase vem vazia | Aberto |

## Defeitos

### DEF-09 · Seed da fase original não existe (RF-18, Alta)

Encontrado na preparação do ambiente da aceitação, antes das sessões com participantes.

- **Passos:**
  1. Subir um banco limpo (`docker compose -f infra/dev/docker-compose.yml up -d`).
  2. `cd apps/api && pnpm exec prisma migrate deploy`.
  3. `pnpm exec prisma db seed`, como manda o `modulos-banco.md` §4.
  4. Abrir a tela Escolher Fase, ou `GET /publicadas`.
- **Esperado:** pelo `modulos-banco.md` §3 e pelo contrato `banco.md` (seção Seed), o seed cria o usuário de sistema "Math Scape" (`sistema@math-scape.local`, `senha_hash` `"!desativado"`) e publica `fases-exemplo/escola-01.json`, validada com `validarFase`. Ele precisa ser idempotente. Com isso, a Escola fica disponível para qualquer jogador (RF-18).
- **Obtido:**
  - O `prisma.config.ts` aponta para `seed: 'tsx prisma/seed.ts'`, mas `apps/api/prisma/` só tem `schema.prisma` e `migrations/`. O arquivo nunca existiu: `git log --all -- apps/api/prisma/seed.ts` não mostra nenhum commit.
  - Nenhuma migration insere dados. O banco nasce sem fase, e Escolher Fase fica vazia.
- **Por que os testes não pegaram:** a suíte de sistema carrega a Escola pela Api. O `importarFase` de `tests/e2e/apoio/sistema.ts` cria uma conta sintética, importa `escola-01.json` e publica. Assim, a equivalência com o legado passa, mas nada exercita o caminho que leva a fase original a um ambiente real. A Api já trata o usuário de sistema no login (`apps/api/src/rotas/auth.ts`, linha 28, e o teste em `tests/api/auth.test.ts`, linha 252), mas nada cria esse usuário.
- **Efeito:**
  - **Fase 8 (deploy):** o sistema publicado sobe sem a fase original. O critério de sucesso 1 do plano e a demonstração "jogo legado e fase migrada lado a lado" dependem dela.
  - **Contorno manual é frágil:** importar a Escola pelo editor com a conta de uma pessoa faz dessa pessoa a dona da fase. Se essa conta for excluída, a Escola some junto, porque o RF-19 apaga em cascata as fases do dono (`ON DELETE CASCADE`, `banco.md`).
  - **Fase 7:** contornado por enquanto. O roteiro de aceitação importa a Escola com a conta do condutor (`docs/aceitacao/materiais/escola-01-importar.json`).
- **Correção esperada:** criar `apps/api/prisma/seed.ts` conforme o `modulos-banco.md` §3. Ele precisa:
  - criar o usuário de sistema se não existir;
  - validar `escola-01.json` com `validarFase`;
  - gravar `documento = documento_publicado` e `publicada_em = agora`;
  - não duplicar a fase quando rodar de novo.
- **Caso que deve passar depois da correção (sugestão para a Sarah ou o agente 3):** em banco limpo, rodar o seed duas vezes. `GET /publicadas` devolve exatamente uma fase com o título "Escola?". O login com `sistema@math-scape.local` é recusado com 401. Excluir uma conta comum não remove a Escola.
- **Rastreabilidade:** RF-18 (Alta). A matriz e o plano de testes marcam o RF-18 como "Aprovado, com ressalva", e essa avaliação continua válida para o comportamento da fase. O defeito está na carga dela no banco, que ficou sem caso de teste.

---
Responsável (fase 7): Yuri Martinelli · Data: 06/11/2026
