# CRM de leads do WhatsApp — contrato n8n → MecApp (fases 1, 2A, pesquisa de feedback e relatório de marketing)

Fase 1 = captura das conversas, ligação com o cadastro, opt-out, retenção e
relatório. Follow-up é da fase 3 e **não existe** nesta função. A pesquisa de
feedback (4.8 e 4.9) só **entrega a lista e registra o resultado**: quem envia
a mensagem é o n8n, pela Evolution. Esta função nunca envia WhatsApp.
O relatório de marketing (4.10) só lê: devolve números agregados prontos.
Números e ids de exemplo são fictícios.

> **A CONFIRMAR antes de montar os workflows:** o formato real do evento da
> Evolution API v2 (onde vêm o número, o número alternativo quando o contato
> chega como `@lid`, o id da mensagem, a data e os dados do anúncio de origem).
> Confirmar com **uma mensagem de teste enviada do celular do Adriel para o
> número da loja, clicando num anúncio de WhatsApp**, e copiar o JSON que
> chegar no n8n (sem colar em chat público). Este documento descreve **o que a
> função espera**; o mapeamento "campo da Evolution → campo daqui" é feito no
> workflow e só depois dessa confirmação.

## 1. Endereço e autenticação

- `POST https://<projeto>.supabase.co/functions/v1/crm-leads`
- Header `x-crm-secret: <segredo>`, igual ao Supabase Secret `CRM_N8N_SECRET`
  (32 caracteres ou mais). No n8n, ele fica numa credencial **Header Auth** e
  nunca no corpo do workflow nem no repositório.
- Também mandar `Content-Type: application/json`.
- `verify_jwt = false`: não usa login nem chave anon. Sem CORS, porque só o
  servidor do n8n chama.
- Limites: corpo de até 512 KB e até **200 itens por lote** (`gasto_meta` e
  `contato_registrar`: até **100**).
- A chave da Evolution e a da IA ficam só nas credenciais do n8n. Esta função
  não envia WhatsApp nem chama IA.

## 2. Respostas

| HTTP | corpo | o que o n8n faz |
|---|---|---|
| 200 | `{ok:true, ...}` (pode trazer `rejeitadas` por item) | segue; registra as rejeitadas |
| 400 | `{erro: "json_invalido" \| "acao_invalida" \| "itens_vazios" \| "dias_invalido" \| "dia_invalido" \| "campanha_invalida" \| "limite_invalido" \| "pausa_dias_invalido" \| "user_ids_invalido"}` ou, em `relatorio_marketing`, um dos erros de período de 4.10 | **não** repetir; corrigir o workflow |
| 401 | `{erro:"nao_autorizado"}` | não repetir; conferir a credencial |
| 405 | `{erro:"metodo_invalido"}` | usar POST |
| 413 | `{erro:"lote_grande", max_itens:200}` (`gasto_meta` e `contato_registrar`: `max_itens:100`) ou `{erro:"corpo_grande", max_bytes:524288}` | dividir o lote |
| 500 | `{erro:"interno", codigo:"<código do Postgres>"}` | repetir até 3x (30 s, 2 min, 10 min) |
| 503 | `{erro:"nao_configurado"}` | secret ausente: avisar o admin |

Repetir é seguro. A captura deduplica por pessoa + `wa_message_id`, e opt-out,
vínculo, retenção e `contato_registrar` podem ser chamados de novo sem efeito
duplicado. `pagantes_contato` só lê.

## 3. Envelope

`{"acao": "<acao>", "itens": [ ... ]}`. Um único `"item": {...}` vale como lote de 1.

## 4. Ações

### 4.1 `mensagens`: captura (entrada e saída)

Cada item é **uma mensagem** de conversa individual. Grupos, status,
reações e confirmações de leitura **não** devem ser enviados; o workflow os
descarta.

