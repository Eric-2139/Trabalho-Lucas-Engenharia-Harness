# Módulos — Player (`packages/player` + `apps/player`)

Componente Player · Contrato: `harness/projeto/contratos/player.md` · Código do contrato: `packages/player/contrato/`, `apps/player/contrato/`

Decisões: ADR-003, ADR-006, ADR-009, ADR-012, ADR-014, ADR-017. Processo: ADR-015, ADR-016.

## 1. Pacote `packages/player` (motor, reutilizado pelo modo testar)

| Módulo | Arquivo sugerido | Interface (contrato) | Requisitos |
|---|---|---|---|
| **MotorInteracoes** | `src/motor.ts` | `criarPartida(fase, verificador): Partida`, `EventoClique`, `ResultadoResposta`, `MENSAGENS` | RF-15, RF-16, RF-17, RNF-04 |
| **EstadoPartida** | `src/estado-partida.ts` | `EstadoPartida` (parede ativa, dígitos por posição, enigmas resolvidos, concluída), `assinar` | RF-15 |
| **VerificadorHttp** | `src/verificador-http.ts` | `criarVerificadorHttp({ baseUrlApi, faseId, modo, fetch? })` | RF-11, RF-15, ADR-003 |
| **Palco** | `src/palco.ts` | `calcularPalco`, `paraPixels`, `precisaAvisoResolucao` | RF-03, RNF-01, RNF-02 |
| **RenderizadorParede** | `src/RenderizadorParede.tsx` | `PropsRenderizadorParede` | RF-16, RF-17, RNF-02 |
| **Tema** | `src/tema.ts` | `tema: Tema`, `razaoContraste` | RNF-07, ADR-014 |

### MotorInteracoes e EstadoPartida
- O motor não conhece React nem a rede: recebe a projeção (`FaseJogo`) e um `Verificador`. Por isso o mesmo motor roda no app público e no modo testar do editor (ADR-009).
- `clicar(objetoId)`, na parede ativa:
  - decoração → `{ tipo: 'nenhum' }` e nada muda (RF-16);
  - fala → `{ tipo: 'fala', texto }` (RF-16);
  - enigma → `pedirResposta` com a pergunta;
  - porta → `pedirSenha` com o `tamanhoSenha`.
- `dica(objetoId)` devolve o texto da dica ou `null`. O ícone de dica só existe quando não é `null` (RF-17).
- `responder(objetoId, texto)`:
  - enigma → `verificador.enigma`. Se `correto`, grava cada `{ posicao, valor }` em `digitosRevelados` e o id em `enigmasResolvidos`, e devolve `{ tipo: 'correto', digitos, mensagem: MENSAGENS.respostaCorreta(digitos) }`. Acerto sem dígitos (esquerda da Escola) também tem reação na tela: "Resposta correta!" (LAC-035). Enigma já resolvido pode ser respondido de novo, como no legado; repetir o acerto não muda o estado. Errado → `{ tipo: 'errado', mensagem: 'Resposta Errada!!' }`, sem mexer no estado (RF-15).
  - porta → `verificador.porta`. `aberta` → `concluida = true`; senão `'Senha incorreta!'` (RF-15).
  - `Limitado` → `'Muitas tentativas, aguarde N s'`, sem contar como erro (ADR-003).
  - Promessa rejeitada (rede) → `{ tipo: 'falha', mensagem: MENSAGENS.falhaDeRede }`; objeto inexistente na parede ativa, decoração ou fala → `{ tipo: 'falha', mensagem: MENSAGENS.semPergunta }`. Nos dois casos o estado não muda, e `responder` nunca rejeita a promessa (LAC-036).
- O motor não exige que os enigmas sejam resolvidos antes da porta (ADR-003: verificador sem estado; RF-15 exige só a senha completa).
- Cada mudança de estado avisa os assinantes uma vez; os componentes React usam `assinar` (via `useSyncExternalStore`).

### VerificadorHttp
- `POST <baseUrlApi>/fases/:id/verificar` com `{ objetoId, resposta }`. Em modo `teste`, acrescenta `?modo=teste` e `credentials: 'include'`.
- 200 → corpo; 429 → `{ limitado: true, tentarEmSegundos }`; outro status → rejeita com erro.
- `fetch` é injetável, então os testes não precisam de rede. `baseUrlApi` é `/api` nos apps (ADR-017).

