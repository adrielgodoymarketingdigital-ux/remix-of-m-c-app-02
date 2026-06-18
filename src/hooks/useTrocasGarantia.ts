import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useIdentidade } from "./useResolvedUserId";

export type TipoTrocaGarantia = "garantia" | "troca_comercial";

export interface TrocaGarantia {
  id: string;
  user_id: string;
  empresa_id: string | null;
  venda_id: string | null;
  cliente_nome: string | null;
  tipo: TipoTrocaGarantia;
  produto_defeituoso_nome: string;
  produto_devolvido_id: string | null;
  motivo_defeito: string | null;
  produto_novo_id: string;
  produto_novo_nome: string;
  observacao: string | null;
  created_at: string;
}

export interface NovaTrocaGarantia {
  venda_id?: string | null;
  cliente_nome?: string | null;
  tipo: TipoTrocaGarantia;
  produto_devolvido_id: string;
  produto_devolvido_nome: string;
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
    if (dados.produto_devolvido_id === dados.produto_novo_id) {
      toast.error("Selecione produtos diferentes para devolução e entrega");
      return false;
    }
    try {
      const { data: produtoNovoAtual, error: erroSelectNovo } = await supabase
        .from("produtos")
        .select("quantidade")
        .eq("id", dados.produto_novo_id)
        .single();
      if (erroSelectNovo) throw erroSelectNovo;

      const quantidadeNovoAtual = produtoNovoAtual?.quantidade ?? 0;
      if (quantidadeNovoAtual <= 0) {
        toast.error("Produto novo sem estoque disponível");
        return false;
      }

      const { error: erroUpdateNovo } = await supabase
        .from("produtos")
        .update({ quantidade: quantidadeNovoAtual - 1 } as any)
        .eq("id", dados.produto_novo_id);
      if (erroUpdateNovo) throw erroUpdateNovo;

      let quantidadeDevolvidoAtual: number | null = null;
      if (dados.tipo === "troca_comercial") {
        const { data: produtoDevolvidoAtual, error: erroSelectDevolvido } = await supabase
          .from("produtos")
          .select("quantidade")
          .eq("id", dados.produto_devolvido_id)
          .single();
        if (erroSelectDevolvido) throw erroSelectDevolvido;

        quantidadeDevolvidoAtual = produtoDevolvidoAtual?.quantidade ?? 0;
        const { error: erroUpdateDevolvido } = await supabase
          .from("produtos")
          .update({ quantidade: quantidadeDevolvidoAtual + 1 } as any)
          .eq("id", dados.produto_devolvido_id);
        if (erroUpdateDevolvido) {
          await supabase
            .from("produtos")
            .update({ quantidade: quantidadeNovoAtual } as any)
            .eq("id", dados.produto_novo_id);
          throw erroUpdateDevolvido;
        }
      }

      const { error: erroInsert } = await supabase.from("trocas_garantia").insert({
        user_id: resolvedUserId,
        empresa_id: empresaFiltro,
        venda_id: dados.venda_id ?? null,
        cliente_nome: dados.cliente_nome ?? null,
        tipo: dados.tipo,
        produto_defeituoso_nome: dados.produto_devolvido_nome,
        produto_devolvido_id: dados.produto_devolvido_id,
        motivo_defeito: dados.tipo === "garantia" ? (dados.motivo_defeito ?? null) : null,
        produto_novo_id: dados.produto_novo_id,
        produto_novo_nome: dados.produto_novo_nome,
        observacao: dados.observacao ?? null,
      } as any);

      if (erroInsert) {
        await supabase
          .from("produtos")
          .update({ quantidade: quantidadeNovoAtual } as any)
          .eq("id", dados.produto_novo_id);
        if (dados.tipo === "troca_comercial" && quantidadeDevolvidoAtual !== null) {
          await supabase
            .from("produtos")
            .update({ quantidade: quantidadeDevolvidoAtual } as any)
            .eq("id", dados.produto_devolvido_id);
        }
        throw erroInsert;
      }

      toast.success("Troca registrada! Estoque atualizado.");
      await carregar();
      return true;
    } catch (error: any) {
      toast.error("Erro ao registrar troca", { description: error.message });
      return false;
    }
  };

  const excluir = async (id: string) => {
    try {
      const { error } = await supabase.from("trocas_garantia").delete().eq("id", id);
      if (error) throw error;
      toast.success("Registro de troca excluído. Nenhum ajuste de estoque é revertido automaticamente.");
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
