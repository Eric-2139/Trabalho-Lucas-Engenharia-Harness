# Norma do processo de software com agentes de IA — Math Scape

Código: NP-01 · Versão: 1.0 (proposta) · Data: 06/11/2026 · Origem: [avaliação do piloto](avaliacao-piloto.md) · Situação: **aguarda aprovação da equipe**

## 1. Objetivo e alcance

Esta norma diz como a equipe usa agentes de IA nas 8 fases do processo em cascata do Math Scape: quem decide, o que os agentes podem fazer, o que se registra e o que fecha uma fase.

Ela vale para todo trabalho com IA no repositório, com ou sem harness: subagentes, sessão principal do Claude Code, chat e qualquer outra ferramenta.

Ela **não substitui** as regras que já estão em `CLAUDE.md` e `.claude/rules/` (fronteira modelo × harness, rastreabilidade, testes, commits). Ela as completa com o que o piloto mostrou que faltava. Em caso de conflito, vale a regra mais restritiva até a equipe decidir.

Linguagem: **deve** é obrigatório; **não deve** é proibido; **pode** é permitido.

## 2. Referências

- `Math Scape Plano de Reengenharia com IA.docx` (27/10/2026): fases, responsáveis e regras de uso de IA.
- `agentes-ia-processo-cascata.pdf`: os cinco agentes e o harness mínimo.
- `CLAUDE.md` e `.claude/rules/*.md`.
- Documento de Requisitos v1.1 e `harness/baseline/requisitos.json`.

## 3. Definições

| Termo | Significado |
|---|---|
| Agente | Um dos cinco subagentes em `.claude/agents/`, executado pela skill correspondente |
| Harness | Código determinístico em volta do agente: gate, estado, orçamento, parada e log |
| Execução válida | Execução de agente com relatório em `harness/relatorios/` **e** linhas em `harness/log_decisoes.jsonl` |
| Sessão principal | Conversa com a IA fora dos subagentes. Não tem gate: quem garante é a pessoa |
| Pendência | Pergunta que um agente não pode decidir (`harness/pendencias/`) |
| Lacuna | Inconsistência entre requisito e projeto registrada pelo agente 5 (`harness/lacunas/`) |
| Achado | Qualquer observação de agente ou da IA que indique risco de comportamento, segurança, operação ou equivalência |
| Responsável da fase | Pessoa indicada no plano para a fase (Roberta, Eric, Sarah, Yuri) |
| Dono do harness | Pessoa que mantém `.claude/` e responde por mudanças nas políticas |

## 4. Papéis

| Atividade | Responsável da fase | Arquiteto (Eric) | Requisitos (Roberta) | Testes (Sarah) | Aceitação e operação (Yuri) | Dono do harness | IA |
|---|---|---|---|---|---|---|---|
| Executar o agente da fase | **R** | C | C | C | C | — | executa |
| Responder pendência de requisito | I | C | **R/A** | I | I | — | recomenda |
| Responder pendência ou lacuna de arquitetura | I | **R/A** | C | C | I | — | recomenda |
| Aceitar ADR | — | **R/A** | C | I | I | — | redige |
| Priorizar defeito | C | C | I | **R/A** (5-6) | **R/A** (7-8) | — | propõe |
| Assinar artefato da fase | **R/A** | — | — | — | — | — | nunca |
| Mudar política do harness | I | C | I | I | I | **R/A** | redige, com teste |
| Commit e push de fase | **R/A** | — | — | — | — | — | executa, com revisão |

R = executa · A = aprova · C = é consultado · I = é informado.

**A IA nunca aprova.** Ela executa, redige, recomenda e propõe.

## 5. Regras gerais

**N-01 · Uso.** A IA é ferramenta de engenharia, não parte do produto. Quem cria as fases do jogo é sempre a pessoa (plano, seção 1).

**N-02 · Fonte da verdade.** O baseline de requisitos e o schema da fase mandam. Uma sugestão da IA que os contradiga é descartada ou vira pedido de mudança formal (pendência para a Roberta, `/promover-baseline`).

