# Contrato — Banco (`apps/api/prisma`)

Decisões: ADR-002, ADR-004, ADR-010. Acesso só pela Api (Prisma). Nenhum app cliente fala com o banco.

## Tabelas
| Tabela | Colunas | Regras |
|---|---|---|
| `usuarios` | `id uuid PK`, `nome text`, `email citext UNIQUE`, `senha_hash text`, `criado_em` | Só nome, e-mail e hash (RNF-06); hash argon2id (RNF-05) |
| `sessoes` | `id_hash text PK`, `usuario_id FK`, `criada_em`, `expira_em` | `ON DELETE CASCADE` |
| `fases` | `id uuid PK`, `dono_id FK`, `titulo`, `documento jsonb`, `documento_publicado jsonb NULL`, `publicada_em NULL`, `revisao int`, `criada_em`, `atualizada_em` | `ON DELETE CASCADE`; `titulo` é cópia de `documento.titulo` mantida pela Api, usada em "Minhas fases" (Escolher Fase usa o título da versão publicada); `documento_publicado` muda só ao publicar (PEND-005) |
| `assets` | `id uuid PK`, `dono_id FK`, `arquivo`, `mime`, `bytes`, `criado_em` | `ON DELETE CASCADE`; `bytes <= 5242880` |

## Garantias
- Excluir um usuário remove sessões, fases e registros de imagem (RF-19).
- Índices: `fases(dono_id)`, `fases(publicada_em) WHERE publicada_em IS NOT NULL` (lista de Escolher Fase).

## Seed
Cria o usuário de sistema "Math Scape" (sem senha utilizável) e publica `fases-exemplo/escola-01.json` (RF-18).
