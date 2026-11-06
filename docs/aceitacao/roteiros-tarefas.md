# Roteiros do teste de aceitação com usuários — Math Scape (fase 7)

Responsável: Yuri Martinelli · Usado com o [checklist de aceitação](checklist-aceitacao.md) · Entrada: commit `8a236d6`

## 1. Participantes

- **De 5 a 8 pessoas de fora da equipe.** Pelo menos 3 que **não programam** (o RNF-08 só conta essas) e pelo menos 2 que programam. Podem ser colegas de outros cursos e professores.
- **Navegador:** cada participante usa um. Divida igualmente entre Chrome, Firefox e Edge, com pelo menos uma pessoa que não programa em cada. A Sarah só mediu o arraste da biblioteca e o layout sem rolagem no Chromium.
- **Tela:** pelo menos uma sessão por navegador com a janela em 1280x720 (o mínimo do RNF-01). As demais na resolução normal do computador.
- **LGPD:** registre o participante só pelo código (P1, P2…) e pelo perfil (programa ou não, curso). Cada um usa o e-mail fictício `p<N>@aceitacao.local`. Peça consentimento antes de gravar a tela e não grave rosto nem voz sem autorização.

| Código | Programa? | Curso / função | Navegador e versão | Resolução | Data |
|---|---|---|---|---|---|
| P1 | | | | | |
| P2 | | | | | |
| P3 | | | | | |
| P4 | | | | | |
| P5 | | | | | |
| P6 | | | | | |

## 2. Preparação do ambiente (uma vez)

Rodar como na suíte da Sarah: builds de produção, Api e PostgreSQL locais, banco limpo.

```bash
pnpm install
docker compose -f infra/dev/docker-compose.yml up -d
export DATABASE_URL=postgresql://postgres@127.0.0.1:5432/math_scape
(cd apps/api && pnpm exec prisma generate && pnpm exec prisma migrate deploy)
(cd apps/editor && NODE_ENV=production pnpm exec vite build)
(cd apps/player && NODE_ENV=production pnpm exec vite build)
(cd apps/api && DIRETORIO_ARMAZENAMENTO=/tmp/armazenamento pnpm exec tsx src/servidor.ts) &
(cd apps/editor && pnpm exec vite preview --port 5173 --strictPort) &
(cd apps/player && pnpm exec vite preview --port 5174 --strictPort) &
```

A Api roda sem `NODE_ENV=production`, como no `infra/e2e/entrada.sh`. Em produção o cookie pode exigir HTTPS, e o login falharia em `http://localhost`.

**Alternativa: o ambiente publicado.** Com a pilha de produção no ar ([implantação](../operacao/implantacao.md)), as sessões podem usar os endereços públicos em vez dos comandos acima. Assim, cada participante usa o próprio computador e navegador, o que ajuda no A36. Antes da primeira sessão, rode `node infra/producao/verificar-implantacao.mjs`. Nesse caso, observe o [DEF-10](relatorio-defeitos-aceitacao.md): participantes na mesma fase podem disparar juntos o limite de tentativas da porta.

**Fase original:** não existe seed ([DEF-09](relatorio-defeitos-aceitacao.md)). O `prisma.config.ts` cita `prisma/seed.ts`, mas o arquivo não está no repositório, então o banco começa sem nenhuma fase. Quando o Eric corrigir, troque este passo por `pnpm exec prisma db seed`. Para disponibilizar a Escola:

1. Crie a conta do condutor no editor.
2. Em Minhas Fases, importe `materiais/escola-01-importar.json`. É o `fases-exemplo/escola-01.json` dentro do envelope de exportação, já validado contra o schema. Isso também exercita o A28.
3. Publique a fase.

**Fase de exemplo do jogador (J1):** com a conta do condutor, crie a fase "Sala do Condutor" com estes objetos:
- uma decoração (janela);
- uma fala (giz: "Alguém esqueceu um recado aqui.");
- um enigma com dica (quadro: "Quanto é 9 + 6?", resposta 15, dica "Conte nos dedos", revela as posições 1 a 4);
- uma porta com a senha 1357.

Publique a fase.

**Materiais:** todos estão em `docs/aceitacao/materiais/`. Copie para a área de trabalho do participante: `parede-tijolo.jpg`, `bau.png` e `planta.webp`. Os arquivos `imagem-6mb.jpg` e `imagem.gif` ficam só com o condutor (A14).

**Entre uma sessão e outra:** feche as janelas anônimas e saia da conta. Não apague o banco, porque as fases publicadas de participantes anteriores também servem para a tarefa J1.

## 3. Roteiro do condutor

**Abertura (5 min), lida igual para todos:**
> "Estamos testando o sistema, não você. Não existe resposta errada. Vou te entregar tarefas em cartões. Tente fazer sozinho e vá falando em voz alta o que está pensando e procurando. Eu não posso explicar a tela, mas se você travar, pode me dizer."

**Durante as tarefas:**
- Não aponte, não explique e não use os nomes dos botões.
- Se a pessoa perguntar, devolva: "O que você tentaria?"
- Se ela ficar **3 minutos parada** no mesmo ponto, dê a ajuda mínima e anote como **ajuda**. A tarefa deixa de contar como "sem ajuda".
- Cronometre cada tarefa do momento em que entrega o cartão até a pessoa dizer que terminou.

## 4. Tarefas: criador

Entregue um cartão por vez. Os cartões dizem **o quê**, nunca **como**.

