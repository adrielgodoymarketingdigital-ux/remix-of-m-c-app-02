import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ServicoAvulso {
  id: string;
  nome: string;
  custo: number;
  preco: number;
  lucro: number;
  status: string;
  observacoes?: string;
  created_at: string;
  updated_at: string;
}

export interface FormularioServicoAvulso {
  nome: string;
  custo: number;
  preco: number;
  observacoes?: string;
}

export function useServicosAvulsos() {
  const [servicosAvulsos, setServicosAvulsos] = useState<ServicoAvulso[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOperating, setIsOperating] = useState(false);

  const carregarServicosAvulsos = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return;

      const { data: lojaOwnerId } = await supabase.rpc('get_loja_owner_id');
      const userId = lojaOwnerId || user.id;

      const { data, error } = await supabase
        .from("servicos_avulsos")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setServicosAvulsos((data as any[]) || []);
    } catch (error) {
      console.error("Erro ao carregar serviços avulsos:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED')) {
        carregarServicosAvulsos();
      }
      if (event === 'SIGNED_OUT') {
        setServicosAvulsos([]);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [carregarServicosAvulsos]);

  const criarServicoAvulso = async (dados: FormularioServicoAvulso, limiteServicosAvulsos?: number) => {
    if (isOperating) return false;
    setIsOperating(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data: lojaOwnerId } = await supabase.rpc('get_loja_owner_id');
      const userId = lojaOwnerId || user.id;

      // Verificar limite do plano (0 = não disponível, -1 = ilimitado)
      if (limiteServicosAvulsos !== undefined && limiteServicosAvulsos === 0) {
        toast.error("Serviços avulsos não estão disponíveis no seu plano atual. Faça upgrade!");
        return false;
      }

      if (limiteServicosAvulsos !== undefined && limiteServicosAvulsos > 0) {
        const inicioMes = new Date();
        inicioMes.setDate(1);
        inicioMes.setHours(0, 0, 0, 0);

        const { count } = await supabase
          .from("servicos_avulsos")
          .select("*", { count: "exact", head: true })
          .eq("user_id", userId)
          .gte("created_at", inicioMes.toISOString());

        if ((count || 0) >= limiteServicosAvulsos) {
          toast.error(`Limite de ${limiteServicosAvulsos} serviços avulsos/mês atingido. Faça upgrade!`);
          return false;
        }
      }

      const lucro = dados.preco - dados.custo;

      const { data: inserted, error } = await supabase.from("servicos_avulsos").insert({
        user_id: userId,
        nome: dados.nome,
        custo: dados.custo,
        preco: dados.preco,
        lucro,
        observacoes: dados.observacoes || null,
        status: "finalizado",
      } as any).select();

      if (error) throw error;

      // Lançar no financeiro (contas a receber, já pago)
      try {
        await supabase.from("contas").insert({
          user_id: userId,
          nome: `Serviço Avulso - ${dados.nome}`,
          tipo: "receber" as any,
          valor: dados.preco,
          valor_pago: dados.preco,
          data: new Date().toISOString().split('T')[0],
          status: "pago" as any,
          recorrente: false,
          categoria: "Serviços",
          descricao: `Serviço avulso: ${dados.nome}${dados.observacoes ? ' - ' + dados.observacoes : ''}`,
        });
      } catch (contaError) {
        console.error("Erro ao lançar no financeiro:", contaError);
      }

      // Recarregar do DB para garantir estado correto
      await carregarServicosAvulsos();

      toast.success("Serviço avulso lançado com sucesso!");
      return true;
    } catch (error) {
      console.error("Erro ao criar serviço avulso:", error);
      toast.error("Erro ao criar serviço avulso");
      return false;
    } finally {
      setIsOperating(false);
    }
  };

  const atualizarStatusAvulso = async (id: string, novoStatus: string) => {
    if (isOperating) return false;
    setIsOperating(true);
    
    try {
      // Atualização otimista
      setServicosAvulsos(prev => prev.map(sa => sa.id === id ? { ...sa, status: novoStatus } : sa));

      const { error } = await supabase
        .from("servicos_avulsos")
        .update({ status: novoStatus } as any)
        .eq("id", id);

      if (error) {
        await carregarServicosAvulsos();
        throw error;
      }

      toast.success("Status do serviço avulso atualizado!");
      return true;
    } catch (error) {
      console.error("Erro ao atualizar status do serviço avulso:", error);
      toast.error("Erro ao atualizar status");
      return false;
    } finally {
      setIsOperating(false);
    }
  };

  const excluirServicoAvulso = async (id: string) => {
    if (isOperating) return false;
    setIsOperating(true);
    
    try {
      // Remover do estado antes da chamada (otimista)
      setServicosAvulsos(prev => prev.filter(sa => sa.id !== id));

      const { error } = await supabase
        .from("servicos_avulsos")
        .delete()
        .eq("id", id);

      if (error) {
        // Reverter em caso de erro
        await carregarServicosAvulsos();
        throw error;
      }

      toast.success("Serviço avulso excluído!");
      return true;
    } catch (error) {
      console.error("Erro ao excluir serviço avulso:", error);
      toast.error("Erro ao excluir serviço avulso");
      return false;
    } finally {
      setIsOperating(false);
    }
  };

  return {
    servicosAvulsos,
    loading,
    criarServicoAvulso,
    atualizarStatusAvulso,
    excluirServicoAvulso,
    refetch: carregarServicosAvulsos,
  };
}