### Palco
- `calcularPalco(l, a)` → maior 16:9 centralizado. Ex.: 1920×1200 → `{ x: 0, y: 60, largura: 1920, altura: 1080 }` (RNF-02).
- `paraPixels(objeto, palco)` → `x·largura + palco.x` etc. É o mesmo cálculo no editor e no player (ADR-006).
- `precisaAvisoResolucao(l, a)` → `l < 1280 || a < 720` (RNF-01).

### RenderizadorParede (react-konva)
- Duas camadas Konva: fundo (`listening(false)`) e objetos ordenados por `camada`, a mesma organização do canvas do editor.
- Imagens resolvidas por `resolverImagem` do pacote de schema e decodificadas uma vez.
- Decoração não tem handler de clique (RF-16). Enigma com dica ganha, no canto superior direito do objeto, o ícone de dica (`packages/player/recursos/icone-dica.png`, o mesmo do legado), clicável e acessível pelo teclado na tela de jogo. Sem dica, não há ícone (RF-17, LAC-030).

### Tema (ADR-014)
`src/tema.ts` exporta os tokens; `razaoContraste` implementa a fórmula WCAG 2.1. Cada par de `paresDeContraste` precisa dar ≥ 4,5 (RNF-07). O Editor importa o mesmo tema.

## 2. App `apps/player` (público, sem login)

| Módulo | Interface (contrato) | Requisitos |
|---|---|---|
| `ClienteApiJogo` (`src/cliente-api.ts`) | `listarPublicadas`, `obterJogo`; `fetch` injetável; nunca rejeita: sem resposta → `{ ok: false, status: 0, erro: "Não foi possível falar com o servidor. Tente de novo." }` (LAC-038) | RF-13 |
| **TelaInicial** (`src/telas/TelaInicial.tsx`) | apresentação; links para Escolher Fase e para o editor | — |
| **EscolherFase** (`src/telas/EscolherFase.tsx`) | `PropsEscolherFase`: uma entrada por fase, em `<a>`/`<button>` nativos; Tab percorre, Enter abre; foco visível; lista vazia mostra mensagem | RF-13, RNF-07 |
| **TelaJogo** (`src/telas/TelaJogo.tsx`) | `PropsTelaJogo`: 5 botões de parede, palco, caixa de fala, campo de resposta ou senha, dígitos revelados, aviso de resolução, fim de jogo | RF-15, RF-16, RF-17, RF-18, RNF-01, RNF-02 |
| `src/main.tsx` | rotas: `/`, `/fases`, `/jogar/:id` | — |
| `src/mensagens.ts` | textos em português | RNF-07 |

**Convenções da TelaJogo** (PEND-012, Eric em 05/11/2026), fixadas pelos testes de `tests/player/tela-jogo.test.tsx`:
- aviso de resolução com "1280x720" (ou "1280×720") ou "resolução" no texto, sem bloquear o jogo (RNF-01);
- botões de parede com o nome da parede (frente, direita, fundo, esquerda, teto);
- controle de dica: `<button>` com "dica" no nome acessível, só para os enigmas com dica da parede ativa; ativado, mostra o texto (RF-17);
- um único campo de resposta ou senha (`input`), enviado com Enter num `<form>` ou por botão "Responder"/"Enviar"/"Confirmar"; no modo senha, a pergunta do enigma anterior deixa de aparecer;
- o palco tem tamanho diferente de zero no jsdom com a janela em 1280×720 (medido por `innerWidth`/`innerHeight`; o jsdom não tem `ResizeObserver`), e o nó `Image` do Konva existe com largura e altura mesmo sem a imagem carregada, para o clique acertar o objeto.

O `RenderizadorParede` é testado através da `TelaJogo` (PEND-011): clique real no canvas para fala e decoração e controle de dica no DOM; o ícone desenhado não tem teste por pixel.

O app só recebe `FaseJogo` da Api. Nada no bundle do player contém resposta ou senha (RNF-04).
