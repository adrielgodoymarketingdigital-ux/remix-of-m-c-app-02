import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface ListaCompras {
  id: string;
  user_id: string;
  nome: string;
  created_at: string;
  updated_at: string;
  itens?: ItemLista[];
}

export interface ItemLista {
  id: string;
  lista_id: string;
  user_id: string;
  nome: string;
  quantidade: string;
  concluido: boolean;
  ordem: number;
  created_at: string;
}

export function useListasCompras() {
  const [listas, setListas] = useState<ListaCompras[]>([]);
  const [loading, setLoading] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("listas_compras")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });

      if (error) throw error;
      setListas((data || []) as ListaCompras[]);
    } catch {
      toast({ title: "Erro ao carregar listas", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, []);

  const criarLista = async (nome: string): Promise<ListaCompras | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from("listas_compras")
        .insert({ user_id: user.id, nome: nome.trim() })
        .select()
        .single();

      if (error) throw error;
      await carregar();
      return data as ListaCompras;
    } catch {
      toast({ title: "Erro ao criar lista", variant: "destructive" });
      return null;
    }
  };

  const renomearLista = async (id: string, nome: string): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { error } = await supabase
        .from("listas_compras")
        .update({ nome: nome.trim(), updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) throw error;
      await carregar();
      return true;
    } catch {
      toast({ title: "Erro ao renomear lista", variant: "destructive" });
      return false;
    }
  };

  const excluirLista = async (id: string): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { error } = await supabase
        .from("listas_compras")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) throw error;
      setListas(prev => prev.filter(l => l.id !== id));
      return true;
    } catch {
      toast({ title: "Erro ao excluir lista", variant: "destructive" });
      return false;
    }
  };

  return { listas, loading, carregar, criarLista, renomearLista, excluirLista };
}

export function useItensLista(listaId: string) {
  const [itens, setItens] = useState<ItemLista[]>([]);
  const [loading, setLoading] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("lista_compras")
        .select("*")
        .eq("lista_id", listaId)
        .order("concluido", { ascending: true })
        .order("ordem", { ascending: true });

      if (error) throw error;
      setItens((data || []) as ItemLista[]);
    } catch {
      toast({ title: "Erro ao carregar itens", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [listaId]);

  const adicionar = async (nome: string, quantidade: string): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { error } = await supabase
        .from("lista_compras")
        .insert({
          user_id: user.id,
          lista_id: listaId,
          nome: nome.trim(),
          quantidade: quantidade.trim() || "1",
          concluido: false,
          ordem: Math.floor(Date.now() / 1000),
        });

      if (error) throw error;

      // bump updated_at na lista pai
      await supabase
        .from("listas_compras")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", listaId);

      await carregar();
      return true;
    } catch {
      toast({ title: "Erro ao adicionar item", variant: "destructive" });
      return false;
    }
  };

  const toggle = async (id: string, concluido: boolean): Promise<void> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase
        .from("lista_compras")
        .update({ concluido: !concluido })
        .eq("id", id)
        .eq("user_id", user.id);
      if (error) throw error;
      setItens(prev =>
        prev.map(i => i.id === id ? { ...i, concluido: !concluido } : i)
          .sort((a, b) => Number(a.concluido) - Number(b.concluido) || a.ordem - b.ordem)
      );
    } catch { /* silent */ }
  };

  const editar = async (id: string, nome: string, quantidade: string): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;
      const { error } = await supabase
        .from("lista_compras")
        .update({ nome: nome.trim(), quantidade: quantidade.trim() || "1" })
        .eq("id", id)
        .eq("user_id", user.id);
      if (error) throw error;
      await carregar();
      return true;
    } catch {
      toast({ title: "Erro ao editar item", variant: "destructive" });
      return false;
    }
  };

  const excluir = async (id: string): Promise<void> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase
        .from("lista_compras")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);
      if (error) throw error;
      setItens(prev => prev.filter(i => i.id !== id));
    } catch {
      toast({ title: "Erro ao excluir item", variant: "destructive" });
    }
  };

  const limparConcluidos = async (): Promise<void> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase
        .from("lista_compras")
        .delete()
        .eq("lista_id", listaId)
        .eq("user_id", user.id)
        .eq("concluido", true);
      if (error) throw error;
      setItens(prev => prev.filter(i => !i.concluido));
      toast({ title: "Itens comprados removidos." });
    } catch { /* silent */ }
  };

  return { itens, loading, carregar, adicionar, toggle, editar, excluir, limparConcluidos };
}
