---
name: gerar-testes
description: Executa o agente 3 para converter requisitos OK do baseline em testes executáveis (feliz, borda, negativo) com rastreio requisito↔teste. Aceita ids específicos (ex.: /gerar-testes RF-04 RF-09) ou, sem argumento, todos os requisitos elegíveis.
argument-hint: "[RF-NN ...]"
context: fork
agent: testes
---

Gerar testes para: **$ARGUMENTS** (vazio = todos os requisitos `OK` do baseline).

Procedimento:
0. **Primeiro passo**: `node .claude/ferramentas/definir-escopo.js $ARGUMENTS`. Fixa os requisitos desta rodada (sem ids = todos os `OK`); a parada cobra só eles. O escopo vale uma vez por execução.
1. Leia `harness/baseline/requisitos.json` e `harness/matriz/requisito-teste.json`, para saber o que já está coberto.
2. Para cada requisito elegível:
   - leia o critério de aceitação e **só** o contrato público do módulo (caminhos de contrato do config);
   - derive o caso feliz, os de borda (limites exatos do critério: 7 e 8 caracteres, 0 e 1 item…) e os negativos;
   - gere dados sintéticos com semente fixa que respeitem as restrições do domínio;
   - escreva o teste com uma anotação `@req <ID> @tipo <feliz|borda|negativo>` por caso e o id sem hífen no nome do caso.
3. Se o requisito não está `OK`, ou se um caso "natural" exigiria um comportamento que o critério não menciona, **não escreva o teste**: abra pendência `devolucao_criterio` para o agente 1.
4. Rode `node .claude/ferramentas/executar-suite.js --agente testes`.
   - Vermelho em teste novo: primeiro confira se o teste reflete fielmente o critério. Se reflete, o defeito é real: abra pendência `defeito_codigo` citando o critério. Nunca ajuste a asserção para passar.
5. Relate a cobertura por requisito, as devoluções e os defeitos encontrados.
