import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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

export function useOSBehaviorConfig() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: config, isLoading } = useQuery({
    queryKey: ["os-behavior-config"],
    queryFn: async (): Promise<OSBehaviorConfig> => {
      const lojaUserId = await resolveLojaUserId();
      if (!lojaUserId) return { tecnico_obrigatorio_os: false };

      const { data } = await supabase
        .from("configuracoes_loja")
        .select("layout_os_config")
        .eq("user_id", lojaUserId)
        .maybeSingle();

      const layoutConfig = data?.layout_os_config as Record<string, unknown> | null;
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

      const { data: existing } = await supabase
        .from("configuracoes_loja")
        .select("layout_os_config")
        .eq("user_id", lojaUserId)
        .maybeSingle();

      const layoutAtual = (existing?.layout_os_config as Record<string, unknown>) ?? {};
      const layoutAtualizado = { ...layoutAtual, ...novoConfig };

      const { error } = await supabase
        .from("configuracoes_loja")
        .update({ layout_os_config: layoutAtualizado })
        .eq("user_id", lojaUserId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["os-behavior-config"] });
      toast({ title: "Configuração salva com sucesso" });
    },
    onError: () => {
      toast({ title: "Erro ao salvar configuração", variant: "destructive" });
    },
  });

  return {
    tecnicoObrigatorioOS: config?.tecnico_obrigatorio_os ?? false,
    carregando: isLoading,
    salvar: (tecnico_obrigatorio_os: boolean) =>
      salvar.mutateAsync({ tecnico_obrigatorio_os }),
    salvando: salvar.isPending,
  };
}
