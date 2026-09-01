import { useEffect } from "react";
import { useTutorial } from "./TutorialContext";
import { usePrimeirosPassos } from "@/hooks/usePrimeirosPassos";

/**
 * Auto-starts tutorial for first-time users after onboarding.
 * Shows once, on dashboard mount, if tutorial hasn't been completed.
 *
 * Adiado enquanto o card "Primeiros Passos" estiver pendente (pergunta de
 * perfil ou checklist em aberto): não faz sentido o tour de menu competir
 * com o card no primeiro acesso. Quando o usuário conclui ou dispensa o
 * card, este efeito re-roda e agenda o tutorial.
 */
export function TutorialAutoStart() {
  const { hasCompletedTutorial, startTutorial, isActive } = useTutorial();
  const { cardVisivel, loading } = usePrimeirosPassos();

  useEffect(() => {
    if (hasCompletedTutorial || isActive || loading || cardVisivel) return;

    // Small delay to let the dashboard render first
    const timeout = setTimeout(() => {
      startTutorial();
    }, 1500);
    return () => clearTimeout(timeout);
  }, [hasCompletedTutorial, isActive, loading, cardVisivel, startTutorial]);

  return null;
}
