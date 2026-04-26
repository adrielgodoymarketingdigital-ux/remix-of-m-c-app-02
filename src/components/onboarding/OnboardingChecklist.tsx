import { useOnboarding } from "@/hooks/useOnboarding";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  User, 
  Smartphone, 
  ClipboardList, 
  TrendingUp, 
  Check,
  ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";

interface OnboardingChecklistProps {
  compact?: boolean;
}

export function OnboardingChecklist({ compact = false }: OnboardingChecklistProps) {
  const navigate = useNavigate();
  const { progress, loading, getCurrentStep, getProgressPercentage } = useOnboarding();

  // Não mostrar se completou o onboarding ou ainda está carregando
  if (loading || progress.onboardingCompleted) return null;

  const steps = [
    {
      id: 1,
      title: compact ? "Cliente" : "Cadastrar cliente",
      icon: User,
      route: "/clientes",
      completed: progress.stepClienteCadastrado
    },
    {
      id: 2,
      title: compact ? "Aparelho" : "Cadastrar aparelho",
      icon: Smartphone,
      route: "/dispositivos",
      completed: progress.stepDispositivoCadastrado
    },
    {
      id: 3,
      title: compact ? "OS" : "Criar OS",
      icon: ClipboardList,
      route: "/os",
      completed: progress.stepOsCriada
    },
    {
      id: 4,
      title: compact ? "Lucro" : "Ver lucro",
      icon: TrendingUp,
      route: "/financeiro",
      completed: progress.stepLucroVisualizado
    }
  ];

  const currentStep = getCurrentStep();
  const progressPercent = getProgressPercentage();

  if (compact) {
    return (
      <div className="bg-card border rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium">Primeiros passos</span>
          <span className="text-xs text-muted-foreground">{Math.round(progressPercent)}%</span>
        </div>
        <Progress value={progressPercent} className="h-1.5 mb-3" />
        <div className="flex gap-2">
          {steps.map((step) => (
            <Button
              key={step.id}
              variant={step.completed ? "secondary" : step.id === currentStep ? "default" : "ghost"}
              size="sm"
              className={cn(
                "flex-1 h-8 text-xs",
                step.id > currentStep && !step.completed && "opacity-50"
              )}
              onClick={() => navigate(step.route)}
              disabled={step.id > currentStep && !step.completed}
            >
              {step.completed ? (
                <Check className="h-3 w-3" />
              ) : (
                <step.icon className="h-3 w-3" />
              )}
            </Button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-foreground">Primeiros passos</h3>
          <p className="text-sm text-muted-foreground">Complete para organizar sua assistência</p>
        </div>
        <div className="text-right">
          <span className="text-lg font-bold text-primary">{Math.round(progressPercent)}%</span>
          <p className="text-xs text-muted-foreground">concluído</p>
        </div>
      </div>

      <Progress value={progressPercent} className="h-2 mb-4" />

      <div className="space-y-2">
        {steps.map((step) => {
          const isActive = step.id === currentStep;
          const isLocked = step.id > currentStep && !step.completed;
          const StepIcon = step.icon;

          return (
            <button
              key={step.id}
              onClick={() => !isLocked && navigate(step.route)}
              disabled={isLocked}
              className={cn(
                "w-full flex items-center gap-3 p-3 rounded-lg transition-all text-left",
                step.completed && "bg-primary/5",
                isActive && "bg-primary/10 ring-1 ring-primary",
                isLocked && "opacity-50 cursor-not-allowed",
                !isLocked && !step.completed && "hover:bg-muted"
              )}
            >
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                step.completed && "bg-primary text-primary-foreground",
                isActive && "bg-primary/20 text-primary",
                isLocked && "bg-muted text-muted-foreground"
              )}>
                {step.completed ? <Check className="h-4 w-4" /> : <StepIcon className="h-4 w-4" />}
              </div>
              
              <span className={cn(
                "flex-1 text-sm font-medium",
                step.completed && "text-primary",
                isLocked && "text-muted-foreground"
              )}>
                {step.title}
              </span>

              {!isLocked && (
                <ChevronRight className={cn(
                  "h-4 w-4",
                  step.completed ? "text-primary" : "text-muted-foreground"
                )} />
              )}
            </button>
          );
        })}
      </div>

      {progress.ahaMomentReached && !progress.onboardingCompleted && (
        <div className="mt-4 p-3 bg-primary/10 rounded-lg border border-primary/20">
          <p className="text-sm text-primary font-medium text-center">
            🎉 Você atingiu o momento chave! Continue para desbloquear todo o potencial.
          </p>
        </div>
      )}
    </div>
  );
}
