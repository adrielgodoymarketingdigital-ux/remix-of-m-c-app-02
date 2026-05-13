import { supabase } from "@/integrations/supabase/client";
import { EMAILS_LIBERADOS_TINY, PLANOS_TINY } from "@/config/accessControl";

export async function checkTinyAccess(): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  if (EMAILS_LIBERADOS_TINY.includes(user.email ?? "")) return true;

  const [{ data: roleData }, { data: assinatura }] = await Promise.all([
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle(),
    supabase
      .from("assinaturas")
      .select("plano_tipo")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  if (roleData?.role === "admin") return true;
  if (assinatura?.plano_tipo && PLANOS_TINY.includes(assinatura.plano_tipo)) return true;

  return false;
}
