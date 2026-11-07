# Resumo para o Documento de Requisitos

Projeto: Math Scape, um editor e jogo de fases de escape room que recria a fase original "Escola".
Fontes: `harness/baseline/requisitos.json`, `harness/pendencias/`, `harness/relatorios/` e `docs/ia-log/` deste repositório, no commit `dbc3c51`.

---

## 1. Baseline aprovado

| Campo | Valor |
|---|---|
| Versão | **2026-11-03.1** |
| Aprovado por | Roberta Telles |
| Data da aprovação | 03/11/2026, 18:05 (horário de Brasília) |
| Versão anterior | 2026-11-01.2 (guardada em `harness/baseline/historico-2026-11-01.2.json`) |
| Origem | Math Scape – Documento de Requisitos v1.1 (seções 4, 5, 7 e 9), com as decisões da Roberta e da equipe aplicadas ao rascunho do agente 1. A versão 2026-11-03.1 incorporou as respostas às PEND-005 a PEND-009. |
| Total de requisitos | 28 (19 funcionais e 9 não funcionais), todos com status `OK` |
| Pendências abertas no baseline | nenhuma |
| Não promovido | RNF-11 (restrições tecnológicas). Não virou requisito: fica como "Stack definida" na seção 8 do Documento de Requisitos e serve de entrada para o Projeto do Sistema. |

---

## 2. Requisitos do baseline

`RF` = requisito funcional. `RNF` = requisito não funcional.

