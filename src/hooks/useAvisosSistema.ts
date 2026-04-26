import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAssinatura } from './useAssinatura';
import { useToast } from './use-toast';
import type { AvisoSistemaInsert, AvisoSistemaUpdate } from '@/types/aviso';

// Tipo que corresponde ao retorno da view pública (sem created_by)
interface AvisoSistemaPublico {
  id: string;
  titulo: string;
  mensagem: string;
  tipo: string;
  icone: string | null;
  link_url: string | null;
  link_texto: string | null;
  publico_alvo: string[];
  ativo: boolean;
  data_inicio: string;
  data_fim: string | null;
  prioridade: number;
  cor_fundo: string | null;
  cor_texto: string | null;
  cor_icone: string | null;
  cor_botao: string | null;
  imagem_url: string | null;
  imagem_posicao: string | null;
  created_at: string;
  updated_at: string;
}

// Tipo completo para admin (inclui created_by)
interface AvisoSistemaDB extends AvisoSistemaPublico {
  created_by: string | null;
}

export function useAvisosSistema() {
  const [avisos, setAvisos] = useState<AvisoSistemaPublico[]>([]);
  const [loading, setLoading] = useState(true);
  const { assinatura, trialExpirado } = useAssinatura();

  const planoUsuario = assinatura?.plano_tipo || 'trial';

  const carregarAvisos = async () => {
    setLoading(true);
    try {
      // Usar a view pública que não expõe created_by
      const { data, error } = await supabase
        .from('avisos_sistema_publico')
        .select('*')
        .order('prioridade', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;

      // A view já filtra por ativo=true e período válido
      // Aqui filtramos apenas pelo público-alvo do usuário
      const avisosDoUsuario = (data || []).filter((aviso) => {
        const incluiTodos = aviso.publico_alvo.includes('todos');
        const incluiPlano = aviso.publico_alvo.includes(planoUsuario);
        const incluiTrialExpirado = aviso.publico_alvo.includes('trial_expirado') && trialExpirado;
        
        return incluiTodos || incluiPlano || incluiTrialExpirado;
      });

      setAvisos(avisosDoUsuario);
    } catch (error) {
      console.error('Erro ao carregar avisos:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarAvisos();
  }, [planoUsuario, trialExpirado]);

  return {
    avisos,
    loading,
    recarregar: carregarAvisos,
  };
}

export function useAvisosSistemaAdmin() {
  const [avisos, setAvisos] = useState<AvisoSistemaDB[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const carregarAvisos = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('avisos_sistema')
        .select('*')
        .order('prioridade', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAvisos(data || []);
    } catch (error) {
      console.error('Erro ao carregar avisos:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar os avisos.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const criarAviso = async (aviso: AvisoSistemaInsert) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('avisos_sistema')
        .insert({
          ...aviso,
          created_by: user?.id,
        });

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'Aviso criado com sucesso!',
      });

      await carregarAvisos();
      return true;
    } catch (error) {
      console.error('Erro ao criar aviso:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível criar o aviso.',
        variant: 'destructive',
      });
      return false;
    }
  };

  const atualizarAviso = async (id: string, aviso: AvisoSistemaUpdate) => {
    try {
      const { error } = await supabase
        .from('avisos_sistema')
        .update(aviso)
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'Aviso atualizado com sucesso!',
      });

      await carregarAvisos();
      return true;
    } catch (error) {
      console.error('Erro ao atualizar aviso:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar o aviso.',
        variant: 'destructive',
      });
      return false;
    }
  };

  const excluirAviso = async (id: string) => {
    try {
      const { error } = await supabase
        .from('avisos_sistema')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'Aviso excluído com sucesso!',
      });

      await carregarAvisos();
      return true;
    } catch (error) {
      console.error('Erro ao excluir aviso:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível excluir o aviso.',
        variant: 'destructive',
      });
      return false;
    }
  };

  const toggleAtivo = async (id: string, ativo: boolean) => {
    return atualizarAviso(id, { ativo });
  };

  useEffect(() => {
    carregarAvisos();
  }, []);

  return {
    avisos,
    loading,
    criarAviso,
    atualizarAviso,
    excluirAviso,
    toggleAtivo,
    recarregar: carregarAvisos,
  };
}