```json
{
  "acao": "mensagens",
  "itens": [
    {
      "telefone": "5511990000001",
      "wa_jid": "5511990000001@s.whatsapp.net",
      "nome": "Nome de exibição no WhatsApp",
      "wa_message_id": "ID-FICTICIO-0001",
      "direcao": "entrada",
      "autor": "lead",
      "tipo": "texto",
      "texto": "Oi, vi o anúncio",
      "enviada_em": "2026-11-21T13:05:00Z",
      "referral": {
        "ad_id": "120000000000001",
        "titulo": "Título do anúncio",
        "tipo": "ad",
        "ctwa_clid": "valor-ficticio",
        "url": "https://exemplo.invalid/anuncio"
      }
    }
  ]
}
```

| campo | obrigatório | o que a função espera |
|---|---|---|
| `telefone` | sim | O **número de telefone real** da pessoa: dígitos, com ou sem máscara, `+55…`, ou um endereço `<número>@s.whatsapp.net` / `<número>@c.us`. Vira E.164 (`+5511990000001`), e celular antigo de 8 dígitos ganha o 9. Fora do Brasil, só com `+`. **Endereço `@lid` é recusado** (`telefone_invalido`): ele não é telefone (ver 4.1.1). |
| `wa_jid` | não | O endereço do WhatsApp como veio (até 100 caracteres). É guardado para a fase 3 responder. |
| `nome` | não | Nome de exibição (até 120). Vale o 1º recebido. |
| `wa_message_id` | sim | O id único da mensagem no WhatsApp (de 1 a 128 caracteres). É a chave de deduplicação. |
| `direcao` | sim | `entrada` (pessoa → loja) ou `saida` (loja → pessoa). |
| `autor` | não | `entrada` só aceita `lead`; `saida` aceita `humano` (padrão) ou `automacao`. |
| `tipo` | não | `texto` (padrão), `audio`, `imagem`, `video`, `documento`, `figurinha`, `localizacao`, `contato` ou `outro`. **Mídia nunca é enviada**: em mídia, só a legenda vai em `texto`. |
| `texto` | não | Até 2000 caracteres (cortado). |
| `enviada_em` | sim | Data/hora da mensagem: ISO 8601 ou epoch em segundos/milissegundos. Recusa mais de 10 min no futuro ou mais de 400 dias no passado. |
| `referral` | não | Dados do anúncio de origem, quando vierem: `ad_id` (letras, números, `_ . -`, até 64), `titulo` (200), `tipo` (20), `ctwa_clid` (500), `url` (500). Vale o **1º anúncio** da pessoa. |

#### 4.1.1 Contato `@lid` (obrigatório no workflow)

O WhatsApp pode identificar o contato por um endereço `@lid` que **não
contém o telefone**. Nesse caso **o n8n precisa trazer o número de telefone
real** (do campo de número alternativo que o evento trouxer, ou de uma consulta
à Evolution) e enviá-lo em `telefone`. O `@lid` pode ir em `wa_jid`. Sem
telefone real, a mensagem é rejeitada com `telefone_invalido` e **não** entra
no funil. Qual campo traz o número alternativo está **A CONFIRMAR** com a
mensagem de teste.

Resposta:
```json
{"ok":true,"recebidas":200,"inseridas":187,"duplicadas":12,"opt_outs":1,
 "rejeitadas":[{"indice":44,"erro":"telefone_invalido"}]}
```
Erros por item: `nao_objeto`, `telefone_invalido`, `wa_message_id_invalido`,
`direcao_invalida`, `autor_invalido`, `tipo_invalido`, `data_invalida`,
`ad_id_invalido` e `campo_invalido`.

O que acontece no banco:
- Cria o lead se não existir (1 por telefone).
- Guarda só as **30 últimas** mensagens de cada pessoa.
- Atualiza o último contato e quem falou por último, sem voltar no tempo.
- Guarda **quem mandou a 1ª mensagem** (`direcao` da mensagem mais antiga, mesmo chegando fora de ordem). Desde a fase 1C, **só quem escreveu primeiro (`entrada`) conta como conversa iniciada** no funil. Por isso a `direcao` precisa estar certa também nas mensagens enviadas pela loja: as boas-vindas automáticas e as respostas vão como `saida` (autor `automacao` ou `humano`). Se forem marcadas como `entrada`, quem só recebeu as boas-vindas entra no funil como se tivesse escrito.
- Uma mensagem de entrada que seja **só** "PARAR" (ou pare, para, sair, stop, cancelar…) liga o **opt-out permanente**.

