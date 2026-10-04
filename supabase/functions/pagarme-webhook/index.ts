import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { log } from "./falhaCartaoPix.ts";
import { corsHeaders, processarEvento } from "./processarEvento.ts";
import { verifyPagarmeSignature } from "../_shared/hmac.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Apenas POST é aceito
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const rawBody = await req.text();

    // Valida a assinatura HMAC-SHA256 da Pagar.me (header X-Hub-Signature) só quando
    // o segredo estiver configurado no projeto. Sem ele, segue sem validar (como antes
    // da validação existir) — rejeitar tudo derrubaria a confirmação de pagamentos.
    const webhookSecret = Deno.env.get("PAGARME_WEBHOOK_SECRET");
    if (!webhookSecret) {
      console.warn("PAGARME_WEBHOOK_SECRET ausente: webhook sem validação de assinatura");
    } else {
      const signatureHeader = req.headers.get("x-hub-signature") ?? req.headers.get("X-Hub-Signature");
      const signatureValid = await verifyPagarmeSignature(rawBody, signatureHeader, webhookSecret);
      if (!signatureValid) {
        log("Assinatura HMAC inválida ou ausente");
        return new Response(JSON.stringify({ error: "Invalid signature" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const body = JSON.parse(rawBody);
    const eventType = body?.type;
    const eventId = body?.id;

    // Conta Pagar.me obrigatória: evento sem account.id ou de outra conta é rejeitado
    // (antes, omitir o campo pulava a checagem).
    const pagarmeAccountId = Deno.env.get("PAGARME_ACCOUNT_ID");
    if (pagarmeAccountId) {
      const contaRecebida = body?.account?.id ?? null;
      if (contaRecebida !== pagarmeAccountId) {
        log("Account ID ausente ou inválido", { received: contaRecebida });
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      console.warn("PAGARME_ACCOUNT_ID ausente: conta do evento não conferida");
    }

    log("Evento recebido", { type: eventType, id: eventId, accountId: body?.account?.id ?? null });

    // Cada evento é confirmado na API da Pagar.me antes de alterar qualquer assinatura.
    return await processarEvento(body, supabaseAdmin);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    log("ERRO", { message: msg });
    // Retorna 500 para Pagar.me retentar
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
