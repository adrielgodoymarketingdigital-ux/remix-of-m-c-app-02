# Técnicos adicionais da OS — F1 (só banco, RASCUNHO)

Nada aqui foi aplicado. Rodar no SQL Editor, **um arquivo por vez**, nesta ordem.
NUNCA `supabase db push`.

| Passo | Arquivo | O que faz |
|---|---|---|
| 0 | `scripts/os-tecnicos-adicionais/0-conferir-antes.sql` | Somente leitura. Esperado: tabela/função não existem, âncora = 1, ordem 12 livre. Mostra as policies em vigor de `ordens_servico`. |
| 1 | `supabase/migrations/20261125120000_os_tecnicos_adicionais.sql` | Tabela + índices + trava (trigger) + RLS + privilégios. |
| 2 | `supabase/migrations/20261125120100_salvar_tecnicos_os.sql` | Função `salvar_tecnicos_os` (SECURITY INVOKER). |
| 3 | `supabase/migrations/20261125120200_zerar_catalogo_os_tecnicos_adicionais.sql` | Remendo do `_zerar_catalogo()` em vigor (+1 linha, ordem 12). |
| 4 | `scripts/os-tecnicos-adicionais/9-verificar.sql` | Somente leitura. Todas as colunas `ok_*` = true. |

As 3 migrations são idempotentes. Nenhuma tabela existente muda; as policies de
`ordens_servico` **não mudam** (ver relatório F1: o RLS da OS é por loja, não
por técnico).

## Rollback — NÃO RODE, só em emergência
Ordem obrigatória: `rollback-3-zerar-catalogo.sql` → `rollback-2-funcao.sql` →
`rollback-1-tabela.sql` (o 1 apaga todos os técnicos adicionais gravados e
recusa se o 3 e o 2 não rodaram antes).

## Prova local (PGlite, em memória, sem rede)
    mkdir -p /tmp/pg && npm i --prefix /tmp/pg @electric-sql/pglite@0.3.16
    PGLITE_DIR=/tmp/pg node scripts/os-tecnicos-adicionais/teste-pglite.mjs

68 verificações: migrations idempotentes, gravação/troca/recusas da função,
funcionário, gerente de filial, outra loja, anon, insert direto pela API,
cascatas, rollbacks (md5 do catálogo volta igual) e remendo sem âncora.
Limite: PGlite tem uma sessão só, então a fila entre duas gravações
simultâneas (FOR UPDATE) não é provada aqui.

## Pendências que NÃO são desta fase
- `backup-diario` (Edge Function): incluir `os_tecnicos_adicionais` na lista,
  deploy só depois do passo 1.
- `src/lib/comecarDoZero/regras.ts`: rótulo "técnico adicional de OS" para a
  prévia do "Começar do zero" (F2).
- Tipos (`src/integrations/supabase/types.ts`) regenerados na F2.
