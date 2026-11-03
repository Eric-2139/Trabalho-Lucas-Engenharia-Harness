# Math Scape — Documento de Arquitetura (Fase 2: Projeto do Sistema)

Versão 1.1 · Responsável: Eric · Entrada: baseline de requisitos `2026-11-03.1` (`harness/baseline/requisitos.json`) · Saída para: Fase 3 (Projeto do Programa)

## 1. Visão geral

O Math Scape novo tem uma ideia central: **a fase é um dado, não um código**. Cada fase é um documento JSON validado por um único schema (RNF-09). O editor produz esse documento, a API guarda e confere, e o player o interpreta.

```
                 ┌──────────────────────────────┐
                 │  SchemaFase (pacote Zod)     │  tipos, validação, jogabilidade,
                 │  packages/schema             │  projeção de jogo sem segredos
                 └──────┬───────────┬───────────┘
              importa   │           │  importa            importa
          ┌─────────────┘           └──────────────┐──────────────┐
          ▼                                        ▼              ▼
 ┌──────────────────┐   usa (modo testar)  ┌──────────────────┐  ┌──────────────────┐
 │ Editor           │ ───────────────────▶ │ Player           │  │ Api (Fastify)    │
 │ apps/editor      │                      │ packages/player  │  │ apps/api/src     │
 │ canvas, abas,    │                      │ apps/player      │  │ contas, fases,   │
 │ biblioteca,      │                      │ renderiza e joga │  │ publicar, upload,│
 │ desfazer/refazer │                      └────────┬─────────┘  │ verificar        │
 └────────┬─────────┘                               │            └────────┬─────────┘
          │ HTTP (cookie de sessão)                 │ HTTP               │ Prisma
          └─────────────────────────────────────────┴──────▶ Api        ▼
                                                             ┌──────────────────┐
                                                             │ Banco            │
                                                             │ PostgreSQL+JSONB │
                                                             │ + disco (imagens)│
                                                             └──────────────────┘
```

A regra que guia o desenho: **posição e visual rodam no cliente; resposta, senha, dono e publicação são conferidos no servidor.**

## 2. Componentes

| Id | Responsabilidade | Não faz | Decisões |
|---|---|---|---|
| `SchemaFase` | Schema Zod da fase; tipos TypeScript; `validarJogabilidade` (RF-12); `projetarParaJogo` (remove respostas e senha); catálogo de sprites; fase original `escola-01.json` | Nada de rede, interface ou banco | ADR-001, ADR-002, ADR-003, ADR-006, ADR-011, ADR-012, ADR-013 |
| `Editor` | Login/cadastro, lista "minhas fases", abas das 5 paredes, canvas, biblioteca, painel de propriedades, desfazer/refazer, salvamento, modo testar, exportar/importar, excluir conta | Conferir resposta; guardar segredo fora do documento do dono | ADR-001, ADR-002, ADR-003, ADR-004, ADR-006, ADR-007, ADR-008, ADR-009, ADR-010, ADR-011, ADR-012, ADR-013, ADR-014 |
| `Player` | Biblioteca de renderização e motor de interações (fala, dica, enigma, porta) + app público (tela inicial, Escolher Fase, jogo) | Conhecer respostas ou senha; decidir acerto | ADR-003, ADR-006, ADR-009, ADR-012, ADR-014 |
| `Api` | Contas e sessão, CRUD de fases, publicar, exportar/importar, upload de imagens, verificação de respostas | Renderizar; editar o documento por conta própria | ADR-001, ADR-002, ADR-003, ADR-004, ADR-005, ADR-010, ADR-011, ADR-013 |
| `Banco` | Esquema Prisma, migrations e seed (fase original) | Regra de negócio | ADR-002, ADR-004, ADR-010 |

Contratos: `harness/projeto/contratos/` (`schema.md`, `api.md`, `editor.md`, `player.md`, `banco.md`). Componentes do harness: `harness/projeto/componentes/*.json`.

### Mudança em relação ao plano original
O plano tinha o player só como `apps/player`. Como o **modo testar (RF-11)** joga a fase dentro do editor com as regras do jogador, o motor do player vira uma biblioteca (`packages/player`) usada pelo app público e pelo editor (ADR-009). Assim existe um único motor de regras.

## 3. Comunicação

| De → para | Como | O que trafega |
|---|---|---|
| Editor → Api | HTTP JSON, cookie de sessão | documento completo da fase **do próprio dono** (inclui respostas: é o autor) |
| Player → Api | HTTP JSON, sem login | projeção de jogo (sem respostas nem senha); tentativas de resposta |
| Editor (modo testar) → Api | HTTP JSON, cookie | `jogo-teste` (projeção do rascunho) e `verificar` com `modo=teste`, que confere contra o rascunho do dono |
| Api → Banco | Prisma | linhas relacionais + documento JSONB |
| Todos → SchemaFase | import em tempo de build | tipos e validação |

