#!/usr/bin/env bash
# Gera PDF + XLSX de exemplo (dados fictícios, sem banco) na pasta indicada.
set -euo pipefail
RAIZ="$(cd "$(dirname "$0")/../.." && pwd)"
SAIDA="${1:-$(mktemp -d)}"
mkdir -p "$SAIDA"
# Bundle dentro de node_modules/ para o node achar xlsx/jspdf (xlsx fica externo; jspdf entra no bundle).
OUT="$RAIZ/node_modules/.cache/exportar-categorias/gerar.mjs"
"$RAIZ/node_modules/.bin/esbuild" "$RAIZ/scripts/exportar-categorias/gerar-exemplo.ts" \
  --bundle --platform=node --external:xlsx --alias:jspdf="$RAIZ/node_modules/jspdf/dist/jspdf.es.min.js" --format=esm --alias:@="$RAIZ/src" \
  --outfile="$OUT" --log-level=warning
cd "$RAIZ" && node "$OUT" "$SAIDA"
echo "Arquivos em: $SAIDA"
