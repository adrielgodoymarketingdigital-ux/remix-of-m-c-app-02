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

Na ordem inversa (se a 1D estiver aplicada, `rollback-1d.sql` antes de tudo; depois, se a 1C estiver aplicada, `rollback-1c-direcao.sql`):
1. `scripts/crm-leads/rollback-3-funil-admin.sql`: tira o funil e o gasto. Tabelas e dados ficam.
2. `scripts/crm-leads/rollback-2-gravacao.sql`: tira as funções da Edge Function, que passa a dar 500. **Pausar o n8n antes.**
3. `scripts/crm-leads/rollback-1-estrutura.sql`: **apaga** leads, mensagens, gasto informado **e a lista de opt-out**. Recusa se houver dados; para forçar, exporte antes e troque `'NAO'` por `'SIM'` na linha marcada.

## Fase 1C: só conta quem escreveu primeiro

Migration `supabase/migrations/20261121130000_crm_leads_1c_direcao_primeiro_contato.sql`:
- coluna `crm_leads.primeiro_contato_direcao`, com backfill a partir das mensagens guardadas;
- a ingestão passa a gravar essa coluna;
- o funil e o funil por anúncio só contam `entrada`, com as mesmas colunas de retorno;
- função nova `admin_crm_funil_excluidos`.

**Primeiro o SQL, depois o código.** O card publicado antes do SQL esconde
sozinho a linha "Fora do funil" (a função nova ainda não existe). O card
antigo continua funcionando com o SQL novo: nenhuma coluna de retorno mudou.

| # | Arquivo | Grava? | Depois, conferir |
|---|---------|--------|------------------|
| 1 | `scripts/crm-leads/1c-0-conferir-producao.sql` | não | 10 linhas `ok = true`. **Se 4, 5 ou 6 der false, pare e me mande**: a função em produção não é a do repositório. Anotar a linha 9 |
| 2 | `supabase/migrations/20261121130000_crm_leads_1c_direcao_primeiro_contato.sql` | 1 coluna nova + backfill nela + 3 funções trocadas + 1 nova | `scripts/crm-leads/1c-1-verificar.sql`: 9 linhas `ok = true`; anotar a linha 9 |
| 3 | publicar o código do card (push da branch da 1C) | — | `/admin/marketing`: a linha "Fora do funil" aparece |

- A migration trava `crm_leads` por um instante (`ADD COLUMN`) e segura a
  trava até o `COMMIT`. O backfill é só um UPDATE em poucos milhares de
  linhas. Com `lock_timeout = '3s'`, se a tabela estiver ocupada nada é
  feito: rode de novo. Para ter certeza de que nenhum lead novo fica como
  "desconhecido" nesse meio segundo, dá para pausar a captura do n8n durante
  a aplicação (opcional).
- Rodar a migration de novo não muda nada: o backfill só preenche quem
  ainda está vazio.
- Lead "desconhecido" (`NULL`) é aquele cuja 1ª mensagem não está guardada:
  foi cortada pelo limite de 30 por lead ou pela retenção de 90 dias, ou é
  um opt-out registrado antes de qualquer conversa. Ele fica fora do funil
  e aparece na linha "Fora do funil".

Rollback (**NÃO RODE, só em emergência**):
`scripts/crm-leads/rollback-1c-direcao.sql`.
- Devolve as 3 funções às versões da fase 1, apaga a função nova e a coluna.
- **Perde a coluna.** Ao reaplicar, o backfill recupera só quem ainda tem a
  1ª mensagem guardada.
- Na ordem geral dos rollbacks, ele vem **antes** do rollback-3.

Prova: `PGLITE_DIR=/tmp/pg node scripts/crm-leads/teste-pglite-1c.mjs --mutantes`

## Fase 1D: o degrau "teste" lê o teste certo

O funil contava teste só por `assinaturas.trial_started_at`, que só as
funções de admin preenchem. Quem se cadastra sozinho ganha 14 dias no plano
free, com `free_trial_ends_at` (e `trial_canceled`). Por isso o card
mostrava "Iniciaram teste = 0".

Migration `supabase/migrations/20261121140000_crm_leads_1d_teste.sql`:
- `admin_crm_funil` e `admin_crm_funil_por_anuncio`: mesmos parâmetros e
  colunas de retorno; `testes` passa a contar `trial_started_at` **ou**
  `free_trial_ends_at`. É 1 linha a mais em cada função (marcada `-- 1D`);
  o resto é cópia exata da 1C;
