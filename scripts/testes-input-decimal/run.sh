#!/usr/bin/env bash
# Teste de componente do InputDecimal (src/components/ui/input-decimal.tsx): campo de valor que
# aceita vírgula no celular. Não usa banco. Não mexe no package.json: instala jsdom/testing-library
# numa pasta temporária.   bash scripts/testes-input-decimal/run.sh
set -euo pipefail
AQUI="$(cd "$(dirname "$0")" && pwd)"
RAIZ="$(cd "$AQUI/../.." && pwd)"
DEPS="${DEPS_TESTE_COMPRA:-${TMPDIR:-/tmp}/deps-teste-compra-varias-unidades}"
if [ ! -d "$DEPS/node_modules/jsdom" ]; then
  mkdir -p "$DEPS"
  (cd "$DEPS" && [ -f package.json ] || npm init -y >/dev/null)
  npm i --silent --prefix "$DEPS" jsdom@24.1.3 @testing-library/react@16.0.1 @testing-library/dom@10.4.0 @testing-library/user-event@14.5.2 >/dev/null
fi
node "$AQUI/build.mjs" "$RAIZ" "$DEPS"
node "$AQUI/run.cjs" "$DEPS"
