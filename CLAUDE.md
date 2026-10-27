# Agentes de IA em um processo em cascata — harness

Este projeto configura o Claude Code para executar os **cinco agentes** propostos no trabalho `agentes-ia-processo-cascata.pdf`, cada um com o seu **harness mínimo**: objetivo, ferramentas, estado, políticas e critério de parada.

Tese central: o agente não torna o cascata ágil. Ele reduz a latência entre criar um defeito e descobri-lo (*shift left*). **O modelo julga, o harness garante.**

## Os agentes e a ordem de uso

| # | Agente (`.claude/agents/`) | Fase | Skill que o executa |
|---|---|---|---|
| 1 | `requisitos` | análise de requisitos (mês 1) | `/analisar-requisitos` |
| 5 | `projeto` | projeto do sistema e do programa (mês 1-3) | `/verificar-rastreabilidade` |
| 3 | `testes` | teste de unidade e integração (antecipado) | `/gerar-testes [RF-NN ...]` |
| 4 | `codificacao` | codificação (mês 3-5) | `/implementar-requisito RF-NN` |
| 2 | `manutencao` | operação e manutenção (mês 8+) | `/triar-chamado <id>` |

A numeração é por retorno esperado. A ordem de uso respeita as dependências: **1 → 3 → 4**, com o 2 e o 5 em paralelo. O agente 1 produz a entrada do 3, e o 3 produz a condição de parada do 4. Usar o 4 antes do 3 produz volume de código sem rede de segurança.

Entre o agente 1 e os demais existe um **gate humano**: `/promover-baseline` leva os requisitos do rascunho ao baseline aprovado.

## Fluxo de artefatos
```
harness/entrada/especificacao.md ──(1)──> harness/rascunho/requisitos/ + harness/pendencias/
                                             │ humano: /promover-baseline
                                             ▼
                                  harness/baseline/requisitos.json
                     ┌───────────────────────┼─────────────────────────┐
                    (5)                     (3)                        (4)
             harness/lacunas/        tests/ + matriz req→teste    código nos arquivos previstos
                                                                       │
             harness/chamados/ ──(2)──> harness/diagnosticos/ (+ propostas .patch)
```

## Onde está cada peça do harness
- **Agentes**: `.claude/agents/*.md`. O `tools:` define o conjunto de ferramentas oferecido e o `hooks:` liga o gate daquele agente.
- **Gate (PreToolUse)**: `.claude/hooks/gate.js <agente>` → orçamento + verificações comuns + políticas em `.claude/hooks/agentes/<agente>.js`.
- **Atualização de estado (PostToolUse/Failure)**: `.claude/hooks/pos.js <agente>`.
- **Critério de parada (Stop → SubagentStop)**: `.claude/hooks/parada.js <agente>`. Grava o relatório em `harness/relatorios/`.
- **Início de execução (SubagentStart)**: `.claude/hooks/ciclo.js`, que zera o estado da execução.
- **Ferramentas determinísticas**: `.claude/ferramentas/` (`buscar-log`, `executar-suite`, `iniciar-tarefa`).
- **Constantes**: `harness/config.json` (tetos, limiares, termos críticos, comando de testes).
- **Log de decisões**: `harness/log_decisoes.jsonl`, uma linha por chamada de ferramenta.

## Antes de usar os agentes 3 e 4
A stack do produto ainda não foi definida. Configure em `harness/config.json`:
- `execucao_testes.comando`: comando que roda a suíte em contêiner efêmero **sem rede** e grava JUnit XML em `execucao_testes.relatorio_junit`;
- `diretorios_testes`, `testes.caminhos_contrato` e `testes.caminhos_implementacao_bloqueados`;
- `codificacao.comando_analise`: linter e verificação de tipos.

## Limites conhecidos
- Os hooks de política estão no frontmatter dos agentes, então só valem quando o trabalho roda **como subagente** (via skill ou delegação). Na sessão principal, quem responde é o humano.
- Uma execução por agente de cada vez: o estado fica em `harness/estado/<agente>/`.
- As políticas que são julgamento só são aproximadas em código. Veja `.claude/rules/fronteira-modelo-harness.md`.

## Testes do próprio harness
```
node --test ".claude/testes-harness/*.test.js"
```
Os testes cobrem cada política: um caso que bloqueia e um que permite, rodando os hooks reais contra um projeto temporário.
