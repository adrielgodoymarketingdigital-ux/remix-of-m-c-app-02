import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const CHAVE_COLUNA_ESTOQUE_MINIMO = "coluna-estoque-minimo";

/**
 * A coluna produtos/pecas.estoque_minimo já existe no banco? (fase 3)
 * O front pode ser publicado antes da migration: enquanto a leitura falhar
 * (coluna ausente, rede, qualquer erro), responde false e o campo do cadastro
 * fica escondido, sem toast e sem erro na tela. Lê no máximo 1 linha do
 * próprio usuário (RLS); tabela vazia também responde true.
 */
export function useColunaEstoqueMinimo(): { existe: boolean; carregando: boolean } {
  const consulta = useQuery({
    queryKey: [CHAVE_COLUNA_ESTOQUE_MINIMO],
    retry: false,
    queryFn: async () => {
      const [produtos, pecas] = await Promise.all([
        supabase.from("produtos").select("estoque_minimo").limit(1),
        supabase.from("pecas").select("estoque_minimo").limit(1),
      ]);
      return !produtos.error && !pecas.error;
    },
  });
  return { existe: consulta.data === true, carregando: consulta.isLoading };
}
