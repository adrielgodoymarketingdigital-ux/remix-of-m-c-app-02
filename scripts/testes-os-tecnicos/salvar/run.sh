#!/usr/bin/env bash
# salvarOrdemServico REAL antes x depois com Supabase falso (sem rede, sem banco).
#   bash scripts/testes-os-tecnicos/salvar/run.sh
# REF_ANTES = commit de comparação (padrão origin/main).
set -euo pipefail
AQUI="$(cd "$(dirname "$0")" && pwd)"
RAIZ="$(cd "$AQUI/../../.." && pwd)"
SAIDA="${TMPDIR:-/tmp}/teste-os-tecnicos-salvar"
node "$AQUI/build.mjs" "$RAIZ" "$SAIDA" "${REF_ANTES:-origin/main}"
SALVAR_BUNDLES="$SAIDA" deno test --no-check --no-lock --allow-env --allow-read "$AQUI/salvar.test.ts"
