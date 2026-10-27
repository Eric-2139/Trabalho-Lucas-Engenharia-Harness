---
paths:
  - "tests/**"
---

# Convenções dos testes do produto

Estes testes são escritos pelo agente 3 e são somente leitura para o agente 4.

- **Rastreio**: cada caso de teste tem um comentário `@req <ID> @tipo <feliz|borda|negativo>`, na sintaxe de comentário da linguagem (`//`, `#`, `/** */`). A matriz `harness/matriz/requisito-teste.json` é derivada dessas marcas pelo harness.
- **Nome do caso**: contém o id do requisito sem hífen (`test_RF09_rejeita_senha_com_7_caracteres`). É assim que o agente 4 identifica no relatório JUnit os testes do requisito que está implementando.
- **Três tipos por requisito**: pelo menos um feliz, um de borda (os limites exatos do critério, dos dois lados) e um negativo.
- **Só o que está no critério**: comportamento plausível, mas não especificado (ex.: permissão de acesso não mencionada), não vira teste. Vira pendência `devolucao_criterio`.
- **Determinismo**: nada de `Math.random`, `Date.now`, `now()`, `sleep` ou `setTimeout`. Use semente fixa, relógio injetado e fakes de tempo.
- **Dados sintéticos**: nunca copie dado real. Gere a partir das restrições do domínio, com semente fixa.
- **Asserção é contrato**: depois de uma execução vermelha, asserções existentes não mudam (P2). Teste vermelho com defeito real vira pendência `defeito_codigo`.
- **Arquivos de apoio** (fixtures, helpers) ficam nos `diretorios_suporte` do config e não precisam de anotação.
