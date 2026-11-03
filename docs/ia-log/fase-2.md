# Log de uso de IA — Fase 2: Projeto do Sistema (Eric)

Ferramenta: Claude Code (CLI no terminal), modelo Claude Opus 5.5. Tokens **medidos** nas transcrições das sessões (`~/.claude/projects/…`). A entrada inclui o contexto que o modelo relê a cada passo (cache), por isso é muito maior que o tamanho das mensagens.

O baseline usado foi criado no mesmo dia pelo fluxo do harness (ver `fase-1.md`). Os agentes rodaram pelo CLI do terminal, porque na extensão do VS Code os hooks do harness não rodam.

## Entregáveis
- `harness/projeto/arquitetura.md`: Documento de Arquitetura (componentes, comunicação, modelo de dados, API, onde cada regra roda, RNF críticos, decisões).
- `harness/projeto/decisoes/ADR-001..014.md`: 14 ADRs.
- `harness/projeto/contratos/*.md` (5) e `harness/projeto/componentes/*.json` (5): SchemaFase, Editor, Player, Api, Banco.
- `harness/matriz/rastreabilidade.json`: 84 pares requisito → componente → decisão, 28 de 28 requisitos.
- Baseline `2026-11-03.1`: respostas às PEND-005 a 009 incorporadas aos critérios (RF-08, RF-10, RF-12, RF-13, RF-15, RNF-03, RNF-04).

## Sessões

| Data | Ferramenta / modelo | Objetivo | Resultado / correções | Tokens entrada | Tokens saída | Origem |
|---|---|---|---|---|---|---|
| 03/11 | Claude Code / Opus 5.5 | Arquitetura, ADRs, contratos, componentes, matriz, novo baseline e correções das lacunas (sessão principal) | Cinco rodadas de correção | 22.309.259 | 105.265 | medido |
| 03/11 | idem, subagente `projeto` | `/verificar-rastreabilidade`, rodada 1 | `escalado`: 12 lacunas, 3 bloqueantes; LAC-003 (salvamento automático recusado pelo schema) | 652.487 | 28.793 | medido |
| 03/11 | idem | rodada 2 | `escalado`: 5 novas; LAC-015 (limite por IP quebraria turma em laboratório) | 799.382 | 28.646 | medido |
| 03/11 | idem | rodada 3 (baseline `2026-11-03.1`) | `sucesso`, 5 novas não bloqueantes; LAC-021 (limite por partida não segurava força bruta) | 821.056 | 27.016 | medido |
| 03/11 | idem | rodada 4 | `sucesso`, 3 novas (desalinhamentos ADR × matriz) | 674.900 | 19.808 | medido |
| 03/11 | idem | rodada 5 | `sucesso`, 1 nova (obrigação do Editor na ADR-001 fora da matriz) | 578.047 | 14.674 | medido |
| 03/11 | idem | rodada 6 | `sucesso`, **nenhuma lacuna nova**; 26 resolvidas | 401.939 | 12.904 | medido |
| **Total** | | | | **26.237.070** | **237.106** | medido |

## Onde a IA acertou
- O agente 5 achou defeitos de projeto que passariam para a codificação. O pior: o salvamento automático mandaria estados intermediários (enigma sem resposta, objeto fora da parede) que o próprio schema recusa, e o criador perderia trabalho (LAC-003, ADR-011).
- Pegou efeitos colaterais das minhas próprias correções, duas vezes seguidas, no limite de tentativas contra força bruta: por IP, bloquearia uma turma inteira (LAC-015); por partida, não seguraria ninguém (LAC-021).
- Nenhum agente inventou resposta para pendência aberta; as PEND-005 a 009 foram respondidas pela equipe.

## Onde errou ou precisou de correção humana
- A matriz, os cabeçalhos das ADRs e os contratos se desencontraram várias vezes (LAC-017, 022, 025, 026). A solução foi tornar a matriz a fonte única: o gerador escreve as decisões dos componentes, os cabeçalhos dos contratos e das ADRs e as tabelas do documento, e recusa contrato que cite ADR fora das decisões do componente.
- O agente errou dois campos em lacunas imutáveis (pendência vinculada da LAC-021; contagem de pares da LAC-025) e pediu correção ao arquiteto na resolução.
- Interpretações registradas que a equipe pode corrigir: PEND-006 "em qualquer uma" = mede na máquina do teste e registra a configuração; PEND-008 "só o número" = exatamente um número no texto, vírgula ou ponto decimal, sem separador de milhar.