### 4.2 `resumo`
```json
{"acao":"resumo","itens":[{"telefone":"5511990000001","assunto":"preço do plano","resumo":"Quer saber se emite recibo…","etapa":"em_conversa"}]}
```
`assunto` vai até 120 caracteres, `resumo` até 1500, e `etapa` só aceita
`em_conversa`, `esfriou` ou `perdido`. Resposta: `{ok, atualizados,
nao_encontrados, rejeitadas}`. O prompt da IA deve proibir copiar CPF,
e-mail, endereço ou cartão para o resumo.

### 4.3 `vincular`: ligação com o cadastro, no momento em que acontece
O n8n já recebe `{nome, telefone, user_id}` de `webhook-n8n-cadastro` a cada
cadastro. Um ramo novo repassa:
```json
{"acao":"vincular","itens":[{"telefone":"5511990000001","user_id":"00000000-0000-0000-0000-000000000001"}]}
```
Resposta: `{ok, resultados:["vinculado" | "sem_lead" | "profile_inelegivel" | "invalido"]}`.
Funcionário, gerente de filial, admin e demonstração nunca são vinculados.

### 4.4 `vincular_lote`: a cada hora
`{"acao":"vincular_lote","dias":120}` (de 1 a 400; o padrão é 120). Cruza os
leads sem vínculo com `profiles.celular` por DDD e 8 últimos dígitos. Quando
mais de um cadastro bate, o lead fica marcado como **ambíguo** e não é
vinculado. Resposta: `{ok, vinculados, ambiguos_novos}`.

### 4.5 `opt_out`
`{"acao":"opt_out","itens":[{"telefone":"5511990000001"}]}` registra o pedido
mesmo sem conversa anterior. É **irreversível** pelo sistema. Resposta: `{ok,
registrados, rejeitadas}`.

### 4.6 `retencao` e `relatorio`: o relatório diário chama os dois
- `{"acao":"retencao"}` → `{ok, mensagens_apagadas, leads_limpos}`. Apaga as mensagens e o resumo de quem está há mais de 90 dias sem contato. **Sem pg_cron**: só esta chamada faz isso.
- `{"acao":"relatorio","dia":"2026-11-20"}` → `{ok, relatorio:{dia, conversas_novas, vinculados_no_dia, opt_outs_no_dia, vinculos_ambiguos}}`. Só números. Sem `dia`, usa o dia de hoje em Brasília.

### 4.7 `gasto_meta`: gasto da Meta por anúncio e dia (fase 2A)

Um item por **anúncio e dia**, vindo do Insights da Marketing API no nível
de anúncio. Só números e IDs: nada de nome, e-mail ou telefone.

```json
{
  "acao": "gasto_meta",
  "itens": [
    {
      "ad_id": "120000000000001",
      "campaign_id": "120000000000900",
      "data": "2026-11-20",
      "gasto_centavos": 12345,
      "impressoes": 8100,
      "cliques": 140,
      "conversas_meta": 9,
      "moeda": "BRL"
    }
  ]
}
```

| campo | obrigatório | regra |
|---|---|---|
| `ad_id` | sim | texto `^[A-Za-z0-9_.-]{1,64}$` (o `ad_id` do Insights) |
| `campaign_id` | não | mesmo formato; **só informativo** (o banco não filtra por campanha) |
| `data` | sim | `AAAA-MM-DD`, o **dia da conta de anúncios, em America/Sao_Paulo**; de 400 dias atrás até amanhã (Brasília) |
| `gasto_centavos` | sim | inteiro de 0 a 100.000.000 (R$ 1 milhão por anúncio e dia). `spend` da Meta × 100, arredondado |
| `impressoes`, `cliques` | não (0) | inteiros de 0 a 1.000.000.000 (`impressions`, `inline_link_clicks` ou `clicks`) |
| `conversas_meta` | não (0) | inteiro de 0 a 10.000.000: `actions` com `action_type = onsite_conversion.messaging_conversation_started_7d` |
| `moeda` | não (`BRL`) | 3 letras maiúsculas (`account_currency`). Só `BRL` entra no custo; outra moeda é guardada e ignorada |