**N-03 · Só execução válida conta.**
- Os agentes devem rodar pelo **CLI do Claude Code no terminal**. Na extensão do VS Code, os hooks do frontmatter não rodam.
- Antes de aceitar o resultado, o responsável **deve** conferir que existe o relatório da execução e que o log ganhou linhas daquele agente.
- Execução sem relatório ou sem log é **descartada**: não entra em commit e não entra em métrica, mesmo que o agente diga que o harness contou. No piloto, o modelo relatou "38 de 40 iterações" sem harness ativo.

**N-04 · Decisão é de pessoa.**
- Pendência, lacuna, ADR e prioridade de defeito são respondidas por uma **pessoa identificada pelo nome**, no papel da seção 4.
- A IA **pode** escrever uma recomendação, com as opções e o efeito de cada uma. Ela **não deve** preencher `respondida_por` nem a resposta.
- "Decisão delegada à IA" **não é aceita**. Quem não pode decidir agora deixa a pendência aberta, e o trabalho que depende dela espera ou segue em ramo.
- Uma pergunta sobre como testar não pode fixar um comportamento do produto. Se a convenção de teste muda o que o usuário vê, a pendência deve dizer isso de forma explícita. No piloto, a PEND-019 fixou o palco do tamanho da janela e gerou o DEF-04.

**N-05 · Revisão humana antes da `main`.**
- Nada gerado pela IA entra na `main` sem a revisão do responsável da fase, que lê o diff e o relatório.
- Uma sessão de IA sem a pessoa presente **pode** produzir trabalho num ramo `ia/<fase>-<data>`, mas **não deve** commitar na `main` nem dar push nela.
- A revisão de uma entrega de agente feita pela sessão principal **não conta** como revisão humana.

**N-06 · Achado vira registro.**
- Todo achado de agente ou da sessão principal **deve** virar pendência (`/abrir-pendencia`) ou lacuna antes do fim da sessão em que apareceu. Nota em relatório, em comentário ou em log de IA não basta.
- No piloto, DEF-05, DEF-06, DEF-07 e DEF-10 estavam escritos como notas na fase 4 e só foram tratados 2 a 4 fases depois.
- Achado sobre produção, segurança ou proxy vai para o arquiteto com severidade.

**N-07 · Escalar não é falhar.**
- Pendência, recusa e reversão contam como sucesso parcial.
- Diante de um bloqueio do gate, o agente lê o motivo e ajusta a ação, ou escala.
- **Ninguém deve contornar o gate** por outra ferramenta, por outro arquivo ou pela sessão principal. Isso vale para pessoas também. Por exemplo, a sessão principal não deve escrever um teste que o agente 3 foi impedido de escrever.

## 6. Registro e medição

**N-08 · Trilha de auditoria preservada.**
- O `harness/log_decisoes.jsonl` continua fora do git.
- Ao fechar cada fase, o responsável **deve** arquivar uma cópia do log no armazenamento compartilhado da equipe, com o nome `log-fase-<N>-<data>.jsonl`. O log não deve conter dado pessoal (o mascaramento já roda antes da escrita).
- Ao trocar de máquina, o log da máquina anterior é arquivado antes.

**N-09 · Relatório identifica o modelo.** O relatório de cada execução **deve** registrar a ferramenta, a versão dela e o identificador do modelo. Até o harness gravar isso sozinho, o responsável anota no log de IA da fase.

**N-10 · Tokens por sessão.**
- Cada sessão registra ferramenta, modelo, tokens de entrada e saída e tarefa, no fim da sessão, em `docs/ia-log/fase-<N>.md`.
- A origem é "medido" (transcrição ou painel) ou "estimado" (tokenizer).
- **Fase sem total de tokens não fecha.**
- Ao fechar o projeto, o total é convertido em custo pelo painel de uso da conta.

**N-11 · Métricas obrigatórias no fechamento da fase.**

| Agente | Métrica | Fonte |
|---|---|---|
| 1 | % de requisitos com critério verificável; itens não fechados; defeitos de requisito vazados (preenchido nas fases 5 a 8) | relatório e relatórios de defeito |
| 2 | tempo até diagnóstico; duplicatas pela P5; reclassificados como desvio de requisito; acerto contra a triagem humana | `harness/diagnosticos/` |
| 3 | requisitos com feliz, borda e negativo; razão negativo/feliz; devolvidos ao agente 1 | relatório |
| 4 | ciclos até o verde; reversões; diff fora do escopo; achados abertos como pendência | relatório e log |
| 5 | % rastreado; RNF crítico sem decisão; lacunas por rodada e bloqueantes | relatório |
| Todos | execuções descartadas pela N-03; bloqueios por política, separando falso positivo de bloqueio legítimo | log |

