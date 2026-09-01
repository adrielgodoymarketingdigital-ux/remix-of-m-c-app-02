import { useCallback } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { usePrimeirosPassos } from "@/hooks/usePrimeirosPassos";
import { MiniWalkthrough } from "./MiniWalkthrough";
import { WALKTHROUGHS, WalkthroughKey, isWalkthroughKey } from "./walkthroughs";

/**
 * Ponto único de montagem (no AppLayout) dos walkthroughs curtos do onboarding.
 * Só renderiza quando a URL tem `?walkthrough=<key>` E a rota atual bate com a
 * rota daquele walkthrough. Ao concluir/pular, limpa só esse parâmetro da URL
 * (replace) para não reabrir em refresh/voltar.
 *
 * O gate externo (params + pathname) é barato e roda em toda navegação; só
 * quando há um walkthrough pedido é que `WalkthroughRunner` monta e dispara as
 * queries de `usePrimeirosPassos`.
 */
export function OnboardingWalkthroughHost() {
  const [params] = useSearchParams();
  const { pathname } = useLocation();

  const key = params.get("walkthrough");
  if (!isWalkthroughKey(key)) return null;
  if (WALKTHROUGHS[key].pathname !== pathname) return null;

  return <WalkthroughRunner walkthroughKey={key} />;
}

function WalkthroughRunner({ walkthroughKey }: { walkthroughKey: WalkthroughKey }) {
  const [, setParams] = useSearchParams();
  const { elegivel } = usePrimeirosPassos();

  const limparParam = useCallback(() => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("walkthrough");
        return next;
      },
      { replace: true },
    );
  }, [setParams]);

  // Funcionário / veterano não são público-alvo do onboarding.
  if (!elegivel) return null;

  // Não empilhar com o tour global (mesmo guard do MobileMenuDrawer).
  if (typeof document !== "undefined" && document.querySelector("[data-tutorial-active]")) {
    return null;
  }

  return (
    <MiniWalkthrough
      key={walkthroughKey}
      steps={WALKTHROUGHS[walkthroughKey].steps}
      onFinish={limparParam}
    />
  );
}