## 4. Modelo de dados

```
usuarios (id uuid PK, nome text, email citext UNIQUE, senha_hash text, criado_em)
sessoes  (id_hash text PK, usuario_id FK→usuarios ON DELETE CASCADE, criada_em, expira_em)
fases    (id uuid PK, dono_id FK→usuarios ON DELETE CASCADE, titulo text,
          documento jsonb NOT NULL,            -- versão de edição (rascunho)
          documento_publicado jsonb NULL,      -- cópia congelada ao publicar
          publicada_em timestamptz NULL, revisao int NOT NULL, criada_em, atualizada_em)
assets   (id uuid PK, dono_id FK→usuarios ON DELETE CASCADE, arquivo text, mime text,
          bytes int CHECK (bytes <= 5242880), criado_em)
```

- `usuarios` só tem nome, e-mail e hash (RNF-06). `sessoes` não é dado de cadastro: é estado técnico de login.
- A exclusão de conta (RF-19) apaga o usuário, e o `CASCADE` remove sessões, fases e imagens. Uma fase publicada de conta excluída sai de Escolher Fase.
- `revisao` permite controle de concorrência otimista no salvamento automático (ADR-002).
- `documento_publicado` é a versão que os jogadores veem; muda só ao publicar (PEND-005). O salvamento automático altera apenas `documento`, e o editor indica "alterações não publicadas" quando os dois diferem.

## 5. API

| Método | Rota | Quem | Função | Req. |
|---|---|---|---|---|
| POST | `/auth/cadastro` | visitante | cria conta (só nome, e-mail, senha) | RF-01, RNF-06 |
| POST | `/auth/login` · `/auth/logout` | — | abre/encerra sessão (cookie HttpOnly) | RF-01, RNF-05 |
| DELETE | `/auth/conta` | dono | exclui a própria conta e os dados | RF-19 |
| GET | `/fases` | criador | lista as fases do próprio criador | RF-02 |
| POST | `/fases` | criador | cria fase (documento inicial válido) | RF-02 |
| GET · PUT · PATCH · DELETE | `/fases/:id` | dono | abre, salva (com `revisao`), renomeia, exclui | RF-02, RF-10 |
| GET | `/fases/:id/jogo-teste` | dono | projeção de jogo do rascunho para o modo testar | RF-11, RNF-04 |
| POST | `/fases/:id/duplicar` | dono | cópia com novo id | RF-02 |
| POST | `/fases/:id/publicar` | dono | valida schema + jogabilidade; 422 com posições sem enigma | RF-12, RF-13 |
| GET | `/fases/:id/exportar` | dono | baixa o envelope com a fase e as imagens embutidas (ADR-013) | RF-14 |
| POST | `/fases/importar` | criador | cria fase e imagens novas do importador; 400 se fora do schema | RF-14, RNF-09 |
| GET | `/publicadas` | todos | lista para Escolher Fase (id e título, sem dado do autor) | RF-13, RNF-06 |
| GET | `/publicadas/:id/jogo` | todos | projeção de jogo, sem respostas nem senha | RF-13, RNF-04 |
| POST | `/fases/:id/verificar` | todos (publicada) · dono (`modo=teste`) | recebe objeto + resposta/senha; devolve só certo/errado e dígitos revelados; 429 acima do limite por IP e fase | RF-15, RF-11, RNF-04 |
| POST | `/assets` · GET `/assets/:id` | criador · todos | upload (PNG/JPG/WebP ≤ 5 MB) e leitura | RF-06 |

Detalhes de corpo e erros: `contratos/api.md`.

## 6. Onde cada regra roda

| Regra | Cliente | Servidor |
|---|---|---|
| Posição, tamanho, rotação, camada | Editor (Konva) | só valida o schema |
| Desfazer/refazer | Editor (zundo) | — |
| Validação do documento | Editor: o store só aceita documento válido (ADR-011) | **Api: obrigatória ao salvar, publicar e importar** |
| Jogabilidade para publicar | Editor (aviso) | **Api: decide** |
| Resposta de enigma e senha da porta | — | **Api, sempre (inclusive modo testar)** |
| Quem pode alterar, exportar, excluir | esconde botões | **Api: dono confere em toda rota de escrita** |
| Tipo e tamanho de imagem | aviso | **Api: confere pelo conteúdo do arquivo** |

## 7. Requisitos não funcionais críticos

