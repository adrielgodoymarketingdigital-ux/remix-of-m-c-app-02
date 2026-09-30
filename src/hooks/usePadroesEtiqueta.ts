import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { withRetry, shouldSuppressToast } from "@/lib/supabase-retry";
import { PadraoEtiqueta, normalizarPadroes } from "@/lib/etiquetas/etiquetasProduto";

const QUERY_KEY = ["etiquetas-padroes"];

/**
 * Linha de configuracoes_loja onde ficam os padrões: a da matriz (empresa_id
 * null) do dono da loja — funcionário usa a do dono, como em useConfiguracaoLoja.
 */
async function buscarLinhaConfig(): Promise<{ id: string; padroes: PadraoEtiqueta[] } | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  let targetUserId = user.id;
  const { data: funcData } = await supabase
    .from("loja_funcionarios")
    .select("loja_user_id")
    .eq("funcionario_user_id", user.id)
    .eq("ativo", true)
    .maybeSingle();
  if (funcData?.loja_user_id) targetUserId = funcData.loja_user_id;

  const { data, error } = await supabase
    .from("configuracoes_loja")
    .select("id, etiquetas_padroes")
    .eq("user_id", targetUserId)
    .is("empresa_id", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { id: data.id, padroes: normalizarPadroes(data.etiquetas_padroes) };
}

type Alteracao = { tipo: "salvar"; padrao: PadraoEtiqueta } | { tipo: "excluir"; id: string };

/** "Meus padrões de etiqueta" da loja (configuracoes_loja.etiquetas_padroes). */
export function usePadroesEtiqueta(enabled = true) {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => withRetry(buscarLinhaConfig, "usePadroesEtiqueta"),
    enabled,
    staleTime: 1000 * 60 * 5,
  });

  const mutation = useMutation({
    // Relê a lista antes de gravar: outra pessoa/aparelho pode ter mexido nela.
    mutationFn: async (alteracao: Alteracao) => {
      const linha = await buscarLinhaConfig();
      if (!linha) throw new Error("Configuração da loja não encontrada");
      let lista: PadraoEtiqueta[];
      if (alteracao.tipo === "excluir") {
        lista = linha.padroes.filter((p) => p.id !== alteracao.id);
      } else {
        const { padrao } = alteracao;
        lista = linha.padroes.some((p) => p.id === padrao.id)
          ? linha.padroes.map((p) => (p.id === padrao.id ? padrao : p))
          : [...linha.padroes, padrao];
      }
      const { error } = await supabase
        .from("configuracoes_loja")
        .update({ etiquetas_padroes: lista as unknown as Json })
        .eq("id", linha.id);
      if (error) throw error;
      return lista;
    },
    onSuccess: (lista) => {
      queryClient.setQueryData(QUERY_KEY, (antigo: Awaited<ReturnType<typeof buscarLinhaConfig>>) =>
        antigo ? { ...antigo, padroes: lista } : antigo);
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onError: (error, alteracao) => {
      if (shouldSuppressToast(error)) return;
      toast.error(alteracao.tipo === "salvar" ? "Erro ao salvar o padrão de etiqueta" : "Erro ao excluir o padrão de etiqueta");
    },
  });

  const executar = async (alteracao: Alteracao): Promise<boolean> => {
    try {
      await mutation.mutateAsync(alteracao);
      return true;
    } catch {
      return false;
    }
  };

  return {
    padroes: data?.padroes ?? [],
    carregando: isLoading,
    salvando: mutation.isPending,
    salvarPadrao: (padrao: PadraoEtiqueta) => executar({ tipo: "salvar", padrao }),
    excluirPadrao: (id: string) => executar({ tipo: "excluir", id }),
  };
}
