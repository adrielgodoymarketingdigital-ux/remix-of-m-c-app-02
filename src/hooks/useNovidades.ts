import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Novidade, NovidadeInsert, NovidadeUpdate, SecaoNovidade, LayoutConfig } from "@/types/novidade";

// Helper para converter dados do banco
const parseNovidade = (data: any): Novidade => ({
  ...data,
  conteudo: (data.conteudo || []) as SecaoNovidade[],
  layout_config: (data.layout_config || {}) as LayoutConfig,
  publico_alvo: data.publico_alvo || [],
});

// Hook para usuários - busca novidades públicas filtradas por plano
export function useNovidades(planoTipo?: string) {
  return useQuery({
    queryKey: ["novidades", planoTipo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("novidades_publico")
        .select("*")
        .order("prioridade", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Filtrar por plano do usuário
      const novidades = (data || []).map(parseNovidade);
      
      if (!planoTipo) return novidades;
      
      return novidades.filter(n => 
        n.publico_alvo.includes(planoTipo) || n.publico_alvo.length === 0
      );
    },
  });
}

// Hook para admins - CRUD completo
export function useNovidadesAdmin() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const query = useQuery({
    queryKey: ["novidades-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("novidades")
        .select("*")
        .order("prioridade", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []).map(parseNovidade);
    },
  });

  const criarNovidade = useMutation({
    mutationFn: async (novidade: NovidadeInsert) => {
      const { data: userData } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from("novidades")
        .insert({
          ...novidade,
          conteudo: novidade.conteudo as any,
          layout_config: novidade.layout_config as any,
          created_by: userData.user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return parseNovidade(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["novidades-admin"] });
      queryClient.invalidateQueries({ queryKey: ["novidades"] });
      toast({ title: "Novidade criada com sucesso!" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Erro ao criar novidade", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const atualizarNovidade = useMutation({
    mutationFn: async ({ id, ...updates }: NovidadeUpdate) => {
      const { data, error } = await supabase
        .from("novidades")
        .update({
          ...updates,
          conteudo: updates.conteudo as any,
          layout_config: updates.layout_config as any,
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return parseNovidade(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["novidades-admin"] });
      queryClient.invalidateQueries({ queryKey: ["novidades"] });
      toast({ title: "Novidade atualizada com sucesso!" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Erro ao atualizar novidade", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const excluirNovidade = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("novidades")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["novidades-admin"] });
      queryClient.invalidateQueries({ queryKey: ["novidades"] });
      toast({ title: "Novidade excluída com sucesso!" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Erro ao excluir novidade", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const toggleAtivo = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase
        .from("novidades")
        .update({ ativo })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: (_, { ativo }) => {
      queryClient.invalidateQueries({ queryKey: ["novidades-admin"] });
      queryClient.invalidateQueries({ queryKey: ["novidades"] });
      toast({ 
        title: ativo ? "Novidade publicada!" : "Novidade despublicada" 
      });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Erro ao alterar status", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  // Upload de arquivo para o bucket
  const uploadAsset = async (file: File): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `assets/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("novidades-assets")
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from("novidades-assets")
      .getPublicUrl(filePath);

    return publicUrl;
  };

  return {
    novidades: query.data || [],
    isLoading: query.isLoading,
    error: query.error,
    criarNovidade,
    atualizarNovidade,
    excluirNovidade,
    toggleAtivo,
    uploadAsset,
  };
}