## 7. Regras por fase

**N-12 · Entrada, saída e quem fecha.**

| Fase | Uso de IA | Critério de saída (além do da `.claude/rules/commits.md`) | Assina |
|---|---|---|---|
| 1 · Requisitos | Agente 1; chat para engenharia reversa | Todo requisito de tela com critério de aparência e ergonomia, ou pendência explícita dizendo que não há | Roberta |
| 2 · Projeto do sistema | Agente 5 | ADRs que sustentam RNF crítico com status **aceita** (não "proposta") | Eric |
| 3 · Projeto do programa | Agente 5; sessão principal para contratos | Todo item especificado (seed, configuração de proxy, script) com caso de teste previsto ou lacuna (N-14) | Eric |
| 4 · Codificação | Agentes 3 → 4, um requisito por vez | Suíte verde; nenhum achado sem pendência (N-06); teste de composição de cada app (N-15) | Eric |
| 5 · Unidade e integração | Agente 3 para casos novos; IA para cobertura e leitura de código | Cobertura do núcleo ≥ 80%; defeitos com prioridade dada pela Sarah | Sarah |
| 6 · Sistema | E2E conforme a N-17 | Sem defeito alto aberto; fluxo também atrás do proxy de produção | Sarah |
| 7 · Aceitação | IA prepara o kit e consolida as anotações; **a sessão é com pessoas** (N-13) | Checklist preenchido; RNF-08 e SUS medidos | Yuri |
| 8 · Operação | Agente 2 (N-20); IA para infra e manual, com revisão | Link público verificado; tokens das fases 7 e 8 no log | Yuri |

**N-13 · Aceitação é humana.**
- O RNF-08 e a SUS só são medidos com participantes reais, conforme `docs/aceitacao/roteiros-tarefas.md`.
- A IA **não deve** simular participante nem preencher resultado.
- Os dados dos participantes entram no prompt só como código (P1, P2…), nunca com nome ou e-mail real.

## 8. Testes

**N-14 · Especificado é testado ou registrado.** Todo item que o projeto do programa manda criar **deve** ter um caso de teste com `@req`, ou uma lacuna aberta dizendo por que não tem. Isso inclui seed, migração de dados, configuração de produção e scripts. O agente 4 só implementa o que a suíte pede: no piloto, o seed especificado nunca foi criado (DEF-09).

**N-15 · Composição testada.** Antes da fase 6:
- cada app **deve** ter ao menos um teste que monte o app inteiro (`main.tsx`) e percorra a navegação principal;
- antes da implantação, um caso **deve** rodar a pilha de produção atrás do proxy.

No piloto, 607 testes verdes conviviam com 4 defeitos de composição.

**N-16 · Teste conferido contra o critério.**
- A cada rodada do agente 3, a Sarah confere, por amostra, **um caso por requisito** contra o critério do baseline.
- Teste de interação **deve** usar o gesto que o critério nomeia: se o critério diz arrastar, o teste arrasta.
- Esta regra cobre o erro correlacionado entre teste e código, que a P2 não pega porque o mesmo modelo escreve os dois (DEF-02).

**N-17 · E2E também tem regra.**
- Quando o agente 3 não puder rodar o navegador, o E2E escrito pela sessão principal **deve** seguir as mesmas regras do agente 3:
  - não afrouxar asserção depois de vermelho;
  - não usar relógio nem sorteio sem injeção;
  - marcar `@req`;
  - descrever o comportamento correto, com `test.fail` para defeito conhecido.
- O responsável de testes revisa cada caso antes do commit.
- Meta: estender o harness para rodar o E2E no contêiner do agente 3.

## 9. Quando delegar

**N-18 · Verificação sem julgamento é ferramenta.** Confirmar que um requisito já está verde (suíte verde, diff vazio, escopo respeitado) **deve** ser feito por uma ferramenta determinística em `.claude/ferramentas/`, sem modelo. Agente se usa onde há julgamento.