- função nova `admin_crm_funil_teste`, só admin, só contagens: em teste
  agora, teste acabou sem pagar, teste cancelado, assinantes.
- Não cria nem altera tabela. Não mexe em `_crm_pagantes`,
  `admin_mkt_origens`, ingestão nem n8n.

**Depende da 1C aplicada.** Primeiro o SQL, depois o código. Se o código
for publicado antes do SQL, o card continua igual à 1C ("Iniciaram teste"),
sem aviso nem erro.

Um arquivo por vez, no SQL Editor:

| # | Arquivo | Grava? | Depois, conferir |
|---|---------|--------|------------------|
| 1 | `scripts/crm-leads/1d-0-conferir-producao.sql` | não | 9 linhas `ok = true`. **Se 1, 2 ou 3 der false, pare e me mande**: a 1C não está aplicada ou a função em produção não é a do repositório. Anotar a linha 9 |
| 2 | `supabase/migrations/20261121140000_crm_leads_1d_teste.sql` | 2 funções trocadas + 1 nova (nenhuma tabela) | `scripts/crm-leads/1d-1-verificar.sql`: 7 linhas `ok = true`; a linha 7 deve bater com a 9 da conferência (`com teste` = `com teste depois da 1D`) |
| 3 | publicar o código do card (push da branch da 1D) | — | `/admin/marketing`: aparecem "Em teste agora" e "Teste acabou sem pagar" |

- A migration só troca funções: nenhuma trava de tabela. Com
  `lock_timeout = '3s'`, se alguém estiver usando o funil no instante,
  nada é feito: rode de novo.
- Rodar de novo não muda nada.
- As contagens novas podem se sobrepor: quem cancelou e já passou do prazo
  conta em "cancelado" e em "acabou sem pagar". O card mostra os cancelados
  só como detalhe.
- "Em teste agora" e "acabou sem pagar" olham só `free_trial_ends_at`. O
  teste liberado pelo admin (`trial_started_at`) entra em `testes` (o total),
  mas não nessas duas.

Rollback (**NÃO RODE, só em emergência**): `scripts/crm-leads/rollback-1d.sql`.
- Devolve as 2 funções à versão da 1C e apaga a função nova. Não perde dado.
- Na ordem geral dos rollbacks, ele vem **antes** do `rollback-1c-direcao.sql`.

Provas:
```sh
PGLITE_DIR=/tmp/pg node scripts/crm-leads/teste-pglite-1d.mjs --mutantes        # SQL: suíte + 17 mutantes
deno test --no-check --allow-read scripts/testes-crm-leads/                     # card
deno run --allow-read --allow-write --allow-run --allow-env scripts/testes-crm-leads/mutantes-1d.ts   # 13 mutantes do card
```

## Fase 2A: gasto da Meta por anúncio, automático (n8n)

O n8n manda o gasto diário da Meta **por anúncio** (Insights nível ad) para a
Edge Function `crm-leads`, ação `gasto_meta` (contrato em
`docs/crm-leads/CONTRATO.md`, 4.7). O card do `/admin/marketing` passa a
usar esse gasto no lugar do informado à mão.

Migration `supabase/migrations/20261122120000_crm_leads_2a_gasto_meta_anuncio.sql`
(**aditiva**):
- tabela nova `crm_gasto_meta_anuncio`, com chave `(ad_id, data)`. Guarda
  gasto, impressões, cliques, conversas contadas pela Meta, moeda,
  `campaign_id` (só informativo) e `atualizado_em`. RLS ligada, sem política
  e sem privilégio para anon/authenticated: só as funções leem e gravam;
- `crm_gravar_gasto_meta` (só service_role, usada pela Edge Function);
- `admin_crm_funil_gasto` e `admin_crm_funil_gasto_por_anuncio` (só admin);
- **não** reescreve `admin_crm_funil`, `admin_crm_funil_por_anuncio` nem
  `admin_crm_funil_teste`, e não usa `meta_ads_insights_dia` nem
  `crm_campanhas_whatsapp`. Não toca `_zerar_catalogo` (a tabela não tem dono).

Regra: em cada anúncio e dia com linha automática (inclusive gasto 0), vale
o automático; o informado do mesmo anúncio e dia é ignorado; o informado
**geral** é ignorado em todo dia que tiver qualquer linha automática. Nunca
se somam os dois.

**Depende da 1D aplicada.** Ordem: SQL → Edge Function → código → n8n.
Se o código for publicado antes do SQL, o card fica igual ao de hoje, sem
aviso nem erro. Com o SQL e sem nenhuma sincronização, o card mostra o
gasto informado como hoje.

