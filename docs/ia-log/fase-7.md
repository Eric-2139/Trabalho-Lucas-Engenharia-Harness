# Log de uso de IA — Fase 7: Teste de Aceitação (Yuri)

Ferramenta: Claude (app), modelo Claude Opus 5.5, com acesso de leitura ao repositório.

## Entregas
- Checklist de aceitação: `docs/aceitacao/checklist-aceitacao.md` (45 itens, cobrindo os 19 RF e os 8 RNF do baseline 2026-11-03.1).
- Roteiros, ficha de observação e SUS: `docs/aceitacao/roteiros-tarefas.md`.
- Materiais: `escola-01-importar.json` e `fase-50-objetos-importar.json`, validados com o `validarEnvelope` do pacote schema; imagens de teste em `materiais/`.

## Interações

| Data | Objetivo | Acertou | Errou ou precisou de correção |
|---|---|---|---|
| 06/11 | Preparar a fase 7 a partir do baseline e do relatório da Sarah | Desmembrou os critérios em itens verificáveis e incluiu os pontos de atenção da Sarah (arraste e rolagem fora do Chromium, lista longa de imagens). Achou a falta do `prisma/seed.ts`, que deixa a Escola fora do banco | Citou uma rota do editor que não existe (`/editar/:id`); corrigida para `/fases/:id` depois de ler o `main.tsx`. A fase de 50 objetos falhou na validação por senha nula; corrigida |
| 06/11 | Registrar a falta do seed para o Eric | Confirmou o achado no histórico do git e nos documentos de projeto (`modulos-banco.md` §3, contrato `banco.md`) antes de abrir o DEF-09. Explicou por que a suíte não pegou | — |

## Sessões

| Data | Ferramenta / modelo | Objetivo | Resultado | Tokens entrada | Tokens saída | Origem |
|---|---|---|---|---|---|---|
| 06/11 | Claude / Opus 5.5 | Kit de aceitação (checklist, roteiros, materiais) | Revisar antes do commit | | | preencher pelo painel de uso; senão, estimar |
| **Total** | | | | | | |
