import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdminMecApp } from "@/hooks/useCompatibilidadePelicula";
import { temMarcaComecarDoZero } from "@/lib/comecarDoZero/regras";
import { comecarDoZeroVisivelPara } from "@/lib/comecarDoZero/visibilidade";

/**
 * true só para quem pode ver o "Começar do zero". Enquanto carrega devolve
 * false: o card nem existe. A marca de teste é lida na assinatura do PRÓPRIO
 * usuário logado (não na do dono da loja), para um funcionário da conta de
 * teste não ver o card. Para liberar, mude src/lib/comecarDoZero/visibilidade.ts.
 */
export function useComecarDoZeroVisivel(): boolean {
  const { data: isAdmin } = useIsAdminMecApp();
  const { data: temMarcaTeste } = useQuery({
    queryKey: ["comecar-do-zero-marca-teste"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;
      const { data, error } = await supabase.from("assinaturas").select("modulos_extras").eq("user_id", user.id).maybeSingle();
      if (error) return false;
      return temMarcaComecarDoZero(data?.modulos_extras);
    },
  });
  return comecarDoZeroVisivelPara({ isAdmin: isAdmin === true, temMarcaTeste: temMarcaTeste === true });
}
