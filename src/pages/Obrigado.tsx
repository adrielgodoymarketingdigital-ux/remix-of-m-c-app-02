import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ObrigadoStatusCard } from "@/components/pagamento/ObrigadoStatusCard";
import { PLANOS } from "@/types/plano";

type ObrigadoStatus = "verificando" | "ativado" | "processando";

const CHECKOUT_STORAGE_KEY = "mec_pending_checkout";
const CHECK_INTERVAL_MS = 1000;
const MAX_TENTATIVAS = 15;
const PLANOS_PAGOS = [
  "basico_mensal",
  "basico_anual",
  "intermediario_mensal",
  "intermediario_anual",
  "profissional_mensal",
  "profissional_anual",
];

const getPendingCheckoutPlan = () => {
  if (typeof window === "undefined") return null;

  try {
    const rawValue = localStorage.getItem(CHECKOUT_STORAGE_KEY);
    if (!rawValue) return null;

    const parsed = JSON.parse(rawValue) as { plan?: string; startedAt?: number };
    return typeof parsed.plan === "string" ? parsed.plan : null;
  } catch {
    return null;
  }
};

const clearPendingCheckout = () => {
  if (typeof window !== "undefined") {
    localStorage.removeItem(CHECKOUT_STORAGE_KEY);
  }
};

export default function Obrigado() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [status, setStatus] = useState<ObrigadoStatus>("verificando");
  const [tentativasDisplay, setTentativasDisplay] = useState(0);
  const [planoAtivado, setPlanoAtivado] = useState<string | null>(null);
  const [checkedAuth, setCheckedAuth] = useState(false);
  const plan = searchParams.get("plan") || getPendingCheckoutPlan();

  const tentativasRef = useRef(0);
  const verificandoRef = useRef(false);
  const pollingActiveRef = useRef(true);

  useEffect(() => {
    let cancelled = false;

    const checkAuth = async () => {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (cancelled) return;

        if (session) {
          setCheckedAuth(true);
          return;
        }

        if (attempt < 4) {
          await new Promise((resolve) => setTimeout(resolve, 350));
        }
      }

      if (cancelled) return;

      const params = searchParams.toString();
      const returnUrl = params ? `/obrigado?${params}` : "/obrigado";
      navigate(`/auth?redirect=${encodeURIComponent(returnUrl)}`, { replace: true });
    };

    checkAuth();

    return () => {
      cancelled = true;
    };
  }, [navigate, searchParams]);

  useEffect(() => {
    if (window.fbq && plan) {
      const planoInfo = PLANOS[plan as keyof typeof PLANOS];
      window.fbq('track', 'Purchase', {
        content_name: planoInfo?.nome || plan,
        content_category: 'Subscription',
        currency: 'BRL',
        value: planoInfo?.preco || 0
      });
    }
  }, [plan]);

  const ativarPlano = useCallback((plano: string) => {
    clearPendingCheckout();
    setPlanoAtivado(plano);
    setStatus("ativado");
    pollingActiveRef.current = false;

    toast({
      title: "✅ Plano ativado!",
      description: `Seu plano ${plano.replace(/_/g, " ")} foi ativado com sucesso.`,
    });

    return true;
  }, []);

  const sincronizarAssinaturaStripe = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke("check-subscription");

      if (error) return false;

      if (data?.subscribed && data?.plano_tipo !== "demonstracao") {
        return ativarPlano(data.plano_tipo);
      }
    } catch {
      return false;
    }

    return false;
  }, [ativarPlano]);

  const verificarPlano = useCallback(async (options?: { forceProviderSync?: boolean }): Promise<boolean> => {
    if (verificandoRef.current) return false;
    verificandoRef.current = true;

    try {
      tentativasRef.current += 1;
      setTentativasDisplay(tentativasRef.current);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) return false;

      const { data: assinatura, error } = await supabase
        .from("assinaturas")
        .select("plano_tipo, status, payment_provider")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (error) return false;

      if (
        assinatura &&
        PLANOS_PAGOS.includes(assinatura.plano_tipo) &&
        (assinatura.status === "active" || assinatura.status === "trialing")
      ) {
        return ativarPlano(assinatura.plano_tipo);
      }

      if (options?.forceProviderSync && (!assinatura || assinatura.payment_provider === "stripe")) {
        return sincronizarAssinaturaStripe();
      }

      return false;
    } catch {
      return false;
    } finally {
      verificandoRef.current = false;
    }
  }, [ativarPlano, sincronizarAssinaturaStripe]);

  const handleVerificarAgora = async () => {
    setStatus("verificando");
    tentativasRef.current = 0;
    setTentativasDisplay(0);
    pollingActiveRef.current = true;

    const sucesso = await verificarPlano({ forceProviderSync: true });

    if (!sucesso) {
      setStatus("processando");
      toast({
        title: "⏳ Ainda processando",
        description: "Seu pagamento ainda está sendo processado. Tente novamente em alguns instantes.",
      });
    }
  };

  useEffect(() => {
    if (!checkedAuth) return;

    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    tentativasRef.current = 0;
    pollingActiveRef.current = true;

    const executarVerificacao = async () => {
      if (!pollingActiveRef.current) return;

      const sucesso = await verificarPlano();

      if (sucesso) {
        return;
      }

      if (tentativasRef.current >= MAX_TENTATIVAS) {
        setStatus("processando");
        pollingActiveRef.current = false;
        return;
      }

      if (pollingActiveRef.current) {
        timeoutId = setTimeout(executarVerificacao, CHECK_INTERVAL_MS);
      }
    };

    executarVerificacao();

    return () => {
      pollingActiveRef.current = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [checkedAuth, verificarPlano]);

  useEffect(() => {
    if (status !== "ativado") return;

    const timeoutId = setTimeout(() => {
      navigate("/dashboard", { replace: true });
    }, 700);

    return () => clearTimeout(timeoutId);
  }, [navigate, status]);

  return (
    <ObrigadoStatusCard
      status={status}
      restaurandoSessao={!checkedAuth}
      tentativasDisplay={tentativasDisplay}
      plan={plan}
      planoAtivado={planoAtivado}
      onVerificarAgora={handleVerificarAgora}
      onIrParaDashboard={() => navigate("/dashboard", { replace: true })}
    />
  );
}
