# Implantação e operação — Math Scape (fase 8)

Responsável: Yuri Martinelli · Entrada: commit `8a236d6` (relatório de teste do sistema assinado) · Requisito de implantação: [ADR-017](../../harness/projeto/decisoes/ADR-017.md)

## Como o sistema fica no ar

```
navegador ──HTTPS──> Caddy (web) ─┬─ SITE_PLAYER  → Player (estático)  ┐
                                  ├─ SITE_EDITOR  → Editor (estático)  ├─ /api/* → Api (Fastify) ──> PostgreSQL
                                  └─ certificados Let's Encrypt         ┘                         └─> volume de imagens
                                                         backup diário (pg_dump) ──> ./backups
```

Tudo roda num servidor com Docker Compose (`infra/producao/`). Escolhi um único servidor em vez de hospedagem estática + serviço separado por três motivos:

1. **ADR-017:** o Editor e o Player chamam a Api pelo caminho relativo `/api`. Assim, o cookie `SameSite=Lax` da sessão funciona. Com o Caddy na frente, a reescrita de `/api/*` fica num arquivo versionado (`infra/producao/Caddyfile`), e não no painel de um provedor.
2. **Imagens em disco (ADR-010):** a Api grava as imagens enviadas no disco. Render e Railway gratuitos apagam o disco a cada reinício, a não ser que se pague por um volume.
3. **Custo e portabilidade:** a mesma pilha roda numa VPS de entrada, na máquina da faculdade ou no notebook para a demonstração.

Os dois endereços precisam ser **do mesmo site** (mesmo domínio registrável, por exemplo `mathscape.exemplo.com` e `editor.mathscape.exemplo.com`). Cada app chama a Api pelo próprio endereço, e o cookie da sessão do editor fica só no endereço do editor.

## Requisitos do servidor

