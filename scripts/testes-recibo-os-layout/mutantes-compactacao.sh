#!/usr/bin/env bash
# Prova de que os testes da compactação do recibo personalizado pegam erros:
# estraga a regra/CSS de um jeito por vez, roda os testes e exige que FALHEM.
# Restaura o arquivo no fim de cada um.
# Uso (na raiz do repo): bash scripts/testes-recibo-os-layout/mutantes-compactacao.sh
set -u
cd "$(git rev-parse --show-toplevel)"
REGRA=src/lib/ordemServico/compactacaoReciboPersonalizado.ts
CSS=src/components/ordens/recibo-personalizado/cssReciboPersonalizado.ts
TESTES="scripts/testes-recibo-os-layout/compactacaoReciboPersonalizado.test.ts scripts/testes-recibo-os-layout/cssCompactacaoReciboPersonalizado.test.ts"
sobreviventes=0
antes=$(cat "$REGRA" "$CSS" | shasum)

mutar() { # nome arquivo de para
  local nome="$1" arq="$2" de="$3" para="$4"
  cp "$arq" "$arq.bak"
  if ! python3 -c 'import sys; p,a,b=sys.argv[1:]; s=open(p).read(); assert s.count(a)==1, "trecho não encontrado: "+a; open(p,"w").write(s.replace(a,b))' "$arq" "$de" "$para"; then
    mv "$arq.bak" "$arq"; echo "ERRO ao aplicar: $nome"; sobreviventes=$((sobreviventes+1)); return
  fi
  # shellcheck disable=SC2086
  if deno test -A --no-check $TESTES >/dev/null 2>&1; then
    echo "SOBREVIVEU: $nome"; sobreviventes=$((sobreviventes+1))
  else
    echo "pego:       $nome"
  fi
  mv "$arq.bak" "$arq"
}

