import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  desligarDonoComoFuncionarioCore,
  ligarDonoComoFuncionarioCore,
} from "@/lib/equipe/donoFuncionario.core";
import type { Funcionario } from "@/types/funcionario";

/**
 * Interruptor "Incluir meu usuário como funcionário" (tela de Equipe). Só o
 * dono da loja vê: funcionário e gerente de filial não têm linha própria de dono.
 */
export function useDonoComoFuncionario(funcionarios: Funcionario[]) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: identidade } = useQuery({
    queryKey: ["dono-como-funcionario-identidade"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const [{ data: vinculo }, { data: gerente }, { data: perfil }] = await Promise.all([
        supabase.from("loja_funcionarios").select("id").eq("funcionario_user_id", user.id).eq("ativo", true).maybeSingle(),
        supabase.from("empresa_usuarios").select("proprietario_id").eq("gerente_id", user.id).maybeSingle(),
        supabase.from("profiles").select("nome").eq("user_id", user.id).maybeSingle(),
      ]);

      return {
        authUserId: user.id,
        email: user.email ?? "",
        nome: perfil?.nome || (user.user_metadata?.nome as string | undefined) || user.email || "",
        souDono: !vinculo && !gerente?.proprietario_id,
      };
    },
  });

  const linhaDono = funcionarios.find((f) => f.eh_dono) ?? null;

  const definir = useMutation({
    mutationFn: async (incluir: boolean) => {
      if (!identidade?.souDono) throw new Error("Só o dono da loja pode se incluir como funcionário.");
      const r = incluir
        ? await ligarDonoComoFuncionarioCore(supabase, {
            authUserId: identidade.authUserId,
            lojaUserId: identidade.authUserId,
            nome: identidade.nome,
            email: identidade.email,
          })
        : await desligarDonoComoFuncionarioCore(supabase, identidade.authUserId);
      if (!r.ok) throw new Error(r.erro);
      return incluir;
    },
    onSuccess: (incluir) => {
      toast({
        title: incluir ? "Você foi incluído como funcionário" : "Você saiu da lista de funcionários",
        description: incluir
          ? "Agora você pode se escolher como vendedor e técnico e ter comissão calculada."
          : "Seu histórico de OS, vendas e comissões foi mantido.",
      });
      queryClient.invalidateQueries({ queryKey: ["funcionarios"] });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Não foi possível alterar", description: error.message });
    },
  });

  return {
    souDono: identidade?.souDono === true,
    incluido: linhaDono?.ativo === true,
    linhaDono,
    definir,
  };
}
