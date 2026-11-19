#!/usr/bin/env bash
# Prova de que datasReciboLegal.test.ts pega erros: estraga o código de um jeito
# por vez, roda os testes e exige que FALHEM. Restaura o arquivo no fim de cada um.
# Uso (na raiz do repo): bash scripts/testes-recibo-legal/mutantes.sh
set -u
cd "$(git rev-parse --show-toplevel)"
DATAS=src/lib/origem/datasReciboLegal.ts
GERADOR=src/lib/gerarReciboLegalPDF.ts
TESTE=scripts/testes-recibo-legal/datasReciboLegal.test.ts
sobreviventes=0
antes=$(cat "$DATAS" "$GERADOR" | shasum)

mutar() { # nome arquivo de para
  local nome="$1" arq="$2" de="$3" para="$4"
  cp "$arq" "$arq.bak"
  if ! python3 -c 'import sys; p,a,b=sys.argv[1:]; s=open(p).read(); assert s.count(a)==1, "trecho não encontrado: "+a; open(p,"w").write(s.replace(a,b))' "$arq" "$de" "$para"; then
    mv "$arq.bak" "$arq"; echo "ERRO ao aplicar: $nome"; sobreviventes=$((sobreviventes+1)); return
  fi
  if deno test -A --no-check --config scripts/testes-recibo-legal/deno.json "$TESTE" >/dev/null 2>&1; then
    echo "SOBREVIVEU: $nome"; sobreviventes=$((sobreviventes+1))
  else
    echo "pego:       $nome"
  fi
  mv "$arq.bak" "$arq"
}

mutar "fuso do aparelho em vez de Brasília" "$DATAS" "  timeZone: FUSO_BRASILIA," ""
mutar "hora sempre, mesmo em compra retroativa" "$DATAS" "if (cadastro && cadastro.ano === ano && cadastro.mes === mes && cadastro.dia === dia)" "if (cadastro)"
mutar "data_compra convertida por fuso (new Date)" "$DATAS" "  const [, ano, mes, dia] = m;" "  const { ano, mes, dia } = partesBrasilia(dataCompra)!;"
mutar "sem created_at volta a sair 00:00" "$DATAS" "  return data;" '  return `${data} às 00:00`;'
mutar "compara só o dia, não o mês" "$DATAS" "cadastro.ano === ano && cadastro.mes === mes && cadastro.dia === dia" "cadastro.dia === dia"
mutar "compara dia e mês, não o ano" "$DATAS" "cadastro.ano === ano && cadastro.mes === mes && cadastro.dia === dia" "cadastro.mes === mes && cadastro.dia === dia"
mutar "assinatura sem segundos" "$DATAS" "dataHoraBrasiliaRecibo(dataAssinatura, true)" "dataHoraBrasiliaRecibo(dataAssinatura)"
mutar "relógio de 12 h (sem h23)" "$DATAS" '  hourCycle: "h23",' '  hour12: true,'
mutar "após cadastrar ignora a data gravada" "$DATAS" "gravada.assinatura_vendedor_data || agoraISO" "agoraISO"
mutar "gerador usa data_compra no lugar de created_at" "$GERADOR" "dados.compra.data_compra, dados.compra.created_at, agoraISO" "dados.compra.data_compra, dados.compra.data_compra, agoraISO"
mutar "gerador ignora a data gravada da assinatura" "$GERADOR" "textoDataAssinaturaRecibo(dados.compra.assinatura_cliente_data, agoraISO)" "textoDataAssinaturaRecibo(undefined, agoraISO)"
mutar "gerador volta ao formatador antigo (fuso do aparelho)" "$GERADOR" "const dataCompra = textoDataCompraRecibo(dados.compra.data_compra, dados.compra.created_at, agoraISO);" "const dataCompra = new Date(dados.compra.data_compra + 'T00:00').toLocaleDateString('pt-BR') + ' às 00:00';"

[ "$(cat "$DATAS" "$GERADOR" | shasum)" = "$antes" ] || { echo "ARQUIVO NÃO RESTAURADO"; exit 2; }
echo "sobreviventes: $sobreviventes"
[ "$sobreviventes" -eq 0 ]