Resposta: `{ok, recebidos, inseridos, atualizados, rejeitadas:[{indice, erro}]}`.
Erros por item: `nao_objeto`, `ad_id_invalido`, `campaign_id_invalido`,
`data_invalida`, `data_fora_da_janela`, `gasto_invalido`, `impressoes_invalido`,
`cliques_invalido`, `conversas_meta_invalido`, `moeda_invalida`,
`duplicado_no_lote` (o mesmo `ad_id` + `data` duas vezes no lote: vale o 1º).
Os itens bons do mesmo lote gravam.

- **Idempotente.** Gravação por `(ad_id, data)`: reenviar o mesmo dia
  **substitui** os números (conta como `atualizados`). Pode repetir à vontade.
- **Dias com gasto zero DENTRO da janela de 3 dias têm que ser enviados**,
  com `gasto_centavos: 0` (e os outros números em 0). Quando a Meta corrige
  um dia para zero, ela deixa de devolver a linha. Sem o zero, o valor antigo
  fica gravado. O workflow deve montar a lista "anúncios ativos × 3 dias" e
  completar com zero o que a Meta não devolveu.
- **Regra no funil.** Para cada anúncio e dia com linha (inclusive zero), o
  gasto automático vale e o gasto informado à mão do mesmo anúncio e dia é
  ignorado. O gasto informado geral (sem anúncio) é ignorado em todo dia que
  tiver qualquer linha automática. Nunca se somam os dois.
- **"atualizado há X min"**, no card, é a hora da **última sincronização**
  (o último envio que gravou), não a hora em que a Meta fechou os números.
  A Meta atrasa de minutos a horas e recalcula os últimos dias. Por isso a
  janela de 3 dias.

### 4.8 `pagantes_contato`: lista de pagantes para uma campanha (feedback)

```json
{ "acao": "pagantes_contato", "campanha": "feedback_2026_11", "limite": 15, "pausa_dias": 120 }
```

| campo | obrigatório | regra |
|---|---|---|
| `campanha` | sim | `^[a-z0-9_-]{3,40}$` (minúsculas, números, `_` e `-`). Um nome por campanha; o mesmo nome em todos os lotes dela |
| `limite` | não (15) | inteiro de 1 a 50: quantas pessoas neste lote |
| `pausa_dias` | não (120) | inteiro de 30 a 365 |
| `user_ids` | não | **só para teste**: lista de 1 a 10 `user_id`. Restringe a lista a essas contas; todas as regras continuam valendo |

Resposta:
```json
{
  "ok": true,
  "itens": [{ "user_id": "00000000-0000-0000-0000-000000000001", "primeiro_nome": "Maria", "telefone": "+5511990000001" }],
  "total_elegiveis": 37,
  "excluidos_por_pausa": 4
}
```

- `total_elegiveis`: quantas pessoas ainda podem receber nesta campanha (com
  as deste lote). `excluidos_por_pausa`: quantas ficaram de fora **só** pela
  pausa. Os dois são contagens: não identificam ninguém.
- `primeiro_nome`: 1ª palavra de `profiles.nome`, com a 1ª letra maiúscula e
  o resto minúsculo (`JOÃO` vira `João`). Vazio quando não há nome ou quando
  a 1ª palavra não tem letra. O texto da mensagem tem que funcionar com nome
  vazio ("Oi! Tudo bem?" em vez de "Oi, !").
- `telefone`: sempre celular brasileiro, `+55` + DDD + 9 dígitos.

Quem entra (todas as regras):
1. assinatura `active` em plano pago (os 8 planos de `PRECOS_CENTAVOS`),
   dentro do prazo (`data_fim` vazia ou futura);
