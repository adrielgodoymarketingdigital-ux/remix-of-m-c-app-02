import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type TipoBloqueio = "indeterminado" | "ate_assinar";

export type PlanoAcesso = 
  | "trial"
  | "basico_mensal"
  | "basico_anual"
  | "intermediario_mensal"
  | "intermediario_anual"
  | "profissional_mensal"
  | "profissional_anual";

export type UnidadeTempo = "horas" | "dias";

export interface UsuarioAdmin {
  id: string;
  user_id: string;
  nome: string;
  email: string;
  celular: string | null;
  plano_tipo: string;
  status: string;
  data_inicio: string | null;
  data_fim: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  created_at: string | null;
  dias_restantes_trial: number | null;
  horas_restantes_trial: number | null;
  is_trial: boolean;
  is_trial_24h: boolean;
  is_trial_with_card: boolean; // Novo trial de 7 dias com cartão
  is_pagante: boolean;
  last_login_at: string | null;
  login_count: number;
  usando_apos_trial: boolean;
  bloqueado_admin: boolean;
  bloqueado_admin_motivo: string | null;
  bloqueado_admin_em: string | null;
  bloqueado_tipo: TipoBloqueio | null;
}

export interface EstatisticasUsuarios {
  total: number;
  trials: number;
  trialsAtivos: number;
  trialsExpirados: number;
  trials24h: number;
  trials24hAtivos: number;
  trials24hExpirados: number;
  trials7d: number;
  trials7dAtivos: number;
  trials7dExpirados: number;
  pagantes: number;
  cancelados: number;
  demonstracao: number;
}

export interface MetricasReceita {
  mrrAtual: number;
  potencialTrialsAtivos: number;
  potencialTrialsExpirados: number;
  usuariosUsandoAposTrial: number;
  countTrialsAtivos: number;
  countTrialsExpirados: number;
}

// Preços mensais por plano (em R$)
export const PRECOS_MENSAIS: Record<string, number> = {
  basico_mensal: 19.90,
  basico_anual: 15.90,      // 190.80 / 12
  intermediario_mensal: 39.90,
  intermediario_anual: 31.90, // 382.80 / 12
  profissional_mensal: 79.90,
  profissional_anual: 74.90,  // 898.80 / 12
};

// Preço base para cálculo de potencial (plano intermediário)
const PRECO_BASE_POTENCIAL = 39.90;

