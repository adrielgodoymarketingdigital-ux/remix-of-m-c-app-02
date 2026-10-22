import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { TipoItemFiscal } from "@/lib/fiscal/dadosFiscais";

export interface PerfilTributarioOpcao {
  id: string;
  nome: string;
  descricao: string | null;
  tipo_item: string;
  uf: string | null;
  versao: number;
}

/**
 * Perfis que podem ser OFERECIDOS ao usuário: ativo = true E validado_em
 * preenchido (regra da etapa 1, ver COMMENT em fiscal_perfis_tributarios).
 * Nunca pré-selecionar nem aplicar automaticamente. O RLS já esconde os
 * inativos; o filtro de ativo fica aqui também porque o admin vê todos.
 */
export function usePerfisTributariosValidados(tipos: TipoItemFiscal[], habilitado: boolean) {
  return useQuery({
    queryKey: ["fiscal-perfis-validados", [...tipos].sort().join(",")],
    enabled: habilitado,
    queryFn: async (): Promise<PerfilTributarioOpcao[]> => {
      const { data, error } = await supabase
        .from("fiscal_perfis_tributarios")
        .select("id, nome, descricao, tipo_item, uf, versao")
        .eq("ativo", true)
        .not("validado_em", "is", null)
        .in("tipo_item", tipos)
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });
}
