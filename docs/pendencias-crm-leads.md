# Pendências encontradas na trilha do CRM de leads (só registro)

Nada abaixo foi alterado. Cada item precisa de pedido próprio.

## 1. `webhook-n8n-cadastro`: telefone no log e chamada ao n8n sem segredo
- `supabase/functions/webhook-n8n-cadastro/index.ts` grava no log, a cada cadastro, o objeto `{ nome, telefone, user_id }` **em texto puro** (`console.log("[webhook-n8n-cadastro] Sending to n8n:", …)`) e também a resposta do n8n.
- Chama `https://n8n.appmec.in/webhook/webhookn8n` **sem nenhum segredo** no header. Quem descobrir a URL pode mandar cadastros falsos para o n8n.
- Sugestão: logar só o `user_id` (ou o telefone mascarado) e mandar um header com segredo compartilhado, conferido pelo n8n.
- Ligação com a fase 1: é deste fluxo que o n8n tira `{telefone, user_id}` para a ação `vincular`.

## 2. `meta-capi-event`: Graph API v18.0 e só e-mail
- Usa `https://graph.facebook.com/v18.0/...`, uma versão antiga que a Meta desativa por calendário.
- Envia como dado do usuário só `em` (e-mail com hash), além de `fbc`/`fbp`/IP/user agent. Não manda o telefone com hash (`ph`) nem o `ctwa_clid` das conversas de WhatsApp, o que reduziria a correspondência dos eventos.
- Sugestão: subir a versão e incluir `ph` com hash (o E.164 já normalizado pela fase 1). Mandar eventos de conversa com `ctwa_clid` é para a fase 5.

## 3. Gatilho do CRM antigo em `assinaturas`
- O `trigger_crm_automacao` (migration 20260204200727; não há migration que o remova) roda `AFTER INSERT OR UPDATE OF status, plano_tipo, trial_with_card, trial_end_at, trial_converted, trial_canceled ON assinaturas`. Ele chama `aplicar_automacao_crm` e move registros em `crm_usuarios`/`crm_estagios`, que **nenhuma tela usa**.
- É custo e risco em toda criação de assinatura e em toda troca de status ou plano (inclusive no fluxo de pagamento), sem benefício visível.
- A existência do gatilho em produção não foi conferida (só as tabelas foram).
- O CRM antigo (`AdminCRM.tsx`) também não tem rota nem item no menu desde o commit inicial do remix. O `useCRMWhatsApp` lê todos os profiles e todas as assinaturas a cada 5 s e grava `profiles.crm_stage` direto do navegador.
- A fase 1 não mexe em nada disso.

## 4. Sincronização da Meta por anúncio
- `meta_ads_insights_dia` existe em produção, mas está **vazia**: a Edge Function de sincronização (etapa 2 do Meta Ads) nunca foi feita.
- O cache é **por campanha** (`level=campaign`). O anúncio de WhatsApp informa o **ID do anúncio**, então o custo por anúncio no funil só existe com gasto informado à mão.
- Para usar o gasto da Meta no funil é preciso:
  - criar a sincronização;
  - cadastrar as campanhas de WhatsApp em `crm_campanhas_whatsapp`, hoje só por SQL;
  - para custo por anúncio, sincronizar também `level=ad` (tabela nova).
- Enquanto isso, o card usa o gasto informado pelo admin, mostrando sempre a fonte.

## 5. Observações menores
- Uma conta apagada por inteiro (script de zerar conta) deixa `crm_leads.cadastro_user_id` apontando para um id que não existe mais. É inofensivo: o funil faz LEFT JOIN e a pessoa conta como "conversa" sem cadastro.
- `crm_campanhas_whatsapp` não tem tela: cadastrar campanha é por SQL até a sincronização da Meta existir.
