#!/usr/bin/env bash
# useContas REAL antes x depois com Supabase falso (sem rede, sem banco).
#   bash scripts/testes-recorrencia/hook/run.sh
# REF_ANTES = commit sem a Fase 2 (padrão 6c371e8, a main antes desta correção).
set -euo pipefail
AQUI="$(cd "$(dirname "$0")" && pwd)"
RAIZ="$(cd "$AQUI/../../.." && pwd)"
SAIDA="${TMPDIR:-/tmp}/teste-recorrencia-hook"
node "$AQUI/build.mjs" "$RAIZ" "$SAIDA" "${REF_ANTES:-6c371e8}"
status=0
for tz in America/Sao_Paulo UTC; do
  echo "== TZ=$tz"
  HOOK_BUNDLES="$SAIDA" TZ=$tz deno test --no-check --no-lock --allow-env --allow-read "$AQUI/hook.test.ts" || status=1
done
exit $status
