import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check if called with service role key (internal) or user token
    const authHeader = req.headers.get("Authorization")?.replace("Bearer ", "") || "";
    const isServiceRole = authHeader === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!isServiceRole) {
      // Verify caller is admin user
      const { data: { user: caller } } = await supabaseAdmin.auth.getUser(authHeader);
      if (!caller) {
        return new Response(JSON.stringify({ error: "Não autorizado" }), { status: 401, headers: corsHeaders });
      }
      const { data: isAdmin } = await supabaseAdmin.rpc("has_role", { _user_id: caller.id, _role: "admin" });
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: "Apenas administradores" }), { status: 403, headers: corsHeaders });
      }
    }

    const { user_id, new_password } = await req.json();
    if (!user_id || !new_password) {
      return new Response(JSON.stringify({ error: "user_id e new_password são obrigatórios" }), { status: 400, headers: corsHeaders });
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(user_id, { password: new_password });
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
  }
});
