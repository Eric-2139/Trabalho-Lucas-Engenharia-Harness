---
paths:
  - ".claude/hooks/**"
  - ".claude/lib/**"
  - ".claude/ferramentas/**"
  - ".claude/testes-harness/**"
  - "harness/config.json"
---

# Evolução do código do harness

Ao alterar hooks, bibliotecas ou ferramentas do harness:

- **Fail-closed no gate.** Erro inesperado em `gate.js` bloqueia a ação (exit 2). Nunca troque por exit 1: o Claude Code trata exit 1 como erro não bloqueante e a ferramenta executaria sem política nenhuma.
- **Verificação pura e pequena.** Cada política é uma função `(ctx) => violacao | null` em `.claude/hooks/agentes/<agente>.js`, com o id da política (`P1`…`P5`) no retorno. Efeitos colaterais ficam em `aoPermitir` (antes da ferramenta) ou `aposExecutar` (depois dela), nunca dentro da verificação.
- **Constantes no config.** Tetos, limiares, listas de termos e padrões ficam em `harness/config.json`, com nome descritivo. A exceção são as regras de mascaramento de dado pessoal, que ficam em código de propósito (`lib/mascaramento.js`): afrouxar o mascaramento exige revisão de código.
- **Sem dependências externas.** Só a biblioteca padrão do Node (≥ 20). Isso mantém o harness auditável e fácil de instalar.
- **Toda política tem teste** em `.claude/testes-harness/` (`node --test ".claude/testes-harness/*.test.js"`): um caso que bloqueia e um que permite.
- **Comentários explicam o porquê** da política (qual defeito ela evita), não o que o código faz.
