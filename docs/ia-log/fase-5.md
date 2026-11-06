# Log de uso de IA — Fase 5: Teste de Unidade e Integração (Sarah)

Ferramenta: Claude Code (extensão do VS Code), modelo Claude Opus 5.5. Tokens **medidos** na transcrição da sessão (`~/.claude/projects/…`). A entrada inclui o contexto que o modelo relê a cada passo (cache).

## Entregas
- Plano de testes com rastreabilidade: `docs/testes/plano-de-testes.md`.
- Relatório de defeitos: `docs/testes/relatorio-defeitos.md`.
- Cobertura medida: `infra/testes/cobertura.sh`, que falha abaixo de 80% no núcleo.
- CI: `.github/workflows/ci.yml`.

Os 607 testes de unidade e integração vêm da fase 4 (agente 3). Nesta fase eles foram rodados, medidos e revisados, sem casos novos.

**Harness:** esta sessão rodou como sessão principal. Os agentes 3 e 4 não foram usados, então não há relatório em `harness/relatorios/` nem linha nova em `harness/log_decisoes.jsonl`. O motivo: o agente 3 só roda a suíte unitária no contêiner sem navegador (ADR-016).

## Interações

| Data | Objetivo | Prompt (resumo) | Acertou | Errou ou precisou de correção |
|---|---|---|---|---|
| 06/11 | Levantar o que falta das fases 5 e 6 | "Preciso entregar a parte 5 e 6, onde tem Sarah", com o PDF do plano | Mediu antes de escrever: 607 de 607, análise limpa, sem CI nem plano de testes | A primeira construção da imagem falhou (AMB-01); a IA usou um contexto temporário em vez de mexer na infra do Eric |
| 06/11 | Medir a cobertura | (mesma sessão) | Criou o script sem alterar `entrada.sh`; notou que o schema Zod está em `contrato/`, fora da primeira medição, e o incluiu | — |
| 06/11 | Achar defeitos lendo o código | (mesma sessão) | Achou que as ações do RF-05 existem no store e não são chamadas (DEF-01), e que a biblioteca não tem arrastar (DEF-02) | — |

## Onde a IA mais ajudou
Cruzar critério, contrato e código, para achar o que o teste verde esconde: o store testado sem botão na tela.

## Onde não substitui a pessoa
A prioridade dos defeitos e a assinatura do plano são da Sarah. As prioridades do relatório são proposta da IA.

## Sessões

| Data | Ferramenta / modelo | Objetivo | Resultado | Tokens entrada | Tokens saída | Origem |
|---|---|---|---|---|---|---|
| 06/11 | Claude Code / Opus 5.5 | Levantamento, imagem, suíte, cobertura e análise (sessão principal, até 12:29 UTC) | 607 de 607; meta de cobertura atingida | 1.896.323 | 25.497 | medido |
| **Total** | | | | **1.896.323** | **25.497** | medido |

A sessão foi uma só para as fases 5 e 6. O corte entre elas é o início da construção da suíte Playwright. A escrita dos documentos e o commit entram na fase 6.
