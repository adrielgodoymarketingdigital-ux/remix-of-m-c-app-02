import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { saveSessionMeta, saveSubscriptionCache, getSubscriptionCache } from "@/lib/sessionStorage";

export type StatusVerificacao = 
  | "verificando"        // Ainda carregando dados
  | "liberado"           // Usuário pode acessar (ativo, admin, etc.)
  | "onboarding_pendente" // Precisa completar onboarding
  | "trial_pendente"     // Precisa ativar trial com cartão
  | "trial_expirado"     // Trial acabou e não deve acessar (exceto tela de plano)
  | "bloqueado_admin"    // Bloqueado pelo administrador
  | "erro"               // Erro de rede/fetch - mostrar retry
  | "nao_autenticado";   // Sem sessão válida

export type TipoBloqueioAdmin = "indeterminado" | "ate_assinar" | null;

interface VerificacaoState {
  status: StatusVerificacao;
  assinatura: any | null;
  onboarding: any | null;
  userId: string | null;
  error: string | null;
  tentativas: number;
  bloqueioAdmin: {
    bloqueado: boolean;
    tipo: TipoBloqueioAdmin;
    motivo: string | null;
  };
  isFuncionario: boolean;
  lojaUserId: string | null;
}

/**
 * Hook robusto para verificar se o usuário pode acessar o app.
 * - Nunca redireciona durante "verificando" 
 * - Tenta sincronizar com Stripe se dados parecem inconsistentes
 * - Oferece retry em caso de erro
 */
