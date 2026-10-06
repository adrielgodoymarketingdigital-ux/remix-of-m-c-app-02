import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { OrigemPessoa, FormularioOrigemPessoa } from "@/types/origem";
import { useEmpresaInfo } from "./useResolvedUserId";
import { filtroEmpresaCompras } from "@/lib/origem/comprasDispositivos";

export function useOrigemPessoas() {
  const [pessoas, setPessoas] = useState<OrigemPessoa[]>([]);
  const [loading, setLoading] = useState(true);
  // Mesma regra de empresa das compras (filtroEmpresaCompras): matriz inclui as
  // pessoas sem empresa_id (antes sumiam do seletor), filial só a filial.
  const { empresaId, isFilial } = useEmpresaInfo();

  const carregarPessoas = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) {
        setLoading(false);
        return;
      }

      let query = supabase
        .from("origem_pessoas")
        .select("*")
        .eq("user_id", user.id)
        .eq("ativo", true)
        .order("nome");
      const filtro = filtroEmpresaCompras(empresaId, isFilial);
      if (filtro.tipo === "eq") query = query.eq("empresa_id", filtro.empresaId);
      else if (filtro.tipo === "eq_ou_nulo") query = query.or(filtro.expressaoOr);
      const { data, error } = await query;

      if (error) throw error;
      setPessoas((data || []) as OrigemPessoa[]);
    } catch (error: any) {
      console.error("Erro ao carregar pessoas:", error);
      if (!error?.message?.includes("Auth") && !error?.message?.includes("JWT") && !error?.message?.includes("refresh_token")) {
        toast.error("Erro ao carregar pessoas de origem");
      }
    } finally {
      setLoading(false);
    }
  }, [empresaId, isFilial]);

  const criarPessoa = async (dados: FormularioOrigemPessoa) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Remover campos undefined/vazios antes de inserir
      // Grava a empresa ativa (a mesma do filtro); null para quem não tem empresa.
      const dadosParaInserir = { ...dados, user_id: user.id, ativo: true, empresa_id: empresaId ?? null };
      const dadosLimpos = Object.fromEntries(
        Object.entries(dadosParaInserir)
          .filter(([_, value]) => value !== undefined && value !== "")
      ) as typeof dadosParaInserir;

      const { data, error } = await supabase
        .from("origem_pessoas")
        .insert([dadosLimpos])
        .select()
        .single();

      if (error) throw error;

      toast.success("Pessoa cadastrada com sucesso!");
      await carregarPessoas();
      return data as OrigemPessoa;
    } catch (error: any) {
      console.error("Erro ao criar pessoa:", error);
      
      let mensagem = "Erro ao cadastrar pessoa";
      
      if (error?.code === "22007") {
        mensagem = "Data de nascimento inválida. Verifique o formato.";
      } else if (error?.code === "23505") {
        mensagem = "Já existe uma pessoa cadastrada com estes dados.";
      } else if (error?.message) {
        mensagem = error.message;
      }
      
      toast.error(mensagem);
      return null;
    }
  };

  const atualizarPessoa = async (id: string, dados: Partial<FormularioOrigemPessoa>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("origem_pessoas")
        .update(dados)
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) throw error;

      toast.success("Pessoa atualizada com sucesso!");
      await carregarPessoas();
    } catch (error) {
      console.error("Erro ao atualizar pessoa:", error);
      toast.error("Erro ao atualizar pessoa");
    }
  };

  const excluirPessoa = async (id: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("origem_pessoas")
        .update({ ativo: false })
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) throw error;

      toast.success("Pessoa removida com sucesso!");
      await carregarPessoas();
    } catch (error) {
      console.error("Erro ao excluir pessoa:", error);
      toast.error("Erro ao remover pessoa");
    }
  };

  useEffect(() => {
    carregarPessoas();
  }, [carregarPessoas]);

  return {
    pessoas,
    loading,
    carregarPessoas,
    criarPessoa,
    atualizarPessoa,
    excluirPessoa,
  };
}