- Linux com Docker 24+ e o plugin Compose, 2 GB de memória (o build do front usa ~1,5 GB) e 10 GB de disco.
- Portas 80 e 443 abertas para a internet (o Let's Encrypt valida pela 80).
- Dois registros DNS (A ou AAAA) apontando para o servidor: `SITE_PLAYER` e `SITE_EDITOR`.

## Primeira implantação

```bash
git clone https://github.com/Eric-2139/Trabalho-Lucas-Engenharia-Harness.git math-scape && cd math-scape
cp infra/producao/.env.exemplo infra/producao/.env
# edite o .env: SITE_PLAYER, SITE_EDITOR e SENHA_BANCO (openssl rand -hex 24)
docker compose -f infra/producao/docker-compose.yml --env-file infra/producao/.env up -d --build
docker compose -f infra/producao/docker-compose.yml --env-file infra/producao/.env ps
```

A Api aplica as migrations a cada início (`infra/producao/api-entrada.sh`). Ela roda o seed da fase original **se** `apps/api/prisma/seed.ts` existir.

**Fase original (enquanto o DEF-09 estiver aberto):** o seed não existe, então o sistema sobe sem a Escola. Contorno até o Eric corrigir:

1. Crie uma conta institucional da equipe no editor (não a de uma pessoa).
2. Em Minhas fases, use "Importar fase" com `docs/aceitacao/materiais/escola-01-importar.json` e publique.

Se essa conta for excluída, a Escola some junto (RF-19 apaga em cascata). Quando o seed existir, exclua essa conta e reinicie a Api: o seed cria a Escola no usuário de sistema.

## Verificar uma implantação

```bash
node infra/producao/verificar-implantacao.mjs https://<SITE_PLAYER> https://<SITE_EDITOR>
```

O script faz 18 verificações e não deixa dado para trás. Ele confere:

- os dois apps em HTTPS, e recarregar uma rota interna não dá 404;
- cadastro e login pelo `/api` reescrito, e o cookie `sid` `HttpOnly`, `Secure` e `SameSite=Lax` (RNF-05);
- importar e publicar a Escola com uma conta descartável;
- a fase aparece em Escolher fase sem login (RF-13), e a projeção de jogo não traz senha nem respostas (RNF-04);
- a senha errada não abre a porta, e a certa abre;
- por fim, exclui a conta, e a fase sai da lista.

Saída 0 significa tudo certo. O CD roda esse mesmo script depois de cada implantação.

**Resultado em 06/11/2026** (pilha completa rodando neste repositório com `SITE_PLAYER=localhost` e `SITE_EDITOR=editor.localhost`, certificado da CA interna do Caddy): 18 de 18 verificações ok. Nessa mesma rodada apareceu o [DEF-10](../aceitacao/relatorio-defeitos-aceitacao.md): atrás do proxy, o limite de tentativas da porta vale para todos os jogadores juntos.

## Atualizar

- **Automático (CD):** a cada push na `main` com o CI verde, o workflow `.github/workflows/cd.yml`:
  1. constrói as imagens `api` e `web` e as publica no GHCR (`ghcr.io/eric-2139/trabalho-lucas-engenharia-harness/{api,web}`), com a tag do commit e `latest`;
  2. se os segredos do servidor existirem, entra por SSH, faz checkout do mesmo commit, `pull` das imagens e `up -d`;
  3. roda a verificação acima.

  Configuração em Settings → Secrets and variables → Actions:
  - variáveis `SITE_PLAYER` e `SITE_EDITOR`;
  - segredos `DEPLOY_HOST`, `DEPLOY_USUARIO`, `DEPLOY_CHAVE_SSH` e `DEPLOY_DIRETORIO`;
  - um ambiente `producao` (opcional: dá para exigir aprovação manual nele).

  Se o repositório for privado, o servidor precisa de `docker login ghcr.io` com um token de leitura de pacotes.
- **Manual:** `git pull`, e depois o mesmo `up -d --build` da primeira implantação.
- **Voltar uma versão:** no servidor, rode o comando abaixo com o commit anterior:

  ```bash
  IMAGEM_API=ghcr.io/.../api:<commit anterior> IMAGEM_WEB=ghcr.io/.../web:<commit anterior> docker compose ... up -d --no-build
  ```

  Migrations não voltam sozinhas. Antes de implantar uma versão com migration nova, confira se há backup do dia.

## Configuração e segurança

| Item do plano | Como ficou |
|---|---|
| Segredos em variáveis de ambiente | Só a `SENHA_BANCO`, no `infra/producao/.env`, que o git ignora (`.env.*`). Não há segredo no repositório nem nas imagens. |
| HTTPS | O Caddy emite e renova os certificados do Let's Encrypt e manda `Strict-Transport-Security`. A Api marca o cookie como `Secure` em produção. |
| Banco | Fica fora da internet: o serviço `banco` não publica porta e só a Api o enxerga, pela rede interna do Compose. |
| Limite de upload | A Api recusa imagem acima de 5 MB (413) e formato fora de PNG, JPG e WebP (415) (RF-06), e envelope de importação acima de 50 MB. O Caddy corta qualquer corpo acima de 55 MB antes de chegar à Api. |
| Backup diário | O serviço `backup` grava um `pg_dump` comprimido por dia em `DIRETORIO_BACKUP` e guarda os últimos `DIAS_BACKUP` (7). As imagens ficam no volume `armazenamento`: copie com `docker run --rm -v math-scape_armazenamento:/a -v $PWD:/b alpine tar czf /b/imagens.tgz -C /a .` |

Restaurar o banco a partir de um backup:

```bash
gunzip -c backups/math_scape-AAAA-MM-DD.sql.gz | docker compose -f infra/producao/docker-compose.yml --env-file infra/producao/.env exec -T banco psql -U math_scape math_scape
```

Guarde uma cópia dos backups **fora** do servidor.

## Monitoramento

- **Disponibilidade:** o workflow `.github/workflows/disponibilidade.yml` consulta `https://<SITE_PLAYER>/api/publicadas` e a página do editor a cada 30 minutos. Se falhar, o GitHub manda e-mail a quem ativou o workflow. Ele só roda quando a variável `SITE_PLAYER` está definida.
- **Logs:** use `docker compose -f infra/producao/docker-compose.yml --env-file infra/producao/.env logs -f web api`. O Caddy grava um JSON por requisição (rota, status e tempo) e a Api grava as migrations e os erros não tratados. A Api ainda não tem logger próprio (`Fastify()` sem `logger`); isso está no backlog do [plano de manutenção](plano-manutencao.md).
- **Alerta de erro (Sentry):** não implantado, porque precisa de conta e de mudança no código dos apps e da Api. Fica como manutenção adaptativa no plano.

## Testar a pilha sem domínio

Use `SITE_PLAYER=localhost` e `SITE_EDITOR=editor.localhost` no `.env`. O Caddy usa então um certificado da própria CA interna, e o navegador avisa que o certificado não é confiável. O Chromium resolve `*.localhost` sozinho; em outros sistemas, ponha `127.0.0.1 editor.localhost` no `/etc/hosts`. Para o script de verificação aceitar esse certificado, rode com `NODE_TLS_REJECT_UNAUTHORIZED=0`, **só** nesse caso.

## Limitações conhecidas

- **DEF-09:** sem o seed, a Escola é carregada pelo contorno manual acima.
- **DEF-10:** o limite de tentativas é global atrás do proxy até o Eric configurar o `trustProxy`.
- **Navegadores:** o Caddy entrega o build com alvo `chrome120`, `edge120` e `firefox120` (DEF-08: falta o `browserslist`).
- **Escala:** a pilha é de um servidor só, sem réplica. É suficiente para a disciplina e a demonstração. Para escalar, o armazenamento de imagens precisa ir para S3 (ADR-010, versão 2).
