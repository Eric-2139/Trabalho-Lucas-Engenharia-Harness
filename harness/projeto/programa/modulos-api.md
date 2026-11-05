# Módulos — Api (`apps/api/src`)

Componente Api · Contrato: `harness/projeto/contratos/api.md` · Código do contrato: `apps/api/contrato/`

Decisões: ADR-001, ADR-002, ADR-003, ADR-004, ADR-005, ADR-010, ADR-011, ADR-013, ADR-017. Processo: ADR-015, ADR-016.

## 1. Módulos

| Módulo | Arquivo sugerido | Responsabilidade | Requisitos |
|---|---|---|---|
| Fábrica | `src/app.ts` | `construirApp(opcoes)`: registra plugins e rotas; `onClose` desconecta o Prisma | — |
| Servidor | `src/servidor.ts` | lê `PORTA`, `DATABASE_URL`, `DIRETORIO_ARMAZENAMENTO`, `NODE_ENV`; chama `construirApp` e `listen` | — |
| Banco (acesso) | `src/banco.ts` | cliente Prisma gerado em `src/gerado/prisma` com `@prisma/adapter-pg` | — |
| Sessão | `src/plugins/sessao.ts` | cookie `sid` (HttpOnly, SameSite=Lax, Secure em produção, Path=/); token de 32 bytes; banco guarda o SHA-256; decora `request.usuario` | RF-01, RNF-05, ADR-004 |
| Exigir login | `src/plugins/exigir-login.ts` | pré-handler: sem sessão → 401 | RF-01 |
| Exigir dono | `src/plugins/exigir-dono.ts` | pré-handler: carrega a fase; outro dono ou inexistente → 404; põe `request.fase` | RF-02, RF-14, ADR-005 |
| Limite de tentativas | `src/plugins/limite-verificar.ts` | janelas por IP + fase + tipo (`LIMITES_VERIFICAR`); excedeu → 429 `{ tentarEmSegundos }`; `modo=teste` sem limite; o tempo vem de `OpcoesApp.relogio` (PEND-010) | RF-15, RNF-04, ADR-003 |
| Rotas de conta | `src/rotas/auth.ts` | cadastro, login, logout, excluir conta | RF-01, RF-19, RNF-05, RNF-06 |
| Rotas do criador | `src/rotas/fases.ts` | listar, criar, abrir, salvar (`revisao`), renomear, excluir, duplicar, publicar, jogo-teste, exportar, importar | RF-02, RF-10 a RF-14, RNF-09 |
| Rotas públicas | `src/rotas/publicas.ts` | `/publicadas`, `/publicadas/:id/jogo` | RF-13, RNF-04 |
| Verificar | `src/rotas/verificar.ts` | `POST /fases/:id/verificar` (público ou `modo=teste`) | RF-11, RF-15, RNF-04 |
| Imagens | `src/rotas/assets.ts` + `src/armazenamento/disco.ts` + `src/imagens.ts` | upload multipart, leitura; `detectarTipoImagem` pelos bytes iniciais | RF-06, ADR-010 |
| Erros | `src/erros.ts` | formato `{ erro, detalhes? }`; erros de validação com `detalhes = ErroValidacao[]` | — |

## 2. Regras por rota (complementam `contratos/api.md`)
- **Criar fase**: `CorpoCriarFase` recusa título vazio com 400; só então chama `faseInicial(titulo)`.
- **Cadastro**: `CorpoCadastro` (z.object, descarta campos extras: RNF-06); e-mail guardado em minúsculas; hash `argon2id` (RNF-05); e-mail em uso → 409.
- **Login**: e-mail comparado em minúsculas (o cadastro grava assim); credencial errada → 401 sem dizer qual campo errou. Hash que não é argon2 válido (o usuário de sistema do seed, `"!desativado"`) conta como credencial errada: `argon2.verify` que lança erro vira 401, nunca 500. Cria a sessão e responde com `Set-Cookie`.
- **Excluir conta**: só com `{ confirmar: true }`; apaga o usuário (CASCADE), os arquivos de imagem pelo `Armazenamento` e a sessão; limpa o cookie (RF-19).
- **Salvar** (`PUT /fases/:id`): `CorpoSalvarFase`, depois `validarFase(documento)` (400 com erros), depois referências `asset:` do dono (400), depois revisão igual à do banco (409). Grava, incrementa `revisao` e copia `documento.titulo` para a coluna `titulo` (ADR-002). A ordem 400 → 409 vale também para `publicar` e `importar`.
- **Publicar**: `validarFase` + `validarJogabilidade`; 422 com `{ erro: "A fase não pode ser publicada: há posições da senha sem enigma.", posicoesSemEnigma }` (`RecusaPublicacao`); copia `documento` para `documento_publicado` e grava `publicada_em`.
- **Duplicar**: copia `documento` (não o publicado) para uma fase nova, não publicada, do mesmo dono.
- **Exportar**: envelope com `documento` e as imagens `asset:` em data URL (ADR-013).
- **Importar**: corpo até 50 MB; `validarEnvelope`; cada imagem com tipo pelos bytes e até 5 MB; tudo numa transação: imagens novas do importador, referências reescritas, fase nova. Qualquer falha → nada gravado (ADR-013). A fase criada é "igual" à exportada no sentido de `modulos-schema.md` §4: só os uuids `asset:` mudam.
- **Projeções**: `jogo-teste` e `/publicadas/:id/jogo` passam por `projetarParaJogo`. Antes de responder, o resultado é validado por `FaseJogo` (estrito), o que impede vazar `respostas`, `senha` ou `revela` (RNF-04).
- **Verificar**: lê `documento_publicado` (ou `documento` em `modo=teste`, só para o dono). Enigma: `respostaConfere` → `{ correto, digitos }` com `valor = senha[posicao-1]` para cada posição de `revela`. Porta: `senhaConfere` → `{ aberta }`. Objeto inexistente, ou que não é enigma nem porta → 404. A resposta nunca contém a resposta cadastrada.
- **Assets**: multipart com 1 arquivo; `limits.fileSize` = 5 MB (413); tipo pela assinatura (PNG `89 50 4E 47`, JPEG `FF D8 FF`, WebP `RIFF....WEBP`), senão 415; registro e arquivo gravados juntos (ADR-010).

## 3. Decisões desta fase
- **Política de senha**: o baseline não define tamanho mínimo; o cadastro exige só senha não vazia, com teto de 128 caracteres (o argon2 não deve receber texto ilimitado). Se a equipe quiser uma política, ela vira requisito (Roberta).
- **Prefixo `/api`** fica fora do Fastify (ADR-017): no desenvolvimento o proxy do Vite o retira; em produção, a reescrita da hospedagem.
- **Expiração de sessão**: segue em aberto na ADR-004 (proposta de 7 dias deslizantes, sem requisito). O esquema já tem `expira_em`; a implementação usa 7 dias até haver decisão.
