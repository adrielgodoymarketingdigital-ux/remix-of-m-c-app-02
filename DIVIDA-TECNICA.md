# Dívida Técnica — Méc App

Itens conhecidos, não corrigidos de propósito (risco baixo o suficiente pra
adiar, ou correção arriscada demais pra fazer junto de outra coisa).

## Fuso horário — `useRelatorios.ts` depende do fuso do navegador

**Contexto:** investigação de 2026-09-28 sobre vendas/OS lançadas entre 21h e
meia-noite (Brasília) aparecendo no dia errado em Financeiro → Relatórios.
Causa raiz: comparar uma string de data pura (`"YYYY-MM-DD"`, sem hora/fuso)
direto contra uma coluna `timestamptz` faz o Postgres interpretar a meia-noite
na timezone da SESSÃO do banco — UTC no Supabase — 3h adiantada em relação à
meia-noite de Brasília.

**Corrigido nesta entrega** (usando o novo `limitesDiaBrasilia()` de
`src/lib/dataBrasilia.ts`):
- `src/components/financeiro/SecaoVendasPorFormaPagamento.tsx`
- `src/components/financeiro/SecaoLucratividadePorServico.tsx`
- `src/hooks/useRelatoriosVendas.ts` (dispositivos, produtos, fallback de
  serviços sem `data_caixa`)

**NÃO corrigido nesta entrega — `src/hooks/useRelatorios.ts`**
(`calcularResumo`, `calcularLucroPorItem`, `calcularEvolucaoMensal` — usados
em Financeiro → Análise de Lucros e Custos e na página Relatórios):

- Hoje funciona por um caminho diferente e mais defensivo: busca "alargada"
  em ±1 dia no banco (`getFinancialQueryDateBounds`, em
  `src/lib/vendasFinanceiras.ts`) + reconstrução precisa do dia em
  JavaScript (`isVendaInOptionalFinancialPeriod` / `getDateKeyFromValue`),
  usando `new Date(...).getFullYear()/getMonth()/getDate()` — getters LOCAIS
  do navegador, não forçando `America/Sao_Paulo` como `dataBrasilia.ts` faz.
- **Isso é internamente consistente e funciona corretamente enquanto o fuso
  configurado no SO/navegador de quem está vendo a tela for Brasília** (caso
  comum pra uma loja no Brasil) — mas não é robusto: quebra se o navegador
  estiver com fuso diferente ou mal configurado, e é uma classe de bug
  diferente da que foi corrigida aqui (não é o cast do Postgres, é o
  navegador reinterpretando o instante).
- **Por que não migrar agora:** esse hook concentra o cálculo de lucro
  (receita líquida, custo confirmado/não confirmado, parcelas, pagamento
  duplo, comissões) — já passou por muitas correções sensíveis. Trocar a
  lógica de data aqui arrisca mudar resultado de lucro sem a superfície de
  teste necessária pra validar com segurança. Fica pendente pra uma entrega
  dedicada, migrando pro mesmo `limitesDiaBrasilia()`.
- **Risco prático:** baixo pra a maioria das lojas (navegador normalmente
  configurado corretamente pro fuso do Brasil), mas não é garantido.

## `dataLocalHoje()` no PDV.tsx — nome corrigido, mas há uso arriscado remanescente

Renomeado pra `agoraISO()` em 2026-09-28 (nome antigo sugeria "data local em
YYYY-MM-DD", mas a função sempre devolveu `new Date().toISOString()` — um
timestamp UTC completo). O comportamento não mudou.

Esse valor é usado tanto pra `vendas.data` (timestamptz — correto, o
Postgres guarda o instante exato) quanto pra `contas.data` (columns `date`
puro, em 3 pontos: contas a receber de venda a prazo, primeira e segunda
forma de pagamento, e taxa de cartão). **Nesse segundo caso ainda existe o
mesmo risco de deslocamento de 3h**: uma venda a prazo fechada entre 21h e
meia-noite de Brasília grava a conta a receber com a data do dia UTC
seguinte (um dia adiantada). Não corrigido nesta entrega — precisa de
`dataBrasiliaISO()` (já existe em `src/lib/dataBrasilia.ts`) no lugar de
`agoraISO()` nesses 3 pontos específicos.
