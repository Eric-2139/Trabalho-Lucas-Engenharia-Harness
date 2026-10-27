---
name: triar-chamado
description: Executa o agente 2 para diagnosticar um chamado de harness/chamados/ — deduplicação por causa raiz, correlação de log mascarado, hipóteses com evidência e rastreio até o requisito de origem. Use com o id do chamado (ex.: /triar-chamado 5507).
argument-hint: <id-do-chamado>
context: fork
agent: manutencao
---

Triar o chamado **$ARGUMENTS**.

Procedimento:
1. Leia `harness/chamados/$ARGUMENTS.json`. A severidade define o seu teto de tempo; anote o horário e o serviço afetado.
2. **Similares**: procure em `harness/chamados/` e `harness/diagnosticos/` chamados com descrição parecida. Para cada candidato, leia o diagnóstico e compare a `causa_raiz_id`. Só a mesma causa confirmada fecha como duplicata.
3. **Log**: `node .claude/ferramentas/buscar-log.js --servico <serviço> --inicio <ISO> --fim <ISO>` na janela do incidente. Refine com `--filtro` em vez de repetir a mesma consulta.
4. **Hipóteses**: para cada uma, registre o enunciado, o status e as evidências (`arquivo:linha`). Descarte explicitamente o que não tem suporte.
5. **Código e rastreabilidade**: leia o componente suspeito e procure em `harness/matriz/rastreabilidade.json` o requisito de origem. Consulte o status desse requisito no baseline.
6. **Classifique e roteie**:
   - defeito contra uma especificação clara → `bug_codigo`, com proposta opcional em `harness/propostas/$ARGUMENTS.patch`;
   - requisito ambíguo ou sem métrica → `desvio_requisito` + `escalada_produto`;
   - uso incorreto → `erro_uso` + `orientacao_usuario`;
   - mesma causa raiz de outro chamado → `duplicata` + `fechado_duplicata`.
7. Grave `harness/diagnosticos/$ARGUMENTS.json` e resuma o roteamento e o porquê.
