import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface ItemListaCompras {
  id: string;
  user_id: string;
  nome: string;
  quantidade: string;
  concluido: boolean;
  ordem: number;
  created_at: string;
}

export function useListaCompras() {
  const [itens, setItens] = useState<ItemListaCompras[]>([]);
  const [loading, setLoading] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("lista_compras" as never)
        .select("*")
        .eq("user_id", user.id)
        .order("concluido", { ascending: true })
        .order("ordem", { ascending: true })
        .order("created_at", { ascending: true });

      if (error) throw error;
      setItens((data || []) as ItemListaCompras[]);
    } catch (err) {
      console.error("Erro ao carregar lista de compras:", err);
      toast({ title: "Erro ao carregar lista", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, []);

  const adicionarItem = async (nome: string, quantidade: string): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { error } = await supabase
        .from("lista_compras" as never)
        .insert({
          user_id: user.id,
          nome: nome.trim(),
          quantidade: quantidade.trim() || "1",
          concluido: false,
          ordem: Date.now(),
        } as never);

      if (error) throw error;
      await carregar();
      return true;
    } catch (err) {
      console.error("Erro ao adicionar item:", err);
      toast({ title: "Erro ao adicionar item", variant: "destructive" });
      return false;
    }
  };

  const toggleConcluido = async (id: string, concluido: boolean): Promise<void> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("lista_compras" as never)
        .update({ concluido: !concluido } as never)
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) throw error;
      setItens(prev =>
        prev.map(item => item.id === id ? { ...item, concluido: !concluido } : item)
          .sort((a, b) => Number(a.concluido) - Number(b.concluido) || a.ordem - b.ordem)
      );
    } catch (err) {
      console.error("Erro ao atualizar item:", err);
    }
  };

  const editarItem = async (id: string, nome: string, quantidade: string): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { error } = await supabase
        .from("lista_compras" as never)
        .update({ nome: nome.trim(), quantidade: quantidade.trim() || "1" } as never)
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) throw error;
      await carregar();
      return true;
    } catch (err) {
      console.error("Erro ao editar item:", err);
      toast({ title: "Erro ao editar item", variant: "destructive" });
      return false;
    }
  };

  const excluirItem = async (id: string): Promise<void> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("lista_compras" as never)
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) throw error;
      setItens(prev => prev.filter(item => item.id !== id));
    } catch (err) {
      console.error("Erro ao excluir item:", err);
      toast({ title: "Erro ao excluir item", variant: "destructive" });
    }
  };

  const limparConcluidos = async (): Promise<void> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("lista_compras" as never)
        .delete()
        .eq("user_id", user.id)
        .eq("concluido", true);

      if (error) throw error;
      setItens(prev => prev.filter(item => !item.concluido));
      toast({ title: "Itens concluídos removidos." });
    } catch (err) {
      console.error("Erro ao limpar concluídos:", err);
    }
  };

  return { itens, loading, carregar, adicionarItem, toggleConcluido, editarItem, excluirItem, limparConcluidos };
}
