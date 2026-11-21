# Pendências — Minhas garantias

## Fase B: venda com garantia mas SEM o texto congelado

**Quando acontece:** na venda de um aparelho com o seletor novo (fase B, hoje só
admin), o PDV grava primeiro o texto do termo em `garantias_textos_venda`. Se essa
gravação falhar (rede, RLS, banco fora), a venda **não é perdida**: as linhas de
`vendas` são gravadas com `garantia_id`, `garantia_nome` e `garantia_meses`, mas
com `garantia_texto_id` **nulo**. O PDV mostra o aviso "Garantia salva sem o texto
do termo; ele poderá ser regerado." e registra o erro no console
(`[garantias] texto congelado não gravado`).

**Como achar essas vendas (só leitura):**

```sql
SELECT id, user_id, grupo_venda, garantia_id, garantia_nome, garantia_meses, data
FROM public.vendas
WHERE tipo = 'dispositivo'
  AND garantia_meses > 0
  AND garantia_texto_id IS NULL
  AND garantia_nome IS NOT NULL
  AND data >= now() - interval '30 days'
ORDER BY data DESC;
```

**O que falta decidir (fase C):** como "regerar" o texto dessas vendas. Opções:
1. pelo `garantia_id`, se a garantia ainda existir e não tiver sido editada depois
   da venda (comparar `garantias_loja.updated_at` com `vendas.data`);
2. pelo texto padrão da lib para `garantia_meses` (quando a garantia era
   virtual/personalizada ou foi editada/apagada);
3. deixar a reimpressão usar o termo antigo (caminho de hoje) para essas vendas.

Até a fase C nada lê `garantia_texto_id`: os recibos continuam pelo caminho antigo
(`tempo_garantia`), que segue sendo gravado.

## Fase B: recibo logo depois da venda ainda usa o termo antigo

Na fase B o recibo do PDV (DialogReciboPDV) não mudou: para quem usa o seletor
novo, o termo impresso na hora ainda vem do caminho antigo (config da loja +
`tempo_garantia`), não do texto congelado. O texto congelado só passa a ser
usado na fase C (recibos e reimpressões).

## Fase B: "Sem garantia" não congela texto

Por decisão da fase B, `garantia_meses = 0` grava sem texto congelado, mesmo que
a garantia "Sem garantia" da loja tenha um texto (o termo de venda sem garantia).
Na fase C, decidir se o recibo dessas vendas usa o texto da garantia (pelo
`garantia_id`) ou o termo "sem garantia" de hoje.
