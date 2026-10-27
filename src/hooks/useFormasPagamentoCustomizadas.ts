import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import i18n from "@/lib/i18n/instancia";

// Toasts lidos na hora (saem depois de um await; ver convencoes.md, item 10).
const tAgora = (chave: string) => i18n.t(chave, { ns: "pdv" });

export interface FormaPagamentoCustomizada {
  id: string;
  user_id: string;
  empresa_id?: string | null;
  nome: string;
  ativo: boolean;
  created_at: string;
}

export function useFormasPagamentoCustomizadas(empresaId?: string | null) {
  const [formas, setFormas] = useState<FormaPagamentoCustomizada[]>([]);
  const [loading, setLoading] = useState(true);

  const carregar = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("formas_pagamento_customizadas")
        .select("*")
        .eq("user_id", user.id)
        .eq("ativo", true)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setFormas(data || []);
    } catch (error) {
      console.error("Erro ao carregar formas de pagamento:", error);
    } finally {
      setLoading(false);
    }
  };

  const criar = async (nome: string): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const nomeTrimmed = nome.trim();
      if (!nomeTrimmed) {
        toast.error(tAgora("avisos.nomeFormaObrigatorio"));
        return false;
      }

      const { error } = await supabase
        .from("formas_pagamento_customizadas")
        .insert({
          user_id: user.id,
          empresa_id: empresaId || null,
          nome: nomeTrimmed,
          ativo: true,
        });

      if (error) throw error;
      toast.success(tAgora("avisos.formaCriada"));
      await carregar();
      return true;
    } catch (error) {
      console.error("Erro ao criar forma de pagamento:", error);
      toast.error(tAgora("avisos.erroCriarForma"));
      return false;
    }
  };

  const excluir = async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from("formas_pagamento_customizadas")
        .update({ ativo: false })
        .eq("id", id);

      if (error) throw error;
      toast.success(tAgora("avisos.formaRemovida"));
      await carregar();
      return true;
    } catch (error) {
      console.error("Erro ao excluir forma de pagamento:", error);
      toast.error(tAgora("avisos.erroRemoverForma"));
      return false;
    }
  };

  useEffect(() => {
    carregar();
  }, [empresaId]);

  return { formas, loading, criar, excluir, carregar };
}
