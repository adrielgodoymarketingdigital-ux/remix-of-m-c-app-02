#!/usr/bin/env bash
# Prova da opção "Mostrar custo e lucro" nos relatórios de Produtos e Peças (dados fictícios, sem banco).
#   1. gera os 5 relatórios com o código de REF_ANTES (padrão 4daaea8, antes da opção);
#   2. gera com o código atual: padrão, ligado e desligado, e confere vazamento zero;
#   3. compara byte a byte: antes == padrão de agora == ligado de agora.
# Uso: bash scripts/relatorio-sem-custo/run.sh [pasta-de-saída]   (REF_ANTES=<commit> para outro ponto de partida)
set -euo pipefail
RAIZ="$(cd "$(dirname "$0")/../.." && pwd)"
SAIDA="${1:-$(mktemp -d)}"
REF_ANTES="${REF_ANTES:-4daaea8}"
CACHE="$RAIZ/node_modules/.cache/relatorio-sem-custo"
mkdir -p "$SAIDA" "$CACHE"

empacotar() { # $1 = pasta src usada no alias @, $2 = saída .mjs
  "$RAIZ/node_modules/.bin/esbuild" "$RAIZ/scripts/relatorio-sem-custo/gerar.ts" \
    --bundle --platform=node --external:xlsx --alias:jspdf="$RAIZ/node_modules/jspdf/dist/jspdf.es.min.js" \
    --format=esm --alias:@="$1" --outfile="$2" --log-level=warning
}

# src de antes (fica dentro de node_modules/ para achar os pacotes)
rm -rf "$CACHE/antes-src" && mkdir -p "$CACHE/antes-src"
git -C "$RAIZ" archive "$REF_ANTES" src | tar -x -C "$CACHE/antes-src"
empacotar "$CACHE/antes-src/src" "$CACHE/antes.mjs"
empacotar "$RAIZ/src" "$CACHE/depois.mjs"

cd "$RAIZ"
node "$CACHE/antes.mjs" "$SAIDA/antes" antes
conferencia=0
node "$CACHE/depois.mjs" "$SAIDA/depois" depois || conferencia=1

echo
echo "Ligado = idêntico a antes ($REF_ANTES), byte a byte:"
falhou=$conferencia
for f in completo.pdf menos-estoque.pdf mais-vendidos.pdf categoria-pdf.pdf categoria-xlsx.xlsx; do
  for v in padrao ligado; do
    if cmp -s "$SAIDA/antes/padrao/$f" "$SAIDA/depois/$v/$f"; then echo "OK   $f ($v)"; else echo "FALHA $f ($v) difere"; falhou=1; fi
  done
done
for f in menos-estoque.pdf mais-vendidos.pdf; do
  if cmp -s "$SAIDA/antes/padrao/$f" "$SAIDA/depois/desligado/$f"; then echo "OK   $f (desligado = antes: não tinha custo/lucro)"; else echo "FALHA $f (desligado) difere"; falhou=1; fi
done
echo "Arquivos em: $SAIDA"
exit $falhou
