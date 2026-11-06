# Relatório de defeitos — Math Scape (fases 5 e 6)

Responsável: Sarah Mota · Destino: Eric (correções) · Commit testado: `e9fa8da` · Data: 06/11/2026 · Situação: **aguardando a assinatura da responsável**

Os 607 testes de unidade e integração estão verdes. Todos os defeitos abaixo apareceram no sistema real ou na leitura do código: os testes verdes não os detectam, porque cobrem as peças separadas, e a composição das telas (`main.tsx`) não tem teste unitário.

## Resumo

| ID | Prioridade | Requisito | Defeito | Caso que falha |
|---|---|---|---|---|
| DEF-01 | **Alta** | RF-05 | Não há como excluir, duplicar nem mudar a camada de um objeto na interface | `test_RF05_objeto_selecionado_tem_controles_de_excluir_duplicar_e_camada` |
| DEF-02 | **Alta** | RF-04 | Não é possível arrastar da biblioteca até a parede | `test_RF04_arrastar_da_biblioteca_ate_a_parede_coloca_o_objeto` |
| DEF-05 | **Alta** | RF-15, RF-16, RNF-02 | Quem joga clica e nada muda na janela: fala, pergunta e campo ficam abaixo do palco | `test_RNF02_fala_e_campo_de_resposta_aparecem_sem_rolar_em_*` |
| DEF-03 | Média | RF-06 | Imagem enviada aparece duplicada e, depois de recarregar, não pode mais ser usada | `test_RF06_imagem_usada_nao_duplica_na_lista_e_continua_utilizavel_depois_de_recarregar` |
| DEF-04 | Média | RF-03, RNF-08 | No editor, biblioteca e painel ficam abaixo de um palco do tamanho da janela | `test_RF03_palco_area_de_trabalho_cabe_na_janela_com_a_biblioteca_e_o_painel_a_vista` |
| DEF-06 | Média | RF-18 | Quadro vazio: o enunciado não está na parede, e a geometria difere do legado | evidência visual |
| DEF-07 | Baixa | RF-11 | Modo testar usa rótulos diferentes dos do jogo | `test_RF11_modo_testar_usa_os_mesmos_rotulos_do_jogo` |
| DEF-08 | Baixa | RNF-01 | `browserslist` da ADR-006 não existe | leitura do código |

A prioridade é a do requisito no baseline, ajustada pelo efeito para quem usa. É uma proposta da IA para a Sarah confirmar.

Para reproduzir um caso, use o nome dele (ou trecho): `docker run --rm --network none -v .:/src math-scape-e2e --project=chromium -g test_RF05`. Enquanto a marca `test.fail` estiver no caso, a falha aparece como esperada.

## Defeitos

### DEF-01 · Excluir, duplicar e camada não existem na interface (RF-05, Alta)
- **Passos:** abrir uma fase no editor; clicar num objeto do palco; procurar como excluí-lo, duplicá-lo ou trazê-lo para a frente.
- **Esperado:** "mudar camada altera a sobreposição; duplicar cria cópia na mesma parede; excluir remove o objeto".
- **Obtido:** nenhum botão nem atalho. Um objeto posto por engano nunca sai da parede, exceto por Ctrl+Z.
- **Causa:** `excluirObjeto`, `duplicarObjeto` e `mudarCamada` existem em `apps/editor/src/store/index.ts`, e os testes do store passam. Nenhum componente os chama: `BarraFerramentas`, `PainelPropriedades`, `TelaEdicao` e `atalhos.ts` não os citam.

### DEF-02 · Biblioteca não permite arrastar (RF-04, Alta)
- **Passos:** na Edição, arrastar "Janela" da biblioteca até o palco.
- **Esperado:** "arrastar qualquer um até a parede ativa o coloca nela" (também em `modulos-editor.md` §4).
- **Obtido:** nada acontece. Os itens só aceitam clique ou Enter, e o objeto nasce no centro.
- **Nota:** os testes de componente foram escritos para o clique, por isso passam.

### DEF-05 · Fala, pergunta e campo de resposta fora da janela (RF-15, RF-16, RNF-02, Alta)
- **Passos:** em `/jogar/:id`, em 1280x720, 1920x1080 ou 2560x1440, clicar no giz ou no quadro.
- **Esperado:** "clicar numa fala com texto T mostra T". O jogador precisa ver a fala e conseguir responder.
- **Obtido:** o palco tem a altura da janela e ainda vem depois dos botões, então tudo o que ele mostra fica abaixo da dobra. A tela não muda; é preciso descobrir que há algo rolando a página. A página também rola 16 px na horizontal. Veja [a tela com o enigma já aberto](evidencias/novo-enigma-aberto-1280x720.png).
- **Causa:** `calcularPalco(janela.largura, janela.altura)` em `TelaJogo.tsx` não desconta botões, textos nem o `padding` do `body`. O agente 4 já tinha apontado o risco no log da fase 4.