export function useAdminUsuarios() {
  const [usuarios, setUsuarios] = useState<UsuarioAdmin[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [bloqueandoUsuario, setBloqueandoUsuario] = useState(false);
  const [estatisticas, setEstatisticas] = useState<EstatisticasUsuarios>({
    total: 0,
    trials: 0,
    trialsAtivos: 0,
    trialsExpirados: 0,
    trials24h: 0,
    trials24hAtivos: 0,
    trials24hExpirados: 0,
    trials7d: 0,
    trials7dAtivos: 0,
    trials7dExpirados: 0,
    pagantes: 0,
    cancelados: 0,
    demonstracao: 0,
  });
  const [metricasReceita, setMetricasReceita] = useState<MetricasReceita>({
    mrrAtual: 0,
    potencialTrialsAtivos: 0,
    potencialTrialsExpirados: 0,
    usuariosUsandoAposTrial: 0,
    countTrialsAtivos: 0,
    countTrialsExpirados: 0,
  });

  const verificarAdmin = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();

      if (error) {
        console.error("Erro ao verificar admin:", error);
        return false;
      }

      return !!data;
    } catch (error) {
      console.error("Erro ao verificar admin:", error);
      return false;
    }
  }, []);

  const carregarUsuarios = useCallback(async () => {
    setIsLoading(true);
    try {
      // Verificar se é admin primeiro
      const adminCheck = await verificarAdmin();
      setIsAdmin(adminCheck);

      if (!adminCheck) {
        toast.error("Acesso negado. Você não tem permissão de administrador.");
        setIsLoading(false);
        return;
      }

      // Buscar assinaturas com perfis usando service role via edge function
      const { data, error } = await supabase.functions.invoke("admin-list-users");

      if (error) {
        console.error("Erro ao carregar usuários:", error);
        toast.error("Erro ao carregar usuários");
        setIsLoading(false);
        return;
      }

      const usuariosFormatados: UsuarioAdmin[] = data.usuarios.map((item: any) => {
        // Detectar trial com cartão (novo sistema de 7 dias)
        const isTrialWithCard = item.trial_with_card === true && item.trial_canceled !== true;
        
        // CORRIGIDO: Considerar trial_with_card mesmo se plano_tipo não for "trial"
        const isTrial = item.plano_tipo === "trial" || isTrialWithCard;
        
        // Pagante real (Stripe): tem subscription real
        const hasRealStripeSub = item.stripe_subscription_id?.startsWith("sub_") &&
          !item.stripe_subscription_id?.startsWith("sub_trial_") &&
          !item.stripe_subscription_id?.startsWith("sub_demo_") &&
          !item.stripe_subscription_id?.startsWith("sub_pending_");
        // Pagante via Pagar.me ou Ticto (qualquer provedor): plano pago + status active
        const planosPagos = [
          "basico_mensal", "basico_anual",
          "intermediario_mensal", "intermediario_anual",
          "profissional_mensal", "profissional_anual",
        ];
        const hasPaidPlan = planosPagos.includes(item.plano_tipo);
        const isPagante = (hasRealStripeSub || hasPaidPlan) && item.status === "active" && !isTrial;

        let diasRestantesTrial: number | null = null;
        let horasRestantesTrial: number | null = null;
        
        // Para trial com cartão, usar trial_end_at; senão usar data_fim
        const dataFimTrialRaw = isTrialWithCard ? (item.trial_end_at || item.data_fim) : item.data_fim;
        
        if (isTrial && dataFimTrialRaw) {
          const dataFimTrial = new Date(dataFimTrialRaw);
          const agora = new Date();
          const diffMs = dataFimTrial.getTime() - agora.getTime();
          // Calcular dias (floor para permitir negativos indicando atraso)
          diasRestantesTrial = Math.floor(diffMs / (1000 * 60 * 60 * 24));
          // Calcular horas (ceil para ser mais preciso em trials curtos)
          horasRestantesTrial = Math.ceil(diffMs / (1000 * 60 * 60));
        }

        // Detectar se é trial de 24h (legado) ou trial de 7 dias com cartão (novo)
        // Trial com cartão (trial_with_card = true) é o NOVO sistema de 7 dias
        // Trial SEM cartão e com duração curta (<= 25h) é o sistema LEGADO de 24h
        let isTrial24h = false;
        
        if (isTrial && !isTrialWithCard && item.data_inicio && item.data_fim) {
          const duracaoMs = new Date(item.data_fim).getTime() - new Date(item.data_inicio).getTime();
          const duracaoHoras = duracaoMs / (1000 * 60 * 60);
          isTrial24h = duracaoHoras <= 25; // 25h para ter margem de segurança (sistema legado)
        }

        // Detectar uso após trial expirado
        let usandoAposTrial = false;
        if (isTrial && diasRestantesTrial !== null && diasRestantesTrial < 0 && dataFimTrialRaw && item.last_login_at) {
          const dataFim = new Date(dataFimTrialRaw);
          const ultimoLogin = new Date(item.last_login_at);
          usandoAposTrial = ultimoLogin > dataFim;
        }

        return {
          id: item.id,
          user_id: item.user_id,
          nome: item.nome || "Sem nome",
          email: item.email || "Sem email",
          celular: item.celular || null,
          plano_tipo: item.plano_tipo,
          status: item.status,
          data_inicio: item.data_inicio,
          data_fim: item.data_fim,
          stripe_customer_id: item.stripe_customer_id,
          stripe_subscription_id: item.stripe_subscription_id,
          created_at: item.created_at,
          dias_restantes_trial: diasRestantesTrial,
          horas_restantes_trial: horasRestantesTrial,
          is_trial: isTrial,
          is_trial_24h: isTrial24h,
          is_trial_with_card: isTrialWithCard,
          is_pagante: isPagante,
          last_login_at: item.last_login_at || null,
          login_count: item.login_count || 0,
          usando_apos_trial: usandoAposTrial,
          bloqueado_admin: item.bloqueado_admin || false,
          bloqueado_admin_motivo: item.bloqueado_admin_motivo || null,
          bloqueado_admin_em: item.bloqueado_admin_em || null,
          bloqueado_tipo: item.bloqueado_tipo || null,
        };
      });

      setUsuarios(usuariosFormatados);

      // Calcular estatísticas
      const trialsAtivos = usuariosFormatados.filter(u => u.is_trial && (u.dias_restantes_trial ?? 0) > 0);
      const trialsExpirados = usuariosFormatados.filter(u => u.is_trial && (u.dias_restantes_trial ?? 0) <= 0);
      const pagantesAtivos = usuariosFormatados.filter(u => u.is_pagante && u.status === "active");
      
      // Estatísticas específicas para trials de 24h (LEGADO - sem cartão, duração curta)
      const trials24h = usuariosFormatados.filter(u => u.is_trial && u.is_trial_24h && !u.is_trial_with_card);
      const trials24hAtivos = trials24h.filter(u => (u.horas_restantes_trial ?? 0) > 0);
      const trials24hExpirados = trials24h.filter(u => (u.horas_restantes_trial ?? 0) <= 0);
      
      // Estatísticas para trials de 7 dias (NOVO sistema com cartão OU legado sem cartão mas com duração longa)
      const trials7d = usuariosFormatados.filter(u => u.is_trial && (u.is_trial_with_card || !u.is_trial_24h));
      const trials7dAtivos = trials7d.filter(u => (u.dias_restantes_trial ?? 0) > 0);
      const trials7dExpirados = trials7d.filter(u => (u.dias_restantes_trial ?? 0) <= 0);
      
      const stats: EstatisticasUsuarios = {
        total: usuariosFormatados.length,
        trials: usuariosFormatados.filter(u => u.is_trial).length,
        trialsAtivos: trialsAtivos.length,
        trialsExpirados: trialsExpirados.length,
        trials24h: trials24h.length,
        trials24hAtivos: trials24hAtivos.length,
        trials24hExpirados: trials24hExpirados.length,
        trials7d: trials7d.length,
        trials7dAtivos: trials7dAtivos.length,
        trials7dExpirados: trials7dExpirados.length,
        pagantes: pagantesAtivos.length,
        cancelados: usuariosFormatados.filter(u => u.status === "canceled").length,
        demonstracao: 0, // Modo demonstração foi removido - mantido para compatibilidade
      };

      // Calcular métricas de receita (MRR)
      const mrrAtual = pagantesAtivos.reduce((total, u) => {
        return total + (PRECOS_MENSAIS[u.plano_tipo] || 0);
      }, 0);

      const potencialTrialsAtivos = trialsAtivos.length * PRECO_BASE_POTENCIAL;
      const potencialTrialsExpirados = trialsExpirados.length * PRECO_BASE_POTENCIAL;
      const usuariosUsandoAposTrial = usuariosFormatados.filter(u => u.usando_apos_trial).length;

      setEstatisticas(stats);
      setMetricasReceita({
        mrrAtual,
        potencialTrialsAtivos,
        potencialTrialsExpirados,
        usuariosUsandoAposTrial,
        countTrialsAtivos: trialsAtivos.length,
        countTrialsExpirados: trialsExpirados.length,
      });
    } catch (error) {
      console.error("Erro ao carregar usuários:", error);
      toast.error("Erro ao carregar dados de usuários");
    } finally {
      setIsLoading(false);
    }
  }, [verificarAdmin]);

  const bloquearUsuario = useCallback(async (userId: string, motivo: string, tipoBloqueio: TipoBloqueio = "ate_assinar") => {
    setBloqueandoUsuario(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-block-user", {
        body: {
          user_id: userId,
          bloquear: true,
          motivo: motivo || undefined,
          tipo_bloqueio: tipoBloqueio,
        },
      });

      if (error) {
        console.error("Erro ao bloquear usuário:", error);
        toast.error("Erro ao bloquear usuário: " + error.message);
        return false;
      }

      if (data.error) {
        toast.error(data.error);
        return false;
      }

      const mensagem = tipoBloqueio === "ate_assinar" 
        ? "Usuário bloqueado! Será desbloqueado automaticamente ao assinar um plano."
        : "Usuário bloqueado por prazo indeterminado!";
      
      toast.success(mensagem);
      await carregarUsuarios();
      return true;
    } catch (error: any) {
      console.error("Erro ao bloquear usuário:", error);
      toast.error("Erro ao bloquear usuário: " + error.message);
      return false;
    } finally {
      setBloqueandoUsuario(false);
    }
  }, [carregarUsuarios]);

  const desbloquearUsuario = useCallback(async (userId: string) => {
    setBloqueandoUsuario(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-block-user", {
        body: {
          user_id: userId,
          bloquear: false,
        },
      });

      if (error) {
        console.error("Erro ao desbloquear usuário:", error);
        toast.error("Erro ao desbloquear usuário: " + error.message);
        return false;
      }

      if (data.error) {
        toast.error(data.error);
        return false;
      }

      toast.success("Usuário desbloqueado com sucesso!");
      await carregarUsuarios();
      return true;
    } catch (error: any) {
      console.error("Erro ao desbloquear usuário:", error);
      toast.error("Erro ao desbloquear usuário: " + error.message);
      return false;
    } finally {
      setBloqueandoUsuario(false);
    }
  }, [carregarUsuarios]);

  const deletarUsuario = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("admin-delete-user", {
        body: { user_id: userId },
      });

      if (error) {
        console.error("Erro ao deletar usuário:", error);
        toast.error("Erro ao deletar usuário: " + error.message);
        return false;
      }

      if (data.error) {
        toast.error(data.error);
        return false;
      }

      toast.success(data.message || "Usuário deletado com sucesso!");
      await carregarUsuarios();
      return true;
    } catch (error: any) {
      console.error("Erro ao deletar usuário:", error);
      toast.error("Erro ao deletar usuário: " + error.message);
      return false;
    }
  }, [carregarUsuarios]);

  const concederAcesso = useCallback(async (
    userId: string, 
    planoTipo: PlanoAcesso, 
    tempoAcesso: number, 
    unidadeTempo: UnidadeTempo,
    motivo: string
  ) => {
    setBloqueandoUsuario(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-grant-access", {
        body: {
          user_id: userId,
          plano_tipo: planoTipo,
          tempo_acesso: tempoAcesso,
          unidade_tempo: unidadeTempo,
          motivo: motivo || undefined,
        },
      });

      if (error) {
        console.error("Erro ao conceder acesso:", error);
        toast.error("Erro ao conceder acesso: " + error.message);
        return false;
      }

      if (data.error) {
        toast.error(data.error);
        return false;
      }

      toast.success(data.message || "Acesso concedido com sucesso!");
      await carregarUsuarios();
      return true;
    } catch (error: any) {
      console.error("Erro ao conceder acesso:", error);
      toast.error("Erro ao conceder acesso: " + error.message);
      return false;
    } finally {
      setBloqueandoUsuario(false);
    }
  }, [carregarUsuarios]);

  // Bloquear todos os usuários com trial expirado que não são pagantes
  const bloquearTrialsExpirados = useCallback(async () => {
    setBloqueandoUsuario(true);
    try {
      // Filtrar usuários que:
      // 1. Estão em trial ou demonstração
      // 2. Têm trial expirado (dias_restantes <= 0)
      // 3. Não são pagantes
      // 4. Não estão já bloqueados
      const usuariosParaBloquear = usuarios.filter(u => {
        const isTrialOuDemo = u.is_trial || u.plano_tipo === 'demonstracao';
        const trialExpirado = (u.dias_restantes_trial ?? 0) <= 0;
        const naoEhPagante = !u.is_pagante;
        const naoEstaBloqueado = !u.bloqueado_admin;
        
        return isTrialOuDemo && trialExpirado && naoEhPagante && naoEstaBloqueado;
      });

      if (usuariosParaBloquear.length === 0) {
        toast.info("Não há usuários com trial expirado para bloquear");
        return { sucesso: 0, falha: 0 };
      }

      let sucesso = 0;
      let falha = 0;

      for (const usuario of usuariosParaBloquear) {
        try {
          const { error } = await supabase.functions.invoke("admin-block-user", {
            body: {
              user_id: usuario.user_id,
              bloquear: true,
              motivo: "Bloqueio automático - trial expirado sem assinatura",
              tipo_bloqueio: "ate_assinar",
            },
          });

          if (error) {
            console.error(`Erro ao bloquear ${usuario.email}:`, error);
            falha++;
          } else {
            sucesso++;
          }
        } catch (e) {
          console.error(`Erro ao bloquear ${usuario.email}:`, e);
          falha++;
        }
      }

      if (sucesso > 0) {
        toast.success(`${sucesso} usuário(s) bloqueado(s) com sucesso!`);
      }
      if (falha > 0) {
        toast.error(`Falha ao bloquear ${falha} usuário(s)`);
      }

      await carregarUsuarios();
      return { sucesso, falha };
    } catch (error: any) {
      console.error("Erro ao bloquear trials expirados:", error);
      toast.error("Erro ao bloquear trials expirados: " + error.message);
      return { sucesso: 0, falha: 0 };
    } finally {
      setBloqueandoUsuario(false);
    }
  }, [usuarios, carregarUsuarios]);

  useEffect(() => {
    carregarUsuarios();
  }, [carregarUsuarios]);

  return {
    usuarios,
    isLoading,
    isAdmin,
    estatisticas,
    metricasReceita,
    bloqueandoUsuario,
    recarregar: carregarUsuarios,
    bloquearUsuario,
    desbloquearUsuario,
    deletarUsuario,
    concederAcesso,
    bloquearTrialsExpirados,
  };
}