2. já pagou de verdade (PIX pago, cartão Pagar.me ou notificação de
   assinatura com cobrança) e a conta não foi bloqueada pelo admin. Cortesia
   liberada à mão fica de fora;
3. não é admin, nem conta de teste (plano `demonstracao`/`admin`), nem
   funcionário, nem gerente de filial;
4. `profiles.celular` vira celular brasileiro válido;
5. o telefone não pediu para sair (opt-out do CRM, em `crm_leads`), e a conta
   não está ligada a um lead que pediu;
6. ninguém com esse telefone recebeu (`enviado`) **nesta** campanha;
7. **pausa:** ninguém com esse telefone recebeu (`enviado`) em **qualquer**
   campanha nos últimos `pausa_dias` dias. `falhou` não conta.

Um telefone é uma pessoa. As regras 5 a 7 valem para todas as contas com o
mesmo número, e sai uma conta por número (a de menor `user_id`).

Ordem estável: primeiro quem nunca falhou nesta campanha, depois quem já
falhou; dentro de cada grupo, por `user_id`. Chamar de novo, sem registrar
nada, devolve o **mesmo** lote.

### 4.9 `contato_registrar`: quem recebeu (feedback)

```json
{
  "acao": "contato_registrar",
  "campanha": "feedback_2026_11",
  "itens": [
    { "user_id": "00000000-0000-0000-0000-000000000001", "resultado": "enviado" },
    { "user_id": "00000000-0000-0000-0000-000000000002", "resultado": "falhou" }
  ]
}
```

Até 100 itens. `resultado`: `enviado` (a Evolution aceitou a mensagem) ou
`falhou`. Resposta: `{ok, recebidos, inseridos, atualizados, inalterados,
rejeitadas:[{indice, erro}]}`. Erros por item: `nao_objeto`,
`user_id_invalido`, `resultado_invalido`, `duplicado_no_lote` (vale o 1º),
`usuario_inexistente`. Os itens bons do mesmo lote gravam.

Idempotente por campanha + pessoa:

| já gravado | chega | fica | conta como |
|---|---|---|---|
| nada | `enviado` | `enviado`, hora do envio = agora | `inseridos` |
| nada | `falhou` | `falhou`, sem hora de envio | `inseridos` |
| `falhou` | `enviado` | `enviado`, hora do envio = agora | `atualizados` |
| `falhou` | `falhou` | `falhou` | `atualizados` |
| `enviado` | qualquer um | **nada muda** (nem a hora do envio, para a pausa não esticar) | `inalterados` |

### 4.10 `relatorio_marketing`: relatório semanal e mensal (só leitura)

Devolve os números **prontos** do `/admin/marketing` para um período e para o
período anterior de mesmo tamanho. O n8n **não calcula nada**: só formata e
envia. Não grava nada no banco.

Pedido (sem `itens`):
```json
{ "acao": "relatorio_marketing", "periodo": "semana_anterior" }
{ "acao": "relatorio_marketing", "periodo": "mes_anterior" }
{ "acao": "relatorio_marketing", "periodo": "personalizado", "inicio": "2026-11-01", "fim": "2026-11-15" }
```

Períodos (datas de calendário de **Brasília**, nunca UTC nem o fuso do servidor):

| `periodo` | o que é | exemplo |
|---|---|---|
| `semana_anterior` | a última semana **completa**, segunda a domingo, antes de hoje | rodando na segunda 23/11/2026 → 16/11 a 22/11. No domingo 22/11 → 09/11 a 15/11 (a semana de hoje ainda não acabou) |
| `mes_anterior` | o último mês de calendário completo | rodando em 01/12/2026 → 01/11 a 30/11 |
| `personalizado` | `inicio` e `fim` (YYYY-MM-DD) obrigatórios; `fim` ≥ `inicio`, `fim` ≤ hoje, `fim − inicio` ≤ 400 (mesma regra do card) | |

