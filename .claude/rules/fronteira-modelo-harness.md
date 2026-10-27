# Fronteira entre modelo e harness

Regra que organiza todo o projeto: **tudo o que é julgamento fica no modelo; tudo o que é garantia fica no código.**
Forma operacional: se a consequência de uma decisão errada for recuperável e barata, deixe com o modelo. Se for irreversível, auditável ou regulada, é código.

| Sob decisão do modelo | Determinístico no harness |
|---|---|
| Interpretação de linguagem natural e de código | Quem pode escrever onde, e em qual ambiente |
| Classificação, formulação e descarte de hipóteses | Contagem de iterações, tempo e orçamento |
| Detecção de ambiguidade, conflito e lacuna | Roteamento por severidade, via lista de termos em código |
| Redação de critérios, testes, diagnósticos e código | Validação de esquema e de contrato antes da escrita |
| Escolha de qual ferramenta chamar a cada passo | Quais ferramentas existem no conjunto oferecido |
| Formulação da pergunta na escalada | Condição de parada, reversão e registro de auditoria |

## Consequências práticas
- **O gate é código, não instrução.** Nenhuma política existe só como frase de prompt. Política que só existe no prompt é uma probabilidade, não uma garantia. Ao criar uma política nova, implemente-a em `.claude/hooks/agentes/<agente>.js`; o texto do agente apenas a explica.
- **Restringir ferramentas é mais confiável que instruir.** Para impedir uma ação, prefira não oferecer a ferramenta (`tools:` do agente) a pedir que ela não seja usada.
- **Política eficaz contraria o incentivo imediato do agente.** "Suíte verde" incentiva enfraquecer a asserção; "fechar o chamado" incentiva declarar duplicata. As políticas mais importantes miram exatamente esses atalhos.
- **Uma ferramenta por iteração.** Cada passo gera uma linha em `harness/log_decisoes.jsonl`, o que torna o log auditável e a reversão exata.
- **Escalar não é falhar.** Abrir pendência conta como sucesso parcial. Diante de um bloqueio do gate, leia o motivo e ajuste a ação, ou escale. Nunca tente contornar o gate por outro caminho (outra ferramenta, outro arquivo, outro formato).

## Limites conhecidos (onde o harness só aproxima)
Algumas políticas do desenho são julgamento e não têm verificação exata em código. O harness aproxima e o prompt cobre o restante:
- "não inventa requisito" (agente 3, P3): o harness exige anotação que aponte para um requisito `OK`, mas não prova que o comportamento testado está no critério;
- "confiança abaixo do limiar" (agente 1): o modelo não expõe confiança calibrada; a P4 por termos é a garantia real;
- precedente usado como fonte (agente 1, P2): o harness prova que o `trecho_fonte` existe no documento, mas não que o critério deriva dele.