| ID | Categoria | Requisito | Critério de aceitação |
|---|---|---|---|
| RF-01 | Funcional | Cadastro e login; login exigido só para criar fases, jogar fases publicadas não exige login. | Dado um visitante, quando se cadastra com nome, e-mail e senha, então consegue fazer login. Sem login, ao tentar acessar o editor, é encaminhado ao login; sem login, consegue jogar uma fase publicada. |
| RF-02 | Funcional | Criar, renomear, duplicar e excluir as próprias fases (sala de 5 paredes); excluir fase publicada exige confirmação; exclusão não se desfaz com Ctrl+Z. | Dado um criador logado, criar, renomear, duplicar e excluir refletem na lista dele. Excluir fase publicada pede confirmação: cancelando, nada muda; confirmando, ela sai da tela Escolher Fase. Ctrl+Z não restaura fase excluída. Tentar alterar fase de outro criador (interface ou API) é recusado. |
| RF-03 | Funcional | Editar as 5 paredes em área de proporção fixa, trocando por abas. | Dado o editor aberto, existem 5 abas; cada aba mostra só os objetos daquela parede, e a área mantém a proporção ao redimensionar a janela. |
| RF-04 | Funcional | Biblioteca de objetos: porta, quadro, janela, relógio e os objetos da fase original. | A biblioteca contém porta, quadro, janela, relógio e cada objeto da fase original (entre eles giz, selo e árvore); arrastar qualquer um até a parede ativa o coloca nela. |
| RF-05 | Funcional | Mover, redimensionar, rotacionar, ordenar camadas, duplicar e excluir objetos. | Mover, redimensionar e rotacionar são mantidos após recarregar; mudar camada altera a sobreposição; duplicar cria cópia na mesma parede; excluir remove o objeto. |
| RF-06 | Funcional | Enviar imagens PNG, JPG ou WebP de até 5 MB para fundo ou objeto. | PNG, JPG ou WebP de até 5 MB pode ser usado como fundo ou objeto; outro formato ou mais de 5 MB é recusado com mensagem e nada é gravado. |
| RF-07 | Funcional | 4 tipos de objeto: decoração (só visual), fala, enigma e porta. | Todo objeto tem exatamente um dos 4 tipos; a decoração não tem campos de comportamento; tipo fora dos quatro ou decoração com fala é recusado pelo schema. |
| RF-08 | Funcional | Configurar fala (texto), enigma (pergunta, uma ou mais respostas numéricas, dica, zero ou mais dígitos) e porta (senha de 4 a 8 dígitos, padrão 5). | Fala grava texto. Enigma grava pergunta, uma ou mais respostas numéricas (resposta que não é número é recusada), dica e zero ou mais dígitos (enigma sem dígito é aceito, como na parede esquerda). Porta começa com 5 dígitos, aceita de 4 a 8 e rejeita 3, 9 ou não dígitos. |
| RF-09 | Funcional | Desfazer e refazer com Ctrl+Z e Ctrl+Y. | Após mover um objeto, Ctrl+Z o devolve à posição anterior e Ctrl+Y à nova. |
| RF-10 | Funcional | Salvamento automático a cada 30 s, ao trocar de parede e ao mandar salvar. | Alteração não salva é gravada em até 30 s, ao trocar de parede e ao mandar salvar; ao recarregar, ela está presente. Numa fase publicada, o salvamento altera só a versão em edição: os jogadores continuam vendo a versão publicada até o criador publicar de novo. |
| RF-11 | Funcional | Jogar a fase dentro do editor para testar. | O modo testar joga a fase com as regras do jogador, conferindo respostas no servidor; ao sair, a fase está inalterada. |
| RF-12 | Funcional | Bloquear a publicação se algum dígito da senha não estiver ligado a um enigma, indicando quais. | Com todas as posições da senha ligadas a enigmas, publica. Com senha 92139 e posições 2 e 5 sem enigma, a publicação é recusada e o sistema mostra as posições 2 e 5. Fase sem porta pode ser publicada: a validação confere só as posições da senha. |
| RF-13 | Funcional | Publicar fase; tela Escolher Fase lista as publicadas. | Fase não publicada não aparece em Escolher Fase; publicada, aparece e qualquer jogador consegue jogar. Editar uma fase publicada não muda o que os jogadores veem; publicar de novo substitui a versão publicada. |
| RF-14 | Funcional | Exportar as próprias fases e importar fase em JSON. | Exportar e importar o mesmo arquivo gera fase igual; arquivo fora do schema é recusado; exportar fase de outro criador é recusado. |
| RF-15 | Funcional | Enigma resolvido revela dígitos; aceita qualquer resposta cadastrada, comparando só o número; porta abre só com a senha completa. | Enigma com respostas A e B fica resolvido com A ou B e revela seus dígitos; outra resposta não revela nada. A porta abre só com a senha completa correta. A comparação analisa só o número: com resposta cadastrada 80, "80", " 80 ", "080" e "80,0" resolvem o enigma; "oitenta" ou texto sem número não resolve. |
| RF-16 | Funcional | Decoração não reage ao clique; fala ao clicar é sempre objeto do tipo fala. | Clicar numa decoração não mostra fala nem muda o jogo; clicar numa fala com texto T mostra T. |
| RF-17 | Funcional | Enigma com dica exibe ícone de dica que mostra a dica cadastrada. | Enigma com dica D mostra ícone que exibe D; enigma sem dica não mostra ícone; não existe objeto de dica separado. |
| RF-18 | Funcional | Fase original recriada com os mesmos enigmas, respostas, dígitos e senha 92139. | A fase original tem: esquerda, enigmas 15 e 40 (sem dígito, dados para o teto); teto 55 → 92; direita 123 → 1; frente 310 → 3; fundo -15 ou 80 → 9. Resolvendo tudo e digitando 92139, a porta abre. Perguntas iguais às do Math_Scape_Telas; animação do selo e da árvore não exigida. |
| RF-19 | Funcional | Usuário pode excluir a própria conta e seus dados (LGPD). | Ao excluir a própria conta e confirmar, a sessão acaba, o login é recusado e nome, e-mail e hash deixam de existir no banco; cancelando, a conta continua; excluir conta de outro usuário é recusado. |
| RNF-01 | Não funcional (compatibilidade) | Duas últimas versões estáveis de Chrome, Edge e Firefox, no computador, tela mínima 1280x720; abaixo disso, aviso. | Nas duas últimas versões de Chrome, Edge e Firefox, a 1280x720 ou mais, o fluxo criar, publicar e jogar é concluído; abaixo disso aparece um aviso. |
| RNF-02 | Não funcional (portabilidade) | Sala em 16:9 com posições relativas, escalando a partir de 1280x720. | Em 1280x720, 1920x1080 e 2560x1440, a sala fica em 16:9 e os objetos mantêm posição e tamanho relativos. |
| RNF-03 | Não funcional (desempenho) | Arrastar objetos a pelo menos 30 quadros por segundo com até 50 objetos por parede. | Com 50 objetos numa parede, arrastar mantém pelo menos 30 quadros por segundo. A medição vale em qualquer máquina usada no teste; o relatório registra a configuração da máquina e o navegador. |
| RNF-04 | Não funcional (segurança) | Respostas e senha nunca vão ao navegador de quem joga; conferência no servidor, inclusive no modo testar. O editor do autor recebe o próprio documento. | Inspecionando todas as respostas HTTP durante o jogo e no modo testar, nenhuma resposta nem senha aparece; o servidor devolve só certo/errado e dígitos revelados. O editor do próprio autor pode receber e mostrar as respostas e a senha da fase dele. |
| RNF-05 | Não funcional (segurança) | Senhas com hash (argon2 ou bcrypt); login por sessão em cookie httpOnly. | O banco guarda só hash argon2 ou bcrypt; o cookie de sessão tem o atributo HttpOnly. |
| RNF-06 | Não funcional (conformidade) | Cadastro coleta somente nome, e-mail e senha (LGPD). | O cadastro aceita e grava só nome, e-mail e senha; campo extra não é gravado. |
| RNF-07 | Não funcional (usabilidade) | Interface em português, contraste WCAG 2.1 AA e navegação por teclado no login, Escolher Fase e barra do editor. | Textos em português; contraste mínimo de 4,5:1 (3:1 para texto grande); login, Escolher Fase e barra do editor operáveis só pelo teclado, com foco visível. |
| RNF-08 | Não funcional (usabilidade) | Pessoa que não programa cria e publica uma fase jogável em menos de 30 minutos. | Participante que não programa, sem ajuda, publica uma fase jogável em menos de 30 minutos. |
| RNF-09 | Não funcional (manutenibilidade) | Toda fase é um documento JSON validado por um schema único. | Documento fora do schema é recusado ao salvar, publicar e importar; documento válido é aceito nos três. |

