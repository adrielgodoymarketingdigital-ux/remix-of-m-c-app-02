import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export type StatusPedido = "aguardando" | "confirmado" | "chegou" | "entregue" | "cancelado";

export interface Pedido {
  id: string;
  user_id: string;
  cliente_nome: string;
  cliente_telefone: string | null;
  descricao: string;
  status: StatusPedido;
  pago: boolean;
  valor_total: number | null;
  previsao_chegada: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

export interface FormularioPedido {
  cliente_nome: string;
  cliente_telefone: string;
  descricao: string;
  status: StatusPedido;
  pago: boolean;
  valor_total: string;
  previsao_chegada: string;
  observacoes: string;
}

export const STATUS_LABELS: Record<StatusPedido, string> = {
  aguardando: "Aguardando",
  confirmado: "Confirmado",
  chegou: "Chegou",
  entregue: "Entregue",
  cancelado: "Cancelado",
};

export const STATUS_CORES: Record<StatusPedido, string> = {
  aguardando: "bg-yellow-100 text-yellow-800",
  confirmado: "bg-blue-100 text-blue-800",
  chegou: "bg-purple-100 text-purple-800",
  entregue: "bg-green-100 text-green-800",
  cancelado: "bg-red-100 text-red-800",
};

export function usePedidos() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(false);

  const carregarPedidos = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("pedidos")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPedidos((data || []) as Pedido[]);
    } catch (error) {
      console.error("Erro ao carregar pedidos:", error);
      toast({ title: "Erro ao carregar pedidos", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, []);

  const criarPedido = async (form: FormularioPedido): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { error } = await supabase.from("pedidos").insert({
        user_id: user.id,
        cliente_nome: form.cliente_nome.trim(),
        cliente_telefone: form.cliente_telefone.trim() || null,
        descricao: form.descricao.trim(),
        status: form.status,
        pago: form.pago,
        valor_total: form.valor_total ? Number(form.valor_total) : null,
        previsao_chegada: form.previsao_chegada || null,
        observacoes: form.observacoes.trim() || null,
      });

      if (error) throw error;
      toast({ title: "Pedido cadastrado com sucesso!" });
      await carregarPedidos();
      return true;
    } catch (error) {
      console.error("Erro ao criar pedido:", error);
      toast({ title: "Erro ao cadastrar pedido", variant: "destructive" });
      return false;
    }
  };

  const atualizarPedido = async (id: string, form: Partial<FormularioPedido>): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (form.cliente_nome !== undefined) payload.cliente_nome = form.cliente_nome.trim();
      if (form.cliente_telefone !== undefined) payload.cliente_telefone = form.cliente_telefone.trim() || null;
      if (form.descricao !== undefined) payload.descricao = form.descricao.trim();
      if (form.status !== undefined) payload.status = form.status;
      if (form.pago !== undefined) payload.pago = form.pago;
      if (form.valor_total !== undefined) payload.valor_total = form.valor_total ? Number(form.valor_total) : null;
      if (form.previsao_chegada !== undefined) payload.previsao_chegada = form.previsao_chegada || null;
      if (form.observacoes !== undefined) payload.observacoes = form.observacoes.trim() || null;

      const { error } = await supabase
        .from("pedidos")
        .update(payload)
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) throw error;
      toast({ title: "Pedido atualizado!" });
      await carregarPedidos();
      return true;
    } catch (error) {
      console.error("Erro ao atualizar pedido:", error);
      toast({ title: "Erro ao atualizar pedido", variant: "destructive" });
      return false;
    }
  };

  const excluirPedido = async (id: string): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { error } = await supabase
        .from("pedidos")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) throw error;
      toast({ title: "Pedido excluído." });
      await carregarPedidos();
      return true;
    } catch (error) {
      console.error("Erro ao excluir pedido:", error);
      toast({ title: "Erro ao excluir pedido", variant: "destructive" });
      return false;
    }
  };

  return { pedidos, loading, carregarPedidos, criarPedido, atualizarPedido, excluirPedido };
}
