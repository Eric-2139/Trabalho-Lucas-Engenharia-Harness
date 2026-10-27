---
name: promover-baseline
description: Gate humano — promove requisitos do rascunho (agente 1) para o baseline aprovado em harness/baseline/requisitos.json, após as pendências serem respondidas. Só o humano dispara; agentes nunca escrevem no baseline.
disable-model-invocation: true
---

Você está na **sessão principal**, agindo em nome do humano que aprova o baseline. Os agentes não têm permissão de escrita aqui; esta é a passagem de responsabilidade do rascunho para o documento assinado.

1. Leia `harness/rascunho/requisitos/` e `harness/pendencias/`.
2. Monte uma tabela para o usuário: id, status, pendências ligadas (abertas/respondidas).
3. **Pergunte ao usuário**, requisito a requisito (ou em lote, se ele pedir), o que entra. Regras:
   - `OK` sem pendência aberta → candidato direto;
   - `OK_PENDENTE_REVISAO` → só entra com a pendência respondida pelo humano; ao entrar, vira `OK`;
   - `AMBIGUO` / `CONFLITO` → entram com o status atual (os agentes 3 e 5 precisam vê-los para devolver e bloquear), a menos que o usuário forneça a resposta, caso em que o requisito é reescrito com o critério decidido e vira `OK`.
4. Grave `harness/baseline/requisitos.json` no formato abaixo, com a `versao` incrementada (ex.: `2026-09-22.1`). Nunca edite o baseline de forma parcial: o arquivo inteiro é a versão.
5. Informe ao usuário que, com o baseline alterado, uma execução em curso do agente 5 vai abortar (P2), e que convém rodar `/verificar-rastreabilidade` de novo.

```json
{
  "versao": "2026-09-22.1",
  "aprovado_por": "<nome>",
  "aprovado_em": "<ISO>",
  "requisitos": [ { "id": "RF-01", "...": "mesmo formato do rascunho" } ]
}
```
