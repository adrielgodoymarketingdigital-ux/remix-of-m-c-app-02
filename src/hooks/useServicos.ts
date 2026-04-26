import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Servico } from "@/types/servico";
import { useFuncionarioPermissoes } from "./useFuncionarioPermissoes";
import { withRetry, shouldSuppressToast } from "@/lib/supabase-retry";

export const useServicos = () => {
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [loading, setLoading] = useState(false);
  const { lojaUserId, podeSincronizarServicos, isFuncionario, carregando: carregandoPermissoes } = useFuncionarioPermissoes();

  const carregarServicos = useCallback(async () => {
    // Aguardar permissões carregarem para usar o user_id correto
    if (carregandoPermissoes) return;
    try {
      setLoading(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) { setLoading(false); return; }

      // Usar ID do dono se funcionário tem permissão de sincronizar serviços
      const userId = (isFuncionario && podeSincronizarServicos && lojaUserId) ? lojaUserId : user.id;

      const data = await withRetry(async () => {
        const { data, error } = await supabase
          .from("servicos")
          .select(`
            *,
            pecas:peca_id (
              id,
              nome
            )
          `)
          .eq("user_id", userId)
          .order("nome");
        if (error) throw error;
        return data;
      }, 'useServicos.carregarServicos');
      
      // Transformar dados para incluir peca_nome
      const servicosComPecas = (data || []).map((servico: any) => ({
        ...servico,
        peca_nome: servico.pecas?.nome || null,
        pecas: undefined,
      }));
      
      const servicosOrdenados = servicosComPecas.sort((a, b) =>
        a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" })
      );
      
      setServicos(servicosOrdenados);
    } catch (error: unknown) {
      if (!shouldSuppressToast(error)) {
        toast.error("Erro ao carregar serviços. Tente novamente.");
      }
    } finally {
      setLoading(false);
    }
  }, [lojaUserId, podeSincronizarServicos, isFuncionario, carregandoPermissoes]);

  const criarServico = async (dados: Omit<Servico, "id" | "created_at">) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Remove lucro do insert - é uma coluna GENERATED ALWAYS
      const { lucro, ...dadosSemLucro } = dados;
      
      // Usar ID do dono se funcionário tem permissão
      const userId = (isFuncionario && podeSincronizarServicos && lojaUserId) ? lojaUserId : user.id;

      const dadosCompletos = {
        ...dadosSemLucro,
        quantidade: dados.quantidade ?? 0,
        user_id: userId
      };

      const { data, error } = await supabase
        .from("servicos")
        .insert([dadosCompletos])
        .select()
        .single();

      if (error) throw error;
      
      toast.success("Serviço criado com sucesso!");
      await carregarServicos();
      return data;
    } catch (error: any) {
      console.error("Erro ao criar serviço:", error);
      
      const mensagem = error?.message?.includes('quantidade') 
        ? "Erro: campo quantidade é obrigatório"
        : "Erro ao criar serviço";
      
      toast.error(mensagem);
      return null;
    }
  };

  const atualizarServico = async (id: string, dados: Omit<Servico, "id" | "created_at">) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Remove lucro do update - é uma coluna GENERATED ALWAYS
      const { lucro, ...dadosSemLucro } = dados;

      // Usar ID do dono se funcionário tem permissão
      const userId = (isFuncionario && podeSincronizarServicos && lojaUserId) ? lojaUserId : user.id;

      const { data, error } = await supabase
        .from("servicos")
        .update(dadosSemLucro)
        .eq("id", id)
        .eq("user_id", userId)
        .select()
        .single();

      if (error) throw error;
      
      toast.success("Serviço atualizado com sucesso!");
      await carregarServicos();
      return data;
    } catch (error) {
      console.error("Erro ao atualizar serviço:", error);
      toast.error("Erro ao atualizar serviço");
      return null;
    }
  };

  const excluirServico = async (id: string) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Usar ID do dono se funcionário tem permissão
      const userId = (isFuncionario && podeSincronizarServicos && lojaUserId) ? lojaUserId : user.id;

      const { error } = await supabase
        .from("servicos")
        .delete()
        .eq("id", id)
        .eq("user_id", userId);

      if (error) throw error;
      
      toast.success("Serviço excluído com sucesso!");
      await carregarServicos();
    } catch (error) {
      console.error("Erro ao excluir serviço:", error);
      toast.error("Erro ao excluir serviço");
    }
  };

  useEffect(() => {
    carregarServicos();
  }, [carregarServicos]);

  return {
    servicos,
    loading,
    carregarServicos,
    criarServico,
    atualizarServico,
    excluirServico,
  };
};
