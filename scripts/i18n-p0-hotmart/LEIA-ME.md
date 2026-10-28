# i18n P0: Hotmart, cadastro `?intl=1` e telefone do n8n

## ⚠️ Banco: só à mão no SQL Editor. NUNCA `supabase db push`

O histórico `supabase_migrations.schema_migrations` da produção para em
`20260606000001` (lido em 2026-10-28). Tudo o que veio depois foi aplicado à mão
no SQL Editor e não está registrado ali. Um `supabase db push` tentaria
reaplicar todas essas migrations de uma vez.

## Arquivos

| Arquivo | Para quê |
|---|---|
| `supabase/migrations/20261101120000_hotmart_transaction_id.sql` | Coluna `assinaturas.hotmart_transaction_id`, índice único parcial e os 2 tipos novos no CHECK de `admin_notifications` |
| `verificacao.sql` | Conferência depois da migration: 7 linhas, todas `ok = true` |
| `rollback.sql` | Reversão com guardas (aborta se já houver transação Hotmart gravada ou aviso com tipo novo) |
| `teste-pglite.mjs` | Teste local da migration, da verificação e da reversão |
| `cadastro-main-x-branch.mjs` | Playwright: pedido de signUp da main × branch |

## Ordem

1. SQL Editor: a migration (termina com `HOT OK`), depois `verificacao.sql`.
2. Secret `HOTMART_OFFER_MAP` nas Edge Functions (JSON `{"codigo_da_oferta":"plano"}`).
3. `supabase functions deploy hotmart-webhook --no-verify-jwt`
4. `supabase functions deploy webhook-n8n-cadastro --no-verify-jwt`
5. Front (cadastro `?intl=1` e rótulos dos avisos) pelo push na main.

## Avisos ao admin (`admin_notifications.tipo`)

O CHECK da produção aceita só `novo_trial`, `nova_assinatura`, `cancelamento`,
`pagamento_falhou` e `push_enviado`; a migration acrescenta
`hotmart_oferta_nao_mapeada` e `hotmart_config_invalida`. As Edge Functions
gravam outros 17 tipos (ex.: `nova_assinatura_hotmart`, `cancelamento_ticto`,
`mudanca_plano`, `falha_cartao_ignorada`) que esse CHECK recusa: esses avisos
não são gravados hoje. Fora do escopo da P0; fica registrado.

No `hotmart-webhook`, todo aviso passa por `registrarAviso` (`avisos.ts`): se o
banco recusar ou a rede falhar, só sai uma linha `Aviso ao admin não gravado`
no log (tipo e motivo, sem e-mail), e a resposta HTTP e o fluxo não mudam.
