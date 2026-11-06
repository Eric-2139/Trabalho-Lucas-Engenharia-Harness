# Módulos — Editor (`apps/editor`)

Componente Editor · Contrato: `harness/projeto/contratos/editor.md` · Código do contrato: `apps/editor/contrato/`

Decisões: ADR-001, ADR-002, ADR-003, ADR-004, ADR-006, ADR-007, ADR-008, ADR-009, ADR-010, ADR-011, ADR-012, ADR-013, ADR-014, ADR-017. Processo: ADR-015, ADR-016.

## 1. Módulos

| Módulo | Arquivo sugerido | Interface (contrato) | Requisitos |
|---|---|---|---|
| **Store com histórico** | `src/store/` | `criarStoreEditor(documento)`, `EstadoEditor`, `ResultadoAcao` | RF-05, RF-08, RF-09, ADR-008, ADR-011 |
| **Atalhos** | `src/atalhos.ts` | `atalhoTeclado(evento)` | RF-09 |
| **Salvamento** | `src/salvamento.ts` | `criarSalvamento({ faseId, revisaoInicial, obterDocumento, cliente, relogio })` | RF-10, ADR-002 |
| **Cliente HTTP** | `src/cliente-api.ts` | `criarClienteApiEditor(baseUrlApi, fetch?)` | todas as rotas do criador |
| **AbasParedes** | `src/componentes/AbasParedes.tsx` | `PropsAbasParedes` | RF-03 |
| **CanvasParede** | `src/componentes/CanvasParede.tsx` | `PropsCanvasParede` | RF-03, RF-05, RNF-02, RNF-03 |
| **BibliotecaObjetos** | `src/componentes/BibliotecaObjetos.tsx` | `PropsBibliotecaObjetos` | RF-04, RF-06 |
| **PainelPropriedades** | `src/componentes/PainelPropriedades.tsx` | `PropsPainelPropriedades` | RF-07, RF-08, ADR-011, PEND-007 |
| **BarraFerramentas** | `src/componentes/BarraFerramentas.tsx` | `PropsBarraFerramentas` | RF-09, RF-10, RF-11, RF-12, RF-13, RF-14, RNF-07 |
| Telas | `src/telas/` | Login/Cadastro, Minhas fases, Conta, Edição, Modo testar | RF-01, RF-02, RF-11, RF-19 |
| Aviso de resolução | `src/telas/Edicao.tsx` | usa `precisaAvisoResolucao` do `packages/player` com o tamanho da janela e mostra o aviso (não bloqueia) | RNF-01 |
| Mensagens | `src/mensagens.ts` | textos em português | RNF-07 |

## 2. Store (Zustand + zundo)
- Estado: `documento` (a fase), `paredeAtiva`, `selecionado`. O histórico do zundo cobre **só `documento`** (`partialize`), então trocar de aba ou selecionar não vira passo de desfazer (ADR-008).
- **Recusas** (LAC-037): nada muda e não há passo de histórico. As do schema trazem os erros de `validarFase`; as outras trazem exatamente um erro, com o texto definido em `apps/editor/contrato/store.ts` (objeto inexistente, camada no extremo, senha encurtada).
- **Toda ação que altera o documento** monta o documento novo, chama `validarFase` e só aplica se `ok`. Senão devolve `{ ok: false, erros }` e nada muda (ADR-011). Ação aplicada = exatamente um passo de histórico.
- `adicionarObjeto(tipo, imagem, id)`: usa `objetoPadrao`, insere na parede ativa com `camada` = maior + 1 e seleciona (RF-04).
- `alterarGeometria(id, g)`: limita x/y/largura/altura a 0..1 e normaliza a rotação para [0, 360). É chamada só no fim do gesto (`dragend`/`transformend`, ADR-007), então um arraste = um passo (RF-09).
- `mudarCamada(id, 'frente'|'tras')`: renumera as camadas da parede de 0 a n-1 na ordem visual atual (camada, depois posição na lista) e troca o objeto com o vizinho de cima ou de baixo. Assim a sobreposição sempre muda, mesmo com camadas empatadas. No extremo, recusa com `{ caminho: ["camada"], mensagem: "O objeto já está na frente de todos." }` ou `{ caminho: ["camada"], mensagem: "O objeto já está atrás de todos." }`, sem passo de histórico (RF-05, LAC-032, LAC-037).
- `duplicarObjeto(id, novoId)`: cópia na mesma parede, deslocada em +0,02 (limitado a 1), camada mais alta (RF-05).
- `excluirObjeto(id)`: remove e desfaz a seleção (RF-05).
- `alterarPropriedadesFase({ titulo, senha })`: se a nova senha é mais curta e algum enigma revela posição que deixaria de existir, recusa com `enigmasAfetados` (ADR-011).
- `carregar(documento)`: troca o documento e limpa o histórico (abrir fase, renomear pelo servidor). O histórico não sobrevive a recarregar a página (ADR-008).
- O `id` dos objetos novos vem de `crypto.randomUUID()` no componente que chama a ação, nunca de dentro do store.