---

## 3. Pendências e decisões

O repositório tem 25 pendências, todas respondidas.

### 3.1 Pendências sobre os requisitos (PEND-001 a PEND-009)

As PEND-001 a 006 foram abertas pelo agente de requisitos e as PEND-007 a 009 pelo arquiteto. A Roberta respondeu todas em 03/11/2026: as PEND-001 a 004 às 17:41, gerando o baseline 2026-11-01.2, e as PEND-005 a 009 às 18:05, gerando o baseline 2026-11-03.1.

| Pendência | Tipo | Aberta por | Requisitos | Pergunta | Decisão | Decidido por |
|---|---|---|---|---|---|---|
| PEND-001 | Conflito | requisitos | RF-08, RF-18 | A fase 'Escola' deve se comportar igual ao legado (RF-18) mesmo onde o legado usa comportamentos que os 4 tipos de objeto e a configuração de interação do MVP (RF-08) não suportam? | Manter os 4 tipos do MVP e reescrever RF-18 com o que fica fora (opção 2). A Escola mantém enigmas, respostas, dígitos e senha 92139. Enigmas da esquerda (15 e 40) são enigmas sem dígito, dados para o teto. A dica é a do próprio enigma (RF-17), sem objeto de dica separado. Decoração é só visual; objeto que fala usa o tipo fala (RF-16). Animação do selo e da árvore, relógio com hora real, revelação do Tet e volta para Opções não são exigidos (mudança de cena fica para a versão 2). | Roberta Telles |
| PEND-002 | Revisão crítica | requisitos | RF-01, RF-02, RF-03, RF-06, RF-10, RF-14, RNF-04, RNF-05, RNF-06 | Os critérios de aceitação dos requisitos em categoria crítica (autenticação, dado pessoal, conformidade, operação destrutiva e sigilo da senha do jogo) estão corretos e completos para irem ao baseline? | Aprovar com ajustes. RF-01: login por e-mail e senha; cadastro com nome, e-mail e senha. Criado o RF-19 (excluir a própria conta e seus dados). Excluir fase publicada exige confirmação; cada criador só mexe nas próprias fases; exclusão de fase não se desfaz com Ctrl+Z. Modo testar confere respostas no servidor (RNF-04). "Senha" em RF-08/RF-12 é a senha final do jogo, protegida por RNF-04. Recuperação de senha, expiração e atributos Secure/SameSite do cookie e consentimento formal não entram no baseline 1.1. | Roberta Telles |
| PEND-003 | Ambiguidade | requisitos | RNF-08 | Qual nível de contraste a interface deve atender? | WCAG 2.1 AA (4,5:1; 3:1 para texto grande). Escopo dos menus: login, Escolher Fase e barra do editor (RNF-07). | Roberta Telles |
| PEND-004 | Ambiguidade | requisitos | RF-17 | Quais fases cada usuário pode exportar e importar em JSON, e o JSON exportado inclui respostas e senha final? | Só o autor exporta as próprias fases (exportar fase de outro criador é recusado); importar cria fase do importador e arquivo fora do schema é recusado (RF-14). | Roberta Telles |
| PEND-005 | Ambiguidade | requisitos | RF-12, RF-15 | O que acontece quando o criador edita uma fase já publicada, e o salvamento automático a cada 30 s altera a versão que os jogadores estão jogando? | Só se publicar a fase: editar uma fase publicada não muda o que os jogadores veem até o criador publicar de novo (opção 1). | Roberta Telles |
| PEND-006 | Ambiguidade | requisitos | RNF-03 | Em qual máquina de referência os 30 quadros por segundo com 50 objetos por parede devem ser medidos? | Em qualquer uma: não há máquina de referência fixa; os 30 fps valem na máquina usada no teste, com a configuração registrada no relatório. | Roberta Telles |
| PEND-007 | Ambiguidade | arquiteto | RF-12, RF-13 | Uma fase sem nenhuma porta pode ser publicada? | Pode: fase sem porta pode ser publicada; RF-12 confere só as posições da senha. | Roberta Telles |
| PEND-008 | Ambiguidade | arquiteto | RF-15, RF-18 | Como a resposta digitada é comparada com as respostas cadastradas? | Analisa somente o número: respostas são numéricas e a comparação é numérica (" 80 ", "080", "80,0" = 80; texto sem número é errado). | Roberta Telles |
| PEND-009 | Ambiguidade | arquiteto | RNF-04 | O RNF-04 ("respostas e senha nunca vão ao navegador") permite que o editor do autor receba o próprio documento com respostas e senha? | Pode: o editor do autor recebe o próprio documento com respostas e senha; o RNF-04 protege o navegador de quem joga, inclusive no modo testar. | Roberta Telles |

