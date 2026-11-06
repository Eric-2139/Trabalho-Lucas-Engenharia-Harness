# Log de uso de IA — Fase 8: Operação e Manutenção (Yuri)

Ferramenta: Claude Code (sessão na nuvem), modelo Claude Opus 5.5, na sessão principal, sem os agentes do harness. Tokens: preencher pelo painel de uso; se não houver, estimar e marcar como "estimado".

## Entregas
- Pilha de produção: `infra/producao/` (Dockerfile com os alvos `api` e `web`, `docker-compose.yml`, `Caddyfile`, backup diário, `.env.exemplo`, `verificar-implantacao.mjs`).
- CI/CD: `.github/workflows/cd.yml` (imagens no GHCR e implantação por SSH depois do CI verde na `main`) e `.github/workflows/disponibilidade.yml` (verificação a cada 30 min).
- Documentação:
  - `README.md` (README técnico);
  - `docs/operacao/implantacao.md`;
  - `docs/operacao/manual-do-usuario.md`, com 4 telas capturadas na pilha de produção;
  - `docs/operacao/plano-manutencao.md` (fluxo com o agente 2, severidades, classificação e backlog da versão 2).
- Defeito: DEF-10 em `docs/aceitacao/relatorio-defeitos-aceitacao.md`, para o Eric.

**O que ainda não está feito:** o **link público** depende de um servidor e de um domínio da equipe. A pilha subiu e foi verificada neste ambiente com `localhost` e `editor.localhost`.

## Interações

| Data | Objetivo | Acertou | Errou ou precisou de correção |
|---|---|---|---|
| 06/11 | Escolher a forma de implantação | Leu a ADR-017 (Api no mesmo site, `/api` reescrito) e a ADR-010 (imagens em disco) antes de propor. Escolheu um servidor com Compose e Caddy, em vez de hospedagem estática mais um serviço gerenciado, porque esses perdem o disco das imagens | — |
| 06/11 | Construir e subir a pilha | Usou um `Dockerfile.dockerignore` próprio, porque o `.dockerignore` da raiz é o da imagem de testes e esconde o código | O `prisma generate` exigia `DATABASE_URL` no build; o Caddy não aceitava `email` vazio na configuração global. Os dois foram corrigidos depois de rodar |
| 06/11 | Verificar a implantação | Escreveu um script de 18 verificações que limpa o que cria e o rodou duas vezes, a segunda com os volumes apagados. Testou também a restauração do backup | O script procurava `<div id="root">`, mas o projeto usa `raiz` |
| 06/11 | Procurar o que só aparece atrás do proxy | Suspeitou do `request.ip` atrás do Caddy e provou com dois clientes de IPs diferentes: o segundo levou 429 na primeira tentativa com a senha certa (DEF-10). Deixou a correção para o Eric, como manda o processo | No primeiro roteiro de prova, mandou `content-type: application/json` sem corpo, e a Api recusou a publicação (falso 404 depois) |
| 06/11 | Manual do usuário | Tirou os nomes dos botões do `ROTULOS_EDITOR` e das telas reais capturadas no Chromium | Afirmou que as setas do teclado trocam de parede no Player, mas isso só existe no Editor; e que o corte de 8 MB no proxy bastava, mas ele quebraria a importação de até 50 MB (subiu para 55 MB). Os dois foram corrigidos antes do commit |

## Sessões

| Data | Ferramenta / modelo | Objetivo | Resultado | Tokens entrada | Tokens saída | Origem |
|---|---|---|---|---|---|---|
| 06/11 | Claude Code / Opus 5.5 | Fase 8: pilha de produção, CI/CD, manual, plano de manutenção | Revisar antes do push | | | preencher pelo painel de uso; senão, estimar |
| **Total** | | | | | | |