## 3. Salvamento (RF-10)
- Falhas de rede (LAC-038): o cliente nunca rejeita; sem resposta devolve `{ ok: false, status: 0, erro: "Não foi possível falar com o servidor. Tente de novo." }`. `salvarAgora` também nunca rejeita: 409 → `conflito`; qualquer outra falha (400, 401, 5xx, rede) → `erro`, com a alteração guardada.
- Estados: `salvo` → `pendente` (houve alteração) → `salvando` → `salvo` | `conflito` (409) | `erro` (outro erro; a alteração continua local e é tentada de novo na próxima marcação ou no botão).
- `marcarAlterado()` agenda a gravação para **até 30 s** depois da primeira alteração pendente, e não reinicia o prazo a cada alteração: garante "gravado em até 30 s".
- `salvarAgora()` grava imediatamente; é chamado pelo botão salvar, ao trocar de aba (RF-10) e antes do modo testar (RF-11).
- Usa a `revisao` devolvida por cada `PUT` como a próxima (ADR-002). Depois de salvar uma fase publicada, a tela de edição pede `GET /fases/:id` de novo para atualizar o aviso "alterações não publicadas" (contrato editor.md).
- **Saída do conflito** (decisão da IA com a delegação do Eric, 05/11/2026): em `conflito`, o salvamento automático não grava mais, para não repetir o 409 a cada 30 s. A Edição mostra "Recarregar a fase" (`ROTULOS_EDITOR.recarregarFase`), que chama `abrirFase`, `store.carregar` e cria um salvamento novo com a revisão lida. A alteração local é descartada: a outra aba gravou primeiro (ADR-002).
- **Gravar ao sair e depois do novo login** (PEND-020 e PEND-021, decisões da IA com a delegação do Eric, 06/11/2026): ao desmontar com alteração pendente, a Edição chama `salvarAgora()` antes de `parar()`, e grava também no `pagehide` da janela. Depois de um 401, o app incrementa `sessaoRenovada` a cada login aceito, e a Edição chama `salvarAgora` quando o valor muda.
- Relógio injetado (`Relogio`): os testes avançam o tempo sem esperar.

## 4. Componentes
- **AbasParedes**: 5 `button` com `role="tab"`, na ordem frente, direita, fundo, esquerda, teto; a ativa tem `aria-selected="true"`. Setas e Tab navegam (RNF-07). Trocar de aba chama `salvarAgora` (RF-10).
- **CanvasParede**: `Stage` react-konva no palco 16:9 (`calcularPalco`), só a parede ativa montada (RF-03, ADR-007). Fundo e objetos em camadas separadas; `Transformer` no selecionado. O arraste fica no nó Konva e só chega ao store no fim; `dragBoundFunc` e `boundBoxFunc` limitam a 0..1 (ADR-011). Clique no fundo desmarca e abre Propriedades da fase.
- **BibliotecaObjetos** (LAC-029): três seções. **Objetos**: `CATALOGO` de categoria `objeto`; arrastar para o palco ou Enter adiciona na parede ativa como decoração, e o tipo é trocado no painel. **Fundos**: `CATALOGO` de categoria `fundo` e "sem fundo"; escolher chama `definirFundo(paredeAtiva, ref)`. **Minhas imagens**: as referências `asset:` já usadas na fase (`referenciasDeAsset`) mais as enviadas nesta sessão; cada uma tem "usar como objeto" e "usar como fundo". Enviar imagem: `POST /assets`; sucesso acrescenta a imagem à seção, e a recusa da Api aparece como mensagem (RF-06). Não há rota que liste todos os uploads do criador: uma imagem enviada e nunca usada não aparece depois de recarregar a página. O RF-06 não pede galeria.
- **PainelPropriedades**: com objeto selecionado, mostra o tipo (4 opções, RF-07) e os campos do tipo: fala → texto; enigma → pergunta, respostas (só números, uma por linha), dica, posições reveladas (caixas 1..tamanho da senha); porta → senha da fase. Sem seleção, mostra **Propriedades da fase** (título e senha, PEND-007). Edita num rascunho local e só chama a ação do store com valor válido. Valor inválido mostra o erro e não aplica (ADR-011).
- **BarraFerramentas**: botões nativos com foco visível (RNF-07). Desfazer e refazer (desabilitados quando não há passo), salvar e indicador de salvamento, testar, publicar, exportar, aviso "alterações não publicadas" com "publicar de novo" (PEND-005).

