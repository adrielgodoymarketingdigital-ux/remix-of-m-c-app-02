import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Json } from "@/integrations/supabase/types";
import { linhaMatrizUnica, mesclarLayoutOS, type LinhaLayoutOS } from "@/lib/ordemServico/mesclarLayoutOS";

interface OSBehaviorConfig {
  tecnico_obrigatorio_os: boolean;
}

const resolveLojaUserId = async (): Promise<string | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: funcData } = await supabase
    .from("loja_funcionarios")
    .select("loja_user_id")
    .eq("funcionario_user_id", user.id)
    .eq("ativo", true)
    .maybeSingle();
  if (funcData?.loja_user_id) return funcData.loja_user_id;

  const { data: gerenteData } = await supabase
    .from("empresa_usuarios")
    .select("proprietario_id")
    .eq("gerente_id", user.id)
    .maybeSingle();
  if (gerenteData?.proprietario_id) return gerenteData.proprietario_id;

  return user.id;
};

/**
 * A configuração vale para a loja inteira e fica na linha da matriz (empresa_id
 * null) do dono — nunca nas linhas das filiais.
 */
const buscarLinhasMatriz = async (lojaUserId: string) => {
  const { data, error } = await supabase
    .from("configuracoes_loja")
    .select("id, layout_os_config")
    .eq("user_id", lojaUserId)
    .is("empresa_id", null)
    .order("created_at", { ascending: false })
    .limit(2);
  if (error) console.error("Erro ao ler a configuração da loja:", error);
  return { data: data as LinhaLayoutOS[] | null, error };
};

// Para gravar: lança erro se a leitura falhar ou se a linha não for única, para
// nunca partir de um JSON vazio nem atingir mais de uma linha.
const buscarLinhaMatriz = async (lojaUserId: string): Promise<LinhaLayoutOS> => {
  const { data, error } = await buscarLinhasMatriz(lojaUserId);
  return linhaMatrizUnica(data, error);
};

export function useOSBehaviorConfig() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: config, isLoading } = useQuery({
    queryKey: ["os-behavior-config"],
    queryFn: async (): Promise<OSBehaviorConfig> => {
      const lojaUserId = await resolveLojaUserId();
      if (!lojaUserId) return { tecnico_obrigatorio_os: false };

      // Leitura tolerante (loja ainda sem configuração = desligado; a mais recente,
      // como em useConfiguracaoLoja). Só a gravação exige a linha única.
      const { data, error } = await buscarLinhasMatriz(lojaUserId);
      if (error) throw error;
      const layoutConfig = (data?.[0]?.layout_os_config ?? null) as Record<string, unknown> | null;
      return {
        tecnico_obrigatorio_os: (layoutConfig?.tecnico_obrigatorio_os as boolean) ?? false,
      };
    },
    staleTime: 1000 * 60 * 5,
  });

  const salvar = useMutation({
    mutationFn: async (novoConfig: Partial<OSBehaviorConfig>) => {
      const lojaUserId = await resolveLojaUserId();
      if (!lojaUserId) throw new Error("Usuário não autenticado");

      // Relê a linha antes de gravar e mescla: o layout de impressão e a etiqueta
      // moram no mesmo JSON.
      const linha = await buscarLinhaMatriz(lojaUserId);
      const layoutAtualizado = mesclarLayoutOS(linha.layout_os_config, novoConfig);

      const { data: gravadas, error } = await supabase
        .from("configuracoes_loja")
        .update({ layout_os_config: layoutAtualizado as Json })
        .eq("id", linha.id)
        .select("id");

      if (error) {
        console.error("Erro ao gravar a configuração da loja:", error);
        throw new Error("O banco recusou a gravação. Tente novamente.");
      }
      if (!gravadas?.length) throw new Error("Você não tem permissão para alterar esta configuração.");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["os-behavior-config"] });
      toast({ title: "Configuração salva com sucesso" });
    },
    onError: (error: Error) => {
      toast({ title: "Erro ao salvar configuração", description: error.message, variant: "destructive" });
    },
  });

  return {
    tecnicoObrigatorioOS: config?.tecnico_obrigatorio_os ?? false,
    carregando: isLoading,
    // O erro já aparece no toast; aqui só evita a promise rejeitada solta no Switch.
    salvar: (tecnico_obrigatorio_os: boolean) =>
      salvar.mutateAsync({ tecnico_obrigatorio_os }).catch(() => undefined),
    salvando: salvar.isPending,
  };
}