`periodo_anterior` (migration 20261123130000):
- quando o período é um **mês de calendário inteiro** (`inicio` = dia 1 e
  `fim` = último dia do **mesmo** mês), o anterior é o **mês de calendário
  anterior inteiro**, mesmo com outro número de dias: novembro (01/11–30/11)
  compara com 01/10–31/10; março com 01/02–28/02 (29/02 em ano bissexto);
  janeiro com 01/12–31/12 do ano anterior. Vale para `mes_anterior` e também
  para um `personalizado` que coincida com um mês inteiro (a regra olha as
  datas, não o nome do período);
- em qualquer outro caso (`semana_anterior`, `personalizado`, mês incompleto
  como 01–15), são os **mesmos N dias imediatamente antes**: 01/01–15/01
  compara com 17/12–31/12.

`periodo.dias` é sempre o número de dias do período **atual**; o tamanho do
anterior sai das datas de `periodo_anterior`. Só `cadastros.anterior` e
`funil_whatsapp.anterior` usam o período anterior; gasto, custos e
`por_anuncio` são só do período atual.

Erros 400 (o banco não é chamado): `periodo_invalido`, `datas_obrigatorias`
(personalizado sem as duas datas), `datas_so_no_personalizado` (`inicio`/`fim`
mandados com `semana_anterior` ou `mes_anterior`), `data_invalida`,
`periodo_invertido`, `data_futura`, `periodo_longo`.

Resposta 200 — **só agregados**; nenhum nome, e-mail, telefone ou id de
pessoa. Valores em centavos são inteiros; `null` = "sem como calcular".
Exemplo de `semana_anterior` rodando na segunda 23/11/2026 (números fictícios):
```json
{
  "ok": true,
  "periodo": { "inicio": "2026-11-16", "fim": "2026-11-22", "dias": 7 },
  "periodo_anterior": { "inicio": "2026-11-09", "fim": "2026-11-15" },
  "cadastros": { "total": 42, "com_utm": 30, "vindos_meta": 25,
                 "anterior": { "total": 38, "com_utm": 26, "vindos_meta": 20 } },
  "funil_whatsapp": { "conversas_iniciadas": 120, "cadastros": 18, "em_teste_agora": 15,
                      "teste_acabou_sem_pagar": 2, "assinantes_pagos": 1,
                      "anterior": { "conversas_iniciadas": 101, "cadastros": 15, "em_teste_agora": 9,
                                    "teste_acabou_sem_pagar": 4, "assinantes_pagos": 2 } },
  "gasto": { "total_centavos": 84250, "meta_centavos": 84250, "manual_centavos": 0, "fonte": "automatico",
             "dias_com_gasto_meta": 7, "dias_no_periodo": 7, "atualizado_em": "2026-11-23T10:05:00.000Z" },
  "custos": { "por_conversa_centavos": 702, "por_cadastro_centavos": 4681, "por_assinante_centavos": 84250 },
  "receita_estimada_centavos": 11970,
  "amadurecendo": { "cadastros_em_teste": 16 },
  "por_anuncio": [
    { "ad_id": "120000000000001", "rotulo": "Promo assistência", "conversas": 80, "cadastros": 12, "teste": 12,
      "assinantes": 1, "gasto_centavos": 60000, "custo_por_conversa_centavos": 750 },
    { "ad_id": "120000000000002", "rotulo": "Anúncio 120000000000002", "conversas": 0, "cadastros": 0, "teste": 0,
      "assinantes": 0, "gasto_centavos": 24250, "custo_por_conversa_centavos": null },
    { "ad_id": null, "rotulo": "Sem anúncio (orgânico / link direto)", "conversas": 40, "cadastros": 6, "teste": 6,
      "assinantes": 0, "gasto_centavos": null, "custo_por_conversa_centavos": null }
  ]
}
```
Exemplo de `mes_anterior` rodando em 01/12/2026: mesmo formato, com
`"periodo": {"inicio": "2026-11-01", "fim": "2026-11-30", "dias": 30}` e
`"periodo_anterior": {"inicio": "2026-10-01", "fim": "2026-10-31"}` (outubro
inteiro, 31 dias, contra os 30 de novembro); quando o
mês não tem dado da Meta e tem gasto informado à mão, `"fonte": "manual"`,
`"meta_centavos": 0`, `"dias_com_gasto_meta": 0`; sem gasto nenhum,
`"fonte": "nenhum"`, `"total_centavos": null` e os 3 custos `null`.

