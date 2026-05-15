import { supabase } from "@/integrations/supabase/client";
import { EMAILS_LIBERADOS_TINY } from "@/config/accessControl";

export async function checkTinyAccess(): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  return EMAILS_LIBERADOS_TINY.includes(user.email ?? "");
}
