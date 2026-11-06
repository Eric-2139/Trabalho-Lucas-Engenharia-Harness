# Log de uso de IA — Fase 6: Teste do Sistema (Sarah)

Ferramenta: Claude Code (extensão do VS Code), modelo Claude Opus 5.5. Tokens **medidos** na transcrição da sessão.

## Entregas
- Suíte Playwright: `tests/e2e/` (97 casos em Chromium, Edge e Firefox) e imagem própria em `infra/e2e/`.
- Relatório de teste do sistema: `docs/testes/relatorio-teste-sistema.md`.
- Evidências: `docs/testes/evidencias/`.

**Dependência:** o Playwright está num manifesto isolado (`tests/e2e/package.json`), fora do workspace, do `package.json` e do lockfile do produto, porque dependência do produto é decisão do arquiteto. As ADR-006, ADR-007 e ADR-016 já prescrevem o Playwright em imagem própria. Vale o Eric conferir.

**Harness:** sessão principal, sem os agentes. Os casos de `tests/e2e/` seguem as convenções (`@req`, nomes, sem relógio nem sorteio; só o RNF-03 mede tempo no navegador, porque essa é a medida), mas o gate não os conferiu e a matriz `harness/matriz/requisito-teste.json` não os inclui.

## Interações

| Data | Objetivo | Acertou | Errou ou precisou de correção |
|---|---|---|---|
| 06/11 | Roteiro de equivalência | Usou o legado como oráculo e serviu as rotas curtas dele (`/F_Roo`) sem alterar a pasta | Contou 1 alerta na dica do teto; no legado, o clique sobe ao relógio e dispara mais |
| 06/11 | Fluxos e não funcionais | Encontrou DEF-03 a DEF-07 no navegador real | Testes com corrida (clicar antes de a tela assentar) pareceram defeitos no RF-03 e no RF-11; investigados, eram do teste |
| 06/11 | Separar defeito de erro do teste | Reproduziu cada falha antes de classificar; repetiu a suíte 3 vezes | Uma execução extra da IA apagou resultados. Depois, a tela da falha do RF-13 também foi sobrescrita, e a OBS-01 ficou sem causa |
| 06/11 | Reteste depois das correções | Mediu de novo em vez de aceitar o resumo; notou que o caso do RF-03 não media a proporção e que nenhum caso media a rolagem da página | Mediu a área errada do palco e depois criou uma corrida ao redimensionar. As duas falhas foram investigadas, e eram do teste |

## Onde a IA mais ajudou
Montar a suíte inteira e reproduzir falhas por coordenadas num palco de canvas, onde não há elemento para selecionar.

## Onde errou
- Marcou um comportamento do legado como defeito (as falas perdidas) antes de reler o RF-18. Virou a decisão DIF-01, para a Roberta.
- Só uma versão de cada navegador foi testada: o relatório diz isso, em vez de aprovar o RNF-01.

## Sessões

| Data | Ferramenta / modelo | Objetivo | Resultado | Tokens entrada | Tokens saída | Origem |
|---|---|---|---|---|---|---|
| 06/11 | Claude Code / Opus 5.5 | Suíte Playwright, investigação das falhas e medições (sessão principal, de 12:29 UTC até antes da escrita dos relatórios) | 84 passam, 12 falham como esperado, 0 falhas inesperadas | 4.816.556 | 70.657 | medido |
| 06/11 | Claude Code / Opus 5.5 | Reteste de DEF-01 a DEF-05, reforço dos casos, evidências e atualização dos relatórios | 91 passam, 5 falham como esperado, 0 inesperadas; 667 de 667 | 3.245.397 | 32.424 | medido |
| **Total** | | | | **8.061.953** | **103.081** | medido |

A primeira linha foi medida antes de escrever estes documentos. A segunda foi medida antes do commit do reteste. O commit e o envio não entram na conta.