### DEF-03 · Imagem duplicada e inutilizável depois de recarregar (RF-06, Média)
- **Passos:** enviar um PNG; "Usar como objeto"; ver a lista "Minhas imagens"; salvar e recarregar; "Usar como objeto" de novo.
- **Esperado:** a imagem aparece uma vez e continua utilizável.
- **Obtido:** aparecem "Imagem 1" e "Imagem 2" para o mesmo arquivo. Depois de recarregar, o botão não faz nada e não mostra mensagem (o documento continuou com 1 objeto).
- **Causa:** `referenciasDeAsset` (`packages/schema/src/imagens.ts`) devolve o UUID puro, e `TelaEdicao.tsx` o trata como `asset:<uuid>` (`as RefImagem`). O store recusa a referência inválida, e a tela ignora a recusa.

### DEF-04 · Palco do editor ocupa a janela inteira (RF-03, RNF-08, Média)
- **Passos:** abrir a Edição em 1280x720; selecionar um objeto.
- **Esperado:** poder arrastar, escolher na biblioteca e configurar sem perder o palco de vista. O critério do RF-03 não fala disso; o risco é o RNF-08 (30 minutos, sem ajuda).
- **Obtido:** o palco tem 1280x720, e a página, 1629 px de altura. Biblioteca e painel ficam abaixo dele, e a cada objeto é preciso rolar para baixo e voltar. A página também rola 16 px na horizontal. Veja [a tela](evidencias/editor-objeto-selecionado-1280x720.png).

### DEF-06 · Quadro vazio e geometria diferente do legado (RF-18, Média)
- **Comparação:** [legado](evidencias/legado-frente-1920x1080.png) × [novo](evidencias/novo-frente-1920x1080.png), a 1920x1080.
- **Esperado:** o agente 4 deixou a equivalência visual para esta fase (log da fase 4). O RF-18 exige perguntas iguais, sem exigir o desenho.
- **Obtido:** o texto das perguntas é igual ao do legado, mas só aparece depois do clique. No legado, o enunciado e o campo ficam escritos no quadro; no novo, o quadro é um retângulo vazio. O quadro-negro ficou maior (cerca de 758×468 px contra 638×394) e encosta na porta. A sala ocupa a janela inteira, sem o fundo escuro do legado, e os botões das paredes ficam acima dela, não à direita.

### DEF-07 · Rótulos diferentes no modo testar (RF-11, Baixa)
- **Obtido:** "Resposta" e "Senha:" no modo testar; "Sua resposta" e "Senha da porta:" no jogo. O critério pede "as regras do jogador"; as regras estão iguais, só os textos diferem. O log da fase 4 já citava os textos fixos do `ModoTestar`.

### DEF-08 · `browserslist` ausente (RNF-01, Baixa)
- **Obtido:** a ADR-006 pede `last 2 Chrome/Edge/Firefox versions`. O build usa um alvo fixo (`chrome120`, `edge120`, `firefox120`, em `infra/vite/comum.ts`), sem `browserslist`. Isso não quebrou nada nos navegadores testados. Só o arquiteto mexe em `package.json`, por isso fica com o Eric.

## Decisão para a Roberta

### DIF-01 · Quatro falas do legado não existem no novo Player
Clicar na porta, no selo e nas duas inscrições da esquerda mostra uma fala no legado. No novo, esses objetos abrem o campo de senha ou de resposta, e um objeto só pode ter um tipo (RF-07). O RF-18 não exige essas falas, por isso **não é defeito**.

Mudar isso é mudança de requisito, e passa pela Roberta. Opções: (a) aceitar a diferença; (b) acrescentar as falas como objetos próprios no `escola-01.json`, sem mudar o schema. Os casos `test_RF18_diferenca_DIF01_*` documentam a diferença.

## Observações e ambiente

- **OBS-01 · RF-13, aviso preso (intermitente).** Em uma execução completa, o aviso "Alterações não publicadas" não sumiu 10 s depois de "Publicar de novo". Não se repetiu em 10 repetições isoladas nem nas 3 execuções completas seguintes. A tela da falha foi sobrescrita pela execução seguinte, e a leitura do código não explicou a causa, então não é defeito confirmado. O CI guarda o relatório do Playwright, se voltar a ocorrer.
- **AMB-01 · Imagem de testes não constrói em Docker sem buildx.** O builder clássico não entende `!packages/*/package.json` depois de `*` no `.dockerignore`, e `pnpm testes:imagem` falha com "file not found". Contorno usado: construir a partir de uma pasta temporária só com os manifestos e `infra/testes/`. O `.dockerignore` não foi alterado.
- **AMB-02 · Não havia CI.** O entregável "CI verde" da fase 4 não existia no repositório. O `.github/workflows/ci.yml` foi criado nesta fase.

## Issues no GitHub

O plano pede os defeitos como issues. O `gh` não está instalado nesta máquina, então **as issues não foram abertas**. Cada seção acima já traz passos, esperado, obtido e requisito para virar uma issue.

---
Assinatura da responsável (fase 5): ______________________ Data: ___/___/_____
