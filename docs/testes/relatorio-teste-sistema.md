# Relatório de teste do sistema — Math Scape (fase 6)

Responsável: Sarah Mota · Destino: Yuri, depois das correções · Commit testado: `e9fa8da` · Data: 06/11/2026 · Situação: **assinado por Sarah Mota em 06/11/2026; a entrega ao Yuri aguarda a correção dos defeitos altos**

## Conclusão

**O sistema ainda não está liberado para a aceitação.** O plano só permite entregar ao Yuri sem defeito de prioridade alta aberto, e há três:

1. **DEF-01:** o criador não consegue excluir, duplicar nem reordenar objetos.
2. **DEF-02:** a biblioteca não permite arrastar.
3. **DEF-05:** quem joga clica e nada muda na janela, porque a resposta fica abaixo do palco.

O núcleo está sólido: a fase original se comporta como o legado, a resposta não chega ao navegador, e o fluxo criar → publicar → jogar conclui nos três navegadores. Detalhes e passos: [relatório de defeitos](relatorio-defeitos.md).

## Resultado da suíte

Três execuções completas seguidas, com o mesmo resultado nas três:

| Situação | Casos |
|---|---|
| Passaram | 84 |
| Falham como esperado, marcados com defeito ou diferença (`test.fail`) | 12 |
| Falhas inesperadas | 0 |
| Pulado (só fotografa as evidências, quando pedido) | 1 |

Os 12 casos marcados: DEF-05 (3 resoluções), DIF-01 (4 falas), DEF-01, DEF-02, DEF-03, DEF-04 e DEF-07.

Ambiente: builds de produção do Editor e do Player, Api e PostgreSQL no contêiner, sem rede, a partir de um banco vazio.

## Equivalência com o legado

O mesmo roteiro rodou no jogo antigo e no novo Player com `escola-01.json`.

| Roteiro | Casos | Resultado |
|---|---|---|
| 10 falas de objetos | 10 | Iguais |
| Dicas das 5 paredes, por botão e pelo ícone no palco | 10 | Iguais |
| 6 enigmas: resposta certa (as duas do selo), errada e texto da pergunta | 19 | Iguais |
| Frente 310 → 3 · direita 123 → 1 · fundo -15 ou 80 → 9 · teto 55 → 92 · esquerda 15 e 40 sem dígito | incluído acima | Iguais |
| Senha 92139 abre; senha errada mostra erro | 1 | Igual |
| Decoração não reage ao clique | 1 | Conforme o RF-16 |
| Falas da porta, do selo e das inscrições | 4 | **Diferem** (DIF-01, decisão da Roberta) |

Diferença visual: DEF-06 ([legado](evidencias/legado-frente-1920x1080.png) × [novo](evidencias/novo-frente-1920x1080.png)). A animação do selo e da árvore não é exigida pelo RF-18 e não foi testada.

## Fluxos completos

- **Criador, só pela interface, em Chromium, Edge e Firefox:** cadastrar, criar fase, pôr objetos nas 5 paredes, configurar senha e enigma, testar, publicar, jogar e abrir a porta. Concluído nos três.
- **Jogador, sem login:** escolher a fase, resolver os enigmas, ver `9 2 1 3 9`, abrir a porta e voltar à lista. Concluído.
- O fluxo só conclui rolando a página, e sem excluir nenhum objeto: ver DEF-01 e DEF-05.

## Requisitos não funcionais

| Requisito | Medida | Resultado |
|---|---|---|
| RNF-01 navegadores | Fluxo completo em Chromium 158, Microsoft Edge 157 e Firefox 159 | **Parcial.** Só uma versão de cada; "as duas últimas" não foi medido |
| RNF-01 aviso | Aparece em 1279x720 e 1280x719, não em 1280x720, no Player e no Editor | Aprovado |
| RNF-02 16:9 | Sala em 16:9 e objetos no lugar em 1280x720, 1920x1080 e 2560x1440 | Aprovado (ver DEF-05) |
| RNF-03 30 fps | Ver abaixo | Aprovado nesta máquina |
| RNF-04 segredos | Todas as respostas HTTP de uma partida e do modo testar, inclusive o JavaScript, sem `respostas`, `senha`, `revela` nem `92139`. `/verificar` devolve só `correto` e `digitos` | Aprovado |
| RNF-05 sessão | Cookie `sid` com `HttpOnly`, invisível a `document.cookie`. Hash no banco: coberto na integração | Aprovado |
| RNF-07 acessibilidade | `lang` pt, contraste WCAG calculado nas telas de login, Escolher Fase e Edição; login, Escolher Fase e barra só pelo teclado, com foco visível | Aprovado |
| RNF-08 30 minutos | — | Fase 7. DEF-01, DEF-02 e DEF-04 ameaçam este requisito |

