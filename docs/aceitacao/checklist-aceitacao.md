# Checklist de aceitação — Math Scape (fase 7)

Responsável: Yuri Martinelli · Fonte: `harness/baseline/requisitos.json`, versão 2026-11-03.1 (aprovada por Roberta Telles), que é o Documento de Requisitos v1.1 · Entrada: [relatório de teste do sistema](../testes/relatorio-teste-sistema.md), commit `8a236d6` · Situação: **em preparação**

Cada critério de aceitação da Roberta vira um ou mais itens marcados como Aprovado (A) ou Reprovado (R). Um item reprovado vira issue para o Eric, com os passos e o requisito.

## Como cada item é verificado

| Código | Quem verifica | Como |
|---|---|---|
| **S** | Participantes | Observado nas sessões com usuários reais ([roteiros](roteiros-tarefas.md)). A tarefa vem entre parênteses. |
| **C** | Yuri | Conferência manual, com os passos curtos descritos no item. |
| **E** | Fase 6 | Evidência automatizada da Sarah, aceita mediante uma conferência rápida. Vale para o que não dá para observar à mão (banco, contraste calculado, medição de quadros). |

⚠ marca os pontos que a Sarah deixou para observar na aceitação.

## Regra de decisão

- **Aceito:** todos os itens de prioridade Alta aprovados e o RNF-08 aprovado.
- **Aceito com ressalvas:** só itens de prioridade Média ou Baixa reprovados, com issue aberta para cada um.
- **Não aceito:** algum item Alto ou o RNF-08 reprovado. O item volta para o Eric, e a fase 7 repete só os itens afetados depois da correção.

## Funcionais

| Item | Req. | Prior. | Critério verificado | Como | Resultado | Observação / issue |
|---|---|---|---|---|---|---|
| A01 | RF-01 | Alta | Cadastro com nome, e-mail e senha permite fazer login | S (T1) | | |
| A02 | RF-01 | Alta | Sem login, abrir o editor mostra o login | C: aba anônima → endereço do editor | | |
| A03 | RF-01 | Alta | Sem login, é possível jogar uma fase publicada | S (J1, aba anônima) | | |
| A04 | RF-02 | Alta | Criar, renomear, duplicar e excluir refletem na lista do criador | S (T2) + C (renomear, duplicar e excluir) | | |
| A05 | RF-02 | Alta | Excluir fase publicada pede confirmação: cancelar não muda nada; confirmar tira a fase de Escolher Fase | C | | |
| A06 | RF-02 | Alta | Ctrl+Z não restaura fase excluída | C | | |
| A07 | RF-02 | Alta | Alterar fase de outro criador é recusado | C: conta B abre `/fases/<id da fase de A>` no editor · E: `tests/api/fases.test.ts` | | |
| A08 | RF-03 | Alta | 5 abas; cada uma mostra só os objetos da sua parede; a área mantém a proporção ao redimensionar a janela | S (T3) + C (redimensionar) | | ⚠ "sem rolagem" medido só no Chromium |
| A09 | RF-04 | Alta | A biblioteca tem porta, quadro, janela, relógio e os objetos da fase original (giz, selo, árvore e os demais) | C | | |
| A10 | RF-04 | Alta | Arrastar da biblioteca até a parede ativa coloca o objeto nela | S (T3) | | ⚠ arraste medido só no Chromium: anotar o navegador de cada participante |
| A11 | RF-05 | Alta | Mover, redimensionar e rotacionar continuam iguais depois de recarregar | S (T3) + C (F5) | | |
| A12 | RF-05 | Alta | Mudar a camada altera a sobreposição; duplicar cria cópia na mesma parede; excluir remove | S (T6) + C | | |
| A13 | RF-06 | Média | PNG, JPG ou WebP de até 5 MB servem como fundo e como objeto | S (T4) | | |
| A14 | RF-06 | Média | Outro formato ou arquivo acima de 5 MB é recusado com mensagem, e nada é gravado | C: `imagem-6mb.jpg` e `imagem.gif` (ver roteiros) | | |
| A15 | RF-06 | Média | Com uma lista longa de imagens (20 envios), o editor continua sem rolagem e a biblioteca e o painel ficam à vista | C, em 1280x720, nos 3 navegadores | | ⚠ não testado na fase 6 |
| A16 | RF-07 | Alta | Todo objeto tem exatamente um dos 4 tipos; a decoração não mostra campos de comportamento | S (T5) + C | | |
| A17 | RF-07 | Alta | Tipo fora dos quatro ou decoração com fala é recusado | C: importar arquivo alterado à mão · E: `tests/schema/fase.test.ts` | | |
| A18 | RF-08 | Alta | Fala grava o texto; o enigma grava pergunta, respostas numéricas, dica e dígitos; resposta que não é número é recusada; enigma sem dígito é aceito | S (T5) + C | | |
| A19 | RF-08 | Alta | A porta começa com 5 dígitos, aceita de 4 a 8 e recusa 3, 9 ou letras | C | | |
| A20 | RF-09 | Média | Depois de mover, Ctrl+Z volta à posição anterior e Ctrl+Y à nova | S (T6) + C | | |
| A21 | RF-10 | Alta | Alteração é salva em até 30 s, ao trocar de parede e ao mandar salvar; depois de recarregar, continua lá | C (cronometrar 30 s sem clicar em salvar) | | |
| A22 | RF-10 | Alta | Em fase publicada, salvar muda só a versão em edição; quem joga vê a publicada até publicar de novo | C (duas janelas: editor e aba anônima) | | Observar o aviso preso da OBS-01 |
| A23 | RF-11 | Alta | O modo testar joga com as regras do jogador e confere no servidor; ao sair, a fase está inalterada | S (T7) + C | | DEF-07: anotar se os rótulos diferentes confundem |
| A24 | RF-12 | Média | Senha 92139 com as posições 2 e 5 sem enigma: publicação recusada mostrando 2 e 5 | C | | Anotar em T8 se a mensagem é entendida |
| A25 | RF-12 | Média | Fase sem porta pode ser publicada | C | | |
| A26 | RF-13 | Alta | Fase não publicada não aparece em Escolher Fase; publicada aparece e qualquer jogador consegue jogar | S (T8 e J1) | | |
| A27 | RF-13 | Alta | Editar fase publicada não muda o que o jogador vê; publicar de novo substitui | C (junto com A22) | | |
| A28 | RF-14 | Baixa | Exportar e importar o mesmo arquivo gera fase igual; arquivo fora do schema é recusado; exportar fase de outro criador é recusado | C | | A importação da Escola na preparação já exercita isto |
| A29 | RF-15 | Alta | Enigma com respostas A e B resolve com qualquer uma e revela os dígitos; resposta errada não revela; porta abre só com a senha completa | S (J2) + C (fundo da Escola: -15 e 80) | | |
| A30 | RF-15 | Alta | Com resposta 80: "80", " 80 ", "080" e "80,0" resolvem; "oitenta" e texto sem número não | C (fundo da Escola) | | |
| A31 | RF-16 | Média | Clicar em decoração não faz nada; clicar em fala com texto T mostra T | S (J1 e J2) + C | | |
| A32 | RF-17 | Média | Enigma com dica mostra o ícone com a dica; sem dica, não há ícone | S (T5 e J2) + C | | |
| A33 | RF-18 | Alta | Escola: esquerda 15 e 40 sem dígito; teto 55 → 92; direita 123 → 1; frente 310 → 3; fundo -15 ou 80 → 9; 92139 abre a porta; perguntas iguais às do legado | S (J2) + C + E (equivalência) | | DEF-06 (quadro vazio) e DIF-01 (4 falas): anotar se o participante percebe ou estranha. **[DEF-09](relatorio-defeitos-aceitacao.md):** sem seed, a Escola não entra no banco |
| A34 | RF-19 | Alta | Excluir a própria conta e confirmar encerra a sessão, recusa o login e apaga nome, e-mail e hash; cancelar mantém a conta | C (consulta no banco abaixo) | | |
| A35 | RF-19 | Alta | Excluir conta de outro usuário é recusado | E: `tests/api/auth.test.ts` | | |

