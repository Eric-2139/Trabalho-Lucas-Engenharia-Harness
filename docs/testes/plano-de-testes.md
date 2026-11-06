# Plano de testes — Math Scape (fases 5 e 6)

Responsável: Sarah Mota · Baseline: `2026-11-03.1` · Commit testado: `e9fa8da` (fim da fase 4) · Situação: **aguardando a assinatura da responsável**

A coluna "Resultado" da matriz traz o que foi medido em 06/11/2026. Detalhes dos achados: [relatório de defeitos](relatorio-defeitos.md). Conclusão do sistema: [relatório de teste do sistema](relatorio-teste-sistema.md).

## Níveis

| Nível | Ferramenta | Onde | O que prova |
|---|---|---|---|
| Unidade | Vitest | `tests/schema/`, `tests/player/`, `tests/editor/` | schema aceita o válido e recusa o inválido; motor revela o dígito certo; store desfaz, move e exclui |
| Componente | Testing Library, jsdom com `canvas` | `tests/player/`, `tests/editor/` | painel altera o objeto; abas trocam a parede |
| Integração | Vitest, PostgreSQL real no contêiner | `tests/api/` | rotas da Api; salvar e recarregar; `/verificar` não vaza resposta; usuário não edita fase de outro |
| Sistema | Playwright, builds de produção, navegadores reais | `tests/e2e/` | equivalência com o legado; fluxos completos; não funcionais |
| Aceitação | pessoas reais (fase 7, Yuri) | — | RNF-08 e os critérios da Roberta |

## Como rodar

Tudo roda em contêiner sem rede. O host não precisa de Node nem de banco.

```bash
# Imagens (com rede). Se o Docker não tiver buildx, ver o achado AMB-01.
docker build -f infra/testes/Dockerfile -t math-scape-testes .
docker build -f infra/e2e/Dockerfile -t math-scape-e2e tests/e2e

# Unidade, integração, análise e cobertura
docker run --rm --network none -v .:/src math-scape-testes testes
docker run --rm --network none -v .:/src math-scape-testes analise
docker run --rm --network none -v .:/src --entrypoint bash math-scape-testes /src/infra/testes/cobertura.sh

# Sistema. Relatório em tests/e2e/resultado/ (fora do git)
docker run --rm --network none -v .:/src math-scape-e2e
```

O CI (`.github/workflows/ci.yml`) roda os mesmos comandos a cada push na `main` e em todo pull request, além dos testes do harness.

## Regras adotadas

- **Rastreio:** cada caso tem `@req <ID> @tipo <feliz|borda|negativo>` e o id no nome (`test_RF05_...`).
- **Defeito conhecido fica visível:** o caso descreve o comportamento **correto** e leva `test.fail(true, 'DEF-NN: ...')`. A suíte continua verde enquanto o defeito existe. Quando ele for corrigido, o caso passa a "passar inesperadamente" e o CI fica vermelho até alguém tirar a marca. Nenhuma asserção foi afrouxada para passar.
- **Legado como oráculo:** a equivalência roda o mesmo roteiro no jogo antigo e no novo e compara os dois. O `escola-01.json` só fornece a posição dos cliques.
- **Sem correção de produto nestas fases:** defeito volta ao Eric com o caso que falhou (seção 2 do plano do projeto). Nenhum arquivo de `apps/`, `packages/` ou `harness/` foi alterado.

## Fora do escopo destes testes

- **RNF-08** (publicar em menos de 30 min, sem ajuda): medido com pessoas na fase 7.
- **Duas últimas versões de cada navegador (RNF-01):** o Playwright traz uma versão por navegador. Ver o relatório do sistema.
- **Safari, celular:** fora do RNF-01.

## Matriz de rastreabilidade

Os números de unidade e integração vêm de `harness/matriz/requisito-teste.json`. A coluna de sistema vem das marcas `@req` em `tests/e2e/`.

