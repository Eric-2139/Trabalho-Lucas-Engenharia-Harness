# Plano de manutenção — Math Scape (fase 8)

Responsável: Yuri Martinelli · Vale a partir da primeira implantação ([implantação](implantacao.md)) · Usuários: [manual](manual-do-usuario.md)

## 1. Papéis

| Papel | Quem | Faz |
|---|---|---|
| Operação e triagem | Yuri | Recebe os chamados, roda a triagem, acompanha a disponibilidade e os backups, implanta. |
| Correção | Eric | Corrige o código com o caso de teste anexado, como nas fases 5 a 7. |
| Testes | Sarah | Escreve o caso que reproduz o defeito antes da correção e confirma o reteste. |
| Requisitos | Roberta | Decide os chamados classificados como desvio de requisito e atualiza o documento antes de qualquer código mudar. |

## 2. Como um defeito chega e anda

1. **Entrada:** uma issue no GitHub com o título `[bug] …` (o [manual](manual-do-usuario.md), seção 8, explica como abrir), um alarme do workflow de disponibilidade ou algo visto nos logs.
2. **Registro do chamado (Yuri, em até 1 dia útil):** criar `harness/chamados/<número da issue>.json` com:
   - a descrição;
   - a severidade (tabela da seção 3);
   - o serviço afetado (`web`, `api` ou `banco`);
   - o horário aproximado.

   Junte o log da janela do incidente. Ele fica só na máquina de quem tria e **não é commitado**, porque tem IPs:

   ```bash
   docker logs --timestamps --since <ISO> --until <ISO> math-scape-api-1 > harness/logs/brutos/api-<issue>.log 2>&1
   docker logs --timestamps --since <ISO> --until <ISO> math-scape-web-1 > harness/logs/brutos/web-<issue>.log 2>&1
   ```

3. **Triagem com o agente 2:** `/triar-chamado <número>`. O agente não age sobre produção. Ele:
   - procura duplicatas pela causa raiz;
   - lê o log já mascarado;
   - testa hipóteses citando `arquivo:linha`;
   - rastreia o requisito na matriz.

   O diagnóstico sai em `harness/diagnosticos/<número>.json`. **Uma pessoa confere** antes de seguir, como manda a regra de revisão humana do plano.
4. **Roteamento pela classificação do diagnóstico:**

   | Classificação | Destino |
   |---|---|
   | `bug_codigo` | Sarah escreve o teste que falha → Eric corrige → CI verde → CD implanta. A proposta em `harness/propostas/` é só sugestão. |
   | `desvio_requisito` | Roberta decide; mudança de requisito segue `/promover-baseline` antes de qualquer código. |
   | `erro_uso` | Resposta na issue e, se for dúvida recorrente, ajuste no manual. |
   | `duplicata` | Fecha a issue apontando a original. |
   | `escalada` | Reunião curta da equipe com as três hipóteses descartadas. |

5. **Fechamento:** a issue fecha quando a correção está implantada e o `verificar-implantacao.mjs` passou.

## 3. Severidade e prazos

| Severidade | Exemplo | Primeira resposta | Correção implantada |
|---|---|---|---|
| **Crítica** | Sistema fora do ar; resposta ou senha visível no navegador (RNF-04); perda de dados | 4 h | 1 dia (ou volta à versão anterior na hora) |
| **Alta** | Um requisito de prioridade Alta não funciona (ex.: DEF-09, DEF-10) | 1 dia útil | 1 semana |
| **Média** | Requisito Médio, ou contorno fácil | 3 dias úteis | próxima entrega |
| **Baixa** | Texto, aparência | 1 semana | quando houver folga |

Prazos de equipe de disciplina, para os dias de aula. Fora do semestre, só a Crítica tem prazo.

## 4. Classificação da manutenção

| Tipo | O que é | Itens hoje |
|---|---|---|
| **Corretiva** | Corrige comportamento que contraria o requisito | DEF-06, DEF-07, DEF-08 (issues 6 a 8 do GitHub), DEF-09 e DEF-10 ([relatório](../aceitacao/relatorio-defeitos-aceitacao.md)) |
| **Adaptativa** | Ajusta a mudanças de ambiente: navegador, hospedagem, versões, operação | Logger estruturado na Api (`Fastify({ logger })`) para a operação ter erro com rota e duração; alerta de erro (Sentry) no Editor, no Player e na Api; atualização mensal de dependências com o CI verde; imagens no S3 quando sair de um servidor só (ADR-010) |
| **Evolutiva** | Função nova | Backlog da versão 2 (seção 5) |

Pendente de decisão, sem classificar ainda: **DIF-01** (as quatro falas do legado que não existem no Player novo), com a Roberta.

**Rotina da operação:**
- toda semana, conferir se o backup do dia existe e restaurar um em banco descartável uma vez por mês;
- toda semana, ler o resumo de erros 5xx do Caddy (`docker logs math-scape-web-1 | grep '"status":5'`);
- todo mês, `docker compose pull` das imagens base e reimplantar.

## 5. Backlog da versão 2

Fora do MVP pelo plano (seção 1). Cada item passa pela Roberta como requisito novo antes de chegar ao Eric.

| # | Item | Valor | Impacto técnico previsto |
|---|---|---|---|
| V2-01 | **Inventário:** pegar objetos (o giz) e usá-los depois | Enigmas mais ricos, como no legado | Schema novo (`versaoSchema` 2) com migração dos documentos; estado de partida no Player |
| V2-02 | **Condições encadeadas** ("a porta só abre se pegou o giz") | Ordem de resolução controlada pelo criador | Depende do V2-01; a verificação no servidor passa a ter estado de partida (hoje é sem estado) |
| V2-03 | **Múltiplas salas por fase** | Fases mais longas | Schema: lista de salas; navegação entre salas no Player e no Editor |
| V2-04 | **Edição colaborativa** | Duas pessoas na mesma fase | Hoje o salvamento usa revisão e devolve 409 em conflito; precisa de sincronização em tempo real |
| V2-05 | **App mobile** | Jogar no celular | O RNF-01 exige desktop; o palco 16:9 em coordenadas relativas já ajuda |
| V2-06 | Armazenamento de imagens em S3 compatível | Mais de um servidor; backup separado | Trocar a implementação de `Armazenamento` (ADR-010); o contrato não muda |
| V2-07 | Alerta de erro (Sentry) e logger na Api | Operação vê o erro antes do usuário | Adaptativa: dependência nova (decisão de arquitetura do Eric) |

## 6. Indicadores

Medidos todo mês e anotados neste arquivo:

| Indicador | Fonte | Meta |
|---|---|---|
| Disponibilidade | Execuções do workflow Disponibilidade | ≥ 99% no mês |
| Chamados abertos por severidade | Issues com o rótulo `bug` | Nenhum Crítico aberto |
| Tempo até a correção | Issue aberta → issue fechada | Dentro da tabela da seção 3 |
| Backups restauráveis | Teste mensal de restauração | 100% |

---
Responsável (fase 8): Yuri Martinelli · Data: ___/___/2026