| Tarefa | Cartão entregue ao participante | Itens do checklist |
|---|---|---|
| **T1** | "Crie uma conta para você com o e-mail `p<N>@aceitacao.local` e entre no sistema." | A01 |
| **T2** ⏱ início do RNF-08 | "Crie uma fase nova chamada **Sala do Tesouro**." | A04 |
| **T3** | "Monte a sala: na parede da **frente**, uma porta e um quadro; na parede **direita**, um relógio e uma janela; na parede da **esquerda**, um giz. Deixe a porta maior e incline um pouco a janela." | A08, A10, A11 |
| **T4** | "Use a foto `parede-tijolo.jpg` como fundo da parede do **fundo** e coloque o `bau.png` nessa parede." | A13 |
| **T5** | "Agora faça o jogo funcionar. A porta abre com a senha **2468**. O quadro pergunta *Quanto é 6 × 4?*, a resposta é **24**, a dica é *Some o 6 quatro vezes*, e ao acertar ele mostra os **dois primeiros** números da senha. O relógio pergunta *Quanto é 100 − 32?*, a resposta é **68**, e ao acertar mostra os **dois últimos** números. Ao clicar no giz, aparece a frase *Tem algo escrito no quadro…*." | A16, A18, A32 |
| **T6** | "Coloque um relógio a mais na parede da esquerda e depois tire ele da sala. Mova a janela e volte atrás. Coloque a janela por cima do relógio e depois faça o relógio aparecer na frente dela." | A12, A20 |
| **T7** | "Antes de mostrar para alguém, jogue a sua fase até abrir a porta." | A23 |
| **T8** ⏱ fim do RNF-08 | "Deixe a sua fase disponível para outras pessoas jogarem." | A24 (se aparecer o bloqueio), A26, **A44** |

**RNF-08:** o tempo vai do início da T2 até a publicação dar certo na T8. Só conta como aprovado se a pessoa **não programa**, fez tudo **sem ajuda** e levou **menos de 30 minutos**. Anote também o tempo de cada tarefa, para saber onde ele foi gasto.

## 5. Tarefas: jogador

| Tarefa | Cartão | Itens |
|---|---|---|
| **J1** | (o condutor abre uma janela anônima no Player) "Sem entrar em conta nenhuma, escolha a fase **Sala do Condutor** e jogue até abrir a porta." | A03, A26, A31 |
| **J2** | "Jogue a fase **Escola?** até abrir a porta." Limite de 15 min. Se a pessoa travar 3 min num enigma, entregue o cartão de resposta daquele enigma e anote como ajuda. | A29, A33 |

Durante a J2, observe:
- se a pessoa estranha o quadro vazio (DEF-06);
- se ela espera alguma fala ao clicar na porta, no selo ou nas inscrições (DIF-01);
- se a pergunta e o campo de resposta aparecem sem precisar rolar a página (DEF-05, já corrigido) nos três navegadores.

**Cartões de resposta da Escola** (só para o condutor): esquerda 15 e 40 · teto 55 · direita 123 · frente 310 · fundo -15 ou 80 · porta 92139.

## 6. Questionário SUS (ao final, 5 min)

O participante marca de 1 (discordo totalmente) a 5 (concordo totalmente) para cada frase:

1. Eu usaria este sistema com frequência.
2. Achei o sistema mais complicado do que precisava.
3. Achei o sistema fácil de usar.
4. Eu precisaria da ajuda de alguém técnico para conseguir usar o sistema.
5. As funções do sistema estão bem integradas.
6. O sistema tem muita coisa inconsistente.
7. Imagino que a maioria das pessoas aprenderia a usar este sistema rapidamente.
8. Achei o sistema muito trabalhoso de usar.
9. Eu me senti confiante usando o sistema.
10. Precisei aprender muitas coisas antes de conseguir usar o sistema.

**Cálculo (escala de Brooke, 1996):** nas frases ímpares, nota − 1; nas pares, 5 − nota. Some tudo e multiplique por 2,5, para um resultado de 0 a 100. Acima de 68 está acima da média de referência. Registre a nota de cada participante e a média.

**Conversa final (5 min):** "O que foi mais difícil?" · "O que você esperava que acontecesse e não aconteceu?" · "Você usaria isto para criar uma fase para uma turma?"

## 7. Ficha de observação (uma por participante)

Participante: ___ · Programa? ☐ sim ☐ não · Navegador e versão: ________ · Resolução: ________

| Tarefa | Tempo (min) | Concluiu? | Sem ajuda? | Onde travou / o que tentou | Fala marcante |
|---|---|---|---|---|---|
| T1 | | | | | |
| T2 | | | | | |
| T3 | | | | Arrastou ou clicou na biblioteca? | |
| T4 | | | | | |
| T5 | | | | | |
| T6 | | | | | |
| T7 | | | | Os rótulos do modo testar confundiram? (DEF-07) | |
| T8 | | | | | |
| **T2 a T8** | **total:** | | | **RNF-08:** ☐ aprovado ☐ reprovado | |
| J1 | | | | | |
| J2 | | | | Quadro vazio / falas esperadas? | |

Nota SUS: ____ · A página rolou em algum momento? ☐ não ☐ sim, onde: ________

## 8. Consolidação

1. Passe as fichas e os SUS a limpo numa tabela única.
2. Peça à IA para agrupar as anotações em **padrões de problema**, com a frequência e a gravidade de cada um. Depois **confira cada padrão contra as fichas originais** e registre no log de IA o que ela errou.
3. Preencha o checklist e escreva o Relatório de Aceitação com os critérios aprovados e reprovados, os problemas de usabilidade priorizados, a nota SUS média e o tempo médio do RNF-08.
4. Abra uma issue para o Eric para cada item reprovado, com os passos e o requisito, no mesmo padrão do relatório de defeitos da Sarah.
5. Preencha a coluna "Depois" da seção 8 do plano: o tempo para criar uma fase simples e a nota SUS.
