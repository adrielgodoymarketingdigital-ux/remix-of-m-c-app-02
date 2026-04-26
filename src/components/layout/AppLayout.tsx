import { ReactNode } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { MobileHeader } from "@/components/layout/MobileHeader";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { useCoresPersonalizadas } from "@/hooks/useCoresPersonalizadas";
import { TutorialProvider } from "@/components/tutorial/TutorialContext";
import { TutorialOverlay } from "@/components/tutorial/TutorialOverlay";
import { CardLimitesFree } from "@/components/planos/CardLimitesFree";
import { TrialBanner } from "@/components/trial/TrialBanner";
import { FreeTrialTimer } from "@/components/trial/FreeTrialTimer";
import { BannerVencimentoPlano } from "@/components/layout/BannerVencimentoPlano";
import { useAssinatura } from "@/hooks/useAssinatura";
import { useFuncionarioPermissoes } from "@/hooks/useFuncionarioPermissoes";
import { OcultarValoresProvider } from "@/contexts/OcultarValoresContext";
import { BotaoOcultarValores } from "@/components/layout/BotaoOcultarValores";
import { useUserPresence } from "@/hooks/useUserPresence";

interface AppLayoutProps {
  children: ReactNode;
}

/**
 * Layout principal do app.
 * NOTA: A verificação de fluxo trial agora é feita no ProtectedAppRoute,
 * não mais aqui, para evitar duplicação e loops de verificação.
 */
export function AppLayout({ children }: AppLayoutProps) {
  useCoresPersonalizadas();
  const { assinatura } = useAssinatura();
  const { isFuncionario } = useFuncionarioPermissoes();
  useUserPresence((assinatura as any)?.user_id ?? null);

  const freeTrialEndsAt = (assinatura as any)?.free_trial_ends_at;
  const trialJaCancelado = (assinatura as any)?.trial_canceled === true;
  const showFreeTrialTimer = !isFuncionario && assinatura?.plano_tipo === 'free' && freeTrialEndsAt && !trialJaCancelado;

  return (
    <OcultarValoresProvider>
      <TutorialProvider>
        <SidebarProvider>
          <div className="flex min-h-screen w-full overflow-x-hidden bg-background flex-col">
            <div className="flex flex-1 min-h-0 overflow-x-hidden">
              <AppSidebar />
              <div className="flex min-w-0 flex-1 flex-col min-h-screen overflow-x-hidden">
                <MobileHeader />
                <BannerVencimentoPlano />
                <div className="flex min-w-0 flex-1 flex-col overflow-x-hidden pb-16 lg:pb-0">
                  <div className="px-4 sm:px-6 pt-3">
                    <TrialBanner />
                    {showFreeTrialTimer && (
                      <FreeTrialTimer freeTrialEndsAt={(assinatura as any).free_trial_ends_at} />
                    )}
                  </div>
                  <CardLimitesFree />
                  {children}
                </div>
              </div>
            </div>
            {/* Navegação inferior apenas em mobile */}
            <MobileBottomNav />
            {/* Botão flutuante ocultar valores */}
            <BotaoOcultarValores />
            {/* Tutorial system */}
            <TutorialOverlay />
          </div>
        </SidebarProvider>
      </TutorialProvider>
    </OcultarValoresProvider>
  );
}
