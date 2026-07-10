import { supabase } from "@/integrations/supabase/client";

export async function excluirContaPorId(id: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from("contas")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) throw error;
}
