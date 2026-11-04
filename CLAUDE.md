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
- **Ferramentas determinísticas**: `.claude/ferramentas/` (`buscar-log`, `definir-escopo`, `executar-suite`, `iniciar-tarefa`). A suíte vermelha sai com código 0 (é resultado, não falha da ferramenta); só falha de ambiente ou recusa sai com outro código.
- **Constantes**: `harness/config.json` (tetos, limiares, termos críticos, comando de testes).
- **Log de decisões**: `harness/log_decisoes.jsonl`, uma linha por chamada de ferramenta.

## Antes de usar os agentes 3 e 4
Configurado na fase 3 (ADR-016) em `harness/config.json`:
- `execucao_testes.comando`: `docker run --rm --network none -v .:/src math-scape-testes testes`. Grava o JUnit em `harness/estado/junit.xml`. Exige o Docker rodando e a imagem construída (`pnpm testes:imagem`, de novo a cada mudança do `pnpm-lock.yaml`);
- `diretorios_testes` = `tests/`; `testes.caminhos_contrato` = as pastas `contrato/` e `harness/projeto/`; `testes.caminhos_implementacao_bloqueados` = as pastas `src/` e `apps/api/prisma/`;
- `codificacao.comando_analise`: o mesmo contêiner no modo `analise` (Biome + TypeScript).

## Produto: Math Scape
Escape room de matemática reescrito como plataforma de fases: a fase é um documento JSON validado por um schema Zod único. Projeto do sistema em `harness/projeto/arquitetura.md`; projeto do programa em `harness/projeto/programa/`.

**Stack**: TypeScript 7, React 19 + Vite 8, react-konva, Zustand + zundo, Zod 4, Fastify 5, Prisma 7 + PostgreSQL, Vitest 5 + Testing Library, Biome 2, monorepo pnpm 10, Node ≥ 24.

**Pastas** (ADR-015): `packages/schema` (schema e regras da fase), `packages/player` (motor do jogo), `apps/editor`, `apps/player`, `apps/api` (com `prisma/`), `fases-exemplo/`, `tests/<componente>/`, `infra/`. Em cada pacote, `contrato/` tem os tipos e as assinaturas públicas (fase 3, arquiteto) e `src/` tem a implementação (fase 4, agente 4).

**Comandos**:
| Comando | Para quê |
|---|---|
| `pnpm install` | dependências |
| `pnpm dev` | editor (5173), player (5174) e Api (3000); banco local em `infra/dev/docker-compose.yml` |
| `pnpm test` | Vitest no host (a Api precisa de `DATABASE_URL`) |
| `pnpm testes:imagem` / `pnpm testes:conteiner` | constrói a imagem / roda a suíte como o harness roda |
| `pnpm analise` · `pnpm format` | lint + tipos · formatação |

**Convenções**:
- Domínio em português (`fase`, `parede`, `enigma`, `revela`); componentes em PascalCase; arquivos em kebab-case; textos de interface em português.
- Testes importam pelo pacote (`@math-scape/schema`), nunca de `src/`. Um arquivo por módulo, com o id do requisito no nome do caso.
- Configuração só por variável de ambiente; nada de segredo no código.
- **Mudou o schema, atualiza os testes.** `packages/schema/contrato/` é decisão de projeto: alterar = atualizar `modulos-schema.md`, rodar `node harness/projeto/gerar-projeto.js` e `/verificar-rastreabilidade`, e devolver ao agente 3 antes do agente 4.
- Dependência nova é decisão de arquitetura: só o arquiteto mexe em `package.json` e reconstrói a imagem de testes.

## Limites conhecidos
- Os hooks de política estão no frontmatter dos agentes, então só valem quando o trabalho roda **como subagente** (via skill ou delegação). Na sessão principal, quem responde é o humano.
- Uma execução por agente de cada vez: o estado fica em `harness/estado/<agente>/`.
- As políticas que são julgamento só são aproximadas em código. Veja `.claude/rules/fronteira-modelo-harness.md`.

## Testes do próprio harness
```
node --test ".claude/testes-harness/*.test.js"
```
Os testes cobrem cada política: um caso que bloqueia e um que permite, rodando os hooks reais contra um projeto temporário.
