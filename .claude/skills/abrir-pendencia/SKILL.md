---
name: abrir-pendencia
description: Formato e regras para escalar ao humano abrindo uma pendência estruturada em harness/pendencias/. Use sempre que houver ambiguidade, conflito, categoria crítica, critério ausente, conflito de arquitetura, defeito real de código ou desvio de requisito — escalar é sucesso parcial, não falha.
user-invocable: false
---

# Abrir pendência (ferramenta de escalada comum aos agentes)

Um agente que nunca escala não está mais confiante, está mais perigoso. A pendência é o produto mais valioso do processo: é o defeito que, no cascata puro, só apareceria no teste de aceitação.

## Como abrir
1. Liste `harness/pendencias/` e escolha o próximo número livre (`PEND-001`, `PEND-002`, …).
2. Grave **um novo arquivo** `harness/pendencias/PEND-NNN.json` com `Write`. Pendência existente é imutável: para complementar, abra outra e cite a anterior no `contexto`.

```json
{
  "id": "PEND-004",
  "tipo": "ambiguidade",
  "agente_origem": "requisitos",
  "req_ids": ["RNF-01"],
  "chamado_id": null,
  "pergunta": "Qual p95 é aceitável para a consulta de cliente?",
  "opcoes": ["< 2s (padrão interno, precedente do projeto X)", "< 500ms", "outro"],
  "contexto": "Trecho: 'o sistema deve responder rápido às consultas de cliente'. 'Rápido' não tem métrica.",
  "impacto": "Sem número, RNF-01 não tem teste (agente 3) nem decisão de arquitetura (agente 5).",
  "status": "aberta"
}
```

## Regras (validadas pelo harness)
- `agente_origem` é o seu nome de agente.
- `status` é sempre `"aberta"`. Só o humano responde.
- `tipo` ∈ `ambiguidade`, `conflito`, `revisao_critica`, `devolucao_criterio`, `arquitetura`, `defeito_codigo`, `desvio_requisito`, `escalada`.
- `ambiguidade` e `conflito` oferecem **ao menos duas opções**: o humano decide mais rápido escolhendo do que redigindo.
- `chamado_id` é preenchido quando a escalada vem de um chamado (agente de manutenção).

## Como escrever uma boa pergunta
- Uma decisão por pendência.
- Cite o trecho, a linha de log ou o teste que originou a dúvida.
- Diga o que fica bloqueado enquanto não houver resposta (`impacto`).
- Precedente de outro projeto entra como **opção**, nunca como resposta presumida.