### 3.2 Respostas complementares (baseline 2026-11-03.1)

As respostas às PEND-005 a PEND-009 entraram depois da primeira aprovação e mudaram os critérios de RF-08, RF-10, RF-12, RF-13, RF-15, RNF-03 e RNF-04 (segundo `docs/ia-log/fase-2.md`). O texto de cada resposta está na tabela acima.

### 3.3 Pendências das fases seguintes (PEND-010 a PEND-025)

Foram abertas pelos agentes de testes e de codificação. Tratam de detalhes de projeto, testes e defeitos, sem mudar o texto dos requisitos. Ficam aqui só para registro.

| Pendência | Tipo | Aberta por | Requisitos | Pergunta | Decisão | Decidido por |
|---|---|---|---|---|---|---|
| PEND-010 | Arquitetura | testes | RF-15 | Como os testes devem conferir que o limite de tentativas de POST /fases/:id/verificar libera de novo depois da janela (60 s enigma, 600 s porta), se OpcoesApp não recebe relógio? | Relógio injetável: OpcoesApp ganha `relogio?: () => number` (milissegundos, padrão Date.now), usado pelo limite de tentativas; os testes avançam o relógio para conferir a liberação depois da janela. | Eric |
| PEND-011 | Arquitetura | testes | RF-16, RF-17 | O RenderizadorParede monta o próprio Stage Konva, e qual é a geometria do ícone de dica (tamanho e posição exata em relação ao canto superior direito do enigma)? | Opção (c): RenderizadorParede é coberto pela TelaJogo (clique real no canvas para fala e decoração; controle de dica acessível no DOM). Sem teste por pixel do ícone e sem konva na raiz. | Eric |
| PEND-012 | Arquitetura | testes | RNF-01, RF-15, RF-16, RF-17, RF-18 | Os testes da TelaJogo assumiram os textos e controles abaixo, que o contrato não fixa. Confirma (e registra em modulos-player.md §2 / apps/player/src/mensagens.ts) ou define outros? | Opção (a): confirmados os textos e controles que os testes assumem; registrados em modulos-player.md §2. | Eric |
| PEND-013 | Arquitetura | codificacao | RNF-07 | test_RNF07_tab_percorre_as_fases_na_ordem_da_lista (tests/player/escolher-fase.test.tsx) só passa se a tela Escolher Fase tiver focáveis extras que não são entradas de fase. Isso contraria o projeto, que pede só a lista. Como resolver? | Opção (a), já executada: o agente 3 corrigiu o teste do Tab na rodada 9 (testes-2026-11-05T19-21-22-271Z.json) e o RNF-07 ficou verde (codificacao-2026-11-05T19-23-24-323Z.json). Só faltava registrar o fechamento. | Claude (sessão principal), com decisão delegada pelo Eric |
| PEND-014 | Arquitetura | codificacao | RNF-01 | A parte 1 do RNF-01 (ADR-006: browserslist das duas últimas versões de Chrome, Edge e Firefox e E2E Playwright chromium/msedge/firefox do fluxo criar, publicar e jogar) exige arquivos fora dos arquivos_previstos do Editor e do Player. Quem implementa e onde? | Opção (c): a parte 1 do RNF-01 (browserslist e E2E Playwright em chromium, msedge e firefox) fica para as fases 5-6, como a ADR-016 já prevê para a suíte Playwright. O fluxo criar, publicar e jogar só roda de ponta a ponta depois das telas do Editor. Na fase 4, o RNF-01 cobre o aviso de resolução no Player e no Editor. | Claude (sessão principal), com decisão delegada pelo Eric |
| PEND-015 | Escalada | codificacao | RNF-01 | O aviso de resolução do Editor (modulos-editor.md §1: 'src/telas/Edicao.tsx usa precisaAvisoResolucao e mostra o aviso, sem bloquear') não tem teste e a tela Edicao ainda não existe. Implemento agora ou espero? | Opção (a): o agente 3 escreve os testes do aviso de resolução no Editor (tests/editor/, @req RNF-01, os mesmos limites da TelaJogo) na rodada do Editor, e o agente 4 implementa o aviso junto com a tela de edição. Nada de código sem teste. | Claude (sessão principal), com decisão delegada pelo Eric |
| PEND-016 | Escalada | codificacao | RF-13 | A parte do Editor do RF-13 (botão Publicar, aviso 'alterações não publicadas' e 'publicar de novo', contrato editor.md linha 23) não tem teste e a tela de edição ainda não existe. Segue a mesma regra da PEND-015 (testes do agente 3 antes, implementação junto com a tela de edição)? | Sim, mesma decisão da PEND-015 (a): o agente 3 escreve os testes da barra do Editor (publicar, aviso de alterações não publicadas, publicar de novo) e o agente 4 implementa junto com a tela de edição. | Claude (sessão principal), com decisão delegada pelo Eric |
| PEND-017 | Arquitetura | testes | RF-03, RF-04, RF-06, RF-07, RF-08, RF-10, RNF-07 | Os testes dos componentes do Editor (rodada B1) assumiram a estrutura acessível abaixo, que apps/editor/contrato/componentes.ts e modulos-editor.md §4 não fixam. Confirma (e registra em modulos-editor.md §4) ou define outra? | Opção (a): confirmada a estrutura acessível que os testes assumem; registrada em modulos-editor.md §4 (Convenções dos componentes). | Claude (sessão principal), com decisão delegada pelo Eric |
| PEND-018 | Arquitetura | testes | RF-01, RF-02, RF-14, RF-19, RNF-06, RNF-07 | Os testes das telas TelaEntrar, MinhasFases e TelaConta (rodada B2a) assumiram a estrutura acessível abaixo, que apps/editor/contrato/telas.ts e modulos-editor.md §5 não fixam. Você confirma e registra em modulos-editor.md §5 (Contrato das telas), ou define outra? | Opção (a): confirmada a estrutura acessível que os testes assumem; registrada em modulos-editor.md §5 (Convenções das telas). | Claude (sessão principal), com decisão delegada pelo Eric |
| PEND-019 | Arquitetura | testes | RF-03, RF-09, RF-11, RF-12, RF-14, RNF-01 | Os testes da TelaEdicao (rodada B2b, tests/editor/tela-edicao.test.tsx) assumiram cinco pontos que apps/editor/contrato/telas.ts e modulos-editor.md §5 não fixam. Você confirma e registra em modulos-editor.md §5 (Convenções das telas), ou define outra coisa? | Opção (a): confirmado o que os testes assumem (palco pelo tamanho da janela no jsdom, modo testar com RenderizadorParede e campo de resposta como na TelaJogo, posições do 422 como números no bloco do título, exportar por createObjectURL ou <a download>, seleção pelo palco e atalhos no documento); registrado em modulos-editor.md §5 (Convenções da Edição). | Claude (sessão principal), com decisão delegada pelo Eric |
| PEND-020 | Arquitetura | codificacao | RF-01, RF-10 | Depois do login por cima da Edição (401 durante o uso), quem chama `salvarAgora`? O main.tsx não tem acesso ao salvamento, e PropsTelaEdicao (apps/editor/contrato/telas.ts, fora do escopo de escrita do agente 4) não tem como avisar a Edição de que a sessão voltou. | Opção (b): PropsTelaEdicao ganha `sessaoRenovada?: number`; o app o incrementa a cada login aceito depois de um 401 e a Edição chama `salvarAgora` quando ele muda. O agente 3 cobre com teste e o agente 4 implementa (TelaEdicao e main.tsx). | Claude (sessão principal), com decisão delegada pelo Eric |
| PEND-021 | Defeito de código | codificacao | RF-10 | Ao sair da Edição (link 'Minhas fases' ou 'Conta' na navegação, botão voltar do navegador, outra fase), a TelaEdicao desmonta e chama só `salvamento.parar()`, que cancela o agendamento: a alteração ainda pendente (até 30 s) é descartada sem ser gravada. A Edição deve gravar antes de fechar? | Opção (a): ao desmontar com alteração pendente, a TelaEdicao chama `salvarAgora()` (sem esperar) antes de `parar()`, e grava também no `pagehide` da janela. O agente 3 cobre com teste de desmontagem e o agente 4 implementa. | Claude (sessão principal), com decisão delegada pelo Eric |
| PEND-022 | Defeito de código | testes | RF-05 | DEF-01: excluir, duplicar e mudar camada não têm controle na interface. Os testes novos do contrato da LAC-044 estão vermelhos; o agente 4 implementa os 4 botões no PainelPropriedades e o 'excluir' do atalhoTeclado e da Edição? | Opção (a), decorrente das decisões do Eric nas LAC-043 a LAC-046 (06/11/2026, nesta sessão): implementar conforme o contrato. Implementado pelo agente 4 no commit 29b9d01 (RF-05), suíte verde; confirmado no Playwright em 3 execuções seguidas. | Eric (arquiteto), pelas decisões de contrato das LAC-043 a LAC-046 |
| PEND-023 | Defeito de código | testes | RF-04 | DEF-02: não é possível arrastar um objeto da biblioteca até a parede ativa. Os testes novos do contrato da LAC-045 estão vermelhos; o agente 4 implementa o arraste (biblioteca draggable, região do palco com drop, aoSoltar e adicionarObjeto com posicao)? | Opção (a), decorrente das decisões do Eric nas LAC-043 a LAC-046 (06/11/2026, nesta sessão): implementar conforme o contrato. Implementado pelo agente 4 no commit c75575e (RF-04), suíte verde; confirmado no Playwright em 3 execuções seguidas. | Eric (arquiteto), pelas decisões de contrato das LAC-043 a LAC-046 |
| PEND-024 | Defeito de código | testes | RF-06 | DEF-03: imagem enviada já usada na fase vira entrada inutilizável/duplicada em Minhas imagens. Os testes novos do contrato da LAC-043 estão vermelhos; o agente 4 converte os uuids de referenciasDeAsset em asset:<uuid> e deduplica a lista na Edição? | Opção (a), decorrente das decisões do Eric nas LAC-043 a LAC-046 (06/11/2026, nesta sessão): implementar conforme o contrato. Implementado pelo agente 4 no commit ab88b28 (RF-06), suíte verde; confirmado no Playwright em 3 execuções seguidas. | Eric (arquiteto), pelas decisões de contrato das LAC-043 a LAC-046 |
| PEND-025 | Defeito de código | testes | RF-03 | DEF-04: o palco da Edição usa a janela inteira mesmo quando há medida do contêiner. Os testes novos do contrato da LAC-046 estão vermelhos; o agente 4 mede o contêiner com ResizeObserver e deixa a janela só como reserva? | Opção (a), decorrente das decisões do Eric nas LAC-043 a LAC-046 (06/11/2026, nesta sessão): implementar conforme o contrato. Implementado pelo agente 4 no commit ae7b527 (RF-03), suíte verde; confirmado no Playwright em 3 execuções seguidas. | Eric (arquiteto), pelas decisões de contrato das LAC-043 a LAC-046 |

