import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useFuncionarioPermissoes } from "./useFuncionarioPermissoes";
import { useEmpresaFiltro } from "./useResolvedUserId";

export interface TipoGarantia {
  id: string;
  user_id: string;
  nome: string;
  meses: number;
  ativo: boolean;
  created_at: string;
}

export function useTiposGarantia() {
  const [tiposGarantia, setTiposGarantia] = useState<TipoGarantia[]>([]);
  const [loading, setLoading] = useState(false);
  const { lojaUserId, isFuncionario, carregando: carregandoPermissoes } = useFuncionarioPermissoes();
  const empresaFiltro = useEmpresaFiltro();

  const carregar = useCallback(async () => {
    if (carregandoPermissoes) return;
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const userId = (isFuncionario && lojaUserId) ? lojaUserId : user.id;

      let query = supabase
        .from("tipos_garantia")
        .select("*")
        .eq("user_id", userId)
        .order("meses");
      if (empresaFiltro) query = query.eq("empresa_id", empresaFiltro);
      const { data, error } = await query;

      if (error) throw error;
      setTiposGarantia((data || []) as TipoGarantia[]);
    } catch (error) {
      console.error("Erro ao carregar tipos de garantia:", error);
      toast.error("Erro ao carregar tipos de garantia");
    } finally {
      setLoading(false);
    }
  }, [lojaUserId, isFuncionario, carregandoPermissoes, empresaFiltro]);

  const criar = async (nome: string, meses: number) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const userId = (isFuncionario && lojaUserId) ? lojaUserId : user.id;

      const { data, error } = await supabase
        .from("tipos_garantia")
        .insert({ nome, meses, user_id: userId } as any)
        .select()
        .single();

      if (error) throw error;
      toast.success("Tipo de garantia criado!");
      await carregar();
      return data as TipoGarantia;
    } catch (error: any) {
      toast.error("Erro ao criar tipo de garantia");
      return null;
    }
  };

  const atualizar = async (id: string, nome: string, meses: number) => {
    try {
      const { error } = await supabase
        .from("tipos_garantia")
        .update({ nome, meses } as any)
        .eq("id", id);

      if (error) throw error;
      toast.success("Tipo de garantia atualizado!");
      await carregar();
    } catch (error) {
      toast.error("Erro ao atualizar tipo de garantia");
    }
  };

  const excluir = async (id: string) => {
    try {
      const { error } = await supabase
        .from("tipos_garantia")
        .delete()
        .eq("id", id);

      if (error) {
        if (error.code === "23503") {
          toast.error("Este tipo de garantia está vinculado a dispositivos e não pode ser excluído.");
          return;
        }
        throw error;
      }
      toast.success("Tipo de garantia excluído!");
      await carregar();
    } catch (error) {
      toast.error("Erro ao excluir tipo de garantia");
    }
  };

  useEffect(() => {
    carregar();
  }, [carregar]);

  return { tiposGarantia, loading, carregar, criar, atualizar, excluir };
}
