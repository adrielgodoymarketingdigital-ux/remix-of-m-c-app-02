import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import i18n from "@/lib/i18n/instancia";

// Toasts lidos na hora (saem depois de um await; ver convencoes.md, item 10).
const tAgora = (chave: string) => i18n.t(chave, { ns: "pdv" });

export interface CaixaMovimentacao {
  id: string;
  caixa_id: string;
  user_id: string;
  tipo: "sangria" | "suprimento";
  valor: number;
  motivo?: string | null;
  created_at: string;
}

export function useCaixaMovimentacoes() {
  const [movimentacoes, setMovimentacoes] = useState<CaixaMovimentacao[]>([]);
  const [loading, setLoading] = useState(false);

  const carregarMovimentacoes = async (caixaId: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("caixa_movimentacoes")
        .select("*")
        .eq("caixa_id", caixaId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setMovimentacoes(data as CaixaMovimentacao[]);
    } catch (error) {
      console.error("Erro ao carregar movimentações:", error);
    } finally {
      setLoading(false);
    }
  };

  const registrarMovimentacao = async (
    caixaId: string,
    tipo: "sangria" | "suprimento",
    valor: number,
    motivo?: string
  ): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      if (valor <= 0) {
        toast.error(tAgora("avisos.valorMaiorQueZero"));
        return false;
      }

      const { error } = await supabase
        .from("caixa_movimentacoes")
        .insert({
          caixa_id: caixaId,
          user_id: user.id,
          tipo,
          valor,
          motivo: motivo || null,
        });

      if (error) throw error;

      toast.success(tipo === "sangria" ? tAgora("avisos.sangriaRegistrada") : tAgora("avisos.suprimentoRegistrado"));
      await carregarMovimentacoes(caixaId);
      return true;
    } catch (error) {
      console.error("Erro ao registrar movimentação:", error);
      toast.error(tAgora("avisos.erroMovimentacao"));
      return false;
    }
  };

  const totalSangrias = movimentacoes
    .filter(m => m.tipo === "sangria")
    .reduce((acc, m) => acc + m.valor, 0);

  const totalSuprimentos = movimentacoes
    .filter(m => m.tipo === "suprimento")
    .reduce((acc, m) => acc + m.valor, 0);

  return {
    movimentacoes,
    loading,
    totalSangrias,
    totalSuprimentos,
    carregarMovimentacoes,
    registrarMovimentacao,
  };
}
