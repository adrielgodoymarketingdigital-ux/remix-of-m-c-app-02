import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Orcamento, StatusOrcamento } from "@/types/orcamento";
import { useEmpresaFiltro, useResolvedUserId } from "./useResolvedUserId";

export function useOrcamentos() {
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const { toast } = useToast();
  const empresaFiltro = useEmpresaFiltro();
  const resolvedUserId = useResolvedUserId();

  const carregarOrcamentos = async () => {
    try {
      setCarregando(true);
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return;

      const userId = resolvedUserId ?? user.id;

      let query = supabase
        .from("orcamentos")
        .select("*")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (empresaFiltro) query = query.eq("empresa_id", empresaFiltro);
      const { data, error } = await query;

      if (error) throw error;

      const orcamentosFormatados: Orcamento[] = (data || []).map((o: any) => ({
        ...o,
        itens: Array.isArray(o.itens) ? o.itens : (typeof o.itens === 'string' ? JSON.parse(o.itens) : []),
      }));

      setOrcamentos(orcamentosFormatados);
    } catch (error: any) {
      console.error("Erro ao carregar orçamentos:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os orçamentos.",
        variant: "destructive",
      });
    } finally {
      setCarregando(false);
    }
  };

  const criarOrcamento = async (
    dados: Omit<Orcamento, "id" | "user_id" | "numero_orcamento" | "created_at" | "updated_at">
  ) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const userId = resolvedUserId ?? user.id;

      const dataValidade = new Date();
      dataValidade.setDate(dataValidade.getDate() + dados.validade_dias);

      const { data, error } = await supabase
        .from("orcamentos")
        .insert([{
          user_id: userId,
          numero_orcamento: "",
          empresa_id: empresaFiltro ?? null,
          cliente_id: dados.cliente_id,
          cliente_nome: dados.cliente_nome,
          cliente_telefone: dados.cliente_telefone,
          cliente_email: dados.cliente_email,
          status: dados.status,
          itens: dados.itens as any,
          subtotal: dados.subtotal,
          desconto: dados.desconto,
          valor_total: dados.valor_total,
          validade_dias: dados.validade_dias,
          data_validade: dataValidade.toISOString(),
          observacoes: dados.observacoes,
          termos_condicoes: dados.termos_condicoes,
        }])
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: `Orçamento ${data.numero_orcamento} criado com sucesso!`,
      });

      await carregarOrcamentos();
      return data;
    } catch (error: any) {
      console.error("Erro ao criar orçamento:", error);
      toast({
        title: "Erro",
        description: "Não foi possível criar o orçamento.",
        variant: "destructive",
      });
      throw error;
    }
  };

  const atualizarOrcamento = async (id: string, dados: Partial<Orcamento>) => {
    try {
      const updateData: any = { ...dados };

      const { error } = await supabase
        .from("orcamentos")
        .update(updateData)
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Orçamento atualizado com sucesso!",
      });

      await carregarOrcamentos();
    } catch (error: any) {
      console.error("Erro ao atualizar orçamento:", error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o orçamento.",
        variant: "destructive",
      });
      throw error;
    }
  };

  const atualizarStatus = async (id: string, status: StatusOrcamento) => {
    await atualizarOrcamento(id, { status });
  };

  const excluirOrcamento = async (id: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { error } = await supabase
        .from("orcamentos")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Orçamento excluído com sucesso!",
      });

      await carregarOrcamentos();
    } catch (error: any) {
      console.error("Erro ao excluir orçamento:", error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir o orçamento.",
        variant: "destructive",
      });
      throw error;
    }
  };

  useEffect(() => {
    carregarOrcamentos();
  }, [empresaFiltro]);

  return {
    orcamentos,
    carregando,
    criarOrcamento,
    atualizarOrcamento,
    atualizarStatus,
    excluirOrcamento,
    recarregar: carregarOrcamentos,
  };
}