Definições — **as mesmas do `/admin/marketing`** (o teste PGlite exige número
idêntico ao do card para os mesmos dados):

| campo | de onde vem (card) | regra |
|---|---|---|
| `cadastros.*` | "Cadastros por dia" | cadastros criados no período, sem funcionário, gerente de filial, admin e demonstração. `com_utm` = com `utm_source`; `vindos_meta` = com `fbclid` ou `utm_source` fb/facebook/ig/instagram/meta |
| `receita_estimada_centavos` | total de "Cadastros e conversão por origem" | só o **1º pagamento** de cada cadastro do período (em qualquer data até hoje): PIX pelo valor exato, cartão pelo **preço cheio** do plano (sem cupom); gateway antigo conta como 0 |
| `funil_whatsapp.conversas_iniciadas` | "Funil do WhatsApp" | 1º contato no período e o cliente escreveu primeiro |
| `funil_whatsapp.cadastros` | idem | cadastro feito a partir de 24 h antes do 1º contato (mais antigo = já era cliente, fica fora) |
| `em_teste_agora` / `teste_acabou_sem_pagar` | degraus da 1D | teste de 14 dias ainda valendo e não cancelado / prazo acabou e não pagou |
| `assinantes_pagos` | idem | cadastro do funil com 1º pagamento (mesma regra de pagante do card por origem) |
| `gasto` | selo de fonte do funil (2A) | `fonte` = `automatico` quando há dado da Meta em algum dia do período, senão `manual` quando há gasto informado, senão `nenhum`. Por anúncio e dia, o automático **vence** o informado (o informado geral some em todo dia com qualquer dado da Meta). `total_centavos` = `meta_centavos` + `manual_centavos` (só o informado que sobrou). `atualizado_em` = última sincronização do n8n |
| `custos.*` | "Custo por …" do funil | `total_centavos ÷ quantidade`, arredondado; `null` quando a quantidade é 0 ou não há gasto |
| `amadurecendo.cadastros_em_teste` | — (só no relatório) | cadastros do funil no período cujo teste de 14 dias **ainda não acabou** (inclui quem cancelou o teste antes do fim). Enquanto for alto, `assinantes_pagos` e o custo por assinante ainda vão mudar |
| `por_anuncio` | tabela por anúncio do funil | todos os anúncios com conversa ou gasto no período, ordenados por `gasto_centavos` (maior primeiro; sem gasto no fim). `ad_id: null` = sem anúncio |

Diferenças do card, de propósito:
- `por_anuncio`: sem dado da Meta no período, um anúncio com gasto informado e
  **sem conversa** entra na lista (no card ele não aparece). As linhas que o
  card mostra são iguais.
- `receita_estimada_centavos` soma todas as origens; o card corta em 500
  combinações de origem (só faz diferença acima disso).

## 5. Workflows do n8n (fase 1)

1. **Captura.** Evento de mensagem da Evolution, recebida e enviada:
   - descartar grupos, status e reações;
   - quando vier `@lid`, buscar o número real (4.1.1);
   - mapear para o item de 4.1;
   - acumular até 50 itens ou 10 s;
   - `POST mensagens`.

   A IA **não** entra aqui.
2. **Resumo** (a cada 30 min): para leads com mensagem nova, a IA gera assunto e resumo, e o workflow faz `POST resumo`.
3. **Ligação com o cadastro:**
   - no fluxo que já recebe `webhook-n8n-cadastro`, `POST vincular`;
   - a cada hora, `POST vincular_lote`.
4. **Opt-out.** A captura já detecta "PARAR". Quando a resposta trouxer `opt_outs > 0`, o n8n responde **uma única vez**: "Pronto, não vamos mais te enviar mensagens. Se precisar, é só chamar." Essa resposta é registrada pela captura como `saida`, autor `automacao`.
5. **Relatório diário** (8h):
   - `POST retencao`;
   - `POST relatorio` com o dia anterior;
   - enviar os números para o WhatsApp do admin. Só números, nunca nome ou telefone.

