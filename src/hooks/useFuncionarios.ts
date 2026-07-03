import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Funcionario, FuncionarioFormData } from "@/types/funcionario";
import type { Json } from "@/integrations/supabase/types";
import { applyEmpresaFilter, useEmpresaInfo } from "@/hooks/useResolvedUserId";

export function useFuncionarios(lojaUserIdOverride?: string | null) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { empresaId, isFilial } = useEmpresaInfo();

  const { data: funcionarios = [], isLoading: carregando, refetch } = useQuery({
    queryKey: ["funcionarios", lojaUserIdOverride, empresaId, isFilial],
    queryFn: async () => {
      let lojaUserId = lojaUserIdOverride;

      if (!lojaUserId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return [];

        // Verifica se é funcionário comum
        const { data: funcionarioData } = await supabase
          .from("loja_funcionarios")
          .select("loja_user_id")
          .eq("funcionario_user_id", user.id)
          .eq("ativo", true)
          .maybeSingle();

        if (funcionarioData?.loja_user_id) {
          lojaUserId = funcionarioData.loja_user_id;
        } else {
          // Verifica se é gerente de filial
          const { data: gerenteData } = await supabase
            .from("empresa_usuarios")
            .select("proprietario_id")
            .eq("gerente_id", user.id)
            .maybeSingle();

          lojaUserId = gerenteData?.proprietario_id || user.id;
        }
      }

      let query = supabase
        .from("loja_funcionarios")
        .select("*")
        .eq("loja_user_id", lojaUserId)
        .order("created_at", { ascending: false });

      query = applyEmpresaFilter(query, empresaId, isFilial);

      const { data, error } = await query;

      if (error) throw error;
      
      return (data || []).map((f: any) => ({
        ...f,
        permissoes: typeof f.permissoes === 'string' ? JSON.parse(f.permissoes) : f.permissoes,
        cargo: f.cargo || null,
        comissao_tipo: f.comissao_tipo || null,
        comissao_valor: Number(f.comissao_valor) || 0,
        comissao_escopo: f.comissao_escopo || null,
        comissoes_por_cargo: f.comissoes_por_cargo || null,
        base_comissao: f.base_comissao || "criacao",
      })) as Funcionario[];
    },
  });

  const criarFuncionario = useMutation({
    mutationFn: async (dados: FuncionarioFormData & { senha?: string }) => {
      if (!dados.senha) throw new Error("Senha é obrigatória para criar funcionário");

      const response = await supabase.functions.invoke("criar-funcionario", {
        body: {
          nome: dados.nome,
          email: dados.email.toLowerCase(),
          senha: dados.senha,
          permissoes: dados.permissoes,
          cargo: dados.cargo || null,
          comissao_tipo: dados.comissao_tipo || null,
          comissao_valor: dados.comissao_valor || 0,
          comissao_escopo: dados.comissao_escopo || null,
          comissoes_por_cargo: dados.comissoes_por_cargo || null,
          base_comissao: dados.base_comissao || "criacao",
          empresa_id: isFilial ? empresaId : null,
        },
      });

      if (response.error) {
        let msg = "Erro ao criar funcionário";
        try {
          const ctx = (response.error as any)?.context;
          if (ctx && typeof ctx.json === "function") {
            const body = await ctx.json();
            msg = body?.error || msg;
          } else {
            msg = response.error.message || msg;
          }
        } catch {
          msg = response.error.message || msg;
        }
        throw new Error(msg);
      }
      if (response.data?.error) throw new Error(response.data.error);
      return response.data;
    },
    onSuccess: () => {
      toast({ title: "Funcionário cadastrado", description: "O funcionário já pode acessar o sistema." });
      queryClient.invalidateQueries({ queryKey: ["funcionarios"] });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Erro ao cadastrar", description: error.message });
    },
  });

  const atualizarFuncionario = useMutation({
    mutationFn: async ({ id, dados }: { id: string; dados: Partial<FuncionarioFormData> }) => {
      // Se o email mudou, atualiza via edge function (precisa atualizar no Supabase Auth também)
      const funcionarioAtual = funcionarios.find(f => f.id === id);
      const emailMudou = dados.email !== undefined && dados.email !== funcionarioAtual?.email;
      if (emailMudou) {
        const response = await supabase.functions.invoke("atualizar-funcionario", {
          body: { funcionario_id: id, email: dados.email },
        });
        let errMsg = "Erro ao atualizar email";
        if (response.error || response.data?.error) {
          try {
            const ctx = (response.error as any)?.context;
            if (ctx && typeof ctx.json === "function") {
              const body = await ctx.json();
              errMsg = body?.error || errMsg;
            } else {
              errMsg = response.data?.error || response.error?.message || errMsg;
            }
          } catch {
            errMsg = response.data?.error || response.error?.message || errMsg;
          }
          throw new Error(errMsg);
        }
      }

      // Atualiza demais campos direto na tabela
      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };
      if (dados.nome !== undefined) updateData.nome = dados.nome;
      if (dados.permissoes !== undefined) updateData.permissoes = JSON.parse(JSON.stringify(dados.permissoes)) as Json;
      if (dados.cargo !== undefined) updateData.cargo = dados.cargo || null;
      if (dados.comissao_tipo !== undefined) updateData.comissao_tipo = dados.comissao_tipo || null;
      if (dados.comissao_valor !== undefined) updateData.comissao_valor = dados.comissao_valor || 0;
      if (dados.comissao_escopo !== undefined) updateData.comissao_escopo = dados.comissao_escopo || null;
      if (dados.comissoes_por_cargo !== undefined) updateData.comissoes_por_cargo = dados.comissoes_por_cargo || null;
      if (dados.base_comissao !== undefined) updateData.base_comissao = dados.base_comissao || "criacao";

      const { data, error } = await supabase
        .from("loja_funcionarios")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: "Funcionário atualizado", description: "Os dados foram atualizados com sucesso." });
      queryClient.invalidateQueries({ queryKey: ["funcionarios"] });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Erro ao atualizar", description: error.message });
    },
  });

  const toggleAtivo = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { data, error } = await supabase
        .from("loja_funcionarios").update({ ativo, updated_at: new Date().toISOString() }).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: data.ativo ? "Funcionário ativado" : "Funcionário desativado",
        description: data.ativo ? "O funcionário pode acessar o sistema novamente." : "O funcionário não poderá mais acessar o sistema.",
      });
      queryClient.invalidateQueries({ queryKey: ["funcionarios"] });
    },
    onError: (error: Error) => { toast({ variant: "destructive", title: "Erro", description: error.message }); },
  });

  const excluirFuncionario = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("loja_funcionarios").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Funcionário excluído", description: "O funcionário foi removido da equipe." });
      queryClient.invalidateQueries({ queryKey: ["funcionarios"] });
    },
    onError: (error: Error) => { toast({ variant: "destructive", title: "Erro ao excluir", description: error.message }); },
  });

  const reenviarConvite = useMutation({
    mutationFn: async (id: string) => {
      const conviteToken = crypto.randomUUID();
      const conviteExpiraEm = new Date();
      conviteExpiraEm.setDate(conviteExpiraEm.getDate() + 7);
      const { data, error } = await supabase
        .from("loja_funcionarios")
        .update({ convite_token: conviteToken, convite_expira_em: conviteExpiraEm.toISOString(), updated_at: new Date().toISOString() })
        .eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: "Convite reenviado", description: "Um novo convite foi gerado e é válido por 7 dias." });
      queryClient.invalidateQueries({ queryKey: ["funcionarios"] });
    },
    onError: (error: Error) => { toast({ variant: "destructive", title: "Erro ao reenviar", description: error.message }); },
  });

  return { funcionarios, carregando, refetch, criarFuncionario, atualizarFuncionario, toggleAtivo, excluirFuncionario, reenviarConvite };
}