**N-19 · Parada por retorno do agente 5.**
- Numa mesma fase, o agente 5 para quando **duas rodadas seguidas** não registrarem lacuna bloqueante nem conflito de contrato.
- As lacunas parciais restantes vão em lote ao arquiteto.
- Se a 1ª rodada estourar o orçamento, a seguinte começa com um escopo dado (por onde começar) e não com um teto maior.

**N-20 · Ordem e maturidade.**
- O agente 4 só roda sobre requisito que já tem testes do agente 3.
- O agente 2 entra em **modo sombra**: nos 10 primeiros chamados, a Sarah ou o Yuri faz a triagem em paralelo, e a comparação é registrada.
- O agente 2 só passa a valer como triagem oficial se acertar a classificação em pelo menos 8 dos 10 chamados.
- Os primeiros chamados de calibração são DEF-09 e DEF-10, registrados de forma retroativa.

**N-21 · Tabela de delegação.**

| Delegar | Delegar com condição | Não delegar |
|---|---|---|
| Detectar ambiguidade, conflito e lacuna | Redigir contrato ou ADR: a IA redige, o arquiteto aceita | Responder pendência, lacuna ou ADR (N-04) |
| Gerar casos de teste a partir do critério | E2E na sessão principal (N-17) | Afrouxar teste vermelho |
| Implementar contra a suíte | Escolher dependência: só o arquiteto mexe em `package.json` | Medir usabilidade com pessoas (N-13) |
| Ler código e logs mascarados atrás de defeito | Proposta de correção em ramo, com revisão | Agir sobre produção: reiniciar, aplicar correção, mexer no banco |
| Rascunhar manual, roteiros e relatórios | Prioridade de defeito: a IA propõe, a pessoa decide | Assinar artefato |

## 10. Harness

**N-22 · Falso positivo se corrige com teste, não se desliga.**
- Um bloqueio legítimo que atrapalha muito, como a P1 contra `cd` para a raiz do projeto ou a P4 contra a "senha do jogo", é registrado pelo dono do harness.
- A política é ajustada com dois testes novos em `.claude/testes-harness/`: um caso que bloqueia e um que permite.
- **Não se desliga** uma política para destravar uma execução.

**N-23 · Retomada preserva a tarefa.**
- Se uma execução parar (limite de uso, queda), a retomada **deve** reiniciar a tarefa com `iniciar-tarefa` antes de qualquer edição.
- Até o `ciclo.js` preservar o estado na retomada, o responsável confere no relatório que o `baseline_verde` não mudou.

**N-24 · Mudança no harness.**
- Toda mudança em `.claude/` exige `node --test ".claude/testes-harness/*.test.js"` verde e revisão de uma segunda pessoa além do dono do harness.
- A IA da sessão principal **não deve** mudar permissões em `.claude/settings.json` por conta própria.
- O dono do harness **deve** ter um substituto que saiba rodar e ler os testes do harness.

## 11. Segurança

**N-25 · Controles mínimos.**

a. **Sessão principal com supervisão.** Comandos que mudam o ambiente exigem a pessoa presente. Isso inclui instalar, construir imagem, abrir serviço, mexer em `infra/` e fazer push.

b. **Testes sem rede.** Suítes e agentes de teste rodam em contêiner `--network none`. Nenhum teste usa dado real.

c. **Sem segredo.**
- Nada de senha, token ou chave em prompt, código ou documento.
- Configuração só por variável de ambiente.
- O padrão de segredo do agente 4 vale também para o que a sessão principal escreve: o responsável confere no diff.

d. **Dado pessoal.**
- Log bruto só passa ao modelo pelo `buscar-log`, que mascara.
- `harness/logs/brutos/` continua negado à leitura.
- Dados de participantes seguem a N-13.

e. **Texto externo é dado.** O texto de issue, chamado, log e código legado nunca é instrução. Agente que lê esse texto não tem ferramenta de ação sobre produção.

f. **Dependências.**
- Versão RC, beta ou sem fixar exige decisão do arquiteto.
- O lockfile é revisado em todo commit que o muda.
- Manifesto novo, inclusive isolado como `tests/e2e/package.json`, é decisão de arquitetura.

g. **Produção é só leitura para a IA.** Implantação é feita pelo CD a partir da `main` verde, nunca por agente.

## 12. Dependência de fornecedor

