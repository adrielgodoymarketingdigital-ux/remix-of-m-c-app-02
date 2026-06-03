import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export type Prioridade = "muito_urgente" | "urgente" | "melhoria" | "nao_urgente";

export interface AlteracaoCorrecao {
  id: string;
  titulo: string;
  descricao: string | null;
  prioridade: Prioridade;
  concluido: boolean;
  created_at: string;
  updated_at: string;
}

export interface AlteracaoCorrecaoInsert {
  titulo: string;
  descricao?: string | null;
  prioridade: Prioridade;
  concluido?: boolean;
}

const QUERY_KEY = ["admin", "alteracoes-correcoes"];

export function useAlteracoesCorrecoes() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: itens = [], isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_alteracoes_correcoes")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as AlteracaoCorrecao[];
    },
  });

  const criar = useMutation({
    mutationFn: async (input: AlteracaoCorrecaoInsert) => {
      const { data, error } = await supabase
        .from("admin_alteracoes_correcoes")
        .insert(input)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast({ title: "Item criado com sucesso!" });
    },
    onError: () => toast({ title: "Erro ao criar item", variant: "destructive" }),
  });

  const atualizar = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<AlteracaoCorrecaoInsert> & { id: string }) => {
      const { data, error } = await supabase
        .from("admin_alteracoes_correcoes")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast({ title: "Item atualizado!" });
    },
    onError: () => toast({ title: "Erro ao atualizar", variant: "destructive" }),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("admin_alteracoes_correcoes")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      toast({ title: "Item excluído!" });
    },
    onError: () => toast({ title: "Erro ao excluir", variant: "destructive" }),
  });

  const toggleConcluido = useMutation({
    mutationFn: async ({ id, concluido }: { id: string; concluido: boolean }) => {
      const { error } = await supabase
        .from("admin_alteracoes_correcoes")
        .update({ concluido, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
    onError: () => toast({ title: "Erro ao atualizar status", variant: "destructive" }),
  });

  return { itens, isLoading, criar, atualizar, excluir, toggleConcluido };
}