| RNF | Decisão | Como verificar |
|---|---|---|
| RNF-03 desempenho (30 fps, 50 objetos) | ADR-007 | Playwright mede quadros durante o arraste. Mede na máquina usada no teste, registrando a configuração (PEND-006). |
| RNF-04 segurança (respostas fora do navegador) | ADR-003 | Teste de integração: nenhuma rota pública devolve `respostas` ou `senha`; inspeção de tráfego no E2E |
| RNF-05 segurança (hash, cookie) | ADR-004 | Teste: banco guarda `$argon2id$...`; `Set-Cookie` com `HttpOnly` |

## 8. Decisões de requisito que afetaram o projeto

Todas as pendências estão respondidas (baseline `2026-11-03.1`).

| # | Questão | Decisão | Efeito no projeto |
|---|---|---|---|
| 1 | Editar fase publicada (PEND-005) | Só muda o que os jogadores veem ao publicar de novo | ADR-002 confirmada; indicador "alterações não publicadas" no editor (LAC-002) |
| 2 | Máquina dos 30 fps (PEND-006) | Qualquer uma | ADR-007: mede na máquina do teste e registra a configuração (LAC-001) |
| 3 | Fase sem porta (PEND-007) | Pode publicar | `validarJogabilidade` confere só as posições da senha |
| 4 | Comparação de respostas (PEND-008) | Só o número | Respostas cadastradas são números; `respostaConfere` compara numericamente |
| 5 | Autor recebe as próprias respostas (PEND-009) | Pode | Leitura da ADR-003 ratificada (LAC-008) |

Decidido no projeto após a primeira verificação do agente 5:
- Limite de tentativas em `verificar` por IP e fase, separado por tipo (enigma 300/min; porta 30 a cada 10 min), que cabe numa turma em laboratório e deixa a força bruta da senha lenta (ADR-003, LAC-015, LAC-021). Risco residual registrado: respostas numéricas pequenas ainda podem ser achadas por tentativa.
- Senha editável no painel da fase, sem depender da porta (LAC-019); senha comparada por dígitos exatos e respostas pelo número único do texto (LAC-020); aviso de alterações não publicadas calculado pela Api (LAC-018); tema e acessibilidade comuns (ADR-014); decisões dos componentes derivadas da matriz (LAC-022).
- Referências `asset:` só do próprio dono (ADR-010, LAC-014); Escolher Fase mostra o título da versão publicada (ADR-002, LAC-013); tema visual comum no Player (LAC-016); matriz conferida contra o cabeçalho de cada ADR (LAC-017).
- Documento sempre válido no editor (ADR-011, LAC-003), catálogo de sprites (ADR-012, LAC-006), exportação autocontida (ADR-013, LAC-007), dica na projeção (LAC-004), renomear e título único (LAC-005), autor fora da lista pública (LAC-012), RNF-07 no Player (LAC-009), matriz de navegadores (LAC-010), elementos do RNF-08 no editor (LAC-011).

## 9. Decisões (ADRs)

| ADR | Título | Requisitos |
|---|---|---|
| ADR-001 | Fase como documento JSON com schema Zod único e compartilhado | RF-05, RF-07, RF-08, RF-12, RF-14, RF-16, RF-17, RF-18, RNF-09 |
| ADR-002 | PostgreSQL com fase em JSONB, rascunho e versão publicada | RF-02, RF-10, RF-13 |
| ADR-003 | Respostas e senha só no servidor; projeção de jogo | RF-11, RF-15, RF-18, RNF-04 |
| ADR-004 | Sessão opaca em cookie HttpOnly e hash argon2id | RF-01, RF-19, RNF-05, RNF-06 |
| ADR-005 | Autorização por dono em toda rota de escrita e exportação | RF-02, RF-14, RF-19 |
| ADR-006 | Palco 16:9 com coordenadas relativas | RF-03, RNF-01, RNF-02 |
| ADR-007 | Canvas react-konva otimizado para arrastar | RF-05, RNF-03 |
| ADR-008 | Desfazer/refazer só sobre o documento da fase | RF-02, RF-09 |
| ADR-009 | Motor do player como biblioteca reutilizada no modo testar | RF-11, RF-15, RF-16, RF-17, RF-18 |
| ADR-010 | Imagens em disco atrás de interface de armazenamento | RF-06, RF-19 |
| ADR-011 | O documento no editor é sempre válido | RF-05, RF-08, RF-10, RNF-08, RNF-09 |
| ADR-012 | Catálogo de sprites no pacote de schema | RF-04, RF-06, RF-18 |
| ADR-013 | Exportação autocontida | RF-14, RF-19, RNF-09 |
| ADR-014 | Tema visual e acessibilidade comuns a Editor e Player | RNF-07 |

Arquivos: `harness/projeto/decisoes/ADR-NNN.md`. A rastreabilidade completa (requisito → componente → decisão) está em `harness/matriz/rastreabilidade.json`.