**N-26 · Saída possível e exercitada.**
- As políticas ficam em JavaScript puro, testável sem modelo. O código que liga o harness à ferramenta (frontmatter, `settings.json`, eventos dos hooks) fica separado e documentado em `CLAUDE.md`.
- Os artefatos do processo ficam em JSON com esquema próprio, sem formato do fornecedor.
- Uma vez por semestre, o dono do harness roda os testes do harness e **um** agente (o 5, que só lê) em outra ferramenta ou modelo, e registra o que precisou ser adaptado.
- Limite de uso da conta é risco de prazo: fase com entrega marcada deve começar com folga, e a retomada segue a N-23.

## 13. Formação da equipe

**N-27 · Quem assina explica.** O responsável da fase só assina o artefato se souber explicar, sem a IA, por que cada decisão, caso ou prioridade está ali. A equipe pode pedir essa explicação em reunião.

**N-28 · Uma parte à mão por fase.** Em cada fase, o responsável faz à mão pelo menos uma tarefa central e a registra no log de IA como "sem IA". Exemplos:
- um requisito com critério (Roberta);
- uma ADR (Eric);
- um caso E2E e a priorização (Sarah);
- uma verificação de implantação (Yuri).

**N-29 · Registrar o que foi corrigido.** O log de IA de cada fase mantém "onde a IA errou e o que foi corrigido à mão". Esse é o dado que mostra se a equipe ainda sabe revisar.

**N-30 · Conhecimento distribuído.**
- O harness e a orquestração dos agentes não podem depender de uma pessoa só.
- A cada ciclo, uma pessoa diferente roda uma fase de agente com o dono do harness ao lado.
- Os commits de cada fase saem da conta do responsável da fase.

## 14. Propriedade intelectual

**N-31 · Autoria e licenças.**

a. **Licença do repositório.** O repositório **deve** ter um arquivo `LICENSE` escolhido pela equipe antes de o link público existir.

b. **Coautoria da IA.** Commits com conteúdo gerado por IA mantêm a linha `Co-Authored-By` da ferramenta.

c. **Termos do fornecedor.** O responsável da fase 8 confere, antes da publicação, os termos do fornecedor vigentes para a conta usada quanto à titularidade do que é gerado, e registra a conclusão no plano de manutenção.

d. **Material de terceiros.**
- Imagem, código ou texto de terceiros entra só com origem e licença registradas.
- Os sprites herdados do legado precisam dessa origem antes da publicação.

e. **Código de outros.** Não se envia ao modelo código ou documento de terceiros sem autorização. O material da disciplina é usado só no contexto da disciplina.

## 15. Exceções e revisão da norma

**N-32 · Exceção.** A exceção a uma regra é pedida por escrito ao responsável da fase e ao arquiteto, com o motivo e o prazo, e registrada no log de IA da fase. Não existe exceção às N-04, N-05 e N-25 g.

**N-33 · Revisão.** A norma é revista ao fim de cada ciclo do processo, com as métricas da N-11. A revisão segue o mesmo caminho da mudança de requisito: proposta, discussão e aprovação da equipe.

## Anexo A · Checklist de fechamento de fase

Conferir antes do commit da fase (`.claude/rules/commits.md`):

- [ ] Toda execução de agente da fase tem relatório e linhas no log (N-03). As descartadas estão anotadas.
- [ ] Nenhuma pendência ou lacuna foi respondida pela IA (N-04).
- [ ] Todo achado da fase virou pendência ou lacuna (N-06).
- [ ] O log de decisões da fase foi arquivado (N-08).
- [ ] Os tokens da fase estão somados, com origem (N-10), e as métricas da N-11 foram registradas.
- [ ] O critério de saída da fase na N-12 foi atendido.
- [ ] `node --test ".claude/testes-harness/*.test.js"` está verde.
- [ ] O responsável revisou o diff (N-05) e consegue explicar o artefato (N-27).
- [ ] Há uma tarefa "sem IA" registrada (N-28).

---
Aprovação da equipe

| Nome | Papel | Assinatura | Data |
|---|---|---|---|
| Roberta Telles | Requisitos | | |
| Eric Costa Ciciliotti | Arquitetura e codificação | | |
| Sarah Mota | Testes | | |
| Yuri Martinelli | Aceitação e operação | | |