---

## 4. O que o agente de requisitos gerou

Execução oficial de `/analisar-requisitos` em 03/11/2026, das 17:32 às 17:39 (horário de Brasília). Relatório: `harness/relatorios/requisitos-2026-11-03T20-39-31-000Z.json`.

| Item | Valor |
|---|---|
| Resultado | `sucesso` |
| Requisitos gerados | 29 |
| Pendências abertas | 6 (PEND-001 a PEND-006) |
| Iterações usadas | **39 de 40** |
| Bloqueios do gate | nenhum |
| Taxa de ambiguidade | 6,9% (limite: 30%) |

### Balanço por status antes da aprovação

| Status | Qtd | % |
|---|---|---|
| `OK` | 16 | 55% |
| `OK_PENDENTE_REVISAO` (claro, mas em área crítica) | 9 | 31% |
| `AMBIGUO` | 2 | 7% |
| `CONFLITO` | 2 | 7% |
| **Total** | **29** | 100% |

Dos 29 requisitos do rascunho, 28 foram para o baseline, renumerados conforme o PDF. Cada um guarda o id original no campo `origem_rascunho`. O RNF-11 ficou de fora (ver seção 1).

**Sobre as fontes:**
- O número de iterações (39 de 40) vem de `docs/ia-log/fase-1.md`. O relatório do harness não registra esse dado, e o arquivo `harness/log_decisoes.jsonl` não está no repositório.
- Uma rodada anterior do agente 1 foi descartada, porque rodou na extensão do VS Code, onde os hooks do harness não funcionam. Os números da versão anterior deste resumo (27 requisitos, 8 pendências, 38 de 40 iterações) eram de uma rodada desse tipo e **não valem**.

