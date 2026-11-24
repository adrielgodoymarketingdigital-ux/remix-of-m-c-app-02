#!/usr/bin/env bash
# Técnicos adicionais da OS (F2), sem banco e sem rede:
#   1. regras puras (deno);
#   2. teste de componente da etapa Serviço (jsdom; instala jsdom/testing-library numa pasta
#      temporária, sem mexer no package.json);
#   3. gravação: salvarOrdemServico REAL com Supabase falso (antes = REF_ANTES x novo).
#   bash scripts/testes-os-tecnicos-adicionais/run.sh
set -euo pipefail
AQUI="$(cd "$(dirname "$0")" && pwd)"
RAIZ="$(cd "$AQUI/../.." && pwd)"
echo "== 1. regras puras"
deno test -A --no-check --no-lock "$RAIZ/src/lib/ordemServico/tecnicosAdicionaisOS.test.ts"
echo "== 2. componente (etapa Serviço)"
DEPS="${DEPS_TESTE_COMPRA:-${TMPDIR:-/tmp}/deps-teste-compra-varias-unidades}"
if [ ! -d "$DEPS/node_modules/jsdom" ]; then
  mkdir -p "$DEPS"
  (cd "$DEPS" && [ -f package.json ] || npm init -y >/dev/null)
  npm i --silent --prefix "$DEPS" jsdom@24.1.3 @testing-library/react@16.0.1 @testing-library/dom@10.4.0 @testing-library/user-event@14.5.2 >/dev/null
fi
node "$AQUI/build.mjs" "$RAIZ" "$DEPS"
node "$AQUI/run.cjs" "$DEPS"
echo "== 3. gravação (salvarOrdemServico com Supabase falso)"
# Caminho REAL da pasta (no macOS o TMPDIR passa por link simbólico e o empacotador
# não acha os imports relativos da cópia "antes").
mkdir -p "${TMPDIR:-/tmp}/teste-os-tecnicos-adicionais-salvar"
SAIDA="$(cd "${TMPDIR:-/tmp}/teste-os-tecnicos-adicionais-salvar" && pwd -P)"
node "$RAIZ/scripts/testes-os-tecnicos/salvar/build.mjs" "$RAIZ" "$SAIDA" "${REF_ANTES:-origin/main}"
SALVAR_BUNDLES="$SAIDA" deno test --no-check --no-lock --allow-env --allow-read "$AQUI/gravacao.test.ts"
