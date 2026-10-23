import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { criarHandler } from "./processar.ts";
import { criarDependencias, type ClienteSupabase } from "./adaptador.ts";

// "Começar do zero" — etapa 2: remove pela API do Storage as fotos da fila
// zerar_dados_arquivos de UMA execução do usuário logado.
//   - verify_jwt = true (config.toml) e, aqui, user_id sempre do token.
//   - Só a execução do próprio usuário; a de outro responde como inexistente.
//   - Antes de remover, marca o que ainda é citado por dado que ficou (RPC).
//   - Lotes de 100, orçamento de tempo; chamar de novo até concluido = true.
// Service role só aqui no servidor; nunca vai para o log.

const log = (passo: string, detalhes?: unknown) =>
  console.log(`[ZERAR-DADOS-STORAGE] ${passo}${detalhes ? ` - ${JSON.stringify(detalhes)}` : ""}`);

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

serve(criarHandler({
  ...criarDependencias(supabase as unknown as ClienteSupabase),
  log,
}));
