import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Fornecedor, FormularioFornecedor } from "@/types/fornecedor";
import { useToast } from "@/hooks/use-toast";
import { withRetry, classifyError, shouldSuppressToast } from "@/lib/supabase-retry";

export function useFornecedores() {
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const carregarFornecedores = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) {
        setLoading(false);
        return;
      }

      const data = await withRetry(async () => {
        const { data, error } = await supabase
          .from("fornecedores")
          .select("*")
          .eq("user_id", user.id)
          .is("deleted_at", null)
          .order("nome");
        if (error) throw error;
        return data;
      }, 'useFornecedores.carregarFornecedores');

      setFornecedores((data || []) as Fornecedor[]);
    } catch (error: unknown) {
      if (!shouldSuppressToast(error)) {
        const { userMessage } = classifyError(error);
        toast({
          title: "Erro ao carregar fornecedores",
          description: userMessage,
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const criarFornecedor = async (dados: FormularioFornecedor) => {
    try {
      // Validar campos obrigatórios
      if (!dados.nome || dados.nome.trim().length < 3) {
        toast({
          title: "Erro de validação",
          description: "Nome do fornecedor deve ter no mínimo 3 caracteres.",
          variant: "destructive",
        });
        return false;
      }

      // CNPJ e CPF são opcionais - usuário pode cadastrar fornecedor sem esses dados

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: "Sessão expirada",
          description: "Por favor, faça login novamente.",
          variant: "destructive",
        });
        return false;
      }
      
      const user = session.user;

      // Converter strings vazias para null para evitar conflitos de unicidade
      const dadosLimpos = {
        ...dados,
        cpf: dados.cpf?.trim() || null,
        cnpj: dados.cnpj?.trim() || null,
        email: dados.email?.trim() || null,
        telefone: dados.telefone?.trim() || null,
        celular: dados.celular?.trim() || null,
        cep: dados.cep?.trim() || null,
        endereco: dados.endereco?.trim() || null,
        cidade: dados.cidade?.trim() || null,
        estado: dados.estado?.trim() || null,
        observacoes: dados.observacoes?.trim() || null,
        nome_fantasia: dados.nome_fantasia?.trim() || null,
      };

      const { error } = await supabase.from("fornecedores").insert({
        ...dadosLimpos,
        user_id: user.id,
      });

      if (error) throw error;

      toast({
        title: "Fornecedor cadastrado",
        description: "O fornecedor foi cadastrado com sucesso.",
      });

      await carregarFornecedores();
      return true;
    } catch (error: any) {
      console.error("Erro ao cadastrar fornecedor:", error);
      
      let mensagemErro = "Não foi possível cadastrar o fornecedor.";
      if (error?.message?.includes("JWT")) {
        mensagemErro = "Sua sessão expirou. Por favor, faça login novamente.";
      } else if (error?.code === "23505") {
        // Erro de duplicação - detecta qual campo está duplicado
        if (error?.message?.includes("fornecedores_user_cnpj_unique")) {
          mensagemErro = "Já existe um fornecedor cadastrado com este CNPJ.";
        } else if (error?.message?.includes("fornecedores_user_cpf_unique")) {
          mensagemErro = "Já existe um fornecedor cadastrado com este CPF.";
        } else {
          mensagemErro = "Já existe um fornecedor com estes dados.";
        }
      } else if (error?.message) {
        mensagemErro = error.message;
      }
      
      toast({
        title: "Erro ao cadastrar fornecedor",
        description: mensagemErro,
        variant: "destructive",
      });
      return false;
    }
  };

  const atualizarFornecedor = async (id: string, dados: FormularioFornecedor) => {
    try {
      // Converter strings vazias para null para evitar conflitos de unicidade
      const dadosLimpos = {
        ...dados,
        cpf: dados.cpf?.trim() || null,
        cnpj: dados.cnpj?.trim() || null,
        email: dados.email?.trim() || null,
        telefone: dados.telefone?.trim() || null,
        celular: dados.celular?.trim() || null,
        cep: dados.cep?.trim() || null,
        endereco: dados.endereco?.trim() || null,
        cidade: dados.cidade?.trim() || null,
        estado: dados.estado?.trim() || null,
        observacoes: dados.observacoes?.trim() || null,
        nome_fantasia: dados.nome_fantasia?.trim() || null,
      };

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { error } = await supabase
        .from("fornecedores")
        .update(dadosLimpos)
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) throw error;

      toast({
        title: "Fornecedor atualizado",
        description: "O fornecedor foi atualizado com sucesso.",
      });

      await carregarFornecedores();
      return true;
    } catch (error) {
      console.error("Erro ao atualizar fornecedor:", error);
      toast({
        title: "Erro ao atualizar fornecedor",
        description: "Não foi possível atualizar o fornecedor.",
        variant: "destructive",
      });
      return false;
    }
  };

  const excluirFornecedor = async (id: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { error } = await supabase
        .from("fornecedores")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) throw error;

      toast({
        title: "Fornecedor excluído",
        description: "O fornecedor foi excluído com sucesso.",
      });

      await carregarFornecedores();
      return true;
    } catch (error) {
      console.error("Erro ao excluir fornecedor:", error);
      toast({
        title: "Erro ao excluir fornecedor",
        description: "Não foi possível excluir o fornecedor.",
        variant: "destructive",
      });
      return false;
    }
  };

  useEffect(() => {
    carregarFornecedores();
  }, [carregarFornecedores]);

  return {
    fornecedores,
    loading,
    criarFornecedor,
    atualizarFornecedor,
    excluirFornecedor,
    refetch: carregarFornecedores,
  };
}
