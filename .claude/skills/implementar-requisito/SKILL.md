---
name: implementar-requisito
description: Executa o agente 4 para implementar UM requisito aprovado contra a suíte do agente 3, dentro do escopo do projeto do componente, com reversão automática em regressão. Use com o id (ex.: /implementar-requisito RF-09). Pré-requisito — os testes do requisito já existem.
argument-hint: <RF-NN>
context: fork
agent: codificacao
---

Implementar o requisito **$ARGUMENTS**.

Procedimento:
1. `node .claude/ferramentas/iniciar-tarefa.js --requisito $ARGUMENTS`. Se for recusado (requisito não aprovado ou projeto sem arquivos previstos), abra pendência `arquitetura` e encerre.
2. Leia o contrato e as decisões do componente em `harness/projeto/` e os testes do requisito (somente leitura).
3. Ciclo editar → testar (`node .claude/ferramentas/executar-suite.js --agente codificacao`), com a menor alteração possível por ciclo. Use `git diff` para revisar o que mudou.
4. A cada resultado:
   - **revertido por regressão** → o harness já desfez; registre o acoplamento descoberto e tente outra abordagem que não toque o módulo compartilhado, ou escale;
   - **teste contradiz o projeto** → não viole o projeto: pendência `arquitetura` para o agente 5 e o arquiteto, e deixe a parte feita;
   - **precisa de dependência ou de arquivo fora do escopo** → pendência `arquitetura` com as opções e siga só com o que está no escopo.
5. Encerre quando estiver verde com análise limpa ou quando o teto de 5 ciclos for atingido. Relate ciclos, reversões, pendências e achados.
