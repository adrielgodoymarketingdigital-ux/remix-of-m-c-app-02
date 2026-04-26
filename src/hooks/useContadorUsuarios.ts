import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useContadorUsuarios() {
  const [totalUsuarios, setTotalUsuarios] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Buscar contagem inicial
    const fetchContagem = async () => {
      try {
        const { count, error } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true });

        if (error) {
          console.error('Erro ao buscar contagem de usuários:', error);
          return;
        }

        setTotalUsuarios(count || 0);
      } catch (err) {
        console.error('Erro inesperado:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchContagem();

    // Configurar subscription para atualizações em tempo real
    const channel = supabase
      .channel('profiles-counter')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'profiles'
        },
        () => {
          // Incrementar contador quando novo usuário se cadastrar
          setTotalUsuarios(prev => prev + 1);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'profiles'
        },
        () => {
          // Decrementar contador quando usuário for removido
          setTotalUsuarios(prev => Math.max(0, prev - 1));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { totalUsuarios, loading };
}
