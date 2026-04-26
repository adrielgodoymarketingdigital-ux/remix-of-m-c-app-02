import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useFuncionarioPermissoes } from "./useFuncionarioPermissoes";

export interface TipoServico {
  id: string;
  user_id: string;
  nome: string;
  ativo: boolean;
  created_at: string;
}

export function useTiposServico() {
  const [tiposServico, setTiposServico] = useState<TipoServico[]>([]);
  const [loading, setLoading] = useState(false);
  const { lojaUserId, isFuncionario, carregando: carregandoPermissoes } = useFuncionarioPermissoes();

  const carregar = useCallback(async () => {
    if (carregandoPermissoes) return;
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const userId = (isFuncionario && lojaUserId) ? lojaUserId : user.id;

      const { data, error } = await supabase
        .from("tipos_servico")
        .select("*")
        .eq("user_id", userId)
        .order("nome");

      if (error) throw error;
      setTiposServico((data || []) as TipoServico[]);
    } catch (error) {
      console.error("Erro ao carregar tipos de serviço:", error);
      toast.error("Erro ao carregar tipos de serviço");
    } finally {
      setLoading(false);
    }
  }, [lojaUserId, isFuncionario, carregandoPermissoes]);

  const criar = async (nome: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const userId = (isFuncionario && lojaUserId) ? lojaUserId : user.id;

      const { data, error } = await supabase
        .from("tipos_servico")
        .insert({ nome, user_id: userId } as any)
        .select()
        .single();

      if (error) throw error;
      toast.success("Tipo de serviço criado!");
      await carregar();
      return data as TipoServico;
    } catch (error: any) {
      toast.error("Erro ao criar tipo de serviço");
      return null;
    }
  };

  const atualizar = async (id: string, nome: string) => {
    try {
      const { error } = await supabase
        .from("tipos_servico")
        .update({ nome } as any)
        .eq("id", id);

      if (error) throw error;
      toast.success("Tipo de serviço atualizado!");
      await carregar();
    } catch (error) {
      toast.error("Erro ao atualizar tipo de serviço");
    }
  };

  const excluir = async (id: string) => {
    try {
      const { error } = await supabase
        .from("tipos_servico")
        .delete()
        .eq("id", id);

      if (error) {
        if (error.code === "23503") {
          toast.error("Este tipo de serviço está vinculado a ordens de serviço e não pode ser excluído.");
          return;
        }
        throw error;
      }
      toast.success("Tipo de serviço excluído!");
      await carregar();
    } catch (error) {
      toast.error("Erro ao excluir tipo de serviço");
    }
  };

  useEffect(() => {
    carregar();
  }, [carregar]);

  return { tiposServico, loading, carregar, criar, atualizar, excluir };
}