### RNF-03: quadros por segundo

Arrastar um objeto numa parede com 50 objetos, em 240 movimentos do mouse. Quadros contados com `requestAnimationFrame`, em 3 execuções.

| Navegador | Quadros por segundo (média) | No percentil 95 dos intervalos |
|---|---|---|
| Chromium 158 | 60 | 59,5 a 59,9 |
| Microsoft Edge 157 | 60 | 59,9 |
| Firefox 159 | 59,8 a 60 | 58,3 a 58,4 |

Máquina (PEND-006): Intel Core i7-1165G7 de 2,8 GHz, 8 núcleos, 15 GB de memória, sem GPU no contêiner (renderização por software), Linux 6.8, Docker 29.

**Limite da medida:** o Playwright move o mouse com a janela sem interface. Isso mostra que o arraste não atrasa os quadros, mas não substitui o teste numa máquina fraca com a janela visível.

## Unidade, integração e cobertura (fase 5)

| Medida | Resultado |
|---|---|
| Vitest | 607 de 607, em 34 arquivos |
| Biome e TypeScript | sem erros |
| Testes do harness | 60 de 60 |
| Cobertura do schema (`src` e `contrato`) | 95,5% das linhas, 92,2% dos ramos |
| Cobertura do motor | 100% das linhas, 100% dos ramos |
| Cobertura do estado da partida | 100% das linhas, 85,7% dos ramos |
| Meta do plano: 80% no schema e no motor | **Atingida** |

## O que estes testes não dizem

- **Duas últimas versões:** cada versão do Playwright traz uma versão de cada navegador.
- **Hardware real:** nenhum caso rodou com GPU nem janela visível.
- **Usabilidade:** não houve pessoa usando o sistema. O tempo de 30 minutos é da fase 7.
- **CI:** o fluxo foi escrito nesta fase; o resultado no GitHub só existe depois do envio.
- **Geometria do clique:** o Playwright clica por coordenadas do documento. Não verifica pixel a pixel se o desenho está no lugar (ver DEF-06).
- **Produção:** nada foi testado atrás de proxy ou HTTPS (fase 8).

## Métricas antes e depois (seção 8 do plano)

| Métrica | Legado | Depois |
|---|---|---|
| Como se cria uma fase nova | Escrevendo HTML, CSS e JS | Editor visual, sem código (fluxo E2E concluído; com DEF-01 e DEF-02 abertos) |
| Tempo para criar uma fase simples | — | Fase 7 |
| Respostas e senha visíveis no navegador | Sim | **Não** (tráfego e JavaScript inspecionados) |
| Onde fica a lógica de cada objeto | `onclick` com função própria por objeto | Documento JSON interpretado pelo motor |
| Testes automatizados | 0 | 607 de unidade e integração + 96 de sistema |
| Cobertura de testes do núcleo | 0% | Schema 95,5% · motor 100% (linhas) |
| Fases disponíveis | 1 (fixa no código) | Ilimitadas: a original migrada + as criadas no editor |
| Nota SUS de usabilidade | não medida | Fase 7 |

## Próximos passos

1. **Eric:** corrigir DEF-01, DEF-02 e DEF-05; depois, os de prioridade média. Ao corrigir, tirar o `test.fail` do caso.
2. **Roberta:** decidir o DIF-01.
3. **Sarah:** rodar a suíte de novo e, sem defeito alto aberto, entregar este relatório ao Yuri.

---
Assinatura da responsável (fase 6): Sarah Mota · Data: 06/11/2026
