import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { criarHandler } from "./salvarConfig.ts";

// Grava a configuração fiscal da MATRIZ (fiscal_config com empresa_id nulo).
//   - verify_jwt = true (config.toml) e, aqui, user_id sempre do token.
//   - Só admin (has_role), conferido no servidor.
//   - Só os campos de validarCorpo.ts; ambiente = 'homologacao' e ativo = false forçados.
//   - Service role: o navegador só tem SELECT em fiscal_config (RLS da etapa 1).
// Sem Spedy, certificado ou segredo nesta etapa.

const log = (passo: string, detalhes?: unknown) =>
  console.log(`[FISCAL-CONFIG-SALVAR] ${passo}${detalhes ? ` - ${JSON.stringify(detalhes)}` : ""}`);

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

serve(criarHandler({
  usuarioDoToken: async (token) => {
    const { data, error } = await supabase.auth.getUser(token);
    return error || !data.user ? null : data.user.id;
  },
  ehAdmin: async (userId) => {
    const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (error) log("has_role falhou", { message: error.message });
    return data === true;
  },
  db: supabase,
  log,
}));
