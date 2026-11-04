# Log de uso de IA — Fase 3: Projeto do Programa (Eric)

Ferramenta: Claude Code (CLI no terminal), modelo Claude Opus 5.5. Tokens **medidos** nas transcrições das sessões (`~/.claude/projects/…`). A entrada inclui o contexto que o modelo relê a cada passo (cache), por isso é muito maior que o tamanho das mensagens.

## Entregáveis
- **Schema Zod da fase**: `packages/schema/contrato/fase.ts`, revisado campo a campo em `harness/projeto/programa/modulos-schema.md`, com a origem de cada regra e as decisões D-01 a D-08. Antes de entrar, foi testado numa sonda com 29 casos de borda dos RF-07, RF-08 e RF-12.
- **Estrutura de pastas**: monorepo pnpm com `packages/schema`, `packages/player`, `apps/editor`, `apps/player`, `apps/api`, `fases-exemplo/`, `tests/`, `infra/` (`harness/projeto/programa/README.md`).
- **Especificação de módulos**: `modulos-schema.md`, `modulos-player.md`, `modulos-editor.md`, `modulos-api.md` e `modulos-banco.md`. As interfaces também existem em código, nas pastas `contrato/` de cada pacote, com stubs em `src/` que lançam "não implementado".
- **Catálogo de sprites e fonte da migração**: o jogo legado (Math_Scape_Telas, commit `f62627e`) foi copiado para `harness/entrada/legado/`. As imagens viraram os sprites do catálogo, e a migração da Escola ficou especificada parede por parede (`modulos-schema.md` §6).
- **CLAUDE.md do produto**: seção "Produto: Math Scape" com stack, comandos, convenções e a regra "mudou o schema, atualiza os testes".
- **Harness pronto para os agentes 3 e 4**:
  - imagem `math-scape-testes` (Node 24 + PostgreSQL, sem rede, com migrations);
  - comandos da suíte e da análise em `harness/config.json`;
  - caminhos de contrato e de implementação configurados.
  - Suíte e análise verdes no contêiner.
- **Decisões**: ADR-015 (contrato separado da implementação), ADR-016 (suíte em contêiner sem rede), ADR-017 (Api no mesmo site, sob `/api`).
- **Gerador do projeto** versionado em `harness/projeto/gerar-projeto.js` (estava numa pasta temporária). Agora ele também confere as especificações de módulos e o config do harness. Matriz com 88 pares, 28 de 28 requisitos.
- **Rastreabilidade**: 8 rodadas de `/verificar-rastreabilidade`; 16 lacunas registradas (LAC-027 a LAC-042), todas resolvidas. A última rodada terminou em `sucesso` sem lacuna nova (`harness/relatorios/projeto-2026-11-04T18-43-14-922Z.json`).

## Sessões

| Data | Ferramenta / modelo | Objetivo | Resultado / correções | Tokens entrada | Tokens saída | Origem |
|---|---|---|---|---|---|---|
| 04/11 | Claude Code / Opus 5.5 | Ler o repositório, esqueleto, schema, contratos, contêiner de testes, documentos e resolução das lacunas (sessão principal) | ver abaixo | 60.994.424 | 201.881 | medido |
| 04/11 | idem, subagente `projeto` | rodada 1 | `falha_controlada` (teto de 80 iterações): 6 lacunas registradas e 4 achados listados; LAC-031 (o legado não estava no workspace) | 3.876.120 | 38.198 | medido |
| 04/11 | idem | rodada 2 | `sucesso`: resoluções conferidas; LAC-033 (o "Quadro" do legado já trazia o enigma desenhado) | 1.925.751 | 20.071 | medido |
| 04/11 | idem | rodada 3 | `sucesso`, 2 novas; LAC-035 (acerto sem dígito não tinha reação na tela) | 1.932.934 | 18.392 | medido |
| 04/11 | idem | rodada 4 | `sucesso`, 1 nova (LAC-036, mensagem de falha do motor) | 304.417 | 7.967 | medido |
| 04/11 | idem | rodada 5 | `sucesso`, 2 novas (recusas do store e falhas de rede sem valor definido) | 401.322 | 10.462 | medido |
| 04/11 | idem | rodada 6 | `sucesso`, 3 novas (422 de publicar, caminhos de erro do envelope, resíduos) | 883.605 | 15.201 | medido |
| 04/11 | idem | rodada 7 | `sucesso`, 1 nova (só texto) | 440.280 | 9.573 | medido |
| 04/11 | idem | rodada 8 | `sucesso`, **nenhuma lacuna nova**; 42 resolvidas | 117.289 | 4.234 | medido |
| **Total** | | | | **70.876.142** | **325.979** | medido |

A linha da sessão principal foi medida ao escrever este log; o commit e o push vêm depois.

## Onde a IA acertou
- **O agente 5 achou o que impediria a fase 4.** O legado não estava no workspace (LAC-031). Sem ele, o agente 3 não testaria "perguntas iguais às do legado" e o agente 4 teria de inventar as perguntas.
- **Apontou um atalho do próprio desenho.** O catálogo de sprites era contrato e, ao mesmo tempo, estava no escopo do agente 4, que poderia mudar o que o schema aceita para deixar um teste verde (LAC-027).
- **Achou defeitos que só apareceriam no teste do sistema:**
  - o banco da suíte ignoraria os `CHECK` escritos em SQL (LAC-028);
  - "mudar camada" não mudaria nada com camadas empatadas (LAC-032);
  - o "Quadro" genérico da biblioteca traria desenhado o enigma da Escola (LAC-033).
- **Pegou o que o agente 3 viraria em asserção errada.** As rodadas 4 a 7 acharam tipos do contrato cujo valor não estava escrito: mensagens de falha, recusas do store, resultado de rede, corpo do 422.
- **O gerador do projeto evitou rodadas.** Ele recusou três citações de ADR sem par na matriz antes de o agente 5 rodar, que é a classe de erro da LAC-026 na fase 2.
- **Um risco de segurança do harness foi pego cedo.** O `"type": "module"` no `package.json` da raiz faria o Node tratar os hooks em CommonJS como ESM, e o gate quebraria com exit 1, que não bloqueia. Ele foi removido, e `.claude/package.json` fixa CommonJS para o harness.

## Onde errou ou precisou de correção humana
- **A primeira rodada estourou o teto de 80 iterações.** O escopo da fase 3 (código e documentos) é maior que o da fase 2. Nas rodadas seguintes, o pedido indicou por onde começar e pediu leituras econômicas.
- **As lacunas vieram em cascata, uma rodada por vez:** 6, 1, 2, 1, 2, 3, 1, 0. Cada resolução de contrato deixava um detalhe novo sem valor. O ganho foi achar isso antes dos testes; o custo foi de 8 rodadas.
- **O pnpm resolveu o `prisma` para uma versão RC (8.0.0-rc)**, sem correspondência com o `@prisma/client` 7.10. Foi fixado à mão em 7.10.1.
- **A edição por `node -e` com crases no Git Bash comeu trechos de comentários.** Foi corrigida, e a partir daí as edições foram feitas por arquivos de script.
- **Decisões de projeto sem requisito ficam para a equipe confirmar:**
  - limites de texto (D-03);
  - senha padrão "00000";
  - sem política de senha no cadastro;
  - o "terceiro dígito" da pergunta da frente mantido como no legado;
  - mensagens de acerto do legado não migradas.
