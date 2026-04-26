import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CATEGORIAS_CONTA } from "@/types/conta";

export function useCategoriasDespesas() {
  const { toast } = useToast();
  const [categoriasCustom, setCategoriasCustom] = useState<{ id: string; nome: string }[]>([]);
  const [categoriasExcluidas, setCategoriasExcluidas] = useState<{ id: string; nome: string }[]>([]);
  const [loading, setLoading] = useState(false);

  const carregar = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [customRes, excluidasRes] = await Promise.all([
      supabase
        .from("categorias_despesas")
        .select("id, nome")
        .eq("user_id", user.id)
        .order("nome"),
      supabase
        .from("categorias_sistema_excluidas")
        .select("id, nome")
        .eq("user_id", user.id),
    ]);

    setCategoriasCustom(customRes.data || []);
    setCategoriasExcluidas(excluidasRes.data || []);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const todasCategorias = useCallback(() => {
    const excluidasSet = new Set(categoriasExcluidas.map((c) => c.nome));
    const set = new Set<string>();
    CATEGORIAS_CONTA.forEach((c) => {
      if (!excluidasSet.has(c)) set.add(c);
    });
    categoriasCustom.forEach((c) => set.add(c.nome));
    return Array.from(set).sort();
  }, [categoriasCustom, categoriasExcluidas]);

  const categoriaSistemaAtivas = useCallback(() => {
    const excluidasSet = new Set(categoriasExcluidas.map((c) => c.nome));
    return CATEGORIAS_CONTA.filter((c) => !excluidasSet.has(c));
  }, [categoriasExcluidas]);

  const criar = async (nome: string) => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { error } = await supabase
        .from("categorias_despesas")
        .insert({ user_id: user.id, nome: nome.trim() });

      if (error) {
        if (error.code === "23505") {
          toast({ title: "Categoria já existe", variant: "destructive" });
        } else {
          throw error;
        }
        return false;
      }

      await carregar();
      toast({ title: "Categoria criada!" });
      return true;
    } catch (error: any) {
      toast({ title: "Erro ao criar categoria", description: error.message, variant: "destructive" });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const excluir = async (id: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("categorias_despesas")
        .delete()
        .eq("id", id);

      if (error) throw error;
      await carregar();
      toast({ title: "Categoria excluída" });
      return true;
    } catch (error: any) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const excluirSistema = async (nome: string) => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { error } = await supabase
        .from("categorias_sistema_excluidas")
        .insert({ user_id: user.id, nome });

      if (error) {
        if (error.code === "23505") {
          toast({ title: "Categoria já excluída", variant: "destructive" });
        } else {
          throw error;
        }
        return false;
      }

      await carregar();
      toast({ title: "Categoria do sistema ocultada" });
      return true;
    } catch (error: any) {
      toast({ title: "Erro ao ocultar categoria", description: error.message, variant: "destructive" });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const restaurarSistema = async (id: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("categorias_sistema_excluidas")
        .delete()
        .eq("id", id);

      if (error) throw error;
      await carregar();
      toast({ title: "Categoria restaurada" });
      return true;
    } catch (error: any) {
      toast({ title: "Erro ao restaurar", description: error.message, variant: "destructive" });
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    categoriasCustom,
    categoriasExcluidas,
    categoriaSistemaAtivas,
    todasCategorias,
    criar,
    excluir,
    excluirSistema,
    restaurarSistema,
    loading,
  };
}