| Requisito | Prioridade | O que testar | Unidade e integração (feliz / borda / negativo) | Sistema (`tests/e2e/`) | Resultado | Achados |
|---|---|---|---|---|---|---|
| RF-01 | Alta | Cadastro e login; login exigido só para criar fases, jogar fases publicadas não exige login. | 10 / 13 / 11 | criador | Aprovado |  |
| RF-02 | Alta | Criar, renomear, duplicar e excluir as próprias fases (sala de 5 paredes); excluir fase publicada exige confirmação; exclusão não se desfaz com Ctrl+Z. | 10 / 11 / 16 | criador | Aprovado |  |
| RF-03 | Alta | Editar as 5 paredes em área de proporção fixa, trocando por abas. | 5 / 3 / 4 | criador | Aprovado, com ressalva | DEF-04 |
| RF-04 | Alta | Biblioteca de objetos: porta, quadro, janela, relógio e os objetos da fase original. | 7 / 6 / 6 | criador | **Reprovado** | DEF-02 |
| RF-05 | Alta | Mover, redimensionar, rotacionar, ordenar camadas, duplicar e excluir objetos. | 9 / 11 / 10 | criador | **Reprovado** | DEF-01 |
| RF-06 | Média | Enviar imagens PNG, JPG ou WebP de até 5 MB para fundo ou objeto. | 8 / 10 / 10 | criador | **Reprovado em parte** | DEF-03 |
| RF-07 | Alta | 4 tipos de objeto: decoração (só visual), fala, enigma e porta. | 6 / 6 / 7 | — | Aprovado (unidade) |  |
| RF-08 | Alta | Configurar fala (texto), enigma (pergunta, uma ou mais respostas numéricas, dica, zero ou mais dígitos) e porta (senha de 4 a 8 dígitos, padrão 5). | 13 / 18 / 12 | criador | Aprovado |  |
| RF-09 | Média | Desfazer e refazer com Ctrl+Z e Ctrl+Y. | 6 / 10 / 8 | criador | Aprovado |  |
| RF-10 | Alta | Salvamento automático a cada 30 s, ao trocar de parede e ao mandar salvar. | 13 / 15 / 18 | criador | Aprovado |  |
| RF-11 | Alta | Jogar a fase dentro do editor para testar. | 5 / 6 / 5 | criador | Aprovado, com ressalva | DEF-07 |
| RF-12 | Média | Bloquear a publicação se algum dígito da senha não estiver ligado a um enigma, indicando quais. | 4 / 9 / 5 | criador | Aprovado |  |
| RF-13 | Alta | Publicar fase; tela Escolher Fase lista as publicadas. | 8 / 10 / 10 | criador, jogador | Aprovado, com observação | OBS-01 |
| RF-14 | Baixa | Exportar as próprias fases e importar fase em JSON. | 4 / 7 / 5 | criador | Aprovado |  |
| RF-15 | Alta | Enigma resolvido revela dígitos; aceita qualquer resposta cadastrada, comparando só o número; porta abre só com a senha completa. | 17 / 30 / 24 | jogador | Aprovado, com ressalva | DEF-05 |
| RF-16 | Média | Decoração não reage ao clique; fala ao clicar é sempre objeto do tipo fala. | 4 / 5 / 3 | equivalencia-legado | Aprovado, com ressalva | DEF-05 |
| RF-17 | Média | Enigma com dica exibe ícone de dica que mostra a dica cadastrada. | 2 / 4 / 3 | criador, equivalencia-legado | Aprovado |  |
| RF-18 | Alta | Fase original recriada com os mesmos enigmas, respostas, dígitos e senha 92139. | 10 / 4 / 5 | equivalencia-legado | Aprovado, com ressalva | DEF-06, DIF-01 |
| RF-19 | Alta | Usuário pode excluir a própria conta e seus dados (LGPD). | 3 / 5 / 5 | criador | Aprovado |  |
| RNF-01 | — | Duas últimas versões estáveis de Chrome, Edge e Firefox, no computador, tela mínima 1280x720; abaixo disso, aviso. | 5 / 8 / 3 | fluxo-completo, nao-funcionais | **Parcial**: uma versão por navegador | DEF-08 |
| RNF-02 | — | Sala em 16:9 com posições relativas, escalando a partir de 1280x720. | 3 / 4 / 2 | nao-funcionais | Aprovado, com ressalva | DEF-05 |
| RNF-03 | — | Arrastar objetos a pelo menos 30 quadros por segundo com até 50 objetos por parede. | — | desempenho | Aprovado nesta máquina |  |
| RNF-04 | — | Respostas e senha nunca vão ao navegador de quem joga; conferência no servidor, inclusive no modo testar. O editor do autor recebe o próprio documento. | 5 / 6 / 5 | nao-funcionais | Aprovado |  |
| RNF-05 | — | Senhas com hash (argon2 ou bcrypt); login por sessão em cookie httpOnly. | 2 / 3 / 2 | nao-funcionais | Aprovado |  |
| RNF-06 | — | Cadastro coleta somente nome, e-mail e senha (LGPD). | 2 / 3 / 2 | — | Aprovado (integração) |  |
| RNF-07 | — | Interface em português, contraste WCAG 2.1 AA e navegação por teclado no login, Escolher Fase e barra do editor. | 8 / 10 / 7 | nao-funcionais | Aprovado |  |
| RNF-08 | — | Pessoa que não programa cria e publica uma fase jogável em menos de 30 minutos. | — | — | Não medido: fase 7 |  |
| RNF-09 | — | Toda fase é um documento JSON validado por um schema único. | 4 / 8 / 9 | — | Aprovado (integração) |  |
