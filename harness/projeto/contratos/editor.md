# Contrato — Editor (`apps/editor`)

Decisões: ADR-001, ADR-002, ADR-003, ADR-004, ADR-006, ADR-007, ADR-008, ADR-009, ADR-010, ADR-011, ADR-012, ADR-013, ADR-014. Depende de: SchemaFase, Player (pacote), Api.

## Telas
| Tela | Comportamento observável | Requisito |
|---|---|---|
| Login / Cadastro | Cadastro com nome, e-mail e senha; sem sessão, qualquer rota do editor redireciona para o login | RF-01 |
| Minhas fases | Lista as fases do criador; criar, renomear (`PATCH`), duplicar, excluir (excluir publicada pede confirmação) | RF-02 |
| Conta | Excluir a própria conta com confirmação; cancelar não muda nada | RF-19 |
| Edição | 5 abas (frente, direita, fundo, esquerda, teto); a aba mostra só os objetos daquela parede; palco 16:9 | RF-03, RNF-02 |

## Edição
- **Documento sempre válido (ADR-011)**: o store só aplica ações cujo resultado passa em `validarFase`. Objetos novos nascem com `objetoPadrao`; o painel de propriedades edita num rascunho local e só aplica quando válido; mover/redimensionar/rotacionar ficam limitados a 0..1; encurtar a senha com enigmas que revelam posições removidas é recusado com a lista dos enigmas.
- **Biblioteca**: catálogo `sprite:` do pacote de schema (porta, quadro, janela, relógio e os objetos da Escola); arrastar até o palco insere na parede ativa (RF-04, ADR-012).
- **Seleção** com Transformer: mover, redimensionar, rotacionar; camada para frente/para trás; duplicar na mesma parede; excluir (RF-05).
- **Painel de propriedades**: tipo do objeto; fala → texto; enigma → pergunta, respostas (só números), dica, posições reveladas; porta → senha da fase (4 a 8 dígitos, padrão 5) (RF-07, RF-08). **Propriedades da fase** (clique no fundo da parede): título e senha, editáveis mesmo sem porta (PEND-007, ADR-001).
- **Imagens**: upload para fundo ou objeto via `POST /assets`; mensagem de recusa vinda da Api (RF-06).
- **Desfazer/refazer**: Ctrl+Z / Ctrl+Y sobre o documento; um passo por gesto (RF-09, ADR-008).
- **Salvamento**: automático a cada 30 s com alteração pendente, ao trocar de aba e no botão salvar (`PUT /fases/:id`); indicador "salvo"/"salvando"/"conflito"/"erro ao salvar" (este último mantém a alteração local) (RF-10).
- **Publicar**: mostra as posições sem enigma devolvidas pela Api, com link para o enigma ou para **Propriedades da fase**, onde fica a senha, mesmo em fase sem porta (RF-12, RF-13, PEND-007). Em fase publicada, o editor indica "alterações não publicadas" quando o rascunho difere da versão publicada e oferece "publicar de novo" (PEND-005); o aviso usa `alteracoesNaoPublicadas` de `GET /fases/:id`; depois de cada `PUT` bem-sucedido numa fase publicada, o editor chama `GET /fases/:id` de novo para atualizar o aviso.
- **Modo testar**: salva, busca `GET /fases/:id/jogo-teste` e roda o motor do `packages/player` com verificador `modo=teste`; ao sair, a fase não mudou (RF-11).
- **Exportar / importar** o envelope da ADR-013 (RF-14).

## Elementos que sustentam o RNF-08 (publicar em menos de 30 min, sem ajuda)
- `faseInicial` já traz uma porta na parede da frente e senha de 5 dígitos, para a fase ter fim desde o primeiro minuto.
- Valores padrão válidos (ADR-011): nada do que o criador faz é perdido por documento inválido.
- A recusa de publicação diz **quais posições** faltam e leva ao enigma ou a Propriedades da fase (RF-12).
- Verificação: teste de usabilidade da fase 7 (aceitação), com participantes que não programam; o protocolo é do responsável pela aceitação.

## Não funcionais
Aviso abaixo de 1280x720 e matriz de navegadores da ADR-006 (RNF-01); textos em português, contraste WCAG 2.1 AA, barra do editor e login operáveis por teclado com foco visível, usando o tema comum `packages/player/src/tema.ts` (RNF-07, ADR-014); arrastar ≥ 30 fps com 50 objetos (RNF-03, ADR-007).
