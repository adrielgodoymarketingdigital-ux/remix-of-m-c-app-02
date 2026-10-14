#!/usr/bin/env bash
# Teste de componente: campo Quantidade do cadastro de dispositivo (DialogCadastroDispositivo real).
# Não usa banco (Supabase simulado em mocks/). Não mexe no package.json: instala jsdom/testing-library
# numa pasta temporária.   bash scripts/testes-campo-quantidade/run.sh
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
status=0
for tz in UTC America/Sao_Paulo; do
  echo "== TZ=$tz"
  TZ=$tz node "$AQUI/run.cjs" "$DEPS" 2>/dev/null | grep -E "^(OK|FALHA|ERRO)|^      " || status=1
  TZ=$tz node "$AQUI/run.cjs" "$DEPS" >/dev/null 2>&1 || status=1
done
exit $status