---

## 5. Uso de IA

Ferramenta: Claude Code. Modelo em todas as sessões: **Claude Opus 5.5** (`claude-opus-5-5`).
Horários no fuso de Brasília. "Tokens de entrada" soma tudo o que o modelo leu em cada passo, incluindo o contexto relido do cache. Por isso o número é bem maior que o tamanho das mensagens.

### 5.1 Sessões que geraram o baseline oficial (03/11/2026)

Dados de `docs/ia-log/fase-1.md`.

| Data | Tarefa | Modelo | Tokens de entrada | Tokens de saída | Origem |
|---|---|---|---|---|---|
| 03/11/2026 | Ler o repositório, montar a especificação, diagnosticar os hooks e fazer o gate humano (`/promover-baseline`), na sessão principal | Opus 5.5 | 11.320.206 | 58.342 | medido |
| 03/11/2026 | 1ª rodada do agente 1, sem gate (descartada) | Opus 5.5 | 402.530 | 46.449 | medido |
| 03/11/2026 | 3 subagentes para testar se o gate bloqueia | Opus 5.5 | 76.778 | 1.636 | medido |
| 03/11/2026 | `/analisar-requisitos` com gate (rodada oficial) | Opus 5.5 | 347.591 | 43.511 | medido |
| | **Total** | | **12.147.105** | **149.938** | medido |

