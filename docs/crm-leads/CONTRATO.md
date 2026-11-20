# CRM de leads do WhatsApp — contrato n8n → MecApp (fase 1)

Fase 1 = captura das conversas, ligação com o cadastro, opt-out, retenção e
relatório. Follow-up e envio de mensagens são da fase 3 e **não existem** nesta
função. Números de exemplo são fictícios.

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
- Limites: corpo de até 512 KB e até **200 itens por lote**.
- A chave da Evolution e a da IA ficam só nas credenciais do n8n. Esta função
  não envia WhatsApp nem chama IA.

## 2. Respostas

| HTTP | corpo | o que o n8n faz |
|---|---|---|
| 200 | `{ok:true, ...}` (pode trazer `rejeitadas` por item) | segue; registra as rejeitadas |
| 400 | `{erro: "json_invalido" \| "acao_invalida" \| "itens_vazios" \| "dias_invalido" \| "dia_invalido"}` | **não** repetir; corrigir o workflow |
| 401 | `{erro:"nao_autorizado"}` | não repetir; conferir a credencial |
| 405 | `{erro:"metodo_invalido"}` | usar POST |
| 413 | `{erro:"lote_grande", max_itens:200}` ou `{erro:"corpo_grande", max_bytes:524288}` | dividir o lote |
| 500 | `{erro:"interno", codigo:"<código do Postgres>"}` | repetir até 3x (30 s, 2 min, 10 min) |
| 503 | `{erro:"nao_configurado"}` | secret ausente: avisar o admin |

Repetir é seguro. A captura deduplica por pessoa + `wa_message_id`, e opt-out,
vínculo e retenção podem ser chamados de novo sem efeito duplicado.

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

## 6. Privacidade

- Só admin lê (RLS + `has_role`), e a lista mostra o telefone mascarado.
- Até 30 mensagens por pessoa. Mensagens e resumo são apagados 90 dias após o último contato.
- O opt-out fica guardado para sempre, para poder ser respeitado.
- Texto sugerido para a política de privacidade:
  > "Quando você nos chama no WhatsApp, guardamos seu número, nome de perfil, o anúncio que originou a conversa e até as 30 últimas mensagens, para responder e medir nossos anúncios. As mensagens são apagadas 90 dias após o último contato. Responda PARAR a qualquer momento e não enviaremos mais mensagens; seu número fica registrado apenas para respeitar esse pedido."