**Convenções dos componentes** (PEND-017, decisão da IA com a delegação do Eric, 05/11/2026), fixadas pelos testes de `tests/editor/`:
- **AbasParedes**: a ordem das abas é contrato; ArrowRight/ArrowLeft movem o foco para a aba vizinha; Enter/Espaço ativam; só focar com Tab não chama `aoTrocar`.
- **BibliotecaObjetos**: cada seção é `role="region"` com o nome `ROTULOS_EDITOR.objetos` / `fundos` / `minhasImagens` (ex.: `<section aria-labelledby>`); cada sprite é um `<button>` com o `nome` do `CATALOGO`; "Sem fundo" é botão da seção Fundos; em Minhas imagens, um par de botões `usarComoObjeto` / `usarComoFundo` por imagem, na ordem de `imagensEnviadas`; o envio é um `<input type="file">` com nome acessível `ROTULOS_EDITOR.enviarImagem`; o componente não acrescenta sozinho a imagem enviada.
- **PainelPropriedades**: tipo = `<select>` com nome `ROTULOS_EDITOR.tipo` e 4 `<option>` cujo `value` é o id do tipo; campos com `<label>` (`texto`, `pergunta`, `respostas` em textarea com uma resposta por linha, `dica`, `senha`, `titulo`); posições reveladas são checkboxes na ordem 1..tamanho da senha; um único botão `ROTULOS_EDITOR.aplicar` aplica o rascunho; erro de validação (do painel ou recusa do store) num elemento `role="alert"`; "Propriedades da fase" aparece como texto.
- **BarraFerramentas**: o indicador mostra só o texto do estado atual; com `alteracoesNaoPublicadas` aparecem o texto `ROTULOS_EDITOR.alteracoesNaoPublicadas` e o botão `ROTULOS_EDITOR.publicarDeNovo` (chama `aoPublicar`); sem ele, nenhum dos dois.

## 5. Telas e fluxos
- **Login/Cadastro**: formulários nativos; cadastro só com nome, e-mail e senha (RNF-06). Ao abrir o app, o editor chama `GET /fases`: 401 leva ao login (RF-01). Durante a edição, qualquer 401 (inclusive do salvamento automático; exceto o login recusado, que só mostra o erro) chama `aoNaoAutenticado`: o login aparece por cima da tela sem recarregar, o salvamento fica em `erro` com a alteração guardada na memória e, depois de entrar, `salvarAgora` grava.
- **Minhas fases**: lista; criar, renomear (`PATCH`), duplicar, excluir. Excluir fase publicada pede confirmação (RF-02).
- **Edição**: abas + canvas + biblioteca + painel + barra; `Ctrl+Z`/`Ctrl+Y` via `atalhoTeclado`, ignorados enquanto o foco está num campo de texto (RF-09).
- **Publicar**: 422 mostra as posições sem enigma, com link para o enigma ou para Propriedades da fase (RF-12).
- **Modo testar**: `salvarAgora`, `GET /fases/:id/jogo-teste`, e o motor do `packages/player` com `criarVerificadorHttp({ modo: 'teste' })`. Ao sair, nada no documento mudou (RF-11).
- **Exportar/importar**: baixa o envelope; importa por `POST /fases/importar` e mostra a recusa (RF-14).
- **Conta**: excluir com confirmação; cancelar não muda nada (RF-19).