export function useVerificacaoAcesso() {
  const defaultBloqueioAdmin = { bloqueado: false, tipo: null as TipoBloqueioAdmin, motivo: null as string | null };

  // Tentar restaurar estado do cache para renderização instantânea
  const cachedInitial = (() => {
    try {
      const raw = sessionStorage.getItem("mec_verificacao_cache");
      if (raw) {
        const cached = JSON.parse(raw);
        // Cache válido por 10 minutos E deve ter status definido
        if (cached?.cachedAt && cached?.status && (Date.now() - cached.cachedAt) < 10 * 60 * 1000) {
          return cached;
        }
      }
    } catch {}
    return null;
  })();

  const [state, setState] = useState<VerificacaoState>(
    cachedInitial
      ? {
          status: cachedInitial.status as StatusVerificacao,
          assinatura: cachedInitial.assinatura,
          onboarding: cachedInitial.onboarding,
          userId: cachedInitial.userId,
          error: null,
          tentativas: 0,
          bloqueioAdmin: cachedInitial.bloqueioAdmin || defaultBloqueioAdmin,
          isFuncionario: cachedInitial.isFuncionario || false,
          lojaUserId: cachedInitial.lojaUserId || null,
        }
      : {
          status: "verificando",
          assinatura: null,
          onboarding: null,
          userId: null,
          error: null,
          tentativas: 0,
          bloqueioAdmin: defaultBloqueioAdmin,
          isFuncionario: false,
          lojaUserId: null,
        }
  );

  const verificandoRef = useRef(false);
  const syncStripeAttemptedRef = useRef(false);

  // Salvar estado no sessionStorage para navegação instantânea
  const salvarCacheVerificacao = useCallback((newState: Partial<VerificacaoState>) => {
    try {
      if (newState.status && newState.status !== "verificando" && newState.status !== "erro") {
        sessionStorage.setItem("mec_verificacao_cache", JSON.stringify({
          status: newState.status,
          assinatura: newState.assinatura,
          onboarding: newState.onboarding,
          userId: newState.userId,
          bloqueioAdmin: newState.bloqueioAdmin,
          isFuncionario: newState.isFuncionario,
          lojaUserId: newState.lojaUserId,
          cachedAt: Date.now(),
        }));
      }
    } catch {}
  }, []);

  /**
   * Verifica se o usuário está bloqueado pelo admin
   */
  const getBloqueioAdmin = (assinatura: any): { bloqueado: boolean; tipo: TipoBloqueioAdmin; motivo: string | null } => {
    if (!assinatura) return { bloqueado: false, tipo: null, motivo: null };
    
    if (assinatura.bloqueado_admin === true) {
      console.log("🚫 [useVerificacaoAcesso] Usuário BLOQUEADO pelo admin", {
        tipo: assinatura.bloqueado_tipo,
        motivo: assinatura.bloqueado_admin_motivo,
        em: assinatura.bloqueado_admin_em,
      });
      return { 
        bloqueado: true, 
        tipo: (assinatura.bloqueado_tipo as TipoBloqueioAdmin) || "indeterminado",
        motivo: assinatura.bloqueado_admin_motivo || null,
      };
    }
    
    return { bloqueado: false, tipo: null, motivo: null };
  };

  // Mantém compatibilidade com código existente
  const isBloqueadoAdmin = getBloqueioAdmin;

  const isTrialExpirado = (assinatura: any): boolean => {
    if (!assinatura) return false;
    
    // Admin nunca expira
    if (assinatura.plano_tipo === "admin") return false;
    
    // Plano FREE nunca expira (é gratuito permanente)
    if (assinatura.plano_tipo === "free") {
      console.log("✅ [useVerificacaoAcesso] Plano Free - nunca expira");
      return false;
    }
    
    // Planos pagos ativos nunca expiram
    const planosPagos = [
      'basico_mensal', 'basico_anual',
      'intermediario_mensal', 'intermediario_anual',
      'profissional_mensal', 'profissional_anual',
      'profissional_ultra_mensal', 'profissional_ultra_anual',
    ];
    if (planosPagos.includes(assinatura.plano_tipo) && assinatura.status === 'active') {
      return false;
    }
    
    // TRIAL CANCELADO PELO USUÁRIO = EXPIRADO (bloquear acesso)
    if (assinatura.trial_canceled === true) {
      console.log("⛔ [useVerificacaoAcesso] Trial foi cancelado pelo usuário");
      return true;
    }
    
    // STATUS CANCELADO = verificar se é assinante real que cancelou ou trial que expirou
    if (assinatura.status === "canceled") {
      // Se tem subscription real do Stripe (sub_ não-fake), verificar se ainda está na data válida
      const hasRealStripeSubscription = assinatura.stripe_subscription_id && 
        assinatura.stripe_subscription_id.startsWith('sub_') &&
        !assinatura.stripe_subscription_id.startsWith('sub_trial_') &&
        !assinatura.stripe_subscription_id.startsWith('sub_demo_') &&
        !assinatura.stripe_subscription_id.startsWith('sub_pending_');
      
      // Se cancelado mas tinha plano real, verificar data_fim (com 1 dia de carência)
      if (hasRealStripeSubscription && assinatura.data_fim) {
        const dataFim = new Date(assinatura.data_fim);
        const dataFimComCarencia = new Date(dataFim.getTime() + 24 * 60 * 60 * 1000);
        if (!Number.isNaN(dataFim.getTime()) && dataFimComCarencia > new Date()) {
          console.log("✅ [useVerificacaoAcesso] Assinatura cancelada mas ainda dentro do período pago");
          return false;
        }
      }
      
      // Cancelado sem período válido = expirado
      console.log("⛔ [useVerificacaoAcesso] Status cancelado - acesso expirado", {
        plano: assinatura.plano_tipo,
        data_fim: assinatura.data_fim,
        stripe_sub: assinatura.stripe_subscription_id
      });
      return true;
    }
    
    // TRIAL COM CARTÃO: Verificar pela data trial_end_at
    if (assinatura.trial_with_card === true && assinatura.trial_canceled !== true) {
      const trialEnd = assinatura.trial_end_at;
      if (trialEnd) {
        const endDate = new Date(trialEnd);
        if (!Number.isNaN(endDate.getTime())) {
          const isExpired = endDate < new Date();
          if (isExpired) {
            console.log("⛔ [useVerificacaoAcesso] Trial com cartão expirado", { trial_end_at: trialEnd });
          }
          return isExpired;
        }
      }
      // Trial com cartão sem data de fim = verificar se tem subscription ativa
      // Se não tem, considerar expirado por segurança
      const hasActiveSub = assinatura.status === 'active' || assinatura.status === 'trialing';
      if (!hasActiveSub) {
        console.log("⛔ [useVerificacaoAcesso] Trial com cartão mas sem status ativo");
        return true;
      }
      console.log("✅ [useVerificacaoAcesso] Trial com cartão ativo");
      return false;
    }
    
    // DEMONSTRAÇÃO sem trial_with_card = usuário novo que não completou cadastro
    if (assinatura.plano_tipo === "demonstracao" && !assinatura.trial_with_card) {
      console.log("⛔ [useVerificacaoAcesso] Demonstração sem cartão - precisa completar cadastro");
      return true;
    }
    
    // TRIAL LEGADO: Verificar data de expiração
    if (assinatura.plano_tipo === "trial") {
      const end = assinatura.trial_end_at || assinatura.data_fim;
      if (!end) {
        console.log("⛔ [useVerificacaoAcesso] Trial sem data de fim - expirado por segurança");
        return true;
      }

      const endDate = new Date(end);
      if (Number.isNaN(endDate.getTime())) {
        console.log("⛔ [useVerificacaoAcesso] Trial com data inválida - expirado por segurança");
        return true;
      }
      
      const isExpired = endDate < new Date();
      if (isExpired) {
        console.log("⛔ [useVerificacaoAcesso] Trial legado expirado", { end });
      }
      return isExpired;
    }

    return false;
  };

  /**
   * Verifica se a assinatura indica um usuário ativo que deve ser liberado
   * PRIORIDADE: Qualquer indicação de assinatura ativa = liberar imediatamente
   * MAS: Bloqueio admin tem prioridade máxima (exceto para admins)
   */
  const isUsuarioAtivo = (assinatura: any): boolean => {
    if (!assinatura) {
      console.log("⚠️ [useVerificacaoAcesso] Sem assinatura - não liberado");
      return false;
    }

    console.log("🔍 [useVerificacaoAcesso] Verificando assinatura:", {
      status: assinatura.status,
      plano_tipo: assinatura.plano_tipo,
      stripe_subscription_id: assinatura.stripe_subscription_id,
      trial_with_card: assinatura.trial_with_card,
      bloqueado_admin: assinatura.bloqueado_admin,
      bloqueado_tipo: assinatura.bloqueado_tipo,
    });

    // 1. Admin sempre liberado (mesmo se bloqueado)
    if (assinatura.plano_tipo === "admin") {
      console.log("✅ [useVerificacaoAcesso] Admin detectado - liberado");
      return true;
    }

    // 1.1 Plano FREE sempre liberado (é gratuito permanente)
    if (assinatura.plano_tipo === "free" && assinatura.status === "active") {
      console.log("✅ [useVerificacaoAcesso] Plano Free ativo detectado - liberado");
      return true;
    }

    // 1.5 BLOQUEIO ADMIN TEM PRIORIDADE MÁXIMA
    // Se bloqueio é "indeterminado", NUNCA libera (nem com assinatura)
    // Se bloqueio é "ate_assinar", só libera se tiver assinatura ativa real
    const bloqueio = isBloqueadoAdmin(assinatura);
    if (bloqueio.bloqueado) {
      if (bloqueio.tipo === "indeterminado") {
        console.log("🚫 [useVerificacaoAcesso] Bloqueio INDETERMINADO - acesso negado");
        return false;
      }
      
      // Para bloqueio "ate_assinar", verificar se tem assinatura Stripe REAL ativa
      const hasRealActiveSubscription = assinatura.stripe_subscription_id && 
        assinatura.stripe_subscription_id.startsWith('sub_') &&
        !assinatura.stripe_subscription_id.startsWith('sub_trial_') &&
        !assinatura.stripe_subscription_id.startsWith('sub_demo_') &&
        !assinatura.stripe_subscription_id.startsWith('sub_pending_') &&
        assinatura.status === 'active';
      
      if (!hasRealActiveSubscription) {
        console.log("🚫 [useVerificacaoAcesso] Bloqueado até assinar - sem assinatura ativa");
        return false;
      }
      
      console.log("✅ [useVerificacaoAcesso] Bloqueio 'até assinar' superado - tem assinatura ativa");
      // Continua verificação normal
    }

    // 2. VERIFICAÇÃO RIGOROSA: Trial expirado NUNCA é liberado
    if (isTrialExpirado(assinatura)) {
      console.log("⛔ [useVerificacaoAcesso] Trial/Assinatura expirado detectado - NÃO liberado", {
        trial_end_at: assinatura.trial_end_at,
        data_fim: assinatura.data_fim,
        status: assinatura.status,
        plano_tipo: assinatura.plano_tipo,
      });
      return false;
    }

    // 3. Verificar subscription Stripe REAL primeiro (mais confiável)
    const hasRealStripeSubscription = assinatura.stripe_subscription_id && 
      assinatura.stripe_subscription_id.startsWith('sub_') &&
      !assinatura.stripe_subscription_id.startsWith('sub_trial_') &&
      !assinatura.stripe_subscription_id.startsWith('sub_demo_') &&
      !assinatura.stripe_subscription_id.startsWith('sub_pending_');

    // Assinante real com status ativo = liberado
    if (hasRealStripeSubscription && assinatura.status === 'active') {
      console.log("✅ [useVerificacaoAcesso] Assinante Stripe ativo - liberado", {
        subscription_id: assinatura.stripe_subscription_id,
        status: assinatura.status,
        plano: assinatura.plano_tipo,
      });
      return true;
    }

    // 4. Status trialing com subscription real = liberado (período de trial do Stripe)
    if (hasRealStripeSubscription && assinatura.status === 'trialing') {
      console.log("✅ [useVerificacaoAcesso] Em trial Stripe - liberado", {
        subscription_id: assinatura.stripe_subscription_id,
        trial_end_at: assinatura.trial_end_at,
      });
      return true;
    }

    // 5. Trial com cartão cadastrado E status ativo/trialing = liberado
    if (assinatura.trial_with_card === true && 
        assinatura.trial_canceled !== true &&
        (assinatura.status === 'active' || assinatura.status === 'trialing')) {
      console.log("✅ [useVerificacaoAcesso] Trial com cartão e status ativo - liberado");
      return true;
    }

    // 6. Status cancelado = NÃO liberado (mesmo com trial_with_card)
    if (assinatura.status === 'canceled') {
      console.log("⛔ [useVerificacaoAcesso] Status cancelado - acesso negado");
      return false;
    }

    // 7. Demonstração sem cartão = NÃO liberado (precisa completar cadastro)
    if (assinatura.plano_tipo === 'demonstracao' && !assinatura.trial_with_card) {
      console.log("⛔ [useVerificacaoAcesso] Demonstração sem cartão - precisa checkout");
      return false;
    }

    console.log("⏳ [useVerificacaoAcesso] Nenhuma condição de liberação atendida - acesso negado");
    return false;
  };

  /**
   * Tenta sincronizar com Stripe para curar DB desatualizado
   */
  const tentarSincronizarStripe = useCallback(async (): Promise<boolean> => {
    if (syncStripeAttemptedRef.current) {
      console.log("⏭️ [useVerificacaoAcesso] Sync Stripe já tentado nesta sessão");
      return false;
    }

    syncStripeAttemptedRef.current = true;

    try {
      console.log("🔄 [useVerificacaoAcesso] Tentando sincronizar com Stripe...");
      const { data, error } = await supabase.functions.invoke('check-subscription');
      
      if (error) {
        console.error("❌ [useVerificacaoAcesso] Erro ao sincronizar com Stripe:", error);
        return false;
      }

      console.log("✅ [useVerificacaoAcesso] Resposta do check-subscription:", data);
      return data?.synced === true || data?.subscribed === true;
    } catch (e) {
      console.error("❌ [useVerificacaoAcesso] Exceção ao sincronizar:", e);
      return false;
    }
  }, []);

  /**
   * Executa a verificação completa
   */
  const verificar = useCallback(async () => {
    if (verificandoRef.current) {
      console.log("⏳ [useVerificacaoAcesso] Verificação já em andamento");
      return;
    }

    verificandoRef.current = true;
    setState(prev => ({ ...prev, status: "verificando", error: null }));

    try {
      // 1. Obter sessão com retry
      let session = null;
      for (let i = 0; i < 3; i++) {
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          session = data.session;
          break;
        }
        // Tentar refresh se não teve sessão
        const { data: refresh } = await supabase.auth.refreshSession();
        if (refresh.session) {
          session = refresh.session;
          break;
        }
        await new Promise(r => setTimeout(r, 500 + (i * 300)));
      }

      if (!session) {
        console.log("❌ [useVerificacaoAcesso] Sem sessão após tentativas");
        setState(prev => ({
          ...prev,
          status: "nao_autenticado",
          userId: null,
        }));
        verificandoRef.current = false;
        return;
      }

      const userId = session.user.id;
      console.log("✅ [useVerificacaoAcesso] Sessão obtida:", userId);
      // Renovar metadados da sessão de longa duração a cada verificação
      saveSessionMeta(userId);

      // 2. Verificar se é funcionário primeiro (com tratamento de erro robusto)
      console.log("🔍 [useVerificacaoAcesso] Verificando se usuário é funcionário...", { userId });
      
      let funcionarioData = null;
      let isFuncionario = false;
      
      try {
        const { data, error: funcError } = await supabase
          .from("loja_funcionarios")
          .select("id, loja_user_id, ativo, permissoes")
          .eq("funcionario_user_id", userId)
          .eq("ativo", true)
          .maybeSingle();

        if (!funcError && data) {
          funcionarioData = data;
          isFuncionario = true;
        } else if (funcError) {
          // Erro de RLS ou outro - assumir que não é funcionário
          console.warn("⚠️ [useVerificacaoAcesso] Erro ao buscar funcionário (pode ser RLS):", funcError);
        }
      } catch (e) {
        console.warn("⚠️ [useVerificacaoAcesso] Exceção ao buscar funcionário, assumindo dono:", e);
      }

      console.log("🔍 [useVerificacaoAcesso] Resultado da busca funcionário:", { 
        funcionarioData, 
        isFuncionario,
        userId 
      });

      // Se for funcionário ativo, usar a assinatura do dono da loja
      const userIdParaAssinatura = funcionarioData?.loja_user_id || userId;
      
      if (isFuncionario) {
        console.log("👷 [useVerificacaoAcesso] Usuário é FUNCIONÁRIO - usando assinatura do dono:", funcionarioData?.loja_user_id);
      } else {
        console.log("👤 [useVerificacaoAcesso] Usuário NÃO é funcionário - usando própria assinatura");
      }

      // 3. Buscar assinatura (do dono se for funcionário) e onboarding em paralelo
      const [assinaturaRes, onboardingRes] = await Promise.all([
        supabase
          .from("assinaturas")
          .select("*")
          .eq("user_id", userIdParaAssinatura)
          .maybeSingle(),
        supabase
          .from("user_onboarding")
          .select("onboarding_obrigatorio_completed")
          .eq("user_id", userIdParaAssinatura)
          .maybeSingle(),
      ]);

      // 3. Tratar erros de fetch (NÃO redirecionar, mostrar erro)
      if (assinaturaRes.error || onboardingRes.error) {
        console.error("❌ [useVerificacaoAcesso] Erro ao buscar dados:", {
          assinaturaError: assinaturaRes.error,
          onboardingError: onboardingRes.error,
        });

        // MODO OFFLINE: Se sem internet, usar cache local
        if (!navigator.onLine) {
          const cached = getSubscriptionCache(userId);
          if (cached) {
            console.log("📶 [useVerificacaoAcesso] Offline — usando cache de assinatura");
            const { assinatura: cachedAssinatura, onboarding: cachedOnboarding } = cached;
            if (isUsuarioAtivo(cachedAssinatura)) {
              setState({
                status: "liberado",
                assinatura: cachedAssinatura,
                onboarding: cachedOnboarding,
                userId,
                error: null,
                tentativas: state.tentativas + 1,
                bloqueioAdmin: getBloqueioAdmin(cachedAssinatura),
                isFuncionario,
                lojaUserId: funcionarioData?.loja_user_id || null,
              });
              verificandoRef.current = false;
              return;
            }
          }
        }

        // Se não conseguiu dados, tentar sync com Stripe
        const synced = await tentarSincronizarStripe();
        if (synced) {
          // Após sync, tentar buscar de novo
          const { data: assinaturaRetry } = await supabase
            .from("assinaturas")
            .select("*")
            .eq("user_id", userId)
            .maybeSingle();
          
          if (assinaturaRetry && isUsuarioAtivo(assinaturaRetry)) {
            setState({
              status: "liberado",
              assinatura: assinaturaRetry,
              onboarding: onboardingRes.data,
              userId,
              error: null,
              tentativas: state.tentativas + 1,
              bloqueioAdmin: getBloqueioAdmin(assinaturaRetry),
              isFuncionario: false,
              lojaUserId: null,
            });
            verificandoRef.current = false;
            return;
          }
        }

        // Ainda com erro - mostrar tela de retry
        setState(prev => ({
          ...prev,
          status: "erro",
          error: "Não foi possível verificar seu acesso. Verifique sua conexão.",
          userId,
          tentativas: prev.tentativas + 1,
        }));
        verificandoRef.current = false;
        return;
      }

      const assinatura = assinaturaRes.data;
      const onboarding = onboardingRes.data;

      // Salvar cache offline após fetch bem-sucedido
      if (assinatura) {
        saveSubscriptionCache(userId, assinatura, onboarding);
      }

      const bloqueioInfo = getBloqueioAdmin(assinatura);

      const trialExpirado = isTrialExpirado(assinatura);

      console.log("📦 [useVerificacaoAcesso] Dados carregados:", {
        plano: assinatura?.plano_tipo,
        status: assinatura?.status,
        trial_with_card: assinatura?.trial_with_card,
        stripe_sub: assinatura?.stripe_subscription_id,
        onboarding_completed: onboarding?.onboarding_obrigatorio_completed,
        bloqueado_admin: bloqueioInfo.bloqueado,
        isFuncionario,
        lojaUserId: funcionarioData?.loja_user_id,
      });

      // 3.5 PRIORIDADE FUNCIONÁRIO: Funcionários ativos com dono que tem assinatura ativa = LIBERADO
      if (isFuncionario && funcionarioData?.ativo) {
        // Verificar se o dono tem assinatura válida
        const donoTemAssinatura = assinatura && (
          assinatura.status === 'active' || 
          assinatura.status === 'trialing' ||
          (assinatura.trial_with_card && !assinatura.trial_canceled)
        );
        
        if (donoTemAssinatura) {
          console.log("✅ [useVerificacaoAcesso] FUNCIONÁRIO com dono ativo - LIBERADO");
          setState({
            status: "liberado",
            assinatura,
            onboarding,
            userId,
            error: null,
            tentativas: state.tentativas + 1,
            bloqueioAdmin: bloqueioInfo,
            isFuncionario: true,
            lojaUserId: funcionarioData.loja_user_id,
          });
          verificandoRef.current = false;
          return;
        } else {
          console.log("⛔ [useVerificacaoAcesso] FUNCIONÁRIO mas dono sem assinatura ativa - BLOQUEADO");
          setState({
            status: "trial_expirado",
            assinatura,
            onboarding,
            userId,
            error: "O dono da loja não possui assinatura ativa.",
            tentativas: state.tentativas + 1,
            bloqueioAdmin: bloqueioInfo,
            isFuncionario: true,
            lojaUserId: funcionarioData.loja_user_id,
          });
          verificandoRef.current = false;
          return;
        }
      }

      // 4. PRIORIDADE 0: Verificar bloqueio admin (exceto se tem assinatura ativa)
      if (bloqueioInfo.bloqueado && !isUsuarioAtivo(assinatura)) {
        console.log("🚫 [useVerificacaoAcesso] Usuário bloqueado pelo admin - bloqueando acesso");
        setState({
          status: "bloqueado_admin",
          assinatura,
          onboarding,
          userId,
          error: null,
          tentativas: state.tentativas + 1,
          bloqueioAdmin: bloqueioInfo,
          isFuncionario,
          lojaUserId: funcionarioData?.loja_user_id || null,
        });
        verificandoRef.current = false;
        return;
      }

      // 5. PRIORIDADE 1: Verificar se é usuário ativo (liberar imediatamente)
      if (isUsuarioAtivo(assinatura)) {
        // 5.1 Verificar onboarding obrigatório para plano Free (não é funcionário)
        // Usuários Free PRECISAM completar onboarding antes de acessar o app
        if (
          !isFuncionario &&
          assinatura?.plano_tipo === "free" &&
          !onboarding?.onboarding_obrigatorio_completed
        ) {
          console.log("⏳ [useVerificacaoAcesso] Plano Free ativo - onboarding obrigatório pendente");
          setState({
            status: "onboarding_pendente",
            assinatura,
            onboarding,
            userId,
            error: null,
            tentativas: state.tentativas + 1,
            bloqueioAdmin: bloqueioInfo,
            isFuncionario,
            lojaUserId: funcionarioData?.loja_user_id || null,
          });
          verificandoRef.current = false;
          return;
        }

        setState({
          status: "liberado",
          assinatura,
          onboarding,
          userId,
          error: null,
          tentativas: state.tentativas + 1,
          bloqueioAdmin: bloqueioInfo,
          isFuncionario,
          lojaUserId: funcionarioData?.loja_user_id || null,
        });
        verificandoRef.current = false;
        return;
      }

      // 6. Trial expirado: bloquear acesso ao app (a UI decide redirecionar para /plano)
      if (trialExpirado) {
        console.log("⛔ [useVerificacaoAcesso] Trial expirado - bloqueando acesso");
        setState({
          status: "trial_expirado",
          assinatura,
          onboarding,
          userId,
          error: null,
          tentativas: state.tentativas + 1,
          bloqueioAdmin: bloqueioInfo,
          isFuncionario,
          lojaUserId: funcionarioData?.loja_user_id || null,
        });
        verificandoRef.current = false;
        return;
      }

      // 7. Se não tem assinatura E não é erro, tentar sync com Stripe
      if (!assinatura && !syncStripeAttemptedRef.current) {
        const synced = await tentarSincronizarStripe();
        if (synced) {
          // Recarregar e verificar novamente
          const { data: assinaturaRetry } = await supabase
            .from("assinaturas")
            .select("*")
            .eq("user_id", userId)
            .maybeSingle();
          
          if (isUsuarioAtivo(assinaturaRetry)) {
            setState({
              status: "liberado",
              assinatura: assinaturaRetry,
              onboarding,
              userId,
              error: null,
              tentativas: state.tentativas + 1,
              bloqueioAdmin: getBloqueioAdmin(assinaturaRetry),
              isFuncionario,
              lojaUserId: funcionarioData?.loja_user_id || null,
            });
            verificandoRef.current = false;
            return;
          }
        }
      }

      // 7. NOVO USUÁRIO: Verificar etapas do funil
      // IMPORTANTE: Só entra aqui se NÃO for usuário ativo/pagante
      const isPaidOrTrialing = assinatura?.status === 'active' || assinatura?.status === 'trialing';
      const hasRealSubscription = assinatura?.stripe_subscription_id && 
        assinatura.stripe_subscription_id.startsWith('sub_') &&
        !assinatura.stripe_subscription_id.startsWith('sub_trial_') &&
        !assinatura.stripe_subscription_id.startsWith('sub_demo_') &&
        !assinatura.stripe_subscription_id.startsWith('sub_pending_');

      // Usuário com status ativo ou subscription real NUNCA deve ser redirecionado para onboarding
      if (!isPaidOrTrialing && !hasRealSubscription) {
        // NOVO FLUXO: Primeiro pagamento, depois onboarding
        
        // Etapa 1: Onboarding obrigatório pendente
        if (!onboarding?.onboarding_obrigatorio_completed) {
          console.log("⏳ [useVerificacaoAcesso] Usuário pagou - onboarding pendente");
          setState(prev => ({
            ...prev,
            status: "onboarding_pendente",
            assinatura,
            onboarding,
            userId,
            error: null,
          }));
          verificandoRef.current = false;
          return;
        }
      } else {
        // Usuário é pagante mas não foi pego pelo isUsuarioAtivo - liberar por segurança
        console.log("⚠️ [useVerificacaoAcesso] Usuário pagante detectado no fallback - liberando", {
          status: assinatura?.status,
          subscription_id: assinatura?.stripe_subscription_id
        });
        setState(prev => ({
          ...prev,
          status: "liberado",
          assinatura,
          onboarding,
          userId,
          error: null,
        }));
        verificandoRef.current = false;
        return;
      }

      // 8. Fallback: BLOQUEAR usuário sem assinatura válida
      // Se chegou aqui, significa que não tem status ativo/trialing válido
      console.log("⛔ [useVerificacaoAcesso] Estado não mapeado - BLOQUEANDO acesso", {
        status: assinatura?.status,
        plano_tipo: assinatura?.plano_tipo,
        trial_with_card: assinatura?.trial_with_card,
      });
      setState({
        status: isFuncionario ? "liberado" : "trial_pendente", // Funcionário sempre liberado se dono tem assinatura
        assinatura,
        onboarding,
        userId,
        error: null,
        tentativas: state.tentativas + 1,
        bloqueioAdmin: bloqueioInfo,
        isFuncionario,
        lojaUserId: funcionarioData?.loja_user_id || null,
      });
    } catch (e: any) {
      console.error("❌ [useVerificacaoAcesso] Exceção na verificação:", e);
      setState(prev => ({
        ...prev,
        status: "erro",
        error: e.message || "Erro inesperado. Tente novamente.",
        tentativas: prev.tentativas + 1,
      }));
    } finally {
      verificandoRef.current = false;
    }
  }, [tentarSincronizarStripe]);

  // Auto-cachear estado quando liberado
  useEffect(() => {
    if (state.status === "liberado") {
      salvarCacheVerificacao(state);
    }
  }, [state.status, salvarCacheVerificacao]);

  // Executar verificação na montagem (mas não bloqueia se tem cache)
  useEffect(() => {
    // Se já tem cache válido, verificar em background sem bloquear
    if (cachedInitial && state.status === "liberado") {
      // Verificar em background silenciosamente
      const bgVerify = async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) {
            setState(prev => ({ ...prev, status: "nao_autenticado", userId: null }));
            sessionStorage.removeItem("mec_verificacao_cache");
          }
          // Se sessão é válida, os dados cacheados são suficientes
        } catch {}
      };
      bgVerify();
    } else {
      verificar();
    }
  }, []);

  // Função de retry exposta
  const tentarNovamente = useCallback(() => {
    syncStripeAttemptedRef.current = false; // Permitir nova tentativa de sync
    verificar();
  }, [verificar]);

  return {
    ...state,
    tentarNovamente,
    isVerificando: state.status === "verificando",
  };
}
