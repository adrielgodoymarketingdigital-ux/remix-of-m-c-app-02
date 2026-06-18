import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useIdentidade } from "./useResolvedUserId";

export interface TrocaGarantia {
  id: string;
  user_id: string;
  empresa_id: string | null;
  venda_id: string | null;
  cliente_nome: string | null;
  produto_defeituoso_nome: string;
  motivo_defeito: string | null;
  produto_novo_id: string;
  produto_novo_nome: string;
  observacao: string | null;
  created_at: string;
}

export interface NovaTrocaGarantia {
  venda_id?: string | null;
  cliente_nome?: string | null;
  produto_defeituoso_nome: string;
  motivo_defeito?: string | null;
  produto_novo_id: string;
  produto_novo_nome: string;
  observacao?: string | null;
}

export function useTrocasGarantia() {
  const [trocas, setTrocas] = useState<TrocaGarantia[]>([]);
  const [loading, setLoading] = useState(false);
  const { userId: resolvedUserId, empresaId: empresaFiltro, carregando: identidadeCarregando } = useIdentidade();

  const carregar = useCallback(async () => {
    if (identidadeCarregando || !resolvedUserId) return;
    try {
      setLoading(true);
      let query = supabase
        .from("trocas_garantia")
        .select("*")
        .eq("user_id", resolvedUserId)
        .order("created_at", { ascending: false });
      if (empresaFiltro) query = query.eq("empresa_id", empresaFiltro);
      const { data, error } = await query;

      if (error) throw error;
      setTrocas((data || []) as TrocaGarantia[]);
    } catch (error) {
      console.error("Erro ao carregar trocas em garantia:", error);
      toast.error("Erro ao carregar trocas em garantia");
    } finally {
      setLoading(false);
    }
  }, [resolvedUserId, empresaFiltro, identidadeCarregando]);

  const criar = async (dados: NovaTrocaGarantia) => {
    if (!resolvedUserId) return false;
    try {
      const { data: produtoAtual, error: erroSelect } = await supabase
        .from("produtos")
        .select("quantidade")
        .eq("id", dados.produto_novo_id)
        .single();
      if (erroSelect) throw erroSelect;

      const quantidadeAtual = produtoAtual?.quantidade ?? 0;
      if (quantidadeAtual <= 0) {
        toast.error("Produto novo sem estoque disponível");
        return false;
      }

      const { error: erroUpdate } = await supabase
        .from("produtos")
        .update({ quantidade: quantidadeAtual - 1 } as any)
        .eq("id", dados.produto_novo_id);
      if (erroUpdate) throw erroUpdate;

      const { error: erroInsert } = await supabase.from("trocas_garantia").insert({
        user_id: resolvedUserId,
        empresa_id: empresaFiltro,
        venda_id: dados.venda_id ?? null,
        cliente_nome: dados.cliente_nome ?? null,
        produto_defeituoso_nome: dados.produto_defeituoso_nome,
        motivo_defeito: dados.motivo_defeito ?? null,
        produto_novo_id: dados.produto_novo_id,
        produto_novo_nome: dados.produto_novo_nome,
        observacao: dados.observacao ?? null,
      } as any);

      if (erroInsert) {
        await supabase
          .from("produtos")
          .update({ quantidade: quantidadeAtual } as any)
          .eq("id", dados.produto_novo_id);
        throw erroInsert;
      }

      toast.success("Troca em garantia registrada! Estoque atualizado.");
      await carregar();
      return true;
    } catch (error: any) {
      toast.error("Erro ao registrar troca em garantia", { description: error.message });
      return false;
    }
  };

  const excluir = async (id: string) => {
    try {
      const { error } = await supabase.from("trocas_garantia").delete().eq("id", id);
      if (error) throw error;
      toast.success("Registro de troca excluído. O estoque não foi alterado.");
      await carregar();
    } catch (error) {
      toast.error("Erro ao excluir registro de troca");
    }
  };

  useEffect(() => {
    carregar();
  }, [carregar]);

  return { trocas, loading, carregar, criar, excluir };
}
