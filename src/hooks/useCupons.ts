import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Cupom, CupomValidacao } from "@/types/cupom";

export const useCupons = () => {
  const [cupons, setCupons] = useState<Cupom[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const carregarCupons = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("cupons")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCupons(data || []);
    } catch (error: any) {
      console.error("Erro ao carregar cupons:", error);
      toast({
        title: "Erro ao carregar cupons",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const validarCupom = async (
    codigo: string, 
    valorCompra: number
  ): Promise<CupomValidacao> => {
    try {
      const codigoUpper = codigo.toUpperCase().trim();
      
      const { data: cupom, error } = await supabase
        .from("cupons")
        .select("*")
        .eq("codigo", codigoUpper)
        .eq("status", "ativo")
        .single();

      if (error || !cupom) {
        return {
          valido: false,
          mensagem: "Cupom não encontrado ou inválido.",
        };
      }

      const agora = new Date();
      const dataInicio = new Date(cupom.data_inicio);
      if (agora < dataInicio) {
        return {
          valido: false,
          mensagem: `Cupom disponível apenas a partir de ${dataInicio.toLocaleDateString()}.`,
        };
      }

      if (cupom.data_validade) {
        const dataValidade = new Date(cupom.data_validade);
        if (agora > dataValidade) {
          await supabase
            .from("cupons")
            .update({ status: "expirado" })
            .eq("id", cupom.id);
          
          return {
            valido: false,
            mensagem: "Cupom expirado.",
          };
        }
      }

      if (
        cupom.quantidade_maxima_uso && 
        cupom.quantidade_usada >= cupom.quantidade_maxima_uso
      ) {
        return {
          valido: false,
          mensagem: "Cupom esgotado. Limite de uso atingido.",
        };
      }

      if (cupom.valor_minimo_compra && valorCompra < cupom.valor_minimo_compra) {
        return {
          valido: false,
          mensagem: `Valor mínimo de compra de R$ ${cupom.valor_minimo_compra.toFixed(2)} não atingido.`,
        };
      }

      let valorDesconto = 0;
      if (cupom.tipo_desconto === "percentual") {
        valorDesconto = (valorCompra * cupom.valor) / 100;
      } else {
        valorDesconto = Math.min(cupom.valor, valorCompra);
      }

      return {
        valido: true,
        mensagem: "Cupom aplicado com sucesso!",
        valorDesconto: Math.round(valorDesconto * 100) / 100,
        cupom,
      };
    } catch (error: any) {
      console.error("Erro ao validar cupom:", error);
      return {
        valido: false,
        mensagem: "Erro ao validar cupom. Tente novamente.",
      };
    }
  };

  const incrementarUsoCupom = async (cupomId: string) => {
    try {
      const { error } = await supabase.rpc("incrementar_uso_cupom", {
        cupom_id: cupomId,
      });

      if (error) throw error;
    } catch (error: any) {
      console.error("Erro ao incrementar uso do cupom:", error);
      throw error;
    }
  };

  const criarCupom = async (dadosCupom: Omit<Cupom, "id" | "user_id" | "created_at" | "updated_at" | "quantidade_usada">) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data, error } = await supabase
        .from("cupons")
        .insert({
          ...dadosCupom,
          user_id: user.id,
          codigo: dadosCupom.codigo.toUpperCase().trim(),
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Cupom criado",
        description: "O cupom foi criado com sucesso.",
      });

      await carregarCupons();
      return true;
    } catch (error: any) {
      console.error("Erro ao criar cupom:", error);
      
      let mensagem = "Não foi possível criar o cupom.";
      if (error.code === "23505") {
        mensagem = "Já existe um cupom com este código.";
      }
      
      toast({
        title: "Erro ao criar cupom",
        description: mensagem,
        variant: "destructive",
      });
      return false;
    }
  };

  const atualizarCupom = async (id: string, dadosCupom: Partial<Cupom>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { error } = await supabase
        .from("cupons")
        .update(dadosCupom)
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) throw error;

      toast({
        title: "Cupom atualizado",
        description: "O cupom foi atualizado com sucesso.",
      });

      await carregarCupons();
      return true;
    } catch (error: any) {
      console.error("Erro ao atualizar cupom:", error);
      toast({
        title: "Erro ao atualizar cupom",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }
  };

  const excluirCupom = async (id: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { error } = await supabase
        .from("cupons")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) throw error;

      toast({
        title: "Cupom excluído",
        description: "O cupom foi excluído com sucesso.",
      });

      await carregarCupons();
      return true;
    } catch (error: any) {
      console.error("Erro ao excluir cupom:", error);
      toast({
        title: "Erro ao excluir cupom",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }
  };

  useEffect(() => {
    carregarCupons();
  }, []);

  return {
    cupons,
    loading,
    carregarCupons,
    validarCupom,
    incrementarUsoCupom,
    criarCupom,
    atualizarCupom,
    excluirCupom,
  };
};
