import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const EMAILS_LIBERADOS_TINY = ["drappleararas@gmail.com", "ifixproararasoficial@gmail.com"];
const PLANOS_TINY = ["profissional_ultra_mensal", "profissional_ultra_anual"];

export async function checkTinyAccessByUserId(userId: string): Promise<boolean> {
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (EMAILS_LIBERADOS_TINY.includes(authUser?.user?.email ?? "")) return true;

  const [{ data: roleData }, { data: assinatura }] = await Promise.all([
    supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle(),
    supabaseAdmin
      .from("assinaturas")
      .select("plano_tipo")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  if (roleData?.role === "admin") return true;
  if (assinatura?.plano_tipo && PLANOS_TINY.includes(assinatura.plano_tipo)) return true;

  return false;
}
