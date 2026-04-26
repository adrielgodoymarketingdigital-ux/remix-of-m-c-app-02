import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.80.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function sha256Hash(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(value.trim().toLowerCase());
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const META_PIXEL_ID = Deno.env.get("META_PIXEL_ID");
    const META_ACCESS_TOKEN = Deno.env.get("META_ACCESS_TOKEN");

    if (!META_PIXEL_ID || !META_ACCESS_TOKEN) {
      console.error("[Meta CAPI] Missing META_PIXEL_ID or META_ACCESS_TOKEN");
      return new Response(
        JSON.stringify({ error: "Meta CAPI not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const {
      event_name,
      event_id,
      email,
      fbp,
      fbc,
      client_user_agent,
      custom_data,
    } = body;

    if (!event_name || !event_id) {
      return new Response(
        JSON.stringify({ error: "event_name and event_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get client IP from request headers
    const client_ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-real-ip") ||
      "unknown";

    // Build user_data
    const user_data: Record<string, unknown> = {};

    if (email) {
      user_data.em = [await sha256Hash(email)];
    }
    if (fbp) user_data.fbp = fbp;
    if (fbc) user_data.fbc = fbc;
    if (client_ip && client_ip !== "unknown") {
      user_data.client_ip_address = client_ip;
    }
    if (client_user_agent) {
      user_data.client_user_agent = client_user_agent;
    }

    const event_time = Math.floor(Date.now() / 1000);

    const payload = {
      data: [
        {
          event_name,
          event_time,
          event_id,
          action_source: "website",
          user_data,
          custom_data: custom_data || {},
        },
      ],
    };

    console.log("[Meta CAPI] Sending event:", JSON.stringify({
      event_name,
      event_id,
      event_time,
      has_email: !!email,
      has_fbp: !!fbp,
      has_fbc: !!fbc,
      has_ip: client_ip !== "unknown",
      custom_data,
    }));

    const metaUrl = `https://graph.facebook.com/v18.0/${META_PIXEL_ID}/events?access_token=${META_ACCESS_TOKEN}`;

    const metaResponse = await fetch(metaUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const metaResult = await metaResponse.json();

    if (!metaResponse.ok) {
      console.error("[Meta CAPI] Error response:", JSON.stringify(metaResult));
      return new Response(
        JSON.stringify({ success: false, error: metaResult }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[Meta CAPI] Success:", JSON.stringify(metaResult));

    return new Response(
      JSON.stringify({ success: true, meta_response: metaResult }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[Meta CAPI] Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
