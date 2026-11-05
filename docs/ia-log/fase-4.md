# Log de uso de IA — Fase 4: Codificação (Eric)

Ferramenta: Claude Code (CLI no terminal), modelo Claude Opus 5.5. Tokens **medidos** nas transcrições das sessões (`~/.claude/projects/…`). A entrada inclui o contexto que o modelo relê a cada passo (cache), por isso é muito maior que o tamanho das mensagens.

A fase 4 avança um requisito por vez: o agente 3 escreve os testes de uma camada (`/gerar-testes`) e o agente 4 implementa contra eles (`/implementar-requisito`). Cada requisito verde é um commit (regra de commit). Este log cresce a cada entrega.

## Entregas

| # | Requisito | Camada | Testes (agente 3) | Implementação (agente 4) | Relatórios do harness |
|---|---|---|---|---|---|
| 1 | RF-07 | SchemaFase | rodada 1: 68 casos em `tests/schema/` para RF-07, RF-08, RF-12, RF-15, RNF-09 (`sucesso`, 5 de 5 com feliz, borda e negativo) | `validarFase` em `packages/schema/src/validar.ts`; verde no 1º de 5 ciclos, análise limpa, sem reversão | `testes-2026-11-04T20-29-29-582Z.json`, `codificacao-2026-11-04T20-35-11-516Z.json` |
| 2 | RF-12 | SchemaFase | já escritos na rodada 1 (8 casos em `tests/schema/jogabilidade.test.ts`) | `validarJogabilidade` em `packages/schema/src/jogabilidade.ts`; verde no 1º de 5 ciclos, análise limpa, sem reversão | `codificacao-2026-11-05T17-22-58-494Z.json` |
| 3 | RF-15 | SchemaFase | já escritos na rodada 1 (16 casos em `tests/schema/comparacao.test.ts`) | `respostaConfere` e `senhaConfere` em `packages/schema/src/comparacao.ts`; verde no 1º de 5 ciclos, análise limpa, sem reversão | `codificacao-2026-11-05T17-24-24-855Z.json` |
| 4 | RF-08 | SchemaFase | já escritos na rodada 1 (19 casos em `tests/schema/fase.test.ts` e `padroes.test.ts`) | `faseInicial` em `packages/schema/src/padroes.ts`; verde no 1º de 5 ciclos, análise limpa, sem reversão | `codificacao-2026-11-05T17-25-51-805Z.json` |
| 5 | RNF-09 | SchemaFase | já escritos na rodada 1 (15 casos em `tests/schema/envelope.test.ts` e `fase.test.ts`) | `validarEnvelope` em `packages/schema/src/validar.ts` e `referenciasDeAsset` em `imagens.ts`; verde no 1º de 5 ciclos (67 de 67 testes da suíte), análise limpa, sem reversão | `codificacao-2026-11-05T17-27-30-210Z.json` |
| 6 | RF-18 | SchemaFase | rodada 2: 15 casos em `tests/schema/fase-exemplo.test.ts` (`sucesso`; feliz 9, borda 3, negativo 3) | `fases-exemplo/escola-01.json` migrado do legado; verde no 1º de 5 ciclos (82 de 82), análise limpa, sem reversão | `testes-2026-11-05T17-30-32-086Z.json`, `codificacao-2026-11-05T17-33-34-997Z.json` |
| 7 | RNF-02 | Player | rodada 3: 54 casos em `tests/player/` (`motor`, `verificador-http`, `palco`) para RF-15, RF-16, RF-17, RNF-02 (`sucesso`, 4 de 4 com feliz, borda e negativo) | `calcularPalco`, `paraPixels` e `precisaAvisoResolucao` em `packages/player/src/palco.ts`; verde no 1º de 5 ciclos, análise limpa, sem reversão | `testes-2026-11-05T17-38-25-719Z.json`, `codificacao-2026-11-05T17-39-41-453Z.json` |
| 8 | RF-16 | Player | rodada 3 (7 casos em `tests/player/motor.test.ts`) | motor `criarPartida` em `packages/player/src/motor.ts` e `estado-partida.ts`; verde no 1º de 5 ciclos, análise limpa, sem reversão; de carona, os casos de motor do RF-17 (5) e do RF-15 (18) | `codificacao-2026-11-05T17-41-45-139Z.json` |

O RF-15 fecha só a camada SchemaFase: a revelação dos dígitos no motor do Player e a rota de verificação da Api voltam ao agente 3 e ao agente 4 nas camadas seguintes.

Achado do agente 4 no RF-08, para o arquiteto: o projeto não diz se `x`/`y` são o canto superior esquerdo ou o centro do objeto. O agente inferiu "canto" pela D-07 (`modulos-schema.md`), que é também o padrão do Konva, e centralizou a porta com `x = (1 − largura)/2`. Nenhum teste confere a posição. O comentário no código cita a ADR-006, mas ela não fixa essa convenção. Falta escrevê-la na ADR-006 ou em `contratos/schema.md` antes do Player e do editor.