A promoção para o baseline 2026-11-03.1 (PEND-005 a 009) aconteceu dentro da sessão de Projeto do Sistema. Os tokens dessa sessão estão em `docs/ia-log/fase-2.md` e não são repetidos aqui.

### 5.2 Sessões da Roberta nesta conversa (31/10 a 07/11/2026)

Feitas sobre uma cópia antiga do repositório. O baseline e o resumo produzidos nelas foram **substituídos** pelos do repositório. Ficam registradas porque também foram uso de IA.

| Data e hora | Tarefa | Modelo | Tokens de entrada | Tokens de saída | Origem |
|---|---|---|---|---|---|
| 31/10/2026, 22:28 | Conferir o Node.js e criar `harness/entrada/especificacao.md` | Opus 5.5 | 487.744 | 3.533 | medido |
| 31/10/2026, 22:59 | `/analisar-requisitos` (sem hooks; resultado não usado) | Opus 5.5 | 294.860 | 31.723 | medido |
| 01/11/2026, 13:23 | Resumo das pendências PEND-001 a 008 | Opus 5.5 | 120.413 | 2.205 | medido |
| 01/11/2026, 13:26 | `/promover-baseline` (versão local 2026-11-01.1) | Opus 5.5 | 516.795 | 13.765 | medido |
| 01/11/2026, 13:30 | Respostas complementares (versão local 2026-11-01.2) | Opus 5.5 | 382.003 | 7.099 | medido |
| 01/11/2026, 13:56 | 1ª versão deste resumo | Opus 5.5 | 797.085 | 9.804 | medido |
| 07/11/2026, 08:40 | Instalar o Git, ligar ao GitHub e baixar o repositório atual (nada enviado) | Opus 5.5 | 2.122.109 | 5.579 | medido |
| 07/11/2026, 08:52 | Esta versão do resumo | Opus 5.5 | ~1.500.000 | ~25.000 | **estimado** |
| | **Total** | | **~6.220.000** | **~98.700** | parcialmente estimado |

A última linha foi estimada porque a sessão ainda estava em andamento: até o início da escrita deste arquivo, ela tinha consumido 464.249 tokens de entrada e 2.325 de saída. As demais linhas foram medidas nas transcrições.
