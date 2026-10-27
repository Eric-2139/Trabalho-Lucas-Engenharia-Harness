---
name: verificar-rastreabilidade
description: Executa o agente 5 para verificar a consistência entre requisitos aprovados e artefatos de projeto (componentes, decisões, contratos), registrando lacunas classificadas. Use após aprovar o baseline, após mudar o projeto, ou quando um agente reportar acoplamento ou conflito projeto×requisito.
context: fork
agent: projeto
---

Verificar a rastreabilidade requisito ↔ componente ↔ decisão. $ARGUMENTS

Procedimento:
1. Leia `harness/baseline/requisitos.json` e anote a `versao`: ela vai em toda lacuna.
2. Leia `harness/matriz/rastreabilidade.json`, `harness/projeto/componentes/` e as decisões de arquitetura em `harness/projeto/`.
3. Para cada requisito:
   - sem componente → antes de registrar como `requisito_orfao`, procure um componente que o cubra parcialmente (`lacuna_parcial`);
   - RNF crítico sem `decisao_id` → `rnf_sem_decisao`, bloqueante. Se o próprio requisito estiver ambíguo, vincule a pendência de origem em vez de propor uma decisão sobre nada.
4. Para cada componente sem requisito → `componente_sem_ancora`, com a hipótese de requisito implícito (conformidade, operação, histórico). Nunca proponha remoção.
5. Contratos incompatíveis entre componentes que realizam o mesmo requisito → `conflito_contrato`.
6. Revise as pendências abertas por outros agentes do tipo `arquitetura` (conflito projeto×teste, acoplamento oculto) e registre as lacunas correspondentes.
7. Relate o percentual rastreado, as lacunas por tipo e os impedimentos.
