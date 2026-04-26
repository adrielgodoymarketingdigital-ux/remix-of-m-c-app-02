import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Dispositivo } from "@/types/dispositivo";
import { useAssinatura } from "./useAssinatura";
import { useEventTracking } from "./useEventTracking";
import { useConfetti } from "./useConfetti";
import { useFuncionarioPermissoes } from "./useFuncionarioPermissoes";
import { withRetry, classifyError, shouldSuppressToast } from "@/lib/supabase-retry";

export function useDispositivos() {
  const [dispositivos, setDispositivos] = useState<Dispositivo[]>([]);
  const [loading, setLoading] = useState(true);
  const { podeCadastrarDispositivo, limites } = useAssinatura();
  const { trackDispositivoCadastrado } = useEventTracking();
  const { disparar: dispararConfetti } = useConfetti();
  const { lojaUserId, podeSincronizarDispositivos, isFuncionario } = useFuncionarioPermissoes();
  const navigate = useNavigate();

  const carregarDispositivos = useCallback(async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;

      if (!user) {
        setLoading(false);
        return;
      }

      // Usar ID do dono se funcionário tem permissão de sincronizar dispositivos
      const userId = (isFuncionario && podeSincronizarDispositivos && lojaUserId) ? lojaUserId : user.id;

      const data = await withRetry(async () => {
        const { data, error } = await supabase
          .from("dispositivos")
          .select(`
            *,
            fornecedores (nome)
          `)
          .eq("user_id", userId)
          .eq("vendido", false)
          .is("deleted_at", null)
          .order("marca", { ascending: true })
          .order("modelo", { ascending: true });
        if (error) throw error;
        return data;
      }, 'useDispositivos.carregarDispositivos');

      setDispositivos((data || []) as Dispositivo[]);
    } catch (error: unknown) {
      if (!shouldSuppressToast(error)) {
        const { userMessage } = classifyError(error);
        toast({
          title: "Erro ao carregar dispositivos",
          description: userMessage,
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  }, [lojaUserId, podeSincronizarDispositivos, isFuncionario]);

  const criarDispositivo = async (dados: any): Promise<Dispositivo | null> => {
    try {
      // Obter user_id do usuário autenticado
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Erro de autenticação",
          description: "Por favor, faça login novamente.",
          variant: "destructive",
        });
        return null;
      }

      // Verificar limite do plano
      const podeAdicionar = await podeCadastrarDispositivo();
      if (!podeAdicionar) {
        const limiteTexto = limites.dispositivos === -1 
          ? "ilimitado" 
          : limites.dispositivos.toString();
        toast({
          title: "Limite de dispositivos atingido",
          description: `Seu plano atual permite até ${limiteTexto} dispositivos. Faça upgrade para adicionar mais!`,
          variant: "destructive",
        });
        return null;
      }

      // Usar ID do dono se funcionário tem permissão
      const userId = (isFuncionario && podeSincronizarDispositivos && lojaUserId) ? lojaUserId : user.id;

      // Garantir compatibilidade entre foto_url e fotos + adicionar user_id
      const dadosAjustados = {
        ...dados,
        foto_url: dados.foto_url || dados.fotos?.[0] || null,
        fotos: dados.fotos || (dados.foto_url ? [dados.foto_url] : []),
        fornecedor_id: dados.fornecedor_id || null,
        user_id: userId,
        codigo_barras: dados.codigo_barras || null,
      };

      const { data, error } = await supabase
        .from("dispositivos")
        .insert(dadosAjustados)
        .select(`
          *,
          fornecedores (nome)
        `)
        .single();

      if (error) throw error;

      toast({
        title: "Dispositivo cadastrado",
        description: "O dispositivo foi cadastrado com sucesso.",
      });

      // Tracking de evento e atualização do onboarding
      if (data?.id) {
        trackDispositivoCadastrado(data.id);
        // Verificar se precisa navegar para próximo passo
        const { data: onboardingData } = await supabase
          .from('user_onboarding')
          .select('step_os_criada')
          .eq('user_id', user.id)
          .maybeSingle();
        
        // Atualizar progresso do onboarding
        await supabase.rpc('update_onboarding_step', {
          _user_id: user.id,
          _step: 'dispositivo_cadastrado'
        });

        // Disparar confetti de celebração
        dispararConfetti('celebracao');

        // Navegar para próximo passo se ainda não criou OS
        if (!onboardingData?.step_os_criada) {
          setTimeout(() => navigate('/os'), 800);
        }
      }

      await carregarDispositivos();
      return data as Dispositivo;
    } catch (error: any) {
      console.error("Erro ao cadastrar dispositivo:", error);
      
      let descricao = "Não foi possível cadastrar o dispositivo.";
      if (error?.code === "42501") {
        descricao = "Erro de permissão. Por favor, faça login novamente.";
      }
      
      toast({
        title: "Erro ao cadastrar dispositivo",
        description: descricao,
        variant: "destructive",
      });
      return null;
    }
  };

  const atualizarDispositivo = async (id: string, dados: any) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Usar ID do dono se funcionário tem permissão
      const userId = (isFuncionario && podeSincronizarDispositivos && lojaUserId) ? lojaUserId : user.id;

      // Garantir compatibilidade entre foto_url e fotos
      const dadosAjustados = {
        ...dados,
        foto_url: dados.foto_url || dados.fotos?.[0] || null,
        fotos: dados.fotos || (dados.foto_url ? [dados.foto_url] : []),
        fornecedor_id: dados.fornecedor_id || null,
        codigo_barras: dados.codigo_barras || null,
      };

      const { error } = await supabase
        .from("dispositivos")
        .update(dadosAjustados)
        .eq("id", id)
        .eq("user_id", userId);

      if (error) throw error;

      toast({
        title: "Dispositivo atualizado",
        description: "O dispositivo foi atualizado com sucesso.",
      });

      await carregarDispositivos();
    } catch (error) {
      console.error("Erro ao atualizar dispositivo:", error);
      toast({
        title: "Erro ao atualizar dispositivo",
        description: "Não foi possível atualizar o dispositivo.",
        variant: "destructive",
      });
    }
  };

  const excluirDispositivo = async (id: string) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const userId = (isFuncionario && podeSincronizarDispositivos && lojaUserId) ? lojaUserId : user.id;

      // Soft delete - mover para lixeira
      const { error } = await supabase
        .from("dispositivos")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id)
        .eq("user_id", userId);

      if (error) throw error;

      toast({
        title: "Dispositivo movido para lixeira",
        description: "O dispositivo foi movido para a lixeira. Você pode restaurá-lo ou excluí-lo permanentemente.",
      });

      await carregarDispositivos();
    } catch (error) {
      console.error("Erro ao excluir dispositivo:", error);
      toast({
        title: "Erro ao excluir dispositivo",
        description: "Não foi possível excluir o dispositivo.",
        variant: "destructive",
      });
    }
  };

  const restaurarDispositivo = async (id: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const userId = (isFuncionario && podeSincronizarDispositivos && lojaUserId) ? lojaUserId : user.id;

      const { error } = await supabase
        .from("dispositivos")
        .update({ deleted_at: null })
        .eq("id", id)
        .eq("user_id", userId);

      if (error) throw error;

      toast({
        title: "Dispositivo restaurado",
        description: "O dispositivo foi restaurado com sucesso.",
      });

      await carregarDispositivos();
    } catch (error) {
      console.error("Erro ao restaurar dispositivo:", error);
      toast({
        title: "Erro ao restaurar",
        description: "Não foi possível restaurar o dispositivo.",
        variant: "destructive",
      });
    }
  };

  const excluirPermanentemente = async (id: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const userId = (isFuncionario && podeSincronizarDispositivos && lojaUserId) ? lojaUserId : user.id;

      const { error } = await supabase
        .from("dispositivos")
        .delete()
        .eq("id", id)
        .eq("user_id", userId);

      if (error) throw error;

      toast({
        title: "Dispositivo excluído permanentemente",
        description: "O dispositivo foi removido definitivamente.",
      });
    } catch (error) {
      console.error("Erro ao excluir permanentemente:", error);
      toast({
        title: "Erro ao excluir",
        description: "Não foi possível excluir o dispositivo permanentemente.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    carregarDispositivos();
  }, [carregarDispositivos]);

  return {
    dispositivos,
    loading,
    carregarDispositivos,
    criarDispositivo,
    atualizarDispositivo,
    excluirDispositivo,
    restaurarDispositivo,
    excluirPermanentemente,
  };
}
