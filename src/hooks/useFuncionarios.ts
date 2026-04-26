import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Funcionario, FuncionarioFormData, Permissoes } from "@/types/funcionario";
import type { Json } from "@/integrations/supabase/types";

export function useFuncionarios(lojaUserIdOverride?: string | null) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);

  const { data: funcionarios = [], isLoading: carregando, refetch } = useQuery({
    queryKey: ["funcionarios", lojaUserIdOverride],
    queryFn: async () => {
      let lojaUserId = lojaUserIdOverride;
      
      if (!lojaUserId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return [];
        
        // Check if the current user is a staff member
        const { data: funcionarioData } = await supabase
          .from("loja_funcionarios")
          .select("loja_user_id")
          .eq("funcionario_user_id", user.id)
          .eq("ativo", true)
          .maybeSingle();
        
        lojaUserId = funcionarioData?.loja_user_id || user.id;
      }

      const { data, error } = await supabase
        .from("loja_funcionarios")
        .select("*")
        .eq("loja_user_id", lojaUserId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      return (data || []).map((f: any) => ({
        ...f,
        permissoes: typeof f.permissoes === 'string' ? JSON.parse(f.permissoes) : f.permissoes,
        cargo: f.cargo || null,
        comissao_tipo: f.comissao_tipo || null,
        comissao_valor: Number(f.comissao_valor) || 0,
        comissao_escopo: f.comissao_escopo || null,
        comissoes_por_cargo: f.comissoes_por_cargo || null,
      })) as Funcionario[];
    },
  });

  const criarFuncionario = useMutation({
    mutationFn: async (dados: FuncionarioFormData & { senha?: string }) => {
      if (!dados.senha) throw new Error("Senha é obrigatória para criar funcionário");

      const { data, error } = await supabase.functions.invoke("criar-funcionario", {
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
        },
      });

      if (error) throw new Error(error.message || "Erro ao criar funcionário");
      if (data?.error) throw new Error(data.error);
      return data;
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
      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };
      if (dados.nome !== undefined) updateData.nome = dados.nome;
      if (dados.email !== undefined) updateData.email = dados.email?.toLowerCase();
      if (dados.permissoes !== undefined) updateData.permissoes = JSON.parse(JSON.stringify(dados.permissoes)) as Json;
      if (dados.cargo !== undefined) updateData.cargo = dados.cargo || null;
      if (dados.comissao_tipo !== undefined) updateData.comissao_tipo = dados.comissao_tipo || null;
      if (dados.comissao_valor !== undefined) updateData.comissao_valor = dados.comissao_valor || 0;
      if (dados.comissao_escopo !== undefined) updateData.comissao_escopo = dados.comissao_escopo || null;
      if (dados.comissoes_por_cargo !== undefined) updateData.comissoes_por_cargo = dados.comissoes_por_cargo || null;

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
