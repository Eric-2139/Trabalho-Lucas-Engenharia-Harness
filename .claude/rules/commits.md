# Commit ao fim de cada fase

Pedido do Eric (03/11/2026): ao concluir uma fase do processo em cascata, o trabalho é commitado sem precisar pedir de novo.

## Quando uma fase conta como concluída
| Fase | Concluída quando |
|---|---|
| 1 · Análise de requisitos | baseline promovido em `harness/baseline/requisitos.json` (gate humano) |
| 2 · Projeto do sistema | `/verificar-rastreabilidade` sem lacuna aberta nem bloqueante contra o baseline vigente |
| 3 · Projeto do programa | schema da fase, estrutura de pastas e especificação de módulos revisados |
| 4 · Codificação | requisito implementado com a suíte verde (relatório do agente 4 com `sucesso`) |
| 5-8 | artefato de saída da fase entregue (relatório de testes, aceitação, manutenção) |

Rodada de agente que terminou em `falha_controlada`, `incompleto` ou com o harness inativo (sem linha no `harness/log_decisoes.jsonl`) **não** é fase concluída: não commite.

## Como
- Um commit por fase, só com os artefatos daquela fase. Mensagem: `Fase N (<nome>): <o que foi entregue>`, com o relatório do harness citado no corpo.
- Inclua o log de IA da fase (`docs/ia-log/fase-N.md`) com os tokens medidos.
- Commite no branch de trabalho, nunca direto na `main`. Se estiver na `main`, crie antes `fase-N-<nome>`. Merge e push só com pedido explícito.
- Nunca commite `harness/estado/` nem `harness/log_decisoes.jsonl` (ignorados pelo `.gitignore`), nem segredo ou dado pessoal.
- Antes de commitar, rode `node --test ".claude/testes-harness/*.test.js"`; se falhar, não commite e avise.