Um arquivo por vez:

| # | O quê | Grava? | Depois, conferir |
|---|-------|--------|------------------|
| 1 | `scripts/crm-leads/2a-0-conferir-producao.sql` (SQL Editor) | não | 8 linhas `ok = true`. **Se 1, 2 ou 3 der false, pare e me mande** (as funções da 1D em produção não são as do repositório). Anotar as linhas 7 e 8 (a 8 deve ser `America/Sao_Paulo` ou `(sem linha)`) |
| 2 | `supabase/migrations/20261122120000_crm_leads_2a_gasto_meta_anuncio.sql` (SQL Editor) | 1 tabela nova + 3 funções novas | `scripts/crm-leads/2a-1-verificar.sql`: 9 linhas `ok = true`; a 9 deve dizer `0 linhas` |
| 3 | publicar a Edge Function (`supabase functions deploy crm-leads --no-verify-jwt`, na branch da 2A) | — | teste abaixo, que **não grava nada** |
| 4 | publicar o código do card (push da branch da 2A) | — | `/admin/marketing`: selo "Gasto informado (sem dado da Meta no período)", custos iguais aos de antes |
| 5 | ligar o workflow "Gasto da Meta por anúncio" no n8n (CONTRATO.md, 5.6) | sim (pelo n8n) | card: "Gasto da Meta por anúncio · N de M dias", "atualizado há X min" e "A Meta contou N conversas" |

Teste do passo 3 (o item é inválido de propósito: volta rejeitado e nada é gravado):
```sh
read -s CRM_N8N_SECRET   # cole o segredo e Enter
curl -s -X POST https://<projeto>.supabase.co/functions/v1/crm-leads \
  -H "x-crm-secret: $CRM_N8N_SECRET" -H 'Content-Type: application/json' \
  -d '{"acao":"gasto_meta","itens":[{"ad_id":"x y","data":"2026-11-20","gasto_centavos":1}]}' ; echo
# esperado: {"ok":true,"recebidos":1,"inseridos":0,"atualizados":0,"rejeitadas":[{"indice":0,"erro":"ad_id_invalido"}]}
unset CRM_N8N_SECRET
```

- A migration cria tabela e funções novas e não trava tabela existente. Com
  `lock_timeout = '3s'`, se algo travar, nada é feito: rode de novo.
- Rodar de novo não muda nada.
- Moeda: só `BRL` entra no custo. Se a conta de anúncios não for em real,
  os números são guardados e ignorados (me avise).

Rollback (**NÃO RODE, só em emergência**): `scripts/crm-leads/rollback-2a.sql`.
- Desligue antes o workflow do n8n.
- Apaga as 3 funções e a tabela, **perdendo o gasto automático gravado**.
  Ao reaplicar, o n8n só repõe os últimos 3 dias, a não ser que se rode o
  workflow com um período maior.
- Não mexe em nada das fases 1, 1C e 1D. Com o código da 2A publicado, o
  card volta sozinho ao gasto informado.
- Na ordem geral dos rollbacks, ele vem **antes** do `rollback-1d.sql`.

Provas:
```sh
PGLITE_DIR=/tmp/pg node scripts/crm-leads/teste-pglite-2a.mjs --mutantes        # SQL: suíte + 24 mutantes (fase 1 + 1C + 1D + 2A)
deno test --no-check --allow-read scripts/testes-crm-leads/                     # card + Edge Function
deno run --allow-read --allow-write --allow-run --allow-env scripts/testes-crm-leads/mutantes-2a.ts   # 25 mutantes (card + Edge)
```

## Feedback: lista de pagantes para a pesquisa (n8n)

O admin dispara no n8n um fluxo que manda a pesquisa de feedback aos
pagantes. O n8n não lê o banco: pede a lista à Edge Function
(`pagantes_contato`) e conta quem recebeu (`contato_registrar`). As regras de
quem entra, a pausa de 120 dias entre campanhas e o formato estão em
`docs/crm-leads/CONTRATO.md` (4.8, 4.9 e 5.7).

A migration `20261122130000_crm_feedback_pagantes.sql` é **aditiva**. Ela cria:
- a tabela `crm_contato_campanha` (campanha, `destinatario_user_id`,
  resultado, `enviado_em`, `atualizado_em`). Não guarda nome, telefone nem
  texto. RLS ligada, sem política, só service_role;
- as funções `crm_pagantes_contato` e `crm_contato_registrar` (SECURITY
  DEFINER, só service_role).