## Não funcionais

| Item | Req. | Critério verificado | Como | Resultado | Observação / issue |
|---|---|---|---|---|---|
| A36 | RNF-01 | Fluxo criar, publicar e jogar concluído nas duas últimas versões de Chrome, Edge e Firefox, a partir de 1280x720 | S (participantes divididos entre os navegadores) + C. Anotar a versão exata de cada navegador | | Fase 6 mediu só uma versão de cada. DEF-08 aberto |
| A37 | RNF-01 | Abaixo de 1280x720 aparece um aviso | C (janela em 1279x720) | | |
| A38 | RNF-02 | Em 1280x720, 1920x1080 e 2560x1440 a sala fica em 16:9 e os objetos mantêm posição e tamanho relativos | C (modo dispositivo do DevTools) + E | | |
| A39 | RNF-03 | Arrastar com 50 objetos numa parede mantém pelo menos 30 quadros por segundo, numa máquina real com a janela visível | C: importar `fase-50-objetos-importar.json`, arrastar e medir com o medidor de FPS do DevTools. Anotar a máquina e o navegador | | A fase 6 mediu sem janela visível e sem GPU |
| A40 | RNF-04 | Nenhuma resposta nem senha aparece nas respostas HTTP do jogo e do modo testar | C: DevTools → Rede → buscar `92139`, `respostas`, `revela` + E | | |
| A41 | RNF-05 | O banco guarda só hash argon2 e o cookie de sessão é HttpOnly | C: consulta no banco + DevTools → Aplicativo → Cookies (`sid`) | | |
| A42 | RNF-06 | O cadastro pede e grava só nome, e-mail e senha | C (formulário) + E: `tests/api/auth.test.ts` (campo extra) | | |
| A43 | RNF-07 | Textos em português; contraste AA; login, Escolher Fase e barra do editor operáveis só pelo teclado, com foco visível | C (teclado) + E (contraste calculado na fase 6) | | |
| A44 | RNF-08 | Participante que não programa publica, **sem ajuda**, uma fase jogável em **menos de 30 minutos** | S (T2 a T8, cronometrado) | | Critério de sucesso 2 do plano |
| A45 | RNF-09 | Documento fora do schema é recusado ao salvar, publicar e importar; documento válido é aceito nos três | C (importar) + E (salvar e publicar pela Api) | | |

## Consultas usadas nas conferências

```sql
-- RNF-05: o hash precisa começar com $argon2
SELECT email, left(senha_hash, 10) FROM usuarios;
-- RF-19: depois de excluir a conta, nenhuma linha
SELECT count(*) FROM usuarios WHERE email = '<e-mail da conta excluída>';
```

## Resultado consolidado

| | Alta | Média | Baixa | RNF |
|---|---|---|---|---|
| Aprovados | | | | |
| Reprovados | | | | |

Decisão: ☐ Aceito ☐ Aceito com ressalvas ☐ Não aceito

---
Assinatura do responsável (fase 7): Yuri Martinelli · Data: ___/___/2026
