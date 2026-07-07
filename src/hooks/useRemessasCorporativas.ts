import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface RemessaItem {
  id: string;
  remessa_id: string;
  user_id: string;
  marca?: string;
  modelo: string;
  cor?: string;
  imei?: string;
  numero_serie?: string;
  defeito_padrao?: string;
  status: "pendente" | "recebido";
  os_ids?: string[];
  created_at: string;
}

export interface Remessa {
  id: string;
  user_id: string;
  empresa_id?: string;
  cliente_id?: string;
  cliente_nome?: string;
  nome: string;
  descricao?: string;
  status: "ativa" | "concluida" | "cancelada";
  created_at: string;
  updated_at: string;
  itens?: RemessaItem[];
}

export function useRemessasCorporativas() {
  const [remessas, setRemessas] = useState<Remessa[]>([]);
  const [loading, setLoading] = useState(true);

  const carregar = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("remessas_corporativas")
        .select(`
          *,
          clientes(nome),
          remessa_itens(*)
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const remessasFormatadas = (data || []).map((r: any) => ({
        ...r,
        cliente_nome: r.clientes?.nome,
        itens: r.remessa_itens || [],
      }));

      setRemessas(remessasFormatadas);
    } catch (error) {
      console.error("Erro ao carregar remessas:", error);
    } finally {
      setLoading(false);
    }
  };

  const criarRemessa = async (dados: {
    nome: string;
    descricao?: string;
    cliente_id?: string;
    empresa_id?: string;
  }): Promise<Remessa | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from("remessas_corporativas")
        .insert({ ...dados, user_id: user.id })
        .select()
        .single();

      if (error) throw error;
      toast.success("Remessa criada!");
      await carregar();
      return data as Remessa;
    } catch (error) {
      console.error("Erro ao criar remessa:", error);
      toast.error("Erro ao criar remessa");
      return null;
    }
  };

  const adicionarItem = async (
    remessa_id: string,
    item: Omit<RemessaItem, "id" | "remessa_id" | "user_id" | "status" | "os_ids" | "created_at">
  ): Promise<RemessaItem | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from("remessa_itens")
        .insert({ ...item, remessa_id, user_id: user.id, status: "pendente" })
        .select()
        .single();

      if (error) throw error;
      toast.success("Dispositivo adicionado!");
      await carregar();
      return data as RemessaItem;
    } catch (error) {
      console.error("Erro ao adicionar item:", error);
      toast.error("Erro ao adicionar dispositivo");
      return null;
    }
  };

  const removerItem = async (item_id: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from("remessa_itens")
        .delete()
        .eq("id", item_id);

      if (error) throw error;
      await carregar();
      return true;
    } catch (error) {
      console.error("Erro ao remover item:", error);
      toast.error("Erro ao remover dispositivo");
      return false;
    }
  };

  const buscarItemPorId = async (item_id: string): Promise<RemessaItem | null> => {
    try {
      const { data, error } = await supabase
        .from("remessa_itens")
        .select("*, remessas_corporativas(nome, cliente_id, user_id, clientes(nome))")
        .eq("id", item_id)
        .single();

      if (error) throw error;
      return data as any;
    } catch (error) {
      return null;
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  return {
    remessas,
    loading,
    carregar,
    criarRemessa,
    adicionarItem,
    removerItem,
    buscarItemPorId,
  };
}
