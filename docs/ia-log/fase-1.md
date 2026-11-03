# Log de uso de IA — Fase 1: Análise de Requisitos no harness (03/11/2026)

Complementa a seção 11 do Documento de Requisitos v1.1 (Roberta). Ferramenta: Claude Code (extensão do VS Code e depois CLI no terminal), modelo Claude Opus 5.5. Tokens **medidos** nas transcrições das sessões; a entrada inclui o contexto relido a cada passo (cache).

## O que foi feito
O `harness/baseline/requisitos.json` nunca tinha sido criado. Ele foi gerado pelo fluxo do harness a partir do Documento de Requisitos v1.1:

1. `harness/entrada/especificacao.md`: o plano, a análise do legado e as decisões PEND-01 a 10 da equipe, sem as respostas que vieram depois do agente.
2. `/analisar-requisitos` (agente 1): 29 requisitos e 6 pendências, 39 de 40 iterações, resultado `sucesso` (`harness/relatorios/requisitos-2026-11-03T20-39-31-000Z.json`).
3. Gate humano (`/promover-baseline`) com as decisões da Roberta no documento: baseline `2026-11-01.2`, 28 requisitos (19 RF, 9 RNF), todos OK, na numeração do PDF; cada requisito guarda `origem_rascunho`. PEND-001 a 004 respondidas; PEND-005 e 006 ficaram abertas (respondidas depois, na fase 2, gerando o baseline `2026-11-03.1`).

**Problema encontrado:** na extensão do VS Code, os hooks do frontmatter dos agentes (o gate, o pós-execução e a parada) não rodavam. O Claude Code os ignora quando o VS Code passa a pasta como restrita. A primeira rodada do agente 1 foi descartada porque rodou sem o harness. No CLI do terminal o gate funciona: o teste de leitura de 200 linhas foi bloqueado com `[harness · LEITURA]`. É provavelmente o mesmo problema anotado pela Roberta ("hooks rodaram no PowerShell e não gravaram relatório nem log"). **Rodar os agentes pelo terminal.**

## Sessões
| Data | Ferramenta / modelo | Objetivo | Resultado / correções | Tokens entrada | Tokens saída | Origem |
|---|---|---|---|---|---|---|
| 03/11 | Claude Code / Opus 5.5 | Ler o repositório, montar a especificação, diagnosticar os hooks, gate humano (sessão principal) | Hooks do frontmatter ignorados no VS Code; resolvido rodando no terminal | 11.320.206 | 58.342 | medido |
| 03/11 | idem, subagente `requisitos` | 1ª rodada do agente 1 (sem gate, descartada) | Saída guardada fora do repositório | 402.530 | 46.449 | medido |
| 03/11 | idem, 3 subagentes de teste | Testar se o gate bloqueia | 2 sem bloqueio (VS Code), 1 bloqueado (terminal) | 76.778 | 1.636 | medido |
| 03/11 | idem, subagente `requisitos` | `/analisar-requisitos` com gate | 29 requisitos, 6 pendências, `sucesso` | 347.591 | 43.511 | medido |
| **Total** | | | | **12.147.105** | **149.938** | medido |

## Onde a IA acertou e errou
- O agente 1 achou o conflito entre "Escola igual ao legado" e os 4 tipos de objeto, e a ambiguidade de editar fase já publicada, que não estava no documento.
- A primeira rodada rodou sem o harness, e o modelo relatou "38 de 40 iterações" como se o harness estivesse contando. Só a ausência de log e de relatório mostrou o problema.
- A lista de termos críticos (P4) marcou "senha" do jogo como credencial: falso positivo previsto pelo desenho, resolvido no gate humano.
