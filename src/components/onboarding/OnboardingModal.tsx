import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useOnboarding, TipoNegocio } from "@/hooks/useOnboarding";
import { useAssinatura } from "@/hooks/useAssinatura";
import { useOnboardingConfig } from "@/hooks/useOnboardingConfig";
import { useFuncionarioPermissoes } from "@/hooks/useFuncionarioPermissoes";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  User, 
  Smartphone, 
  ClipboardList, 
  TrendingUp, 
  Check, 
  ArrowRight,
  Sparkles,
  Target,
  Rocket,
  Wrench,
  ShoppingCart,
  Cog,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";
import logoMec from "@/assets/logo-mec-novo.png";

interface OnboardingStep {
  id: number;
  title: string;
  description: string;
  icon: React.ReactNode;
  route: string;
  actionText: string;
  completed: boolean;
}

// Rotas onde o onboarding modal NÃO deve aparecer (públicas e do funil)
const ROTAS_PUBLICAS = [
  '/',
  '/auth',
  '/reset-password',
  '/obrigado',
  '/completar-cadastro',
  '/cadastro-plano',
  '/onboarding-inicial',
  '/c/',
];

// Rotas internas do app (onde o modal também não deve aparecer para evitar loop e sobreposição)
const ROTAS_ONBOARDING = [
  '/clientes',
  '/dispositivos',
  '/os',
  '/ordens-servico',
  '/financeiro',
  '/dashboard',
  '/servicos',
  '/produtos',
];

