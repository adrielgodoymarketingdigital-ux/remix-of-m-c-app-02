import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useFuncionarioPermissoes } from "@/hooks/useFuncionarioPermissoes";

export interface TaxaCartao {
  id: string;
  user_id: string;
  bandeira: string;
  taxa_debito: number;
  taxa_credito: number;
  taxas_parcelado: Record<string, number>; // {"2": 3.5, "3": 4.0, ...}
  ativo: boolean;
  created_at: string;
}

export function useTaxasCartao() {
  const [taxas, setTaxas] = useState<TaxaCartao[]>([]);
  const [loading, setLoading] = useState(true);
  const { lojaUserId } = useFuncionarioPermissoes();

  const carregarTaxas = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const userId = lojaUserId || user.id;

      const { data, error } = await supabase
        .from("taxas_cartao")
        .select("*")
        .eq("user_id", userId)
        .order("bandeira");

      if (error) throw error;

      setTaxas(
        (data || []).map((t: any) => ({
          ...t,
          taxa_debito: Number(t.taxa_debito) || 0,
          taxa_credito: Number(t.taxa_credito) || 0,
          taxas_parcelado: (typeof t.taxas_parcelado === "object" && t.taxas_parcelado !== null)
            ? t.taxas_parcelado as Record<string, number>
            : {},
        }))
      );
    } catch (err) {
      console.error("Erro ao carregar taxas de cartão:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarTaxas();
  }, [lojaUserId]);

  const criarTaxa = async (dados: Omit<TaxaCartao, "id" | "user_id" | "created_at">) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const userId = lojaUserId || user.id;

      const { error } = await supabase.from("taxas_cartao").insert({
        user_id: userId,
        bandeira: dados.bandeira,
        taxa_debito: dados.taxa_debito,
        taxa_credito: dados.taxa_credito,
        taxas_parcelado: dados.taxas_parcelado as any,
        ativo: dados.ativo,
      });

      if (error) throw error;
      await carregarTaxas();
      return true;
    } catch (err) {
      console.error("Erro ao criar taxa:", err);
      return false;
    }
  };

  const atualizarTaxa = async (id: string, dados: Partial<TaxaCartao>) => {
    try {
      const updateData: any = {};
      if (dados.bandeira !== undefined) updateData.bandeira = dados.bandeira;
      if (dados.taxa_debito !== undefined) updateData.taxa_debito = dados.taxa_debito;
      if (dados.taxa_credito !== undefined) updateData.taxa_credito = dados.taxa_credito;
      if (dados.taxas_parcelado !== undefined) updateData.taxas_parcelado = dados.taxas_parcelado;
      if (dados.ativo !== undefined) updateData.ativo = dados.ativo;

      const { error } = await supabase
        .from("taxas_cartao")
        .update(updateData)
        .eq("id", id);

      if (error) throw error;
      await carregarTaxas();
      return true;
    } catch (err) {
      console.error("Erro ao atualizar taxa:", err);
      return false;
    }
  };

  const excluirTaxa = async (id: string) => {
    try {
      const { error } = await supabase.from("taxas_cartao").delete().eq("id", id);
      if (error) throw error;
      await carregarTaxas();
      return true;
    } catch (err) {
      console.error("Erro ao excluir taxa:", err);
      return false;
    }
  };

  const calcularTaxa = (
    taxaCartao: TaxaCartao,
    formaPagamento: string,
    numeroParcelas?: number,
    valorTotal?: number
  ): { percentual: number; valor: number } => {
    let percentual = 0;

    if (formaPagamento === "debito") {
      percentual = taxaCartao.taxa_debito;
    } else if (formaPagamento === "credito") {
      percentual = taxaCartao.taxa_credito;
    } else if (formaPagamento === "credito_parcelado" && numeroParcelas) {
      const key = String(numeroParcelas);
      percentual = taxaCartao.taxas_parcelado[key] ?? taxaCartao.taxa_credito;
    }

    const valor = valorTotal ? (valorTotal * percentual) / 100 : 0;
    return { percentual, valor };
  };

  const taxasAtivas = taxas.filter((t) => t.ativo);

  return {
    taxas,
    taxasAtivas,
    loading,
    criarTaxa,
    atualizarTaxa,
    excluirTaxa,
    calcularTaxa,
    recarregar: carregarTaxas,
  };
}
