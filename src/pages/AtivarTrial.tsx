import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { PLANOS } from "@/types/plano";
import { 
  Gift, 
  CheckCircle2, 
  CreditCard, 
  Loader2,
  Lock,
  Sparkles
} from "lucide-react";

export default function AtivarTrial() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialPlan = searchParams.get("plan") || "intermediario_mensal";
  const wasCanceled = searchParams.get("canceled") === "true";
  
  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(initialPlan);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Check authentication AND subscription status
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    let mounted = true;

    const checkAuthAndSubscription = async () => {
      // Timeout de segurança: liberar após 8 segundos mesmo se algo travar
      timeoutId = setTimeout(() => {
        if (mounted) {
          console.log("⚠️ [AtivarTrial] Timeout atingido - liberando página");
          setCheckingAuth(false);
        }
      }, 8000);

      try {
        console.log("🔍 [AtivarTrial] Iniciando verificação...");
        
        // Verificar sessão com timeout próprio
        const sessionPromise = supabase.auth.getSession();
        const sessionResult = await Promise.race([
          sessionPromise,
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000))
        ]);
        
        if (!sessionResult || !('data' in sessionResult)) {
          console.log("⚠️ [AtivarTrial] Timeout ao buscar sessão");
          if (mounted) setCheckingAuth(false);
          return;
        }

        const session = sessionResult.data.session;
        
        if (!session) {
          console.log("❌ [AtivarTrial] Sem sessão - redirecionando para auth");
          navigate('/auth');
          return;
        }

        console.log("✅ [AtivarTrial] Sessão encontrada:", session.user.id);

        // Verificar assinatura com timeout
        const assinaturaPromise = supabase
          .from("assinaturas")
          .select("*")
          .eq("user_id", session.user.id)
          .maybeSingle();
          
        const assinaturaResult = await Promise.race([
          assinaturaPromise,
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000))
        ]);

        const assinatura = assinaturaResult && 'data' in assinaturaResult ? assinaturaResult.data : null;
        
        console.log("📦 [AtivarTrial] Assinatura:", assinatura?.plano_tipo, assinatura?.status);

        if (assinatura) {
          // Admin sempre liberado
          if (assinatura.plano_tipo === "admin") {
            console.log("✅ [AtivarTrial] Admin - redirecionando para dashboard");
            navigate('/dashboard', { replace: true });
            return;
          }

          // Assinatura ativa/trialing (não demonstração)
          const isActiveUser =
            (assinatura.status === "active" || assinatura.status === "trialing") &&
            assinatura.plano_tipo !== "demonstracao";
          if (isActiveUser) {
            console.log("✅ [AtivarTrial] Usuário ativo - redirecionando para dashboard");
            navigate('/dashboard', { replace: true });
            return;
          }

          // Subscription Stripe REAL
          const hasRealStripeSubscription = assinatura.stripe_subscription_id && 
            assinatura.stripe_subscription_id.startsWith('sub_') &&
            !assinatura.stripe_subscription_id.startsWith('sub_trial_') &&
            !assinatura.stripe_subscription_id.startsWith('sub_demo_') &&
            !assinatura.stripe_subscription_id.startsWith('sub_pending_');

          if (hasRealStripeSubscription) {
            console.log("✅ [AtivarTrial] Stripe real - redirecionando para dashboard");
            navigate('/dashboard', { replace: true });
            return;
          }

          // Trial com cartão já ativado
          if (assinatura.trial_with_card === true) {
            console.log("✅ [AtivarTrial] Trial com cartão - redirecionando para dashboard");
            navigate('/dashboard', { replace: true });
            return;
          }
        }

        // Usuário pode continuar para ativar trial
        console.log("✅ [AtivarTrial] Usuário precisa ativar trial - liberando página");
        if (mounted) setCheckingAuth(false);
        
      } catch (error) {
        console.error("[AtivarTrial] Erro na verificação:", error);
        // Em caso de erro, liberar a página para o usuário tentar
        if (mounted) setCheckingAuth(false);
      } finally {
        clearTimeout(timeoutId);
      }
    };

    checkAuthAndSubscription();
    
    return () => {
      mounted = false;
      clearTimeout(timeoutId);
    };
  }, [navigate]);

  // Show toast if user canceled checkout
  useEffect(() => {
    if (wasCanceled) {
      toast({
        title: "Checkout cancelado",
        description: "Você pode tentar novamente quando quiser.",
      });
    }
  }, [wasCanceled]);

  const plans = [
    { key: "basico_mensal", ...PLANOS.basico_mensal },
    { key: "intermediario_mensal", ...PLANOS.intermediario_mensal },
    { key: "profissional_mensal", ...PLANOS.profissional_mensal },
  ];

  const handleActivateTrial = async () => {
    setLoading(true);

    try {
      // Track event
      if (window.fbq) {
        window.fbq('track', 'InitiateCheckout', {
          content_name: `Trial - ${selectedPlan}`,
          content_category: 'Trial Activation',
          currency: 'BRL',
          value: 0,
        });
      }

      // Get tracking params
      const trackingParams = (window as any).__getTrackingParams?.() || {};

      // Call edge function to create trial checkout
      const { data, error } = await supabase.functions.invoke('create-trial-checkout', {
        body: {
          planoTipo: selectedPlan,
          fbp: trackingParams.fbp,
          fbc: trackingParams.fbc,
          fbclid: trackingParams.fbclid,
          utm_source: trackingParams.utm_source,
          utm_medium: trackingParams.utm_medium,
          utm_campaign: trackingParams.utm_campaign,
          utm_content: trackingParams.utm_content,
          utm_term: trackingParams.utm_term,
          client_user_agent: trackingParams.client_user_agent,
        },
      });

      if (error) throw error;

      if (data?.url) {
        // Redirect to Stripe checkout
        console.log("Redirecting to Stripe checkout:", data.url);
        
        // Try window.location.assign first, fallback to window.open
        try {
          // Use replace to avoid back button issues
          window.location.replace(data.url);
        } catch (redirectError) {
          console.log("Fallback: opening in new tab", redirectError);
          window.open(data.url, '_blank');
          setLoading(false);
        }
        return;
      } else {
        throw new Error("URL de checkout não retornada");
      }
    } catch (error: any) {
      console.error("Error creating trial checkout:", error);
      toast({
        title: "Erro ao ativar trial",
        description: error.message || "Não foi possível iniciar o checkout. Tente novamente.",
        variant: "destructive",
      });
      // Only reset loading on error
      setLoading(false);
    }
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="text-sm text-muted-foreground">Verificando acesso...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white py-4 sm:py-8 px-3 sm:px-4">
      <div className="max-w-lg mx-auto">
        {/* Success Badge */}
        <div className="text-center mb-4 sm:mb-6">
          <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-green-100 text-green-700 text-xs sm:text-sm font-medium">
            <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            Parabéns! Você está quase lá
          </div>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-xl border border-gray-100 p-4 sm:p-6 md:p-8">
          {/* Header */}
          <div className="text-center mb-5 sm:mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-green-400 to-green-600 mb-3 sm:mb-4">
              <Gift className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
            </div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 leading-tight">
              Comece seu teste gratuito de 7 dias
            </h1>
            <p className="text-gray-600 mt-2 sm:mt-3 text-sm sm:text-lg">
              Você terá acesso completo ao sistema.{" "}
              <span className="font-semibold text-green-600">Nenhuma cobrança será feita agora.</span>
            </p>
          </div>

          {/* Benefits */}
          <div className="bg-gray-50 rounded-lg sm:rounded-xl p-3 sm:p-5 mb-4 sm:mb-6">
            <div className="space-y-2 sm:space-y-3">
              {[
                "Acesso total às funcionalidades",
                "Cancelamento simples e sem fidelidade",
                "Suporte para ajudar na configuração",
                "Seus dados permanecem salvos",
              ].map((benefit, index) => (
                <div key={index} className="flex items-center gap-2 sm:gap-3">
                  <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-green-500 shrink-0" />
                  <span className="text-sm sm:text-base text-gray-700">{benefit}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Plan Selection */}
          <div className="mb-4 sm:mb-6">
            <Label className="text-xs sm:text-sm font-medium text-gray-700 mb-2 sm:mb-3 block">
              <Sparkles className="inline h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" />
              Selecione seu plano para após o trial:
            </Label>
            <RadioGroup 
              value={selectedPlan} 
              onValueChange={setSelectedPlan}
              className="space-y-2 sm:space-y-3"
            >
              {plans.map((plan) => (
                <label
                  key={plan.key}
                  className={`flex items-center justify-between p-3 sm:p-4 rounded-lg sm:rounded-xl border-2 cursor-pointer transition-all ${
                    selectedPlan === plan.key 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2 sm:gap-3">
                    <RadioGroupItem value={plan.key} id={plan.key} />
                    <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2">
                      <span className="font-medium text-sm sm:text-base text-gray-900">{plan.nome}</span>
                      {plan.key === "intermediario_mensal" && (
                        <span className="px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs font-medium bg-blue-100 text-blue-700 rounded-full w-fit">
                          Recomendado
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="font-bold text-sm sm:text-base text-gray-900 whitespace-nowrap">
                    R${plan.preco.toFixed(2).replace('.', ',')}/mês
                  </span>
                </label>
              ))}
            </RadioGroup>
          </div>

          {/* Warning */}
          <div className="flex items-start gap-2 sm:gap-3 p-3 sm:p-4 rounded-lg sm:rounded-xl bg-yellow-50 border border-yellow-200 mb-4 sm:mb-6">
            <CreditCard className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-600 shrink-0 mt-0.5" />
            <p className="text-xs sm:text-sm text-yellow-800">
              <span className="font-medium">O cartão é necessário apenas para ativar o teste.</span>{" "}
              Você só será cobrado após 7 dias, e pode cancelar a qualquer momento.
            </p>
          </div>

          {/* CTA Button */}
          <Button
            onClick={handleActivateTrial}
            disabled={loading}
            className="w-full h-12 sm:h-14 text-base sm:text-lg font-bold bg-green-600 hover:bg-green-700 shadow-lg shadow-green-500/25"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
                Preparando...
              </>
            ) : (
              <>
                🚀 Ativar Teste Gratuito
              </>
            )}
          </Button>

          {/* Security Badge */}
          <div className="flex items-center justify-center gap-1.5 sm:gap-2 mt-3 sm:mt-4 text-xs sm:text-sm text-gray-500">
            <Lock className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span>Pagamento seguro via</span>
            <span className="font-semibold text-gray-700">Stripe</span>
          </div>
        </div>

        {/* Bottom note */}
        <p className="text-center text-xs sm:text-sm text-gray-500 mt-4 sm:mt-6">
          Ao ativar, você concorda com os termos de serviço.
        </p>
      </div>
    </div>
  );
}
