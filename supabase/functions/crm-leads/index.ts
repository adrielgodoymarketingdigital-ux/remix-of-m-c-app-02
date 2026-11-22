// Edge Function crm-leads: porta de entrada do n8n para o CRM de leads do
// WhatsApp (fase 1: captura, resumo, vínculo, opt-out, retenção, relatório;
// fase 2A: gasto da Meta por anúncio; feedback: lista de pagantes e registro
// de envio; relatório de marketing semanal/mensal).
// Lógica em handler.ts; contrato em docs/crm-leads/CONTRATO.md;
// publicação e secret em scripts/crm-leads/LEIA-ME.md.
// verify_jwt = false (supabase/config.toml): a autenticação é o x-crm-secret.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { dataBrasiliaISO } from "../_shared/dataBrasilia.ts";
import { criarHandler } from "./handler.ts";

Deno.serve(criarHandler({
  segredo: Deno.env.get("CRM_N8N_SECRET"),
  db: () => createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  }),
  hojeBrasilia: () => dataBrasiliaISO(),
}));
