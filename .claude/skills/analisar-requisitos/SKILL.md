---
name: analisar-requisitos
description: Executa o agente 1 sobre a especificação em harness/entrada/especificacao.md, produzindo requisitos atômicos com critério de aceitação no rascunho e pendências para decisão humana. Use no início do processo ou quando a especificação mudar.
context: fork
agent: requisitos
---

Analise a especificação em `harness/entrada/especificacao.md`. $ARGUMENTS

Procedimento:
1. Liste `harness/rascunho/requisitos/` e `harness/pendencias/`: se já houver trabalho anterior, continue a partir dele. Mesmo id é uma nova versão, não uma duplicata.
2. Leia o glossário e os precedentes em `harness/base-conhecimento/`, se existirem.
3. Leia o documento em trechos sequenciais de até 80 linhas. Para cada trecho:
   - extraia os requisitos atômicos (um ator, uma ação, uma condição verificável);
   - compare cada um com os já registrados, procurando conflito;
   - redija o critério de aceitação **só** com base no documento atual;
   - registre com `Write` em `harness/rascunho/requisitos/<ID>.json`;
   - abra as pendências necessárias (skill `abrir-pendencia`).
4. Ao chegar ao fim do documento, revise: todo `AMBIGUO`, `CONFLITO` e `OK_PENDENTE_REVISAO` tem pendência? Todo conflito está marcado nos dois lados?
5. Entregue o relatório: balanço por status, percentual não fechado e as pendências priorizadas.

Formato do requisito:
```json
{
  "id": "RF-04",
  "texto": "O operador pode excluir registros de cliente.",
  "categoria": "funcional",
  "subcategoria": null,
  "criterio_aceitacao": "Dado um operador autenticado, quando solicita a exclusão do cliente X, então X deixa de aparecer na consulta.",
  "trecho_fonte": "o operador pode excluir registros de cliente",
  "status": "OK_PENDENTE_REVISAO",
  "conflita_com": [],
  "pendencias": ["PEND-002"]
}
```
Requisito não funcional usa `"categoria": "nao_funcional"` e `subcategoria` obrigatória (`desempenho`, `seguranca`, `disponibilidade`, `usabilidade`, …).