Inferências do agente 4 no RF-18, que nenhum teste confere e que ficam para a equivalência visual da fase 6:
- **Base das coordenadas.** O CSS do legado posiciona objetos até `left: 1555px`, embora `.room` declare 1440×900. O agente usou 1920×1080 (`x = left/1920`, `y = top/1080`).
- **Tamanhos.** O padrão do catálogo, exceto onde o CSS fixa o tamanho: selo, relógio do teto, olho e largura das inscrições. A altura das inscrições foi estimada pelas linhas de texto.
- **Pergunta do fundo.** É só `"4, 23, 42, 61"`: no legado não há enunciado, apenas os números desenhados no selo.
- **Teto.** A inscrição (camada 3) cobre a borda esquerda do olho, como no legado. Falta conferir no Player se isso atrapalha o clique.

Camada Player (rodada 3): o RF-16 e o RF-17 são testados pelo motor (`clicar`, `dica`), não pelo desenho. O jsdom não tem canvas e o pacote `canvas` não é dependência do projeto. Por isso o ícone de dica desenhado e a falta de handler na decoração (RenderizadorParede, Konva) ficam sem teste automático: é risco para a aceitação, a cobrir no E2E da fase 6 ou com uma decisão de arquitetura.

Pontos do motor (RF-16) para o arquiteto:
- **`dica` só na parede ativa.** O agente 4 fez `dica(objetoId)` procurar o enigma só na parede ativa, como `clicar` e `responder`. O projeto não fixa isso e nenhum teste distingue os dois casos.
- **Assinante que lança exceção.** Se um assinante lança dentro da atualização, `responder` devolve "falha de rede" com o estado já mudado. Nenhum teste cobre esse caso.

De carona com o RF-07 ficaram verdes os casos de schema do RF-08 e do RNF-09 em `tests/schema/fase.test.ts`. Com as entregas 2 a 5, a suíte da camada SchemaFase está toda verde (67 de 67). Ainda são stubs `projetarParaJogo`, `objetoPadrao` e `resolverImagem`, que nenhum teste da rodada 1 cobre. Elas entram com os requisitos do Player e do editor (RNF-04, RF-17, ADR-011, ADR-012). Salvar e publicar pela Api (RNF-09) ficam para a camada da Api.

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
| 05/11 | idem, subagente `codificacao` | Implementar RF-15 (camada SchemaFase) | `sucesso` no 1º ciclo; 2 bloqueios P1 | 212.835 | 3.227 | medido |
| 05/11 | idem, subagente `codificacao` | Implementar RF-08 (camada SchemaFase) | `sucesso` no 1º ciclo; 2 bloqueios P1 | 386.168 | 4.610 | medido |
| 05/11 | idem, subagente `codificacao` | Implementar RNF-09 (camada SchemaFase) | `sucesso` no 1º ciclo | 283.982 | 5.194 | medido |
| 05/11 | idem, subagente `testes` | Testes do RF-18 (camada SchemaFase) | `sucesso`; nenhum bloqueio | 816.917 | 14.210 | medido |
| 05/11 | idem, subagente `codificacao` | Implementar RF-18 (`escola-01.json`) | `sucesso` no 1º ciclo | 456.386 | 15.194 | medido |
| 05/11 | idem, subagente `testes` | Testes da camada Player (RF-15, RF-16, RF-17, RNF-02) | `sucesso`; nenhuma devolução | 1.039.820 | 25.892 | medido |
| 05/11 | idem, subagente `codificacao` | Implementar RNF-02 (palco) | `sucesso` no 1º ciclo | 227.390 | 4.547 | medido |
| 05/11 | idem, subagente `codificacao` | Implementar RF-16 (motor) | `sucesso` no 1º ciclo | 574.758 | 7.560 | medido |
| **Total** | | | | **14.048.666** | **164.371** | medido |

A linha da sessão principal de 04/11 foi medida ao escrever este log; a de 05/11 entra quando a sessão fechar a camada SchemaFase.

## Onde a IA acertou
- **Achou, antes de rodar, o defeito que pararia a fase.** O disjuntor e o JUnit velho só apareceriam na primeira rodada real, como falha controlada sem causa aparente.
- **O agente 3 separou critério de contrato.** Testou "80 graus" e "80 ou 90" pelo contrato de `respostaConfere`, e deixou de fora os limites D-03 e a senha "00000", que nenhum critério pede.
- **O gate funcionou como desenhado.** Os dois agentes tentaram prefixar `cd "..." &&` nos comandos, o gate bloqueou (P1) e eles refizeram com o comando puro.

## Onde errou ou precisou de correção humana
- **Edição do `.claude/settings.json` negada.** O classificador do modo automático barrou a permissão da nova ferramenta, por ser autoconfiguração. Ficou para o Eric pôr à mão.
- **O gerador do projeto foi rodado sem querer** (`--help` não existe e ele escreve arquivos). Só o carimbo de data da matriz mudou, e foi revertido.
