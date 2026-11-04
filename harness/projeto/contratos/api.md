# Contrato — Api (`apps/api`, HTTP JSON)

Decisões: ADR-001, ADR-002, ADR-003, ADR-004, ADR-005, ADR-010, ADR-011, ADR-013, ADR-017. Autenticação: cookie `sid` (HttpOnly). Erros: `{ erro: string, detalhes?: any }`.

Os apps chamam a Api pelo caminho `/api` no mesmo site em que são servidos (ADR-017); as rotas abaixo são escritas sem esse prefixo. Corpos de pedido e tipos de resposta: `packages/schema/contrato/api.ts`; fábrica do servidor e limites: `apps/api/contrato/`.

## Contas
| Rota | Corpo | Sucesso | Erros |
|---|---|---|---|
| `POST /auth/cadastro` | `{ nome, email, senha }` (campos extras descartados) | 201 `{ id, nome, email }` | 400 inválido · 409 e-mail em uso |
| `POST /auth/login` | `{ email, senha }` | 204 + `Set-Cookie: sid=…; HttpOnly` | 401 |
| `POST /auth/logout` | — | 204, sessão apagada | — |
| `DELETE /auth/conta` | `{ confirmar: true }` | 204; usuário, sessões, fases e imagens apagados | 401 · 400 sem confirmação |

## Fases do criador (exigem sessão; `:id` de outro dono → 404)
| Rota | Corpo | Sucesso | Erros |
|---|---|---|---|
| `GET /fases` | — | 200 `[{ id, titulo, publicada, atualizadaEm }]` | 401 |
| `POST /fases` | `{ titulo }` | 201 `{ id, revisao, documento }` (de `faseInicial`) | 401 · 400 |
| `GET /fases/:id` | — | 200 `{ id, revisao, documento, publicada, alteracoesNaoPublicadas }` (documento completo, só para o dono; `alteracoesNaoPublicadas` compara rascunho e versão publicada) | 404 |
| `PUT /fases/:id` | `{ revisao, documento }` | 200 `{ revisao }`; atualiza a coluna `titulo` a partir de `documento.titulo` | 400 fora do schema ou `asset:` inexistente/de outro dono (indica defeito: o editor só envia documento válido, ADR-011) · 409 revisão desatualizada |
| `PATCH /fases/:id` | `{ titulo }` | 200 `{ revisao }` (renomear: altera `documento.titulo` e a coluna) | 400 · 404 |
| `DELETE /fases/:id` | — | 204 (sai de Escolher Fase se publicada) | 404 |
| `POST /fases/:id/duplicar` | — | 201 `{ id }` (cópia da versão em edição, não publicada) | 404 |
| `POST /fases/:id/publicar` | — | 200 `{ publicadaEm }` | 400 fora do schema · 422 `{ erro: "A fase não pode ser publicada: há posições da senha sem enigma.", posicoesSemEnigma: [2,5] }` |
| `GET /fases/:id/jogo-teste` | — | 200 `FaseJogo` do rascunho (modo testar) | 404 |
| `GET /fases/:id/exportar` | — | 200 envelope `{ formato, versao, fase, imagens }` da versão em edição, com imagens embutidas (ADR-013) | 404 |
| `POST /fases/importar` | envelope (até 50 MB) | 201 `{ id }` (fase e imagens novas do importador) | 400 fora do schema · 413 · 415 imagem inválida; nada é gravado em caso de erro |

## Jogo (sem login)
| Rota | Corpo | Sucesso | Erros |
|---|---|---|---|
| `GET /publicadas` | — | 200 `[{ id, titulo }]` (título da versão publicada; sem dado do autor) | — |
| `GET /publicadas/:id/jogo` | — | 200 `FaseJogo` (`projetarParaJogo` da versão publicada) | 404 não publicada |
| `POST /fases/:id/verificar` | `{ objetoId, resposta }` | enigma: 200 `{ correto, digitos: [{ posicao, valor }] }` (comparação só pelo número) · porta: 200 `{ aberta }` (dígitos exatos) | 404 · 429 `{ tentarEmSegundos }` acima de 300/min (enigma) ou 30 a cada 10 min (porta), por IP e fase (ADR-003) |
| `POST /fases/:id/verificar?modo=teste` | `{ objetoId, resposta }` | idem, contra o rascunho; só o dono; sem limite | 404 |

Referências `asset:` são conferidas em `PUT`, `publicar` e `importar`: precisam existir e ser do dono da fase (ADR-010).

Garantia de RNF-04: nenhuma resposta de rota pública, de `jogo-teste` ou de `verificar` contém `respostas`, `senha` ou `revela`.

## Imagens
| Rota | Corpo | Sucesso | Erros |
|---|---|---|---|
| `POST /assets` | multipart, 1 arquivo | 201 `{ id, ref: "asset:<uuid>", url }` | 401 · 413 > 5 MB · 415 não é PNG/JPG/WebP |
| `GET /assets/:id` | — | 200 imagem | 404 |
