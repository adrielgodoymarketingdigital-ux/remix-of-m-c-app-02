import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Assinatura, LIMITES_POR_PLANO, STRIPE_PRICE_IDS, PlanoTipo, LimitesPlano, getLimitesFree } from "@/types/assinatura";
import { PLANOS } from "@/types/plano";

interface VerificacaoStripeResult {
  subscribed: boolean;
  plano_tipo: string;
  subscription_end?: string;
  synced?: boolean;
  error?: string;
}

export function useAssinatura() {
  const [assinatura, setAssinatura] = useState<Assinatura | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  
  // Flag para evitar chamadas duplicadas durante inicialização
  const jaInicializouRef = useRef(false);
  const carregandoAssinaturaRef = useRef(false);
  const assinaturaRef = useRef<Assinatura | null>(null);

  const obterSessaoComRetry = useCallback(async (tentativas = 3) => {
    for (let i = 0; i < tentativas; i++) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) return session;
        
        // Se não tem sessão, tentar refreshSession
        if (!session && i < tentativas - 1) {
          console.log(`🔄 Tentativa ${i + 1}: sessão vazia, tentando refresh...`);
          const { data: refresh } = await supabase.auth.refreshSession();
          if (refresh.session) return refresh.session;
        }
      } catch (e) {
        console.log(`⚠️ Tentativa ${i + 1} de obter sessão falhou`);
      }
      // Delay progressivo para dar tempo de refresh de token
      await new Promise((r) => setTimeout(r, 600 + (i * 300)));
    }
    return null;
  }, []);

  // Watchdog: evita ficar preso em loader infinito em caso de falha silenciosa
  useEffect(() => {
    if (!carregando) return;
    const t = window.setTimeout(() => {
      console.log("⚠️ Watchdog: forçando fim do carregamento após timeout");
      setCarregando(false);
    }, 12000); // Aumentado para 12 segundos para dar tempo ao token refresh
    return () => window.clearTimeout(t);
  }, [carregando]);

  const carregarAssinatura = useCallback(async (sessionOverride?: any): Promise<Assinatura | null> => {
    // Evitar chamadas simultâneas
    if (carregandoAssinaturaRef.current) {
      console.log("⏳ Já está carregando assinatura, ignorando chamada duplicada");
      return assinaturaRef.current;
    }

    carregandoAssinaturaRef.current = true;

    try {
      const session = sessionOverride ?? (await obterSessaoComRetry(3));
      if (!session) {
        console.log("❌ Sem sessão, finalizando carregamento");
        setAssinatura(null);
        setUserId(null);
        setCarregando(false);
        return null;
      }

      const user = session.user;
      setUserId(user.id);

      // Verificar se o usuário é funcionário de alguma loja
      const { data: funcionarioData } = await supabase
        .from("loja_funcionarios")
        .select("loja_user_id")
        .eq("funcionario_user_id", user.id)
        .eq("ativo", true)
        .maybeSingle();

      // Se for funcionário, usar o ID do dono da loja para buscar assinatura
      const userIdParaAssinatura = funcionarioData?.loja_user_id || user.id;
      
      console.log("🔍 Buscando assinatura para:", funcionarioData ? "dono da loja" : "próprio usuário", userIdParaAssinatura);

      const { data, error } = await supabase
        .from("assinaturas")
        .select("*")
        .eq("user_id", userIdParaAssinatura)
        .maybeSingle();

      // Se não existir linha ainda, não é erro fatal
      if (error) throw error;

      console.log("📦 Assinatura carregada:", data?.plano_tipo, data?.status);
      assinaturaRef.current = data;
      setAssinatura(data);
      return data;
    } catch (error) {
      console.error("Erro ao carregar assinatura:", error);
      return null;
    } finally {
      carregandoAssinaturaRef.current = false;
      setCarregando(false);
    }
  }, [obterSessaoComRetry]);

  // Verifica assinatura diretamente no Stripe (fallback quando webhook falha)
  const verificarAssinaturaStripe = useCallback(async (): Promise<VerificacaoStripeResult> => {
    try {
      console.log("🔍 Verificando assinatura diretamente no Stripe...");
      
      const { data, error } = await supabase.functions.invoke('check-subscription');
      
      if (error) {
        console.error("❌ Erro ao verificar no Stripe:", error);
        throw error;
      }
      
      console.log("✅ Resposta do Stripe:", data);
      
      // Se sincronizou, recarregar do DB
      if (data.synced) {
        console.log("🔄 Recarregando assinatura do DB após sync...");
        await carregarAssinatura();
      }
      
      return data as VerificacaoStripeResult;
    } catch (error: any) {
      console.error("❌ Erro na verificação Stripe:", error);
      return {
        subscribed: false,
        plano_tipo: "demonstracao",
        error: error.message
      };
    }
  }, [carregarAssinatura]);

  const recarregarComFeedback = useCallback(async (): Promise<Assinatura | null> => {
    setCarregando(true);
    try {
      const session = await obterSessaoComRetry(3);
      if (!session) {
        toast({
          title: "Erro",
          description: "Sessão não encontrada. Faça login novamente.",
          variant: "destructive",
        });
        return null;
      }

      const user = session.user;

      const { data, error } = await supabase
        .from("assinaturas")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      setAssinatura(data);

      toast({
        title: "✅ Status atualizado",
        description: "Informações da assinatura foram atualizadas com sucesso.",
      });

      return data;
    } catch (error: any) {
      console.error("Erro ao carregar assinatura:", error);
      toast({
        title: "Erro ao atualizar",
        description: error.message || "Não foi possível atualizar o status da assinatura.",
        variant: "destructive",
      });
      return null;
    } finally {
      setCarregando(false);
    }
  }, [obterSessaoComRetry]);

  // Listener para mudanças de autenticação
  // CRÍTICO: callback NÃO pode ser async e NÃO deve chamar supabase diretamente (evita deadlock)
  useEffect(() => {
    const handleAuthEvent = async (event: string, session: any) => {
      // INITIAL_SESSION é disparado na primeira carga
      if (event === 'INITIAL_SESSION') {
        if (session && !jaInicializouRef.current) {
          console.log("🚀 Inicialização via INITIAL_SESSION");
          jaInicializouRef.current = true;
          await carregarAssinatura(session);
        } else if (!session) {
          // Em alguns refresh o INITIAL_SESSION pode vir vazio antes do SDK recuperar a sessão.
          // Não encerrar o carregamento aqui — tentar recuperar com retry.
          console.log("❌ Sem sessão no INITIAL_SESSION (tentando recuperar...)");
          setCarregando(true);
          const recovered = await obterSessaoComRetry(3);

          if (recovered && !jaInicializouRef.current) {
            console.log("✅ Sessão recuperada após INITIAL_SESSION vazio");
            jaInicializouRef.current = true;
            await carregarAssinatura(recovered);
          } else if (!recovered) {
            console.log("❌ Não foi possível recuperar sessão após tentativas");
            setAssinatura(null);
            setUserId(null);
            setCarregando(false);
          }
        }
      } else if (event === 'SIGNED_IN') {
        console.log("🔄 Usuário logou, recarregando assinatura...");
        // Login tracking é feito apenas nos formulários de login (Auth.tsx, CadastroPlano.tsx)
        // para evitar contagem inflada por token refresh

        jaInicializouRef.current = true;
        await carregarAssinatura(session);
      } else if (event === 'TOKEN_REFRESHED') {
        console.log("🔄 Token renovado, recarregando assinatura...");
        await carregarAssinatura(session);
      } else if (event === 'SIGNED_OUT') {
        console.log("👋 Usuário deslogou, limpando assinatura...");
        jaInicializouRef.current = false;
        setAssinatura(null);
        setUserId(null);
        setCarregando(false);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("🔑 Auth state changed:", event, session?.user?.id);

      // Atualizações síncronas rápidas (ok dentro do callback)
      if (event === 'SIGNED_OUT') {
        jaInicializouRef.current = false;
        setAssinatura(null);
        setUserId(null);
        setCarregando(false);
        return;
      }

      // Deferir qualquer async para fora do callback
      window.setTimeout(() => {
        handleAuthEvent(event, session);
      }, 0);
    });

    // Não force setCarregando(false) aqui.
    // O INITIAL_SESSION pode vir vazio e a recuperação acontece logo em seguida; encerrar cedo causa tela de erro no refresh.
    // O watchdog acima já evita loader infinito em caso de falha real.

    return () => {
      subscription.unsubscribe();
    };
  }, [carregarAssinatura, obterSessaoComRetry]);

  // Listener Realtime com filtro por user_id
  useEffect(() => {
    if (!userId) return;

    console.log("📡 Configurando listener realtime para user:", userId);

    const channel = supabase
      .channel(`assinaturas-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "assinaturas",
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          console.log("🔔 Realtime: mudança detectada na assinatura", payload);
          
          // Atualizar estado diretamente com o payload quando possível
          if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
            const newData = payload.new as Assinatura;
            console.log("📦 Atualizando estado com dados do realtime:", newData.plano_tipo);
            setAssinatura(newData);
          } else {
            // Fallback: recarregar do DB
            carregarAssinatura();
          }
        }
      )
      .subscribe((status) => {
        console.log("📡 Status do canal realtime:", status);
      });

    return () => {
      console.log("📡 Removendo canal realtime");
      supabase.removeChannel(channel);
    };
  }, [userId, carregarAssinatura]);

  // Listener para visibility change - recarrega assinatura quando aba volta ao foco
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && userId) {
        console.log("👀 Aba voltou ao foco, verificando assinatura...");
        await carregarAssinatura();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [userId, carregarAssinatura]);

  // Verificar se trial expirou - LÓGICA RIGOROSA
  const trialExpirado = useMemo(() => {
    if (!assinatura) return false;
    
    // Admin nunca expira
    if (assinatura.plano_tipo === 'admin') return false;
    
    // Plano Free nunca expira (é gratuito permanente)
    if (assinatura.plano_tipo === 'free') return false;
    
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
    
    // Trial cancelado = expirado
    if ((assinatura as any).trial_canceled === true) {
      return true;
    }
    
    // Status cancelado = verificar data_fim
    if (assinatura.status === 'canceled') {
      if (assinatura.data_fim) {
        const dataFim = new Date(assinatura.data_fim);
        if (!Number.isNaN(dataFim.getTime()) && dataFim > new Date()) {
          return false; // Ainda dentro do período
        }
      }
      return true; // Cancelado e fora do período = expirado
    }
    
    // Trial com cartão - verificar trial_end_at
    if ((assinatura as any).trial_with_card === true) {
      const trialEnd = (assinatura as any).trial_end_at;
      if (trialEnd) {
        const endDate = new Date(trialEnd);
        if (!Number.isNaN(endDate.getTime())) {
          return endDate < new Date();
        }
      }
      // Sem data mas sem status ativo = expirado
      if (assinatura.status !== 'active' && assinatura.status !== 'trialing') {
        return true;
      }
    }
    
    // Trial legado - verificar data_fim
    if (assinatura.plano_tipo === 'trial') {
      const end = (assinatura as any).trial_end_at || assinatura.data_fim;
      if (!end) return true; // Sem data = expirado por segurança
      
      const endDate = new Date(end);
      if (Number.isNaN(endDate.getTime())) return true;
      return endDate < new Date();
    }
    
    // Demonstração sem cartão = expirado (precisa checkout)
    if (assinatura.plano_tipo === 'demonstracao' && !(assinatura as any).trial_with_card) {
      return true;
    }
    
    return false;
  }, [assinatura]);

  // Dias restantes do trial
  const diasRestantesTrial = useMemo(() => {
    if (assinatura?.plano_tipo === 'trial' && assinatura?.data_fim) {
      const diffTime = new Date(assinatura.data_fim).getTime() - new Date().getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return Math.max(0, diffDays);
    }
    return 0;
  }, [assinatura]);

  // Horas restantes do trial (para trials de 24h)
  const horasRestantesTrial = useMemo(() => {
    if (assinatura?.plano_tipo === 'trial' && assinatura?.data_fim) {
      const diffTime = new Date(assinatura.data_fim).getTime() - new Date().getTime();
      const diffHours = Math.ceil(diffTime / (1000 * 60 * 60));
      return Math.max(0, diffHours);
    }
    return 0;
  }, [assinatura]);

  // Se trial expirou, aplicar limites reduzidos (trial expirado = acesso bloqueado)
  const limiteTrialExpirado: LimitesPlano = {
    dispositivos: 0,
    ordens_servico_mes: 0,
    produtos_mes: 0,
    dispositivos_catalogo: 0,
    servicos_avulsos_mes: 0,
    armazenamento_mb: 0,
    modulos: {
      dashboard: true,
      pdv: false,
      produtos_pecas: false,
      dispositivos: false,
      vendas: false,
      ordem_servico: false,
      fornecedores: false,
      clientes: false,
      contas: false,
      financeiro: false,
      configuracoes: false,
      servicos: false,
      orcamentos: false,
      catalogo: false,
      landing_page: false,
    },
    recursos_premium: {
      consulta_imei: false,
      verificacao_garantia_apple: false,
      suporte_prioritario: false,
      assinatura_digital: false,
    },
  };

  // Detectar migração de conta Stripe: plano pago com status canceled/past_due
  // Indica que a assinatura expirou e não renovou porque mudamos de conta Stripe
  const migracaoNecessaria = useMemo(() => {
    if (!assinatura) return false;
    if (assinatura.plano_tipo === 'admin' || assinatura.plano_tipo === 'free') return false;
    if (assinatura.plano_tipo === 'trial' || assinatura.plano_tipo === 'demonstracao') return false;
    
    const planosPagos = [
      'basico_mensal', 'basico_anual',
      'intermediario_mensal', 'intermediario_anual',
      'profissional_mensal', 'profissional_anual',
      'profissional_ultra_mensal', 'profissional_ultra_anual',
    ];

    const statusExpirado = ['canceled', 'past_due', 'unpaid', 'incomplete_expired'];
    
    return planosPagos.includes(assinatura.plano_tipo) && statusExpirado.includes(assinatura.status);
  }, [assinatura]);

  // Verificar se está bloqueado manualmente pelo admin
  const bloqueadoPorAdmin = useMemo(() => {
    const assinaturaAny = assinatura as any;
    if (!assinaturaAny?.bloqueado_admin) return false;
    
    // Se o tipo de bloqueio é "ate_assinar" e o usuário tem uma assinatura paga ativa,
    // ele deve ser automaticamente desbloqueado
    if (assinaturaAny.bloqueado_tipo === "ate_assinar") {
      const planoTipo = assinaturaAny.plano_tipo;
      const status = assinaturaAny.status;
      
      // Verificar se é um plano pago (não trial) e está ativo
      const planosPagos = [
        'basico_mensal', 'basico_anual',
        'intermediario_mensal', 'intermediario_anual',
        'profissional_mensal', 'profissional_anual',
        'profissional_ultra_mensal', 'profissional_ultra_anual',
        'admin'
      ];
      
      if (planosPagos.includes(planoTipo) && status === 'active') {
        console.log("✅ Usuário assinou plano pago, ignorando bloqueio 'ate_assinar'");
        return false; // Não está mais bloqueado pois assinou
      }
    }
    
    // Bloqueio indeterminado ou ainda não assinou
    return true;
  }, [assinatura]);

  const limites = useMemo(() => {
    // Se não tem assinatura MAS está carregando ou acabou de iniciar, 
    // assumir limites de trial para não bloquear novos usuários
    if (!assinatura) {
      // Dar benefício da dúvida - assumir trial até confirmar que realmente não existe
      console.log("📋 Assinatura não carregada, assumindo limites de trial temporariamente");
      return LIMITES_POR_PLANO.trial;
    }

    // NOVO: Se bloqueado manualmente pelo admin, aplicar bloqueio total
    if (bloqueadoPorAdmin) {
      console.log("🚫 Usuário bloqueado pelo admin, aplicando restrições");
      return limiteTrialExpirado;
    }

    // Se status é canceled, aplicar limites do plano Free (downgrade)
    if (assinatura.status === 'canceled') {
      console.log("📋 Assinatura cancelada, aplicando limites Free");
      return getLimitesFree(assinatura.created_at);
    }
    
    if (assinatura.plano_tipo === 'trial' && trialExpirado) {
      return limiteTrialExpirado;
    }
    
    // "demonstracao" com status ativo = trial (legado), mas se não ativo = Free
    if (assinatura.plano_tipo === 'demonstracao' && assinatura.status !== 'active' && assinatura.status !== 'trialing') {
      console.log("📋 Demonstração não ativa, aplicando limites Free");
      return getLimitesFree(assinatura.created_at);
    }
    
    // Para plano Free, verificar se tem trial de 24h ativo
    if (assinatura.plano_tipo === 'free') {
      const freeTrialEndsAt = (assinatura as any).free_trial_ends_at;
      if (freeTrialEndsAt && new Date(freeTrialEndsAt) > new Date()) {
        console.log("🎁 Trial 24h ativo, liberando acesso completo");
        return LIMITES_POR_PLANO.trial;
      }
      return getLimitesFree(assinatura.created_at);
    }
    
    return LIMITES_POR_PLANO[assinatura.plano_tipo as PlanoTipo] || limiteTrialExpirado;
  }, [assinatura, trialExpirado, bloqueadoPorAdmin]);

  const temAcessoModulo = useCallback((modulo: keyof typeof limites.modulos): boolean => {
    return limites.modulos[modulo];
  }, [limites]);

  const temRecursoPremium = useCallback((recurso: keyof typeof limites.recursos_premium): boolean => {
    return limites.recursos_premium[recurso];
  }, [limites]);

  const podeCadastrarDispositivo = useCallback(async (): Promise<boolean> => {
    if (limites.dispositivos === -1) return true; // ilimitado

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return false;
      const user = session.user;

      const { count, error } = await supabase
        .from("dispositivos")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);

      if (error) throw error;

      return (count || 0) < limites.dispositivos;
    } catch (error) {
      console.error("Erro ao verificar limite:", error);
      return false;
    }
  }, [limites.dispositivos]);

  const obterContagemDispositivos = useCallback(async (): Promise<{
    usados: number;
    limite: number;
    restantes: number;
    percentual: number;
  }> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return { usados: 0, limite: 0, restantes: 0, percentual: 0 };
      const user = session.user;

      const { count, error } = await supabase
        .from("dispositivos")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id);

      if (error) throw error;

      const usados = count || 0;
      const limite = limites.dispositivos === -1 ? Infinity : limites.dispositivos;
      const restantes = limite === Infinity ? Infinity : Math.max(0, limite - usados);
      const percentual = limite === Infinity ? 0 : (usados / limite) * 100;

      return { usados, limite, restantes, percentual };
    } catch (error) {
      console.error("Erro ao obter contagem:", error);
      return { usados: 0, limite: 0, restantes: 0, percentual: 0 };
    }
  }, [limites.dispositivos]);

  // Verificar se pode criar nova ordem de serviço (baseado no limite mensal)
  const podeCriarOrdemServico = useCallback(async (): Promise<{
    permitido: boolean;
    usadas: number;
    limite: number;
  }> => {
    // -1 significa ilimitado
    if (limites.ordens_servico_mes === -1) {
      return { permitido: true, usadas: 0, limite: -1 };
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return { permitido: false, usadas: 0, limite: 0 };
      const user = session.user;

      // Buscar ordens criadas no mês atual
      const inicioMes = new Date();
      inicioMes.setDate(1);
      inicioMes.setHours(0, 0, 0, 0);

      const fimMes = new Date(inicioMes.getFullYear(), inicioMes.getMonth() + 1, 0);
      fimMes.setHours(23, 59, 59, 999);

      const { count, error } = await supabase
        .from("ordens_servico")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .gte("created_at", inicioMes.toISOString())
        .lte("created_at", fimMes.toISOString());

      if (error) throw error;

      const usadas = count || 0;
      return {
        permitido: usadas < limites.ordens_servico_mes,
        usadas,
        limite: limites.ordens_servico_mes,
      };
    } catch (error) {
      console.error("Erro ao verificar limite de OS:", error);
      return { permitido: false, usadas: 0, limite: 0 };
    }
  }, [limites.ordens_servico_mes]);

  // Obter contagem de OS do mês
  const obterContagemOSMes = useCallback(async (): Promise<{
    usadas: number;
    limite: number;
    restantes: number;
    percentual: number;
    ilimitado: boolean;
  }> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return { usadas: 0, limite: 0, restantes: 0, percentual: 0, ilimitado: false };
      const user = session.user;

      // Buscar ordens criadas no mês atual
      const inicioMes = new Date();
      inicioMes.setDate(1);
      inicioMes.setHours(0, 0, 0, 0);

      const fimMes = new Date(inicioMes.getFullYear(), inicioMes.getMonth() + 1, 0);
      fimMes.setHours(23, 59, 59, 999);

      const { count, error } = await supabase
        .from("ordens_servico")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .gte("created_at", inicioMes.toISOString())
        .lte("created_at", fimMes.toISOString());

      if (error) throw error;

      const usadas = count || 0;
      const ilimitado = limites.ordens_servico_mes === -1;
      const limite = ilimitado ? Infinity : limites.ordens_servico_mes;
      const restantes = ilimitado ? Infinity : Math.max(0, limite - usadas);
      const percentual = ilimitado ? 0 : (usadas / limite) * 100;

      return { usadas, limite: limites.ordens_servico_mes, restantes, percentual, ilimitado };
    } catch (error) {
      console.error("Erro ao obter contagem de OS:", error);
      return { usadas: 0, limite: 0, restantes: 0, percentual: 0, ilimitado: false };
    }
  }, [limites.ordens_servico_mes]);

  // Obter contagem de dispositivos no catálogo
  const obterContagemCatalogo = useCallback(async (): Promise<{
    usados: number;
    limite: number;
    restantes: number;
    percentual: number;
    ilimitado: boolean;
  }> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return { usados: 0, limite: 0, restantes: 0, percentual: 0, ilimitado: false };
      const user = session.user;

      // Buscar configuração da loja para ver quantos dispositivos estão no catálogo
      const { data: config, error } = await supabase
        .from("configuracoes_loja")
        .select("catalogo_config")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      const catalogoConfig = config?.catalogo_config as { dispositivos_selecionados?: string[] } | null;
      const usados = catalogoConfig?.dispositivos_selecionados?.length || 0;
      const ilimitado = limites.dispositivos_catalogo === -1;
      const limite = ilimitado ? Infinity : limites.dispositivos_catalogo;
      const restantes = ilimitado ? Infinity : Math.max(0, limite - usados);
      const percentual = ilimitado ? 0 : (usados / limite) * 100;

      return { usados, limite: limites.dispositivos_catalogo, restantes, percentual, ilimitado };
    } catch (error) {
      console.error("Erro ao obter contagem de catálogo:", error);
      return { usados: 0, limite: 0, restantes: 0, percentual: 0, ilimitado: false };
    }
  }, [limites.dispositivos_catalogo]);

  // Verificar se pode cadastrar produto/peça (baseado no limite mensal)
  const podeCadastrarProduto = useCallback(async (): Promise<{
    permitido: boolean;
    usados: number;
    limite: number;
  }> => {
    // -1 significa ilimitado
    if (limites.produtos_mes === -1) {
      return { permitido: true, usados: 0, limite: -1 };
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return { permitido: false, usados: 0, limite: 0 };
      const user = session.user;

      // Buscar produtos e peças criados no mês atual
      const inicioMes = new Date();
      inicioMes.setDate(1);
      inicioMes.setHours(0, 0, 0, 0);

      const fimMes = new Date(inicioMes.getFullYear(), inicioMes.getMonth() + 1, 0);
      fimMes.setHours(23, 59, 59, 999);

      const [produtosResult, pecasResult] = await Promise.all([
        supabase
          .from("produtos")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .gte("created_at", inicioMes.toISOString())
          .lte("created_at", fimMes.toISOString()),
        supabase
          .from("pecas")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .gte("created_at", inicioMes.toISOString())
          .lte("created_at", fimMes.toISOString()),
      ]);

      if (produtosResult.error) throw produtosResult.error;
      if (pecasResult.error) throw pecasResult.error;

      const usados = (produtosResult.count || 0) + (pecasResult.count || 0);
      return {
        permitido: usados < limites.produtos_mes,
        usados,
        limite: limites.produtos_mes,
      };
    } catch (error) {
      console.error("Erro ao verificar limite de produtos:", error);
      return { permitido: false, usados: 0, limite: 0 };
    }
  }, [limites.produtos_mes]);

  // Obter contagem de produtos/peças do mês
  const obterContagemProdutosMes = useCallback(async (): Promise<{
    usados: number;
    limite: number;
    restantes: number;
    percentual: number;
    ilimitado: boolean;
  }> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return { usados: 0, limite: 0, restantes: 0, percentual: 0, ilimitado: false };
      const user = session.user;

      // Buscar produtos e peças criados no mês atual
      const inicioMes = new Date();
      inicioMes.setDate(1);
      inicioMes.setHours(0, 0, 0, 0);

      const fimMes = new Date(inicioMes.getFullYear(), inicioMes.getMonth() + 1, 0);
      fimMes.setHours(23, 59, 59, 999);

      const [produtosResult, pecasResult] = await Promise.all([
        supabase
          .from("produtos")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .gte("created_at", inicioMes.toISOString())
          .lte("created_at", fimMes.toISOString()),
        supabase
          .from("pecas")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .gte("created_at", inicioMes.toISOString())
          .lte("created_at", fimMes.toISOString()),
      ]);

      if (produtosResult.error) throw produtosResult.error;
      if (pecasResult.error) throw pecasResult.error;

      const usados = (produtosResult.count || 0) + (pecasResult.count || 0);
      const ilimitado = limites.produtos_mes === -1;
      const limite = ilimitado ? Infinity : limites.produtos_mes;
      const restantes = ilimitado ? Infinity : Math.max(0, limite - usados);
      const percentual = ilimitado ? 0 : (usados / limite) * 100;

      return { usados, limite: limites.produtos_mes, restantes, percentual, ilimitado };
    } catch (error) {
      console.error("Erro ao obter contagem de produtos:", error);
      return { usados: 0, limite: 0, restantes: 0, percentual: 0, ilimitado: false };
    }
  }, [limites.produtos_mes]);

  const abrirPaginaPagamento = useCallback(async (planoKey: string, cupomCodigo?: string) => {
    try {
      // Verificar se o usuário já tem um customer real no Stripe
      // Se sim, ir direto para create-checkout-session (que trata upgrade)
      // Se não, redirecionar para /cadastro-plano (primeira assinatura)
      const planoAtualTipo = assinatura?.plano_tipo;
      const hasRealStripeCustomer = assinatura?.stripe_customer_id?.startsWith('cus_');
      const planosPrimeiraAssinatura: PlanoTipo[] = ['trial', 'demonstracao', 'free'];
      
      if ((!planoAtualTipo || planosPrimeiraAssinatura.includes(planoAtualTipo)) && !hasRealStripeCustomer) {
        window.location.href = `/cadastro-plano?plan=${planoKey}`;
        return;
      }

      // SOMENTE para usuários com plano pago que vão direto ao Stripe:
      // Disparar Meta Pixel aqui
      const planoInfo = PLANOS[planoKey as keyof typeof PLANOS];
      
      if (window.fbq) {
        window.fbq('track', 'InitiateCheckout', {
          content_name: planoInfo?.nome || planoKey,
          content_category: 'Subscription',
          currency: 'BRL',
          value: planoInfo?.preco || 0
        });
      }

      const priceId = STRIPE_PRICE_IDS[planoKey as keyof typeof STRIPE_PRICE_IDS];
      
      if (!priceId) {
        toast({
          title: "Erro",
          description: "Preço não encontrado para este plano.",
          variant: "destructive",
        });
        return;
      }

      // Get tracking parameters for Meta CAPI
      const trackingParams = (window as any).__getTrackingParams?.() || {};

      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: { 
          priceId, 
          planoTipo: planoKey,
          cupomCodigo: cupomCodigo || null,
          // Meta CAPI tracking params
          fbp: trackingParams.fbp,
          fbc: trackingParams.fbc,
          fbclid: trackingParams.fbclid,
          utm_source: trackingParams.utm_source,
          utm_medium: trackingParams.utm_medium,
          utm_campaign: trackingParams.utm_campaign,
          utm_content: trackingParams.utm_content,
          utm_term: trackingParams.utm_term,
          client_user_agent: trackingParams.client_user_agent,
        }
      });

      if (error) throw error;

      // Se foi upgrade direto (sem checkout), recarregar assinatura
      if (data?.upgraded) {
        toast({
          title: "✅ Plano atualizado!",
          description: `Seu plano foi alterado para ${planoKey.replace(/_/g, ' ').toUpperCase()} com sucesso.`,
        });
        await verificarAssinaturaStripe();
        await carregarAssinatura();
        return;
      }

      if (data?.alreadySubscribed) {
        toast({
          title: "ℹ️ Plano atual",
          description: "Você já está neste plano.",
        });
        return;
      }

      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (error: any) {
      console.error("Erro ao abrir página de pagamento:", error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível iniciar o processo de pagamento.",
        variant: "destructive",
      });
    }
  }, [assinatura]);

  const cancelarPlano = useCallback(async (): Promise<boolean> => {
    try {
      const { data, error } = await supabase.functions.invoke('cancel-subscription');

      if (error) throw error;

      if (data?.success) {
        toast({
          title: "Plano cancelado",
          description: "Seu plano foi cancelado. Você agora está no plano de demonstração.",
        });
        await carregarAssinatura();
        return true;
      } else {
        toast({
          title: "Erro",
          description: data?.message || "Não foi possível cancelar o plano.",
          variant: "destructive",
        });
        return false;
      }
    } catch (error: any) {
      console.error("Erro ao cancelar plano:", error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível cancelar o plano.",
        variant: "destructive",
      });
      return false;
    }
  }, [carregarAssinatura]);

  return {
    assinatura,
    carregando,
    limites,
    temAcessoModulo,
    temRecursoPremium,
    podeCadastrarDispositivo,
    obterContagemDispositivos,
    podeCriarOrdemServico,
    obterContagemOSMes,
    obterContagemCatalogo,
    podeCadastrarProduto,
    obterContagemProdutosMes,
    abrirPaginaPagamento,
    cancelarPlano,
    trialExpirado,
    diasRestantesTrial,
    horasRestantesTrial,
    migracaoNecessaria,
    recarregar: recarregarComFeedback,
    verificarAssinaturaStripe,
  };
}
