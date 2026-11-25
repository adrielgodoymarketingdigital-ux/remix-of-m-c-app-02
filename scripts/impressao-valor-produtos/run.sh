#!/usr/bin/env bash
# Prova de páginas do valor da linha de produto/peça na impressão da OS (dados fictícios, sem banco, sem rede).
#   1. gera as impressões (A4 Padrão, Tech, Personalizado níveis 0-3, cupom 80 mm,
#      PDF A4 e cupom do jsPDF)
#      com o código de REF_ANTES e com o código atual;
#   2. mede no Chrome com mídia de impressão (desktop e Android, 1 OS e duas OS por folha) e
#      imprime em PDF A4 contando as páginas;
#   3. compara (comparar.mjs) e sai com erro se OS que cabia deixar de caber ou OS sem produto mudar.
# Uso: bash scripts/impressao-valor-produtos/run.sh [pasta-de-saída]
#   REF_ANTES=<commit> (padrão ca9189b = origin/main de 2026-11-25)   PLAYWRIGHT_PATH=<.../node_modules/playwright>   CHROME_PATH=<chrome>
set -euo pipefail
RAIZ="$(cd "$(dirname "$0")/../.." && pwd)"
SAIDA="${1:-$(mktemp -d)}"
REF_ANTES="${REF_ANTES:-ca9189b}"
CACHE="$RAIZ/prova-cache.local/impressao-valor-produtos"  # *.local está no .gitignore; dentro da raiz p/ achar node_modules
DIR="$RAIZ/scripts/impressao-valor-produtos"
export PLAYWRIGHT_PATH="${PLAYWRIGHT_PATH:-$HOME/Downloads/teste-carencia/node_modules/playwright}"
mkdir -p "$SAIDA" "$CACHE"

empacotar() { # $1 = pasta src usada no alias @, $2 = saída .mjs
  "$RAIZ/node_modules/.bin/esbuild" "$DIR/gerar.tsx" \
    --bundle --platform=node --format=esm --jsx=automatic \
    --alias:jspdf="$RAIZ/node_modules/jspdf/dist/jspdf.es.min.js" --alias:@="$1" \
    --banner:js="import{createRequire as __cr}from'module';const require=__cr(import.meta.url);" \
    --outfile="$2" --log-level=warning
}
css() { # $1 = pasta src, $2 = saída .css (index.css compilado como no app)
  "$RAIZ/node_modules/.bin/tailwindcss" -i "$1/index.css" -c "$RAIZ/tailwind.config.ts" -o "$2" 2>/dev/null
}

# src de antes (fica dentro de node_modules/ para achar os pacotes)
rm -rf "$CACHE/antes-src" && mkdir -p "$CACHE/antes-src"
git -C "$RAIZ" archive "$REF_ANTES" src | tar -x -C "$CACHE/antes-src"

for lado in antes depois; do
  if [ "$lado" = antes ]; then SRC="$CACHE/antes-src/src"; else SRC="$RAIZ/src"; fi
  empacotar "$SRC" "$CACHE/$lado.mjs"
  css "$SRC" "$CACHE/$lado.css"
  rm -rf "${SAIDA:?}/$lado"
  (cd "$RAIZ" && node "$CACHE/$lado.mjs" "$SAIDA/$lado")
done

# As duas medições em paralelo (cada uma abre o próprio Chrome).
node "$DIR/medir.mjs" "$SAIDA/antes" "$CACHE/antes.css" "$CACHE/antes-src/src/components/ordens/ImpressaoOrdemServico.tsx" &
P1=$!
node "$DIR/medir.mjs" "$SAIDA/depois" "$CACHE/depois.css" "$RAIZ/src/components/ordens/ImpressaoOrdemServico.tsx" &
P2=$!
wait $P1; wait $P2

echo
node "$DIR/comparar.mjs" "$SAIDA/antes" "$SAIDA/depois"
echo "Arquivos em: $SAIDA  (antes|depois/html, pdf, pdf-html)"