export function OnboardingModal() {
  const navigate = useNavigate();
  const location = useLocation();
  const { progress, loading, getCurrentStep, getProgressPercentage, setTipoNegocio, getTotalSteps, skipOnboarding } = useOnboarding();
  const { assinatura, carregando: carregandoAssinatura } = useAssinatura();
  const { config: onboardingConfig } = useOnboardingConfig();
  const { isFuncionario, carregando: carregandoFuncionario } = useFuncionarioPermissoes();
  const [showAhaMessage, setShowAhaMessage] = useState(false);
  const [selectingTipo, setSelectingTipo] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [showInitialChoice, setShowInitialChoice] = useState(true);

  // Mostrar mensagem do Aha Moment quando atingir (DEVE estar antes dos returns condicionais)
  useEffect(() => {
    if (progress.ahaMomentReached && !progress.onboardingCompleted) {
      setShowAhaMessage(true);
      const timer = setTimeout(() => setShowAhaMessage(false), 10000);
      return () => clearTimeout(timer);
    }
  }, [progress.ahaMomentReached, progress.onboardingCompleted]);

  // Verificar se está em rota pública/funil
  const isPublicRoute = ROTAS_PUBLICAS.some(
    (rota) => location.pathname === rota || location.pathname.startsWith('/c/')
  );
  
  // Verificar se é admin
  const isAdmin = assinatura?.plano_tipo === 'admin';
  
  // Verificar se é cliente TRIAL (novos usuários)
  const isTrial = assinatura?.plano_tipo === 'trial';
  
  // Verificar se é cliente PAGANTE ATIVO (qualquer plano pago com status active)
  const isPagante = assinatura?.status === 'active' && !isTrial;
  
  // Verificar se está em uma rota de onboarding
  const isOnboardingRoute = ROTAS_ONBOARDING.some(rota => location.pathname.startsWith(rota));
  
  // Verificar se QUALQUER step foi completado (significa que não é usuário novo)
  const jaUsouSistema = 
    progress.stepClienteCadastrado ||
    progress.stepDispositivoCadastrado ||
    progress.stepOsCriada ||
    progress.stepPecaCadastrada ||
    progress.stepLucroVisualizado ||
    progress.onboardingCompleted;

  // LÓGICA CORRIGIDA:
  // - NUNCA mostrar para funcionários (eles usam o sistema do dono)
  // - Mostrar para clientes TRIAL que NÃO completaram o onboarding
  // - NÃO mostrar para clientes pagantes ativos
  // - NÃO mostrar para quem já usou o sistema (completou qualquer step)
  // - NÃO mostrar em rotas de onboarding (evita loop)
  // - NÃO mostrar se pulou ou dispensou
  const shouldShowOnboarding = 
    !isFuncionario &&  // FUNCIONÁRIOS NUNCA veem onboarding
    !carregandoFuncionario &&
    !isPublicRoute &&
    !loading && 
    !carregandoAssinatura &&
    assinatura &&
    !isAdmin &&
    isTrial &&
    !isPagante &&
    !jaUsouSistema &&  // Não mostra se já usou o sistema
    !isOnboardingRoute &&
    !progress.onboardingCompleted &&  // Só mostra se não completou o onboarding
    !progress.onboardingSkipped &&    // Não mostra se pulou
    !progress.onboardingDismissed;    // Não mostra se dispensou

  // Se não deve mostrar, retorna null
  if (!shouldShowOnboarding) return null;

  // Handler para pular o onboarding
  const handlePularOnboarding = async () => {
    setSkipping(true);
    await skipOnboarding();
    const destino = onboardingConfig?.textos_personalizados?.destino_ao_pular || '/dashboard';
    navigate(destino);
  };

  // Se não selecionou tipo de negócio ainda E está na escolha inicial, mostrar tela de escolha
  if (!progress.tipoNegocio && showInitialChoice) {
    return (
      <div className="fixed inset-0 z-[100] bg-background flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-card border-b px-4 py-4 sm:p-6 flex-shrink-0">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center justify-center gap-3">
              <img src={logoMec} alt="MEC App" className="h-10 sm:h-12 flex-shrink-0" />
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto px-4 py-6 sm:p-8">
          <div className="max-w-lg mx-auto">
            {/* Intro */}
            <div className="text-center mb-8">
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
                Bem-vindo ao MEC App!
              </h1>
              <p className="text-muted-foreground">
                Como você gostaria de começar?
              </p>
            </div>

            {/* Options */}
            <div className="space-y-4">
              {/* Opção 1: Primeiros Passos */}
              <button
                onClick={() => setShowInitialChoice(false)}
                disabled={skipping}
                className={cn(
                  "w-full border-2 rounded-xl p-6 text-left transition-all duration-300 hover:border-primary hover:shadow-lg hover:shadow-primary/10",
                  "bg-card hover:bg-primary/5",
                  skipping && "opacity-50 cursor-not-allowed"
                )}
              >
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-primary/20 rounded-lg flex-shrink-0">
                    <Rocket className="h-7 w-7 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-lg text-foreground">
                        Primeiros Passos
                      </h3>
                      <Badge className="bg-primary text-primary-foreground">
                        Recomendado
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Te guiaremos passo a passo para configurar seu sistema
                    </p>
                  </div>
                </div>
              </button>

              {/* Opção 2: Pular */}
              <button
                onClick={handlePularOnboarding}
                disabled={skipping}
                className={cn(
                  "w-full border-2 rounded-xl p-5 text-left transition-all duration-300 hover:border-muted-foreground/50",
                  "bg-muted/30 hover:bg-muted/50",
                  skipping && "opacity-50 cursor-not-allowed"
                )}
              >
                <div className="flex items-center gap-4">
                  {skipping ? (
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-muted-foreground" />
                  ) : (
                    <ArrowRight className="h-6 w-6 text-muted-foreground" />
                  )}
                  <div>
                    <h3 className="font-medium text-foreground">Já sei como usar</h3>
                    <p className="text-sm text-muted-foreground">
                      Ir direto para o sistema
                    </p>
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Se não selecionou tipo de negócio, mostrar tela de seleção
  if (!progress.tipoNegocio) {
    return (
      <div className="fixed inset-0 z-[100] bg-background flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-card border-b px-4 py-4 sm:p-6 flex-shrink-0">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img src={logoMec} alt="MEC App" className="h-8 sm:h-10 flex-shrink-0" />
                <div className="min-w-0">
                  <h1 className="text-lg sm:text-xl font-bold text-foreground truncate">Bem-vindo ao MEC App!</h1>
                  <p className="text-xs sm:text-sm text-muted-foreground truncate">Vamos personalizar sua experiência</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handlePularOnboarding}
                disabled={skipping}
                className="text-muted-foreground hover:text-foreground"
              >
                Pular
                <X className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto px-4 py-6 sm:p-8">
          <div className="max-w-2xl mx-auto">
            {/* Intro */}
            <div className="text-center mb-8">
              <div className="mx-auto w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mb-4">
                <Target className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-2">
                Qual é o seu foco principal?
              </h2>
              <p className="text-sm sm:text-base text-muted-foreground">
                Selecione a opção que melhor descreve seu negócio para personalizarmos o sistema para você.
              </p>
            </div>

            {/* Options */}
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Assistência Técnica */}
              <button
                onClick={async () => {
                  setSelectingTipo(true);
                  await setTipoNegocio('assistencia');
                  navigate('/clientes');
                }}
                disabled={selectingTipo}
                className={cn(
                  "relative border-2 rounded-xl p-6 text-left transition-all duration-300 hover:border-primary hover:shadow-lg hover:shadow-primary/10",
                  "bg-card hover:bg-primary/5",
                  selectingTipo && "opacity-50 cursor-not-allowed"
                )}
              >
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-orange-500/20 rounded-lg flex-shrink-0">
                    <Wrench className="h-6 w-6 text-orange-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg text-foreground mb-1">
                      Assistência Técnica
                    </h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      Consertos, manutenção e reparos de dispositivos eletrônicos.
                    </p>
                    <ul className="space-y-1 text-xs text-muted-foreground">
                      <li className="flex items-center gap-2">
                        <Check className="h-3 w-3 text-primary" />
                        Ordens de Serviço
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="h-3 w-3 text-primary" />
                        Controle de Peças
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="h-3 w-3 text-primary" />
                        Gestão de Clientes
                      </li>
                    </ul>
                  </div>
                </div>
                {selectingTipo && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded-xl">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                  </div>
                )}
              </button>

              {/* Venda de Dispositivos */}
              <button
                onClick={async () => {
                  setSelectingTipo(true);
                  await setTipoNegocio('vendas');
                  navigate('/clientes');
                }}
                disabled={selectingTipo}
                className={cn(
                  "relative border-2 rounded-xl p-6 text-left transition-all duration-300 hover:border-primary hover:shadow-lg hover:shadow-primary/10",
                  "bg-card hover:bg-primary/5",
                  selectingTipo && "opacity-50 cursor-not-allowed"
                )}
              >
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-blue-500/20 rounded-lg flex-shrink-0">
                    <ShoppingCart className="h-6 w-6 text-blue-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg text-foreground mb-1">
                      Venda de Dispositivos
                    </h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      Compra e venda de celulares, tablets e eletrônicos.
                    </p>
                    <ul className="space-y-1 text-xs text-muted-foreground">
                      <li className="flex items-center gap-2">
                        <Check className="h-3 w-3 text-primary" />
                        Estoque de Dispositivos
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="h-3 w-3 text-primary" />
                        Controle de Vendas
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="h-3 w-3 text-primary" />
                        Gestão de Clientes
                      </li>
                    </ul>
                  </div>
                </div>
                {selectingTipo && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded-xl">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                  </div>
                )}
              </button>
            </div>

            {/* Info */}
            <p className="text-center text-xs text-muted-foreground mt-6">
              <Cog className="inline h-3 w-3 mr-1" />
              Você pode alterar isso depois nas configurações
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Definir passos baseado no tipo de negócio
  const getSteps = (): OnboardingStep[] => {
    if (progress.tipoNegocio === 'assistencia') {
      return [
        {
          id: 1,
          title: "Cadastre seu primeiro cliente",
          description: "Organize todos os seus clientes em um só lugar. Nunca mais perca contato!",
          icon: <User className="h-6 w-6" />,
          route: "/clientes",
          actionText: "Cadastrar Cliente",
          completed: progress.stepClienteCadastrado
        },
        {
          id: 2,
          title: "Cadastre sua primeira peça",
          description: "Registre as peças que você usa nos consertos. Controle total do estoque!",
          icon: <Cog className="h-6 w-6" />,
          route: "/produtos",
          actionText: "Cadastrar Peça",
          completed: progress.stepPecaCadastrada
        },
        {
          id: 3,
          title: "Crie sua primeira Ordem de Serviço",
          description: "O coração do sistema! Organize cada serviço do início ao fim.",
          icon: <ClipboardList className="h-6 w-6" />,
          route: "/os",
          actionText: "Criar OS",
          completed: progress.stepOsCriada
        },
        {
          id: 4,
          title: "Veja o lucro do serviço",
          description: "Acompanhe quanto você está ganhando em cada serviço.",
          icon: <TrendingUp className="h-6 w-6" />,
          route: "/financeiro",
          actionText: "Ver Financeiro",
          completed: progress.stepLucroVisualizado
        }
      ];
    } else {
      // Vendas
      return [
        {
          id: 1,
          title: "Cadastre seu primeiro cliente",
          description: "Organize todos os seus clientes em um só lugar. Nunca mais perca contato!",
          icon: <User className="h-6 w-6" />,
          route: "/clientes",
          actionText: "Cadastrar Cliente",
          completed: progress.stepClienteCadastrado
        },
        {
          id: 2,
          title: "Cadastre o primeiro aparelho",
          description: "Registre os dispositivos que você vende. Estoque sempre organizado!",
          icon: <Smartphone className="h-6 w-6" />,
          route: "/dispositivos",
          actionText: "Cadastrar Aparelho",
          completed: progress.stepDispositivoCadastrado
        },
        {
          id: 3,
          title: "Veja o lucro das vendas",
          description: "Acompanhe quanto você está ganhando em cada venda.",
          icon: <TrendingUp className="h-6 w-6" />,
          route: "/financeiro",
          actionText: "Ver Financeiro",
          completed: progress.stepLucroVisualizado
        }
      ];
    }
  };

  const steps = getSteps();
  const currentStep = getCurrentStep();
  const progressPercent = getProgressPercentage();
  const totalSteps = getTotalSteps();

  const handleStepClick = (step: OnboardingStep) => {
    if (step.id <= currentStep || step.completed) {
      navigate(step.route);
    }
  };

  // Aha Moment Message
  if (showAhaMessage) {
    return (
      <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-gradient-to-br from-primary/20 via-background to-primary/10 border-2 border-primary rounded-2xl p-8 max-w-lg text-center animate-in zoom-in-95 duration-500">
          <div className="mx-auto w-20 h-20 bg-primary/20 rounded-full flex items-center justify-center mb-6">
            <Sparkles className="h-10 w-10 text-primary animate-pulse" />
          </div>
          
          <h2 className="text-2xl font-bold text-foreground mb-4">
            🎉 Parabéns! Você atingiu o momento chave!
          </h2>
          
          <p className="text-lg text-muted-foreground mb-6">
            {progress.tipoNegocio === 'assistencia' 
              ? 'Você acabou de organizar sua assistência técnica.'
              : 'Você acabou de organizar seu controle de vendas.'
            }
            <span className="text-primary font-semibold"> É assim que o sistema evita prejuízo e perda de controle.</span>
          </p>
          
          <div className="flex flex-col gap-3">
            <Button 
              size="lg" 
              className="w-full"
              onClick={() => setShowAhaMessage(false)}
            >
              <Rocket className="mr-2 h-5 w-5" />
              Continuar Explorando
            </Button>
            <Button 
              variant="outline" 
              size="lg" 
              className="w-full"
              onClick={() => {
                setShowAhaMessage(false);
                navigate('/plano');
              }}
            >
              Ver Planos Disponíveis
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] bg-background flex flex-col overflow-hidden">
      {/* Header - Mobile Optimized */}
      <div className="bg-card border-b px-4 py-4 sm:p-6 flex-shrink-0">
        <div className="max-w-3xl mx-auto">
          {/* Mobile: Stack logo and title vertically */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <img src={logoMec} alt="MEC App" className="h-8 sm:h-10 flex-shrink-0" />
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl font-bold text-foreground truncate">Bem-vindo ao MEC App!</h1>
                <p className="text-xs sm:text-sm text-muted-foreground truncate">
                  {progress.tipoNegocio === 'assistencia' 
                    ? 'Vamos configurar sua assistência técnica'
                    : 'Vamos configurar seu controle de vendas'
                  }
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 self-end sm:self-auto flex-shrink-0">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                <span className="text-xs sm:text-sm font-medium whitespace-nowrap">{Math.round(progressPercent)}% completo</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handlePularOnboarding}
                disabled={skipping}
                className="text-muted-foreground hover:text-foreground"
              >
                Pular
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-card/50 px-4 py-3 sm:px-6 sm:py-4 flex-shrink-0">
        <div className="max-w-3xl mx-auto">
          <Progress value={progressPercent} className="h-1.5 sm:h-2" />
        </div>
      </div>

      {/* Content - Scrollable */}
      <div className="flex-1 overflow-auto px-4 py-4 sm:p-6">
        <div className="max-w-3xl mx-auto">
          {/* Intro Message - Mobile Optimized */}
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 sm:p-6 mb-6 sm:mb-8">
            <div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-4">
              <div className="p-2 sm:p-3 bg-primary/10 rounded-lg flex-shrink-0">
                <Rocket className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
              </div>
              <div className="min-w-0">
                <h2 className="font-semibold text-base sm:text-lg text-foreground mb-1 sm:mb-2">
                  Em {totalSteps} passos simples, tudo estará organizado
                </h2>
                <p className="text-sm text-muted-foreground">
                  Complete os passos abaixo para descobrir como o MEC App pode transformar 
                  {progress.tipoNegocio === 'assistencia' 
                    ? ' o controle da sua assistência técnica'
                    : ' o controle das suas vendas'
                  }. <strong>Chega de bagunça e prejuízo!</strong>
                </p>
              </div>
            </div>
          </div>

          {/* Steps - Mobile Optimized */}
          <div className="space-y-3 sm:space-y-4">
            {steps.map((step, index) => {
              const isActive = step.id === currentStep;
              const isLocked = step.id > currentStep && !step.completed;
              const isCompleted = step.completed;

              return (
                <div
                  key={step.id}
                  className={cn(
                    "relative border rounded-xl p-4 sm:p-6 transition-all duration-300",
                    isCompleted && "bg-primary/5 border-primary/30",
                    isActive && "bg-card border-primary shadow-lg shadow-primary/10",
                    isLocked && "bg-muted/30 border-muted opacity-60"
                  )}
                >
                  {/* Connector line - Hidden on mobile */}
                  {index < steps.length - 1 && (
                    <div 
                      className={cn(
                        "absolute left-8 sm:left-10 top-full w-0.5 h-3 sm:h-4 -translate-x-1/2 z-10 hidden sm:block",
                        isCompleted ? "bg-primary" : "bg-muted"
                      )}
                    />
                  )}

                  {/* Mobile: Vertical layout */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                    {/* Step Icon & Badge Row */}
                    <div className="flex items-center gap-3 sm:block">
                      <div className={cn(
                        "flex-shrink-0 w-10 h-10 sm:w-14 sm:h-14 rounded-full flex items-center justify-center",
                        isCompleted && "bg-primary text-primary-foreground",
                        isActive && "bg-primary/20 text-primary",
                        isLocked && "bg-muted text-muted-foreground"
                      )}>
                        {isCompleted ? <Check className="h-5 w-5 sm:h-7 sm:w-7" /> : React.cloneElement(step.icon as React.ReactElement, { className: "h-5 w-5 sm:h-6 sm:w-6" })}
                      </div>
                      
                      {/* Badge - Only visible on mobile inline */}
                      <div className="flex items-center gap-2 sm:hidden">
                        <span className={cn(
                          "text-xs font-medium px-2 py-0.5 rounded-full",
                          isCompleted && "bg-primary/20 text-primary",
                          isActive && "bg-primary text-primary-foreground",
                          isLocked && "bg-muted text-muted-foreground"
                        )}>
                          Passo {step.id}
                        </span>
                        {isCompleted && (
                          <span className="text-xs text-primary font-medium">✓ Concluído</span>
                        )}
                      </div>
                    </div>

                    {/* Step Content */}
                    <div className="flex-1 min-w-0">
                      {/* Badge - Desktop only */}
                      <div className="hidden sm:flex items-center gap-2 mb-1">
                        <span className={cn(
                          "text-xs font-medium px-2 py-0.5 rounded-full",
                          isCompleted && "bg-primary/20 text-primary",
                          isActive && "bg-primary text-primary-foreground",
                          isLocked && "bg-muted text-muted-foreground"
                        )}>
                          Passo {step.id}
                        </span>
                        {isCompleted && (
                          <span className="text-xs text-primary font-medium">✓ Concluído</span>
                        )}
                      </div>
                      <h3 className={cn(
                        "font-semibold text-base sm:text-lg mb-1",
                        isLocked ? "text-muted-foreground" : "text-foreground"
                      )}>
                        {step.title}
                      </h3>
                      <p className={cn(
                        "text-xs sm:text-sm",
                        isLocked ? "text-muted-foreground/70" : "text-muted-foreground"
                      )}>
                        {step.description}
                      </p>
                    </div>

                    {/* Action Button - Full width on mobile */}
                    {!isLocked && (
                      <Button
                        onClick={() => handleStepClick(step)}
                        variant={isCompleted ? "outline" : "default"}
                        size="default"
                        className={cn(
                          "w-full sm:w-auto flex-shrink-0 mt-2 sm:mt-0",
                          isActive && "animate-pulse"
                        )}
                      >
                        {isCompleted ? "Ver" : step.actionText}
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom Message */}
          <div className="mt-6 sm:mt-8 text-center pb-4">
            <p className="text-xs sm:text-sm text-muted-foreground">
              Complete até o <strong>Passo {totalSteps - 1}</strong> para desbloquear o acesso completo ao sistema.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
