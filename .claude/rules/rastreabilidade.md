---
paths:
  - "harness/**"
---

# Artefatos do processo e rastreabilidade

## Identificadores
- Requisito funcional: `RF-NN`. Não funcional: `RNF-NN`. O id nunca é reutilizado para outro requisito.
- Pendência: `PEND-NNN`. Lacuna: `LAC-NNN`. Chamado: o id do sistema de chamados.
- Todo artefato estruturado é um arquivo JSON chamado `<id>.json`.

## Status de requisito
Valores em ASCII, sem acento:

| Status | Significado | Exige |
|---|---|---|
| `OK` | atômico, com fonte e critério verificável | `criterio_aceitacao` preenchido |
| `AMBIGUO` | sem métrica ou sem sujeito definido | critério **vazio** + pendência |
| `CONFLITO` | contradiz outro requisito | `conflita_com` nos dois lados + pendência |
| `OK_PENDENTE_REVISAO` | claro, mas em categoria crítica (P4) | critério + pendência `revisao_critica` |

## Quem escreve onde
| Local | Escrito por | Observação |
|---|---|---|
| `harness/entrada/` | humano | especificação bruta |
| `harness/rascunho/requisitos/` | agente 1 | versões anteriores vão para `rascunho/historico/` (harness) |
| `harness/baseline/` | humano (`/promover-baseline`) | imutável para agentes |
| `harness/pendencias/` | todos os agentes | append-only; resposta só do humano |
| `harness/chamados/` | sistema de chamados / humano | entrada do agente 2 |
| `harness/diagnosticos/`, `harness/propostas/` | agente 2 | proposta só como `.patch` |
| `tests/` (config `diretorios_testes`) | agente 3 | imutável para o agente 4 |
| código de produção | agente 4 | só nos `arquivos_previstos` do componente |
| `harness/projeto/` | humano / arquiteto | somente leitura para agentes |
| `harness/lacunas/` | agente 5 | rascunho com dono humano |
| `harness/matriz/rastreabilidade.json` | humano / arquiteto | `{ versao_baseline, mapeamentos: [{ req_id, componente_id, decisao_id }] }` |
| `harness/matriz/requisito-teste.json` | harness | derivada das anotações `@req` |
| `harness/estado/`, `harness/relatorios/`, `harness/log_decisoes.jsonl` | harness | nunca editar à mão durante uma execução |

## Componente de projeto
`harness/projeto/componentes/<Componente>.json`:
```json
{
  "id": "AuthService",
  "descricao": "Autenticação de operadores",
  "camada": "servico",
  "arquivos_previstos": ["src/auth/**", "src/shared/validation/password.*"],
  "contrato": "harness/projeto/contratos/auth.md",
  "decisoes": ["ADR-003"]
}
```
`arquivos_previstos` é o escopo de escrita do agente 4 (P1). Globs: `**` atravessa diretórios, `*` não.