6. **Gasto da Meta por anúncio** (fase 2A; a cada 1–2 h):
   - `GET /act_<conta>/insights` com `level=ad`, `time_increment=1`,
     `time_range` = de 2 dias atrás até hoje (3 dias, fuso da conta =
     America/Sao_Paulo), `fields=ad_id,campaign_id,spend,impressions,inline_link_clicks,actions,account_currency`;
   - filtro só das campanhas Click-to-WhatsApp escolhidas pelo dono:
     `filtering=[{"field":"campaign.id","operator":"IN","value":[<lista no workflow>]}]`;
   - completar com zero os anúncios ativos dessas campanhas que não voltaram
     num dos 3 dias (4.7);
   - lotes de até 100 itens, `POST gasto_meta`;
   - o token da Meta fica só na credencial do n8n.

7. **Pesquisa de feedback com pagantes** (disparo manual pelo admin):
   - definir a `campanha` (ex.: `feedback_2026_11`) e usar o mesmo nome em
     todos os lotes;
   - `POST pagantes_contato` com `limite` 15;
   - para cada item, enviar a mensagem pela Evolution com **intervalo de 20
     a 60 s** entre uma e outra (envio em massa rápido derruba o número);
   - a mensagem termina com "Se não quiser mais receber, responda PARAR". A
     captura (1) já trata o PARAR, desde que ela esteja ligada no mesmo
     número;
   - **registrar logo depois de cada envio** (ou no fim do lote, antes de
     pedir o próximo): `POST contato_registrar` com `enviado` ou `falhou`.
     Sem o registro, o próximo `pagantes_contato` devolve as **mesmas**
     pessoas e elas recebem de novo;
   - repetir até `itens` vir vazio. **Parar também** quando um lote inteiro
     falhar: quem falha volta no fim da lista e o laço não terminaria nunca;
   - no fim, mandar ao admin só os números: enviados, falhas,
     `total_elegiveis`, `excluidos_por_pausa`.
   - Teste: `user_ids` com os 2 escolhidos (`scripts/crm-leads/feedback-0-candidatos-teste.sql`).

8. **Relatório de marketing** (4.10):
   - semanal: toda segunda às 8h, `POST relatorio_marketing` com `periodo: "semana_anterior"`;
   - mensal: todo dia 1 às 8h, `POST relatorio_marketing` com `periodo: "mes_anterior"`;
   - o agendamento do n8n no fuso America/Sao_Paulo (o período já é
     calculado em Brasília pela função; o fuso do n8n só decide a hora do envio);
   - só formatar os números e enviar ao WhatsApp do Adriel; não somar nem
     dividir nada no n8n. Em 500, repetir como na tabela da seção 2.

## 6. Privacidade

- Só admin lê (RLS + `has_role`), e a lista mostra o telefone mascarado.
- Até 30 mensagens por pessoa. Mensagens e resumo são apagados 90 dias após o último contato.
- O opt-out fica guardado para sempre, para poder ser respeitado.
- Pesquisa de feedback: `crm_contato_campanha` guarda só `user_id`, campanha,
  resultado e datas (nada de nome, telefone ou texto), e só o service_role
  tem acesso. Nome e telefone aparecem apenas na resposta de
  `pagantes_contato`, para quem tem o `x-crm-secret`. Os logs da função levam
  só contagens. A pesquisa vai para quem **já é cliente**. Vale conferir se a
  política de privacidade cobre esse contato (seção 10).
- Texto sugerido para a política de privacidade:
  > "Quando você nos chama no WhatsApp, guardamos seu número, nome de perfil, o anúncio que originou a conversa e até as 30 últimas mensagens, para responder e medir nossos anúncios. As mensagens são apagadas 90 dias após o último contato. Responda PARAR a qualquer momento e não enviaremos mais mensagens; seu número fica registrado apenas para respeitar esse pedido."
