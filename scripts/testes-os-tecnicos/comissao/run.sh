#!/usr/bin/env bash
# Comissão (Comissões a Pagar, gráfico mensal, Desempenho) antes x depois com
# Supabase em memória (sem rede, sem banco).
#   bash scripts/testes-os-tecnicos/comissao/run.sh
# REF_ANTES = commit de comparação (padrão origin/main).
set -euo pipefail
AQUI="$(cd "$(dirname "$0")" && pwd)"
RAIZ="$(cd "$AQUI/../../.." && pwd)"
SAIDA="${TMPDIR:-/tmp}/teste-os-tecnicos-comissao"
node "$AQUI/build.mjs" "$RAIZ" "$SAIDA" "${REF_ANTES:-origin/main}"
COMISSAO_BUNDLES="$SAIDA" deno test --no-check --no-lock --allow-env --allow-read "$AQUI/comissao.test.ts"