Ela **não altera** tabela nem função existente. Só **usa** `_crm_pagantes`,
`_crm_profile_elegivel`, `crm_normalizar_telefone` e o opt-out de
`crm_leads`; a conferência confere o md5 dessas três funções.

A coluna se chama `destinatario_user_id`, e não `user_id`, de propósito.
Com `user_id`, o "Começar do zero" recusaria todo lojista que já recebeu a
pesquisa (`tabela_nao_classificada`). É o mesmo motivo do `cadastro_user_id`
da fase 1.

Um arquivo por vez:

| # | O quê | Grava? | Depois, conferir |
|---|-------|--------|------------------|
| 1 | `scripts/crm-leads/feedback-0-conferir-producao.sql` (SQL Editor) | não | 9 linhas `ok = true`. **Se 1 a 6 derem false, pare e me mande.** Anotar as linhas 7, 8 e 9 (só contagens) |
| 2 | `supabase/migrations/20261122130000_crm_feedback_pagantes.sql` (SQL Editor) | 1 tabela nova + 2 funções novas | `scripts/crm-leads/feedback-1-verificar.sql`: 10 linhas `ok = true`; a 10 deve dizer `0 / 0 / 0` |
| 3 | publicar a Edge Function (`supabase functions deploy crm-leads --no-verify-jwt`, nesta branch) | — | teste abaixo, que **não grava nada** |
| 4 | `scripts/crm-leads/feedback-0-candidatos-teste.sql` (SQL Editor) | não | até 10 linhas com `user_id` e `dias_assinatura`. Escolher 2 |
| 5 | teste no n8n: o fluxo 5.7 com `"campanha": "feedback_teste"` e `"user_ids": [<os 2>]` | sim (2 linhas) | as 2 mensagens chegaram; `scripts/crm-leads/feedback-2-quem-recebeu.sql` mostra `feedback_teste` com 2 recebidos |
| 6 | campanha de verdade (nome novo, sem `user_ids`) | sim | `feedback-2-quem-recebeu.sql` |

O passo 3 pode vir antes do 1 e do 2: a função publicada responde
`{"erro":"interno","codigo":"PGRST202"}` (função inexistente) às ações novas
até a migration existir. As ações antigas não mudam.

Os 2 do teste entram na pausa: **não** recebem a campanha de verdade pelos
próximos 120 dias, porque já receberam a de teste.

Teste do passo 3 (só lê; use um nome de campanha qualquer):
```sh
read -s CRM_N8N_SECRET   # cole o segredo e Enter
curl -s -X POST https://<projeto>.supabase.co/functions/v1/crm-leads \
  -H "x-crm-secret: $CRM_N8N_SECRET" -H 'Content-Type: application/json' \
  -d '{"acao":"pagantes_contato","campanha":"Errada"}' ; echo
# esperado: {"erro":"campanha_invalida"}
curl -s -X POST https://<projeto>.supabase.co/functions/v1/crm-leads \
  -H "x-crm-secret: $CRM_N8N_SECRET" -H 'Content-Type: application/json' \
  -d '{"acao":"pagantes_contato","campanha":"conferencia","limite":1}' | jq '{total_elegiveis, excluidos_por_pausa, itens: (.itens | length)}'
# esperado: total_elegiveis igual ao último número da linha 7 da conferência (ou um pouco menor:
# a função tira o telefone inteiro quando uma das contas dele tem opt-out); excluidos_por_pausa 0; itens 1
unset CRM_N8N_SECRET
```
(O `jq` mostra só as contagens, sem nome nem telefone na tela.)

Rollback (**NÃO RODE, só em emergência**): `scripts/crm-leads/rollback-feedback.sql`.
- Desligue antes o workflow de feedback do n8n.
- Apaga as 2 funções e a tabela, **perdendo o registro de quem recebeu**. Ao
  reaplicar, a pausa recomeça do zero. Antes, guarde o resultado de
  `feedback-2-quem-recebeu.sql` e não dispare campanha nova até a pausa passar.
- Não mexe em nada das fases 1, 1C, 1D e 2A.

Provas:
```sh
PGLITE_DIR=/tmp/pg node scripts/crm-leads/teste-pglite-feedback.mjs --mutantes   # SQL: suíte + 42 mutantes
deno test --no-check --allow-read scripts/testes-crm-leads/                       # Edge Function (e o resto do CRM)
deno run --allow-read --allow-write --allow-run --allow-env scripts/testes-crm-leads/mutantes-feedback.ts   # 33 mutantes da Edge
```

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
