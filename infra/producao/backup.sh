#!/usr/bin/env bash
# Backup diário do banco: um pg_dump por dia em /backups, apaga os mais velhos que DIAS_BACKUP.
# Restaurar: gunzip -c math_scape-AAAA-MM-DD.sql.gz | docker compose ... exec -T banco psql -U math_scape math_scape
set -uo pipefail
while true; do
  arquivo="/backups/math_scape-$(date +%F).sql.gz"
  if pg_dump --no-owner | gzip > "$arquivo.tmp"; then
    mv "$arquivo.tmp" "$arquivo"
    echo "[backup] $(date -Is) gravado $arquivo"
  else
    rm -f "$arquivo.tmp"; echo "[backup] $(date -Is) FALHOU" >&2
  fi
  find /backups -name 'math_scape-*.sql.gz' -mtime "+${DIAS_BACKUP}" -delete
  sleep 86400
done
