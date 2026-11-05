# Log de uso de IA — Fase 4: Codificação (Eric)

Ferramenta: Claude Code (CLI no terminal), modelo Claude Opus 5.5. Tokens **medidos** nas transcrições das sessões (`~/.claude/projects/…`). A entrada inclui o contexto que o modelo relê a cada passo (cache), por isso é muito maior que o tamanho das mensagens.

A fase 4 avança um requisito por vez: o agente 3 escreve os testes de uma camada (`/gerar-testes`) e o agente 4 implementa contra eles (`/implementar-requisito`). Cada requisito verde é um commit (regra de commit). Este log cresce a cada entrega.

## Entregas

| # | Requisito | Camada | Testes (agente 3) | Implementação (agente 4) | Relatórios do harness |
|---|---|---|---|---|---|
| 1 | RF-07 | SchemaFase | rodada 1: 68 casos em `tests/schema/` para RF-07, RF-08, RF-12, RF-15, RNF-09 (`sucesso`, 5 de 5 com feliz, borda e negativo) | `validarFase` em `packages/schema/src/validar.ts`; verde no 1º de 5 ciclos, análise limpa, sem reversão | `testes-2026-11-04T20-29-29-582Z.json`, `codificacao-2026-11-04T20-35-11-516Z.json` |
| 2 | RF-12 | SchemaFase | já escritos na rodada 1 (8 casos em `tests/schema/jogabilidade.test.ts`) | `validarJogabilidade` em `packages/schema/src/jogabilidade.ts`; verde no 1º de 5 ciclos, análise limpa, sem reversão | `codificacao-2026-11-05T17-22-58-494Z.json` |

De carona com o RF-07 ficaram verdes os casos de schema do RF-08 e do RNF-09 em `tests/schema/fase.test.ts`. O RF-08 e o RNF-09 só fecham quando `faseInicial` e `validarEnvelope` forem implementados.

## Preparo da fase (commit `3d77b02`)
Ao ler o repositório para a fase 4, a IA achou dois defeitos do harness que derrubariam os agentes 3 e 4 na primeira rodada, e uma lacuna de processo:
- **Disjuntor contra suíte vermelha.** O Claude Code trata saída ≠ 0 do Bash como falha da ferramenta (confirmado na documentação de hooks). A suíte vermelha saía com 1, então três execuções vermelhas seguidas disparavam o disjuntor: o agente 3, cujos testes nascem vermelhos contra os stubs, e o agente 4, antes do teto de 5 ciclos. Agora vermelho sai com 0.
- **JUnit velho.** Numa falha de ambiente, o `junit.xml` da execução anterior era lido como resultado novo. Agora é apagado antes de cada execução.
- **Escopo por rodada do agente 3** (decisão do Eric). A parada cobrava os 28 requisitos em toda rodada. A nova ferramenta `definir-escopo.js` fixa os requisitos da rodada.

## Sessões

| Data | Ferramenta / modelo | Objetivo | Resultado | Tokens entrada | Tokens saída | Origem |
|---|---|---|---|---|---|---|
| 04/11 | Claude Code / Opus 5.5 | Ler o repositório, preparar a fase 4, corrigir o harness, orquestrar os agentes e commitar (sessão principal) | harness corrigido (60/60 testes); entrega 1 | 8.181.746 | 43.387 | medido |
| 04/11 | idem, subagente `web-fetch` | Confirmar na documentação quando o hook PostToolUseFailure dispara | Bash com saída ≠ 0 dispara PostToolUseFailure | 63.699 | 3.667 | medido |
| 04/11 | idem, subagente `testes` | Testes da camada SchemaFase para RF-07, RF-08, RF-12, RF-15, RNF-09 | `sucesso`; 1 bloqueio P1 (`cd` antes do comando) | 1.284.923 | 29.360 | medido |
| 04/11 | idem, subagente `codificacao` | Implementar RF-07 | `sucesso` no 1º ciclo; 2 bloqueios P1 (`cd` antes do comando) | 268.004 | 4.183 | medido |
| 05/11 | idem, subagente `codificacao` | Implementar RF-12 | `sucesso` no 1º ciclo; 2 bloqueios P1 | 252.038 | 3.340 | medido |
| **Total** | | | | **10.050.410** | **83.937** | medido |

A linha da sessão principal de 04/11 foi medida ao escrever este log; a de 05/11 entra quando a sessão fechar a camada SchemaFase.

## Onde a IA acertou
- **Achou, antes de rodar, o defeito que pararia a fase.** O disjuntor e o JUnit velho só apareceriam na primeira rodada real, como falha controlada sem causa aparente.
- **O agente 3 separou critério de contrato.** Testou "80 graus" e "80 ou 90" pelo contrato de `respostaConfere`, e deixou de fora os limites D-03 e a senha "00000", que nenhum critério pede.
- **O gate funcionou como desenhado.** Os dois agentes tentaram prefixar `cd "..." &&` nos comandos, o gate bloqueou (P1) e eles refizeram com o comando puro.

## Onde errou ou precisou de correção humana
- **Edição do `.claude/settings.json` negada.** O classificador do modo automático barrou a permissão da nova ferramenta, por ser autoconfiguração. Ficou para o Eric pôr à mão.
- **O gerador do projeto foi rodado sem querer** (`--help` não existe e ele escreve arquivos). Só o carimbo de data da matriz mudou, e foi revertido.
