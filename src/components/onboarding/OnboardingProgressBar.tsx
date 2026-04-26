import { useNavigate, useLocation } from "react-router-dom";
import { useOnboarding } from "@/hooks/useOnboarding";
import { useAssinatura } from "@/hooks/useAssinatura";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { 
  User, 
  Smartphone, 
  ClipboardList, 
  TrendingUp, 
  Check, 
  ChevronRight,
  Sparkles,
  Cog
} from "lucide-react";
import { cn } from "@/lib/utils";

interface OnboardingStep {
  id: number;
  title: string;
  shortTitle: string;
  icon: React.ReactNode;
  route: string;
  stepKey: 'stepClienteCadastrado' | 'stepDispositivoCadastrado' | 'stepPecaCadastrada' | 'stepOsCriada' | 'stepLucroVisualizado';
}

export function OnboardingProgressBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { progress, loading, getProgressPercentage, getCurrentStep } = useOnboarding();
  const { assinatura } = useAssinatura();
  
  // Não mostrar para admins ou planos pagos
  const isAdmin = assinatura?.plano_tipo === 'admin';
  const isPaid = assinatura?.status === 'active' && assinatura?.plano_tipo !== 'trial';
  
  // Verificar se ainda falta completar algum passo baseado no tipo de negócio
  const hasIncompleteSteps = () => {
    if (progress.tipoNegocio === 'assistencia') {
      return !progress.stepClienteCadastrado || !progress.stepPecaCadastrada || !progress.stepOsCriada || !progress.stepLucroVisualizado;
    } else if (progress.tipoNegocio === 'vendas') {
      return !progress.stepClienteCadastrado || !progress.stepDispositivoCadastrado || !progress.stepLucroVisualizado;
    }
    return true;
  };
  
  // Mostrar enquanto houver passos incompletos (ignora o flag onboardingCompleted que pode estar errado)
  const shouldShow = !loading && hasIncompleteSteps() && !isAdmin && !isPaid && progress.tipoNegocio;

  if (!shouldShow) return null;

  // Definir passos baseado no tipo de negócio
  const getSteps = (): OnboardingStep[] => {
    if (progress.tipoNegocio === 'assistencia') {
      return [
        {
          id: 1,
          title: "Cadastrar cliente",
          shortTitle: "Cliente",
          icon: <User className="h-4 w-4" />,
          route: "/clientes",
          stepKey: 'stepClienteCadastrado'
        },
        {
          id: 2,
          title: "Cadastrar peça",
          shortTitle: "Peça",
          icon: <Cog className="h-4 w-4" />,
          route: "/produtos",
          stepKey: 'stepPecaCadastrada'
        },
        {
          id: 3,
          title: "Criar OS",
          shortTitle: "OS",
          icon: <ClipboardList className="h-4 w-4" />,
          route: "/os",
          stepKey: 'stepOsCriada'
        },
        {
          id: 4,
          title: "Ver lucro",
          shortTitle: "Lucro",
          icon: <TrendingUp className="h-4 w-4" />,
          route: "/financeiro",
          stepKey: 'stepLucroVisualizado'
        }
      ];
    } else {
      // Vendas
      return [
        {
          id: 1,
          title: "Cadastrar cliente",
          shortTitle: "Cliente",
          icon: <User className="h-4 w-4" />,
          route: "/clientes",
          stepKey: 'stepClienteCadastrado'
        },
        {
          id: 2,
          title: "Cadastrar aparelho",
          shortTitle: "Aparelho",
          icon: <Smartphone className="h-4 w-4" />,
          route: "/dispositivos",
          stepKey: 'stepDispositivoCadastrado'
        },
        {
          id: 3,
          title: "Ver lucro",
          shortTitle: "Lucro",
          icon: <TrendingUp className="h-4 w-4" />,
          route: "/financeiro",
          stepKey: 'stepLucroVisualizado'
        }
      ];
    }
  };

  const steps = getSteps();
  const progressPercent = getProgressPercentage();
  const currentStep = getCurrentStep();

  const handleStepClick = (step: OnboardingStep) => {
    // Permitir navegar para passos já completados ou o atual
    if (progress[step.stepKey] || step.id === currentStep) {
      navigate(step.route);
    }
  };

  // Encontrar próximo passo - garantir que sempre mostra o próximo não concluído
  const nextStep = steps.find(s => !progress[s.stepKey]) || null;

  return (
    <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 border-b border-primary/20">
      {/* Mobile: Layout expandido e claro */}
      <div className="sm:hidden px-3 py-3">
        {/* Header com progresso */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Primeiros passos</span>
          </div>
          <span className="text-sm font-bold text-primary">{Math.round(progressPercent)}%</span>
        </div>

        {/* Progress bar */}
        <Progress value={progressPercent} className="h-2 mb-3" />

        {/* Passos visuais - círculos com labels */}
        <div className="flex items-center justify-center gap-2 mb-3">
          {steps.map((step, index) => {
            const isCompleted = progress[step.stepKey];
            const isActive = step.id === currentStep;
            const isLocked = step.id > currentStep && !isCompleted;

            return (
              <div key={step.id} className="flex items-center">
                <div className="flex flex-col items-center gap-1">
                  <button
                    onClick={() => handleStepClick(step)}
                    disabled={isLocked}
                    className={cn(
                      "flex items-center justify-center w-12 h-12 rounded-full transition-all",
                      isCompleted && "bg-primary text-primary-foreground",
                      isActive && !isCompleted && "bg-primary/20 text-primary border-2 border-primary shadow-md",
                      isLocked && "bg-muted text-muted-foreground cursor-not-allowed opacity-50",
                      !isLocked && !isCompleted && !isActive && "bg-muted/50 text-muted-foreground"
                    )}
                  >
                    {isCompleted ? (
                      <Check className="h-5 w-5" />
                    ) : (
                      <span className="[&>svg]:h-5 [&>svg]:w-5">{step.icon}</span>
                    )}
                  </button>
                  <span className={cn(
                    "text-[10px] font-medium leading-tight text-center",
                    isActive && "text-primary font-semibold",
                    isCompleted && "text-primary",
                    isLocked && "text-muted-foreground"
                  )}>
                    {step.shortTitle}
                  </span>
                </div>
                
                {index < steps.length - 1 && (
                  <div className={cn(
                    "w-4 h-0.5 mx-1 mt-[-16px]",
                    isCompleted ? "bg-primary" : "bg-muted-foreground/30"
                  )} />
                )}
              </div>
            );
          })}
        </div>

        {/* Botão de ação claro */}
        {nextStep && !progress.onboardingCompleted && (
          <Button
            size="default"
            variant="default"
            className="w-full h-10 text-sm font-semibold gap-2"
            onClick={() => navigate(nextStep.route)}
          >
            {nextStep.title}
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Desktop: Layout original otimizado */}
      <div className="hidden sm:block px-4 py-3">
        <div className="flex items-center gap-4">
          {/* Progress indicator */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <Sparkles className="h-5 w-5 text-primary" />
            <span className="text-sm font-bold text-primary whitespace-nowrap">
              {Math.round(progressPercent)}%
            </span>
          </div>

          {/* Steps */}
          <div className="flex items-center gap-1 flex-1 min-w-0">
            {steps.map((step, index) => {
              const isCompleted = progress[step.stepKey];
              const isActive = step.id === currentStep;
              const isLocked = step.id > currentStep && !isCompleted;
              const isCurrentRoute = location.pathname === step.route;

              return (
                <div key={step.id} className="flex items-center min-w-0">
                  <button
                    onClick={() => handleStepClick(step)}
                    disabled={isLocked}
                    className={cn(
                      "flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all min-w-0",
                      isCompleted && "bg-primary text-primary-foreground",
                      isActive && !isCompleted && "bg-primary/20 text-primary border border-primary",
                      isCurrentRoute && !isCompleted && "ring-2 ring-primary ring-offset-1",
                      isLocked && "bg-muted text-muted-foreground cursor-not-allowed opacity-50",
                      !isLocked && !isCompleted && !isActive && "bg-muted/50 text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {isCompleted ? (
                      <Check className="h-3.5 w-3.5 flex-shrink-0" />
                    ) : (
                      <span className="flex-shrink-0">{step.icon}</span>
                    )}
                    <span className="truncate">{step.shortTitle}</span>
                  </button>
                  
                  {index < steps.length - 1 && (
                    <ChevronRight className={cn(
                      "h-4 w-4 mx-1 flex-shrink-0",
                      isCompleted ? "text-primary" : "text-muted-foreground/50"
                    )} />
                  )}
                </div>
              );
            })}
          </div>

          {/* Next step button */}
          {nextStep && !progress.onboardingCompleted && (
            <Button
              size="sm"
              variant="default"
              className="flex-shrink-0 h-8 px-3 text-xs gap-1"
              onClick={() => navigate(nextStep.route)}
            >
              {nextStep.title}
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        {/* Progress bar */}
        <div className="mt-2">
          <Progress value={progressPercent} className="h-1.5" />
        </div>
      </div>
    </div>
  );
}
