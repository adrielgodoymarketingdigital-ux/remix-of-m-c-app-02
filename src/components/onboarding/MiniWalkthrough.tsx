import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, SkipForward, X } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import type { WalkStep } from "./walkthroughs";

interface MiniWalkthroughProps {
  steps: WalkStep[];
  onFinish: () => void;
}

const SPOTLIGHT_PADDING = 8;

/**
 * Spotlight guiado curto (2–3 passos), no mesmo visual do TutorialOverlay do
 * tour global (véu escuro + anel pulsante + card de tooltip), mas:
 * - sem TutorialContext e sem navegação entre rotas (quem monta, o
 *   OnboardingWalkthroughHost, já garante a rota certa);
 * - o recorte é REALMENTE clicável — o véu é feito de 4 faixas ao redor do
 *   alvo, então o usuário pode clicar no botão destacado e seguir usando o
 *   sistema de verdade enquanto o tour acompanha.
 *
 * Alvos por `data-walkthrough="<target>"`. Um passo cujo alvo ainda não está no
 * DOM (ex.: dentro de um dialog que o usuário não abriu) mostra o tooltip
 * centralizado e continua procurando; assim que o elemento aparece, o foco
 * salta para ele.
 */
export function MiniWalkthrough({ steps, onFinish }: MiniWalkthroughProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const [visible, setVisible] = useState(false);
  const isMobile = useIsMobile();

  const total = steps.length;
  const currentStep = steps[stepIndex] ?? null;

  const finish = useCallback(() => {
    setVisible(false);
    onFinish();
  }, [onFinish]);

  const nextStep = useCallback(() => {
    setStepIndex((i) => {
      if (i < total - 1) return i + 1;
      finish();
      return i;
    });
  }, [total, finish]);

  const prevStep = useCallback(() => {
    setStepIndex((i) => (i > 0 ? i - 1 : i));
  }, []);

  // Posicionar o spotlight, com re-tentativas enquanto o alvo não existe e
  // acompanhamento contínuo (o alvo pode surgir ao abrir um dialog).
  useEffect(() => {
    if (!currentStep) {
      setVisible(false);
      return;
    }

    let cancelled = false;

    const measure = () => {
      if (cancelled) return;
      const el = document.querySelector(
        `[data-walkthrough="${currentStep.target}"]`,
      ) as HTMLElement | null;

      if (!el || el.offsetParent === null) {
        // Ainda não visível: tooltip centralizado, segue procurando.
        setRect(null);
        setTooltipStyle({
          maxWidth: 340,
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
        });
        setVisible(true);
        return;
      }

      const r = el.getBoundingClientRect();
      setRect(r);

      const padding = 16;
      const tooltipWidth = isMobile ? Math.min(340, window.innerWidth - padding * 2) : 340;
      const tooltipEstimatedHeight = 220;
      const pos = currentStep.position || "bottom";
      const style: React.CSSProperties = { maxWidth: tooltipWidth };

      switch (pos) {
        case "bottom":
          style.top = r.bottom + padding;
          style.left = Math.max(
            padding,
            Math.min(r.left + r.width / 2 - tooltipWidth / 2, window.innerWidth - tooltipWidth - padding),
          );
          break;
        case "top":
          style.bottom = window.innerHeight - r.top + padding;
          style.left = Math.max(
            padding,
            Math.min(r.left + r.width / 2 - tooltipWidth / 2, window.innerWidth - tooltipWidth - padding),
          );
          break;
        case "right":
          style.top = Math.max(padding, r.top + r.height / 2 - 80);
          style.left = r.right + padding;
          if ((style.left as number) + tooltipWidth > window.innerWidth) {
            style.left = Math.max(padding, r.left);
            style.top = r.bottom + padding;
          }
          break;
        case "left":
          style.top = Math.max(padding, r.top + r.height / 2 - 80);
          style.right = window.innerWidth - r.left + padding;
          break;
      }

      if (typeof style.top === "number") {
        const maxTop = window.innerHeight - tooltipEstimatedHeight - padding;
        if (style.top > maxTop) style.top = Math.max(padding, r.top - tooltipEstimatedHeight - padding);
        if (style.top < padding) style.top = padding;
      }

      setTooltipStyle(style);
      setVisible(true);
    };

    const first = setTimeout(measure, 150);
    const poll = setInterval(measure, 400);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      cancelled = true;
      clearTimeout(first);
      clearInterval(poll);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [currentStep, stepIndex, isMobile]);

  // Atalhos de teclado.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
      if (e.key === "ArrowRight") nextStep();
      if (e.key === "ArrowLeft") prevStep();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [finish, nextStep, prevStep]);

  // Nada até a 1ª medição (evita flash do véu preto sem tooltip).
  if (!currentStep || !visible) return null;

  // Faixas do véu ao redor do alvo (deixam o recorte clicável).
  const veil = "fixed bg-black/60";
  const bands = rect
    ? [
        { top: 0, left: 0, width: "100%", height: Math.max(0, rect.top - SPOTLIGHT_PADDING) },
        {
          top: Math.max(0, rect.bottom + SPOTLIGHT_PADDING),
          left: 0,
          width: "100%",
          height: `calc(100% - ${Math.max(0, rect.bottom + SPOTLIGHT_PADDING)}px)`,
        },
        {
          top: Math.max(0, rect.top - SPOTLIGHT_PADDING),
          left: 0,
          width: Math.max(0, rect.left - SPOTLIGHT_PADDING),
          height: rect.height + SPOTLIGHT_PADDING * 2,
        },
        {
          top: Math.max(0, rect.top - SPOTLIGHT_PADDING),
          left: rect.right + SPOTLIGHT_PADDING,
          width: `calc(100% - ${rect.right + SPOTLIGHT_PADDING}px)`,
          height: rect.height + SPOTLIGHT_PADDING * 2,
        },
      ]
    : [];

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-none">
      {rect ? (
        bands.map((b, i) => (
          <div key={i} className={`${veil} pointer-events-auto`} style={b} onClick={finish} />
        ))
      ) : (
        <div className="fixed inset-0 bg-black/60 pointer-events-auto" onClick={finish} />
      )}

      {rect && visible && (
        <div
          className="fixed border-2 border-blue-400 rounded-lg pointer-events-none animate-pulse"
          style={{
            top: rect.top - SPOTLIGHT_PADDING,
            left: rect.left - SPOTLIGHT_PADDING,
            width: rect.width + SPOTLIGHT_PADDING * 2,
            height: rect.height + SPOTLIGHT_PADDING * 2,
            boxShadow: "0 0 20px rgba(59,130,246,0.4), 0 0 40px rgba(59,130,246,0.2)",
          }}
        />
      )}

      {visible && (
        <div
          className="fixed bg-white rounded-xl shadow-2xl border border-slate-200 p-5 z-[10000] pointer-events-auto animate-in fade-in slide-in-from-bottom-2 duration-300"
          style={tooltipStyle}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={finish}
            className="absolute top-2 right-2 p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
              {stepIndex + 1} de {total}
            </span>
          </div>

          <h3 className="text-base font-bold text-slate-900 mb-1.5">{currentStep.title}</h3>
          <p className="text-sm text-slate-600 leading-relaxed mb-4">{currentStep.description}</p>

          <div className="w-full h-1 bg-slate-100 rounded-full mb-4 overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-500"
              style={{ width: `${((stepIndex + 1) / total) * 100}%` }}
            />
          </div>

          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={finish}
              className="text-slate-400 hover:text-slate-600 text-xs h-8 px-2"
            >
              <SkipForward className="h-3.5 w-3.5 mr-1" />
              Pular
            </Button>

            <div className="flex items-center gap-2">
              {stepIndex > 0 && (
                <Button variant="outline" size="sm" onClick={prevStep} className="h-8 px-3 text-xs">
                  <ChevronLeft className="h-3.5 w-3.5 mr-1" />
                  Anterior
                </Button>
              )}
              <Button
                size="sm"
                onClick={nextStep}
                className="h-8 px-4 text-xs bg-blue-600 hover:bg-blue-700 text-white"
              >
                {stepIndex === total - 1 ? (
                  "Concluir 🎉"
                ) : (
                  <>
                    Próximo
                    <ChevronRight className="h-3.5 w-3.5 ml-1" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