**Convenções das telas** (PEND-018, decisão da IA com a delegação do Eric, 06/11/2026), fixadas pelos testes de `tests/editor/`:
- **TelaEntrar**: cada formulário é um `<form>` nativo, com os campos rotulados por `<label>` (`nome`, `email`, `senha`) e o botão de envio (`entrar` ou `cadastrar`) dentro dele. Valem os dois formulários juntos ou um botão de mesmo nome que mostra o outro. O cadastro tem só os 3 campos; Enter no campo envia.
- **MinhasFases**: cada fase mostra o título num elemento próprio (texto exato) e, no mesmo item, os botões `abrir` / `renomear` / `duplicar` / `excluir`; fase publicada mostra o texto `publicada` dentro do item. `novaFase` e `renomear` abrem (ou focam) um único campo `titulo`, confirmado com Enter. Importar é um `<input type="file">` com nome acessível `importar`, e o arquivo vai a `importarFase` sem alteração. Excluir fase não publicada pode ou não pedir confirmação.
- **TelaConta**: o botão `excluirConta` abre o `alertdialog`.
- Em todas, a recusa da Api aparece num elemento `role="alert"` cujo texto contém o `erro` do `ResultadoHttp`.

**Convenções da Edição** (PEND-019, decisão da IA com a delegação do Eric, 06/11/2026), fixadas por `tests/editor/tela-edicao.test.tsx`:
- **Palco no jsdom**: o `CanvasParede` da Edição recebe largura e altura maiores que zero. O jsdom não faz layout, então o tamanho vem da janela (`innerWidth`/`innerHeight`) ou de um valor de reserva, como na `TelaJogo`.
- **Modo testar**: o jogo aparece num palco Konva (`RenderizadorParede` do `packages/player`); clicar num enigma abre um campo de texto, enviado com Enter num formulário ou por botão, como na `TelaJogo`; os resultados usam `MENSAGENS` do player. Durante o teste, a edição pode ficar oculta ou montada.
- **Publicação recusada (422)**: as posições aparecem como números no mesmo bloco do título `posicoesSemEnigma`, que não tem outros números.
- **Exportar**: o arquivo sai por `URL.createObjectURL(Blob)` ou por um `<a download>` com URL `data:`, sem alteração.
- **Seleção e atalhos**: clicar numa fala no palco mostra o campo `texto` do painel com o texto dela; clicar em área vazia mostra Propriedades da fase. Os atalhos escutam no documento (Ctrl ou Cmd + Z desfaz, Ctrl + Y refaz) e não agem com o foco num campo de texto.

**Contrato das telas** (`apps/editor/contrato/telas.ts`; decisão da IA com a delegação do Eric, 05/11/2026). O contrato da fase 3 tipava os 5 componentes, mas não as telas. Sem ele, o agente 3 teria de inventar a interface de login, Minhas fases, Conta e Edição:
- `TelaEntrar` (`PropsTelaEntrar`), `MinhasFases` (`PropsMinhasFases`), `TelaConta` (`PropsTelaConta`) e `TelaEdicao` (`PropsTelaEdicao`) recebem o cliente HTTP por propriedade. A Edição recebe também o `Relogio` do salvamento, `gerarId` para os ids dos objetos novos e `verificadorTeste` para o modo testar.
- Nomes acessíveis e textos fixos em `ROTULOS_EDITOR`: os testes e a implementação usam a mesma constante, como `MENSAGENS` no Player.
- Confirmações (excluir fase publicada, excluir conta) são um diálogo no DOM com `role="alertdialog"` e os botões "Confirmar" e "Cancelar", nunca `window.confirm`. Recusas da Api aparecem num elemento com `role="alert"`.
- O aviso de resolução da Edição contém "1280x720" e não bloqueia a edição (RNF-01, PEND-015).
- O `CanvasParede` é testado no jsdom com o pacote `canvas` (ADR-016), como o `RenderizadorParede` (PEND-011): clique e arraste reais no palco, sem teste por pixel. O fim do arraste chega ao store como um passo de histórico (ADR-007).
