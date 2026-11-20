# CRM de leads do WhatsApp — fase 1 (captura, funil e custo por assinante)

Tudo só para admin. Nada aqui foi aplicado nem publicado. Contrato com o n8n:
[docs/crm-leads/CONTRATO.md](../../docs/crm-leads/CONTRATO.md).
O que fica para depois: [docs/pendencias-crm-leads.md](../../docs/pendencias-crm-leads.md).

## O que esta fase NÃO toca

- O CRM antigo: `AdminCRM`, `useCRMWhatsApp`, `crm_estagios`, `crm_usuarios`,
  `crm_automacoes`, `crm_configuracoes` e o gatilho `trigger_crm_automacao`.
- As tabelas do Meta Ads (`meta_ads_insights_dia`, `meta_ads_sync`): são só
  lidas.
- Nenhuma tabela existente. Por isso não há constraint `NOT VALID` nem lock
  em tabela do PDV: os 3 SQL só criam objetos novos, e as funções só LEEM
  `profiles`, `assinaturas`, `pagamentos_pix`, `admin_notifications`,
  `loja_funcionarios`, `empresa_usuarios` e `user_roles`.
- `_zerar_catalogo()`: o vínculo se chama `cadastro_user_id`, e não `user_id`,
  para o "Começar do zero" não enxergar a tabela (é dado de marketing do
  MecApp, não do lojista).

## Ordem para aplicar em produção

SQL Editor, **UM arquivo por vez**. Nunca `supabase db push`. Cada SQL já traz
`SET LOCAL lock_timeout = '3s'` e `statement_timeout = '60s'` dentro do
`BEGIN/COMMIT`.

| # | Arquivo | Grava? | Depois, conferir |
|---|---------|--------|------------------|
| 1 | `scripts/crm-leads/0-conferir-producao.sql` | não | 12 linhas `ok = true`; anotar a linha 6 (linhas da Meta, hoje 0) |
| 2 | `supabase/migrations/20261121120000_crm_leads_1_estrutura.sql` | cria 4 tabelas vazias + 2 funções puras | `scripts/crm-leads/1-verificar-estrutura.sql`: 10 linhas `ok = true` |
| 3 | `supabase/migrations/20261121120010_crm_leads_2_gravacao.sql` | cria 8 funções (só service_role) | `scripts/crm-leads/2-verificar-gravacao.sql`: 5 linhas `ok = true` |
| 4 | `supabase/migrations/20261121120020_crm_leads_3_funil_admin.sql` | cria 5 funções (4 do admin) | `scripts/crm-leads/3-verificar-funil-admin.sql`: 4 linhas `ok = true` |

- Erro `canceling statement due to lock timeout`: nada foi criado. Rodar de
  novo (é idempotente).
- Chamar `admin_crm_funil` no SQL Editor **deve** dar "Apenas
  administradores…": lá não há usuário logado. É a prova de que a trava está
  ativa.
- Passos 2 a 4 podem ficar em dias diferentes. A tela (etapa 1B) só funciona
  depois do 4; a Edge Function, depois do 3.

### Rollback: **NÃO RODE, só em emergência**

Na ordem inversa:
1. `scripts/crm-leads/rollback-3-funil-admin.sql`: tira o funil e o gasto. Tabelas e dados ficam.
2. `scripts/crm-leads/rollback-2-gravacao.sql`: tira as funções da Edge Function, que passa a dar 500. **Pausar o n8n antes.**
3. `scripts/crm-leads/rollback-1-estrutura.sql`: **apaga** leads, mensagens, gasto informado **e a lista de opt-out**. Recusa se houver dados; para forçar, exporte antes e troque `'NAO'` por `'SIM'` na linha marcada.

## Edge Function `crm-leads`: o que o Adriel faz

Não foi publicada. Ordem: **depois** do passo 3 acima.

1. **Criar o segredo, sem colá-lo em chat nenhum.** No seu Mac, gere um valor aleatório e copie direto para a área de transferência:
   ```sh
   openssl rand -hex 32 | tr -d '\n' | pbcopy
   ```
2. No painel do Supabase, em **Project Settings → Edge Functions → Secrets → Add new secret**, use o nome `CRM_N8N_SECRET` e cole o valor (Cmd+V).
3. No n8n, em **Credentials → New → Header Auth**, use o nome `x-crm-secret` e cole o **mesmo** valor. Depois, limpe a área de transferência (copie qualquer outra coisa).
4. Publicar, na pasta do projeto com a branch desta fase:
   ```sh
   supabase functions deploy crm-leads --no-verify-jwt
   ```
   O `config.toml` também marca `verify_jwt = false`; o `--no-verify-jwt` garante isso mesmo se o arquivo não for lido.
5. Teste que **não grava nada** (o relatório só lê). Rode no terminal; o `read -s` não mostra o valor:
   ```sh
   read -s CRM_N8N_SECRET   # cole o segredo e Enter
   curl -s -X POST https://<projeto>.supabase.co/functions/v1/crm-leads \
     -H 'Content-Type: application/json' -d '{"acao":"relatorio"}' ; echo     # esperado: {"erro":"nao_autorizado"}
   curl -s -X POST https://<projeto>.supabase.co/functions/v1/crm-leads \
     -H "x-crm-secret: $CRM_N8N_SECRET" -H 'Content-Type: application/json' \
     -d '{"acao":"relatorio"}' ; echo                                         # esperado: {"ok":true,"relatorio":{...zeros...}}
   unset CRM_N8N_SECRET
   ```
6. A primeira mensagem real só depois de confirmar o formato da Evolution
   (CONTRATO.md, "A CONFIRMAR"), com a mensagem de teste do seu celular.

Para desligar em emergência: em Secrets, apague `CRM_N8N_SECRET`. A função
passa a responder 503 e não grava mais nada.

## Provas (nada toca produção; dados fictícios)

```sh
# Migrations no PGlite (Postgres 17 em WebAssembly): suíte + 10 mutantes
mkdir -p /tmp/pg && npm i --prefix /tmp/pg @electric-sql/pglite@0.3.16
PGLITE_DIR=/tmp/pg node scripts/crm-leads/teste-pglite.mjs --mutantes

# Telefone (SQL × app × função, mesma lista), custos, contrato e handler
deno test --no-check --allow-read scripts/testes-crm-leads/
deno check supabase/functions/crm-leads/index.ts

# Tipos e build (comparar com a origin/main)
npx tsc --noEmit -p tsconfig.app.json
npx vite build
```
