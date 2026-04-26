import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PAGARME_API = "https://api.pagar.me/core/v5";

const log = (s: string, d?: unknown) =>
  console.log(`[CANCEL-PAGARME-SUB] ${s}${d ? ` - ${JSON.stringify(d)}` : ""}`);

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } =
      await supabaseClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: assinatura } = await supabaseAdmin
      .from("assinaturas")
      .select("id, pagarme_subscription_id, status, plano_tipo")
      .eq("user_id", userId)
      .maybeSingle();

    if (!assinatura?.pagarme_subscription_id) {
      return new Response(
        JSON.stringify({ error: "Nenhuma assinatura Pagar.me encontrada." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const pagarmeKey = Deno.env.get("PAGARME_SECRET_KEY");
    if (!pagarmeKey) throw new Error("PAGARME_SECRET_KEY não configurada.");
    const pagarmeAuth = `Basic ${btoa(`${pagarmeKey}:`)}`;

    log("Cancelando subscription", {
      subscriptionId: assinatura.pagarme_subscription_id,
    });

    const res = await fetch(
      `${PAGARME_API}/subscriptions/${assinatura.pagarme_subscription_id}`,
      {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: pagarmeAuth,
        },
      }
    );
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      log("Erro Pagar.me", { status: res.status, data });
      throw new Error(
        (data as { message?: string })?.message ||
          "Falha ao cancelar assinatura na Pagar.me."
      );
    }

    // Marca local como canceled. Acesso continua até data_proxima_cobranca
    // (já registrada). O webhook subscription.canceled também atualiza,
    // mas atualizamos aqui para feedback imediato no frontend.
    await supabaseAdmin
      .from("assinaturas")
      .update({
        status: "canceled",
        updated_at: new Date().toISOString(),
      })
      .eq("id", assinatura.id);

    log("Cancelada com sucesso");
    return new Response(
      JSON.stringify({ success: true, status: "canceled" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log("ERRO", { msg });
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});