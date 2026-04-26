import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAssinatura } from "@/hooks/useAssinatura";
import { Clock, Sparkles, Gift, CreditCard } from "lucide-react";
import { useTrialStatus } from "@/hooks/useTrialStatus";
import { useFuncionarioPermissoes } from "@/hooks/useFuncionarioPermissoes";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function TrialBanner() {
  const navigate = useNavigate();
  const { assinatura, diasRestantesTrial, horasRestantesTrial, trialExpirado } = useAssinatura();
  const { isTrialWithCard, trialDaysRemaining, trialEndsAt, planAfterTrial } = useTrialStatus();
  const { isFuncionario } = useFuncionarioPermissoes();
  
  // Funcionários NUNCA veem banner de trial (usam plano do dono)
  if (isFuncionario) return null;
  
  // Não mostrar se não for trial
  if (assinatura?.plano_tipo !== 'trial') return null;
  
  // Se trial expirou, mostrar mensagem diferente
  if (trialExpirado) {
    return (
      <div className="bg-gradient-to-r from-red-500 to-red-600 text-white p-3 sm:p-4 rounded-lg mb-4 shadow-md">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Clock className="h-5 w-5 flex-shrink-0 animate-pulse" />
            <div className="min-w-0">
              <p className="font-bold text-sm sm:text-base truncate">Teste expirado!</p>
              <p className="text-xs opacity-90 hidden sm:block">Assine para continuar.</p>
            </div>
          </div>
          <Button 
            variant="secondary" 
            size="sm"
            onClick={() => navigate('/plano')}
            className="bg-white text-red-600 hover:bg-gray-100 whitespace-nowrap text-xs sm:text-sm h-8 px-3"
          >
            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            Ver Planos
          </Button>
        </div>
      </div>
    );
  }
  
  // Trial com cartão (7 dias) - mostrar informações sobre cobrança futura
  if (isTrialWithCard && trialEndsAt) {
    const dataCobranca = format(trialEndsAt, "dd 'de' MMMM", { locale: ptBR });
    
    return (
      <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white p-3 sm:p-4 rounded-lg mb-4 shadow-md">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="relative flex-shrink-0">
              <Gift className="h-5 w-5" />
              <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
              </span>
            </div>
            <div className="min-w-0">
              <p className="font-bold text-sm sm:text-base">
                🎁 Teste Grátis - {trialDaysRemaining} {trialDaysRemaining === 1 ? 'dia restante' : 'dias restantes'}
              </p>
              <p className="text-xs opacity-90 hidden sm:block">
                <CreditCard className="inline h-3 w-3 mr-1" />
                Cobrança em {dataCobranca} • {planAfterTrial}
              </p>
            </div>
          </div>
          <Button 
            variant="secondary" 
            size="sm"
            onClick={() => navigate('/plano')}
            className="bg-white text-green-600 hover:bg-gray-100 whitespace-nowrap text-xs sm:text-sm h-8 px-3"
          >
            Gerenciar
          </Button>
        </div>
      </div>
    );
  }
  
  // Trial legado (24h) - manter comportamento anterior
  const mostrarHoras = diasRestantesTrial === 0 && horasRestantesTrial > 0;
  
  return (
    <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white p-3 sm:p-4 rounded-lg mb-4 shadow-md">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="relative flex-shrink-0">
            <Sparkles className="h-5 w-5" />
            <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
            </span>
          </div>
          <div className="min-w-0">
            <p className="font-bold text-sm sm:text-base">
              🎉 Trial - {mostrarHoras 
                ? `${horasRestantesTrial}h restantes` 
                : `${diasRestantesTrial} ${diasRestantesTrial === 1 ? 'dia' : 'dias'}`}
            </p>
            <p className="text-xs opacity-90 hidden sm:block">
              Aproveite! Assine para continuar após o trial.
            </p>
          </div>
        </div>
        <Button 
          variant="secondary" 
          size="sm"
          onClick={() => navigate('/plano')}
          className="bg-white text-orange-600 hover:bg-gray-100 whitespace-nowrap text-xs sm:text-sm h-8 px-3"
        >
          <Sparkles className="mr-1.5 h-3.5 w-3.5" />
          Ver Planos
        </Button>
      </div>
    </div>
  );
}