# ── regra ──
mutar "limite 281 em vez de 270" "$REGRA" "export const LIMITE_UMA_FOLHA_MM = 270;" "export const LIMITE_UMA_FOLHA_MM = 281;"
mutar "cabe só abaixo do limite (< em vez de ≤)" "$REGRA" "if ((alturas[nivel] as number) <= limiteMm) {" "if ((alturas[nivel] as number) < limiteMm) {"
mutar "compacta mesmo quando cabe (pula o nível 0)" "$REGRA" "for (let nivel = 0; nivel <= NIVEL_MAXIMO_COMPACTACAO; nivel++) {" "for (let nivel = 1; nivel <= NIVEL_MAXIMO_COMPACTACAO; nivel++) {"
mutar "escolhe o último nível que cabe, não o primeiro" "$REGRA" "for (let nivel = 0; nivel <= NIVEL_MAXIMO_COMPACTACAO; nivel++) {" "for (let nivel = NIVEL_MAXIMO_COMPACTACAO; nivel >= 0; nivel--) {"
mutar "ignora medida inválida" "$REGRA" "  for (const altura of alturas) if (!valida(altura)) return SEM_COMPACTACAO;" ""
mutar "aceita número de níveis errado" "$REGRA" "  if (alturas.length !== NIVEL_MAXIMO_COMPACTACAO + 1) return SEM_COMPACTACAO;" ""
mutar "medida zero vale" "$REGRA" "Number.isFinite(mm) && mm > 0" "Number.isFinite(mm) && mm >= 0"
mutar "2 folhas no nível 3 em vez de 0" "$REGRA" 'return { nivel: 0, agrupamento: comAnterior <= limiteMm ? "anteriorEFinal" : "final", motivo: "duasFolhas" };' 'return { nivel: 3, agrupamento: comAnterior <= limiteMm ? "anteriorEFinal" : "final", motivo: "duasFolhas" };'
mutar "nunca leva o bloco anterior" "$REGRA" 'agrupamento: comAnterior <= limiteMm ? "anteriorEFinal" : "final"' 'agrupamento: "final"'
mutar "sempre leva o bloco anterior, mesmo sem caber" "$REGRA" 'agrupamento: comAnterior <= limiteMm ? "anteriorEFinal" : "final"' 'agrupamento: "anteriorEFinal"'
mutar "agrupa termo maior que a folha" "$REGRA" '  if (final > limiteMm) return { nivel: 0, agrupamento: "nenhum", motivo: "finalMaiorQueFolha" };' ""
mutar "fim inválido não volta ao recibo de sempre" "$REGRA" "  if (!valida(final)) return SEM_COMPACTACAO;" ""
mutar "anterior inválido não volta ao recibo de sempre" "$REGRA" "  if (!valida(comAnterior) || comAnterior < final) return SEM_COMPACTACAO;" ""
mutar "SEM_COMPACTACAO no nível 1" "$REGRA" 'Object.freeze({ nivel: 0, agrupamento: "nenhum", motivo: "medicaoInvalida" })' 'Object.freeze({ nivel: 1, agrupamento: "nenhum", motivo: "medicaoInvalida" })'
mutar "decisaoMudaRecibo sempre verdadeiro" "$REGRA" 'return !!decisao && (decisao.nivel > 0 || decisao.agrupamento !== "nenhum");' 'return true;'
mutar "decisaoMudaRecibo ignora agrupamento" "$REGRA" 'return !!decisao && (decisao.nivel > 0 || decisao.agrupamento !== "nenhum");' 'return !!decisao && decisao.nivel > 0;'
# ── CSS ──
mutar "CSS de sempre alterado" "$CSS" "  line-height: 1.3;" "  line-height: 1.31;"
mutar "nível 0 passa a ter CSS" "$CSS" '  if (!partes.length) return "";' '  if (!partes.length) return "/* */";'
mutar "CSS sem escopo de nível (vaza entre cópias)" "$CSS" '.join(`html body ${R}.osr-compacto.osr-nivel-${n}`)' '.join(`html body ${R}.osr-compacto`)'
mutar "termo abaixo de 7,5 pt" "$CSS" '${C} .osr-termo { font-size: 7.5pt; }' '${C} .osr-termo { font-size: 7pt; }'
mutar "texto abaixo de 8 pt" "$CSS" '${C} { font-size: 8pt; }' '${C} { font-size: 7.5pt; }'
mutar "títulos abaixo de 8 pt" "$CSS" '${C} .osr-card-titulo { font-size: 8pt; }' '${C} .osr-card-titulo { font-size: 7pt; }'
mutar "ícone do checklist abaixo de 3,2 mm" "$CSS" '${C} .osr-check-icone { width: 3.2mm; height: 3.2mm; }' '${C} .osr-check-icone { width: 2.6mm; height: 2.6mm; }'
mutar "espaço entre cartões abaixo de 1,5 mm" "$CSS" '${C} { gap: 1.5mm; }' '${C} { gap: 1mm; }'
mutar "espaço interno do cartão abaixo de 1 mm" "$CSS" '${C} .osr-card-body { padding: 1mm 3mm; }' '${C} .osr-card-body { padding: 0.6mm 3mm; }'
mutar "nível 1 mexe na fonte" "$CSS" '${C} .osr-campo { padding: 0.35mm 0; }' '${C} .osr-campo { padding: 0.35mm 0; font-size: 8pt; }'
mutar "nível 2 sem avarias menores" "$CSS" '${C} .osr-avarias .impressao-silhueta { max-width: 24mm; }' ''
mutar "níveis deixam de ser cumulativos" "$CSS" "  const partes = CSS_POR_NIVEL.slice(0, n);" "  const partes = CSS_POR_NIVEL.slice(n - 1, n);"
mutar "grupo final pode partir" "$CSS" "  display: flex; flex-direction: column; gap: 2.5mm; flex-shrink: 0;
  break-inside: avoid; page-break-inside: avoid;" "  display: flex; flex-direction: column; gap: 2.5mm; flex-shrink: 0;"
mutar "grupo final com espaço diferente do recibo" "$CSS" "  display: flex; flex-direction: column; gap: 2.5mm; flex-shrink: 0;" "  display: flex; flex-direction: column; gap: 1mm; flex-shrink: 0;"
mutar "ajuste sem o desenho das avarias do Tailwind (Android)" "$CSS" "  partes.unshift(CSS_DESENHO_AVARIAS);" ""
mutar "réplica do Tailwind com valor errado" "$CSS" '${C} .impressao-silhueta .absolute { position: absolute; }' '${C} .impressao-silhueta .absolute { position: static; }'
mutar "escala do desenho volta a valer na captura do iPhone" "$CSS" '${C}:not(.osr-captura) .impressao-silhueta .scale-' '${C} .impressao-silhueta .scale-'
mutar "captura do iPhone sem o limite de 28 mm" "$CSS" '${C}.osr-captura .impressao-silhueta { max-width: 28mm; }' ''
mutar "medição sem a fonte da impressão" "$CSS" "overflow: visible; padding: 0; margin: 0; font-size: 9pt; font-weight: 400;" "overflow: visible; padding: 0; margin: 0; font-weight: 400;"
mutar "medição sem a silhueta de 28 mm do index.css" "$CSS" '${M} .impressao-silhueta { max-width: 28mm; }' ''
mutar "medição mais forte que a compactação" "$CSS" 'const M = `html ${R}.osr-medicao`;' 'const M = `html body ${R}.osr-medicao.osr-medicao`;'

[ "$(cat "$REGRA" "$CSS" | shasum)" = "$antes" ] || { echo "ARQUIVO NÃO RESTAURADO"; exit 2; }
rm -f deno.lock
echo "sobreviventes: $sobreviventes"
[ "$sobreviventes" -eq 0 ]
