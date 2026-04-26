import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CategoriaProduto, FormularioCategoria } from '@/types/categoria-produto';
import { useFuncionarioPermissoes } from './useFuncionarioPermissoes';

export const useCategoriasProdutos = () => {
  const [categorias, setCategorias] = useState<CategoriaProduto[]>([]);
  const [loading, setLoading] = useState(false);
  const { lojaUserId, podeSincronizarProdutos, isFuncionario } = useFuncionarioPermissoes();

  const carregarCategorias = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) { setLoading(false); return; }

      const userId = (isFuncionario && podeSincronizarProdutos && lojaUserId) ? lojaUserId : user.id;

      const { data, error } = await supabase
        .from('categorias_produtos')
        .select('*')
        .eq('user_id', userId)
        .order('nome');

      if (error) throw error;
      setCategorias((data as any[]) || []);
    } catch (error: any) {
      console.error('Erro ao carregar categorias:', error);
    } finally {
      setLoading(false);
    }
  }, [lojaUserId, podeSincronizarProdutos, isFuncionario]);

  const criarCategoria = useCallback(async (dados: FormularioCategoria) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const userId = (isFuncionario && podeSincronizarProdutos && lojaUserId) ? lojaUserId : user.id;

      const { error } = await supabase.from('categorias_produtos').insert({
        nome: dados.nome,
        cor: dados.cor,
        user_id: userId,
      } as any);

      if (error) throw error;
      toast.success('Categoria criada com sucesso!');
      await carregarCategorias();
      return true;
    } catch (error: any) {
      toast.error('Erro ao criar categoria', { description: error.message });
      return false;
    }
  }, [carregarCategorias, lojaUserId, podeSincronizarProdutos, isFuncionario]);

  const atualizarCategoria = useCallback(async (id: string, dados: FormularioCategoria) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const userId = (isFuncionario && podeSincronizarProdutos && lojaUserId) ? lojaUserId : user.id;

      const { error } = await supabase
        .from('categorias_produtos')
        .update({ nome: dados.nome, cor: dados.cor } as any)
        .eq('id', id)
        .eq('user_id', userId);

      if (error) throw error;
      toast.success('Categoria atualizada!');
      await carregarCategorias();
      return true;
    } catch (error: any) {
      toast.error('Erro ao atualizar categoria', { description: error.message });
      return false;
    }
  }, [carregarCategorias, lojaUserId, podeSincronizarProdutos, isFuncionario]);

  const excluirCategoria = useCallback(async (id: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const userId = (isFuncionario && podeSincronizarProdutos && lojaUserId) ? lojaUserId : user.id;

      const { error } = await supabase
        .from('categorias_produtos')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (error) throw error;
      toast.success('Categoria excluída!');
      await carregarCategorias();
      return true;
    } catch (error: any) {
      toast.error('Erro ao excluir categoria', { description: error.message });
      return false;
    }
  }, [carregarCategorias, lojaUserId, podeSincronizarProdutos, isFuncionario]);

  return {
    categorias,
    loading,
    carregarCategorias,
    criarCategoria,
    atualizarCategoria,
    excluirCategoria,
  };
};
