# Pendências — desconto no caixa

Trilha `fix/caixa-desconto` (2026-11-16). A correção fica no **cálculo do caixa**:
`vendas.total` continua BRUTO na gravação do PDV, e o desconto
(`valor_desconto_manual`/`valor_desconto_cupom`) é abatido da 1ª forma em
`agruparVendasPorFormaPagamento` (`src/lib/formaPagamento.ts`, Fase 1).

Os itens abaixo ficam FORA da trilha principal e precisam de decisão própria.

## (a) Pagamento duplo com 2+ itens pode somar a 2ª forma N vezes — a confirmar em dados

- `src/pages/PDV.tsx:691`: `valor_segunda_forma: segundaPorItem?.[idxItem] ?? valorSegundaPagamento`.
- Sem troca, `calcularPlanoTroca` devolve `null` → `segundaPorItem` é `null` → **cada
  linha principal** recebe o V inteiro.
- O agrupador soma `valor_segunda_forma` de cada linha principal: com 2 itens, a 2ª
  forma entra 2×V no caixa, e a 1ª forma de cada item vira `max(0, item − V)`.
- As linhas auxiliares (`pagamento_duplo_secundario`) gravam `item × (V ÷ total líquido)`;
  com desconto, a soma delas passa de V (`rateioSegundaForma.ts` já comenta isso).
- Confirmar com a consulta do diagnóstico (colunas `v2_informado` × `v2_somado_pelo_caixa`)
  antes de mexer. Correção (gravação ou leitura) e dados antigos = trilha separada.

## (b) Conta a receber gravada com o total bruto

- `src/pages/PDV.tsx:722-724`: sem troca e sem duplo, `valorBaseConta = vendaData.total`
  (bruto do item / parcela), sem abater `valor_desconto_manual`.
- Venda "a receber" com desconto gera conta maior do que o cliente deve.
- Com troca já usa `valoresContaReceberComTroca` (com desconto). Trilha separada.

## (c) `valor_desconto_cupom` nunca é gravado em `src/`

- O PDV manda `descontoCupom: 0` para o recibo (`PDV.tsx:965`) e não grava a coluna.
- Várias telas a leem (Vendas, Dispositivos vendidos, Inadimplentes, Extrato SQL,
  recibo). O agrupador do caixa passa a ler também, para ficar coerente se um dia
  for gravada. Nada a fazer agora; registrar se cupom voltar a existir.

## (d) "Alterar data da venda" usa o mesmo agrupador

- `src/lib/vendas/alterarDataVenda.ts:252` (`COLUNAS_LINHA`) não pede as colunas de
  desconto; o ajuste de caixas fechados usa `agruparVendasPorFormaPagamento`.
- Se só esse fluxo passar a usar o líquido antes de os caixas antigos serem corrigidos,
  mover uma venda antiga tira o LÍQUIDO de um caixa que somou o BRUTO e sobra o
  desconto como resíduo (e vice-versa).
- Portanto as fases "telas" (Fase 2) e "dados antigos" (Fase 3) precisam andar juntas
  para esse fluxo — ou `COLUNAS_LINHA` só ganha as colunas de desconto quando a
  migration de dados estiver aplicada.

## (e) Vendas por funcionário (prévia do fechamento) usam `vendas.total` puro

- `src/components/pdv/DialogFechamentoCaixa.tsx:~163`: `const valor = Number(venda.total) || 0;`
  — sem desconto e sem troca.
- Fase 1 deixou pronta `valorLiquidoVenda` (total − desconto, nunca negativo).
  Decidir na Fase 2 se a troca também sai desse número (hoje não sai).

## (f) Observação: edição de venda ajusta caixa fechado pela diferença do bruto

- `src/hooks/useVendas.ts:~1063-1155`: ao editar o `total` de uma venda, soma a
  diferença (bruto novo − bruto antigo) nos totais do caixa fechado e no `saldo_final`
  (se dinheiro). Coerente com as duas bases enquanto o desconto não for editado.
  Conferir na Fase 2 se a edição pode mudar o desconto.
