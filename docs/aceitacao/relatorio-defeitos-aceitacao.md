# Relatório de defeitos da aceitação — Math Scape (fase 7)

Responsável: Yuri Martinelli · Destino: Eric (correções) · Commit analisado: `8a236d6` · Data: 06/11/2026

Defeitos encontrados na fase 7 e na preparação da fase 8, no mesmo formato do [relatório de defeitos da Sarah](../testes/relatorio-defeitos.md). A numeração continua a dela (DEF-01 a DEF-08). O plano pede que cada defeito volte ao Eric com o caso que falha anexado.

## Resumo

| ID | Prioridade | Requisito | Defeito | Como verificar | Situação |
|---|---|---|---|---|---|
| DEF-09 | **Alta** | RF-18 | A fase original não entra no banco: o `prisma/seed.ts` especificado no projeto nunca foi criado | Banco limpo → `prisma db seed` falha e Escolher Fase vem vazia | Aberto |
| DEF-10 | **Alta** | RF-15, ADR-003 | Atrás do proxy de produção, o limite de tentativas vale para todos os jogadores juntos: 30 senhas erradas de uma pessoa bloqueiam a porta da fase para todo mundo por 10 min | Pilha de `infra/producao/` → 30 tentativas erradas de um cliente → outro cliente, com outro IP, recebe 429 na primeira tentativa | Aberto |

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

### DEF-10 · Limite de tentativas compartilhado por todos atrás do proxy (RF-15, ADR-003, Alta)

Encontrado na preparação da implantação (fase 8), ao rodar a pilha de produção (`infra/producao/`) neste ambiente, antes de publicar.

- **Passos:**
  1. Subir a pilha de produção (`docs/operacao/implantacao.md`) e publicar a Escola com uma conta qualquer.
  2. De um cliente A, mandar 30 senhas erradas para a porta: `POST /api/fases/<id>/verificar` com `{ objetoId: "frente-porta", resposta: "00000" }`.
  3. De um cliente B, em outra máquina (outro IP), mandar a senha **certa** `92139` uma única vez.
- **Esperado:** pela ADR-003 e pelo contrato `api.md`, o limite é "30 a cada 10 min (porta), **por IP e fase**". O cliente B, que nunca errou, recebe `200 { aberta: true }`.
- **Obtido:** o cliente B recebe `429 {"tentarEmSegundos":600}` na primeira tentativa. Medido em 06/11/2026: o cliente A era o host (127.0.0.1) e o B, outro contêiner na rede do Compose (172.18.0.6, IP confirmado no log do Caddy).
- **Causa:** em produção, o navegador não fala com a Api, fala com o proxy (ADR-017). A Api é criada com `Fastify()` sem `trustProxy` (`apps/api/src/app.ts`, linha 21), então o `request.ip` usado em `apps/api/src/rotas/verificar.ts`, linha 84, é sempre o endereço do proxy. Todos os jogadores do mundo viram um IP só. O mesmo vale para o limite dos enigmas (300/min).
- **Por que os testes não pegaram:** a suíte de integração chama a Api direto e a de sistema roda sem proxy (`infra/e2e/entrada.sh`). O relatório da Sarah registra "nada foi testado atrás de proxy ou HTTPS (fase 8)".
- **Efeito:**
  - Uma pessoa (ou um robô) que erra 30 vezes tira a porta da Escola do ar para todos por 10 min. É uma negação de serviço de graça.
  - Numa sala de aula, 30 alunos tentando a porta ao mesmo tempo já se bloqueiam. Nas sessões da fase 7 isso também pode aparecer.
- **Correção esperada (decisão do Eric):** confiar só no proxy da própria pilha, por exemplo `Fastify({ trustProxy: <configurável por variável de ambiente> })`, com a pilha de produção definindo o valor. O Caddy já manda `X-Forwarded-For`. Não basta confiar em qualquer `X-Forwarded-For`: sem proxy na frente, o cliente forjaria o cabeçalho e escaparia do limite.
- **Caso que deve passar depois da correção:** com a Api atrás de um proxy confiável, dois clientes com `X-Forwarded-For` diferentes têm limites separados. Sem proxy confiável configurado, um `X-Forwarded-For` forjado não muda o limite.
- **Rastreabilidade:** RF-15 (Alta), ADR-003. A pilha de produção está pronta e não precisa mudar para a correção: basta ela definir a variável que o Eric escolher.

---
Responsável (fase 7): Yuri Martinelli · Data: 06/11/2026
