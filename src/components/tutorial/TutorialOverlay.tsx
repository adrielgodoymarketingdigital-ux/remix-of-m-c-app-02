import { useEffect, useState, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTutorial } from "./TutorialContext";
import { Button } from "@/components/ui/button";
import { X, ChevronLeft, ChevronRight, SkipForward } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

export function TutorialOverlay() {
  const {
    isActive,
    currentStep,
    currentStepIndex,
    totalSteps,
    nextStep,
    prevStep,
    skipTutorial,
  } = useTutorial();

  const navigate = useNavigate();
  const location = useLocation();
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const [visible, setVisible] = useState(false);
  const isMobile = useIsMobile();

  const findTarget = useCallback(() => {
    if (!currentStep) return null;
    return document.querySelector(`[data-tutorial="${currentStep.target}"]`) as HTMLElement | null;
  }, [currentStep]);

  // Navigate to route if needed
  useEffect(() => {
    if (!isActive || !currentStep?.route) return;
    if (location.pathname !== currentStep.route) {
      navigate(currentStep.route);
    }
  }, [isActive, currentStep, location.pathname, navigate]);

  // Position the spotlight
  useEffect(() => {
    if (!isActive || !currentStep) {
      setVisible(false);
      return;
    }

    // On mobile, open the menu drawer if targeting sidebar items
    const isSidebarTarget = currentStep.target.startsWith("sidebar-");
    if (isMobile && isSidebarTarget) {
      window.dispatchEvent(new Event("tutorial-open-mobile-menu"));
    }

    let attempts = 0;
    let retryTimer: ReturnType<typeof setTimeout>;

    const update = () => {
      const el = findTarget();
      if (!el) {
        attempts++;
        if (attempts < 10) {
          retryTimer = setTimeout(update, 300);
          return;
        }
        // Fallback: show tooltip centered without spotlight
        setRect(null);
        const tooltipWidth = 340;
        setTooltipStyle({
          maxWidth: tooltipWidth,
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        });
        setVisible(true);
        return;
      }

      // Scroll target into view if needed
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });

      // Wait a tick for scroll to settle, then measure
      requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        setRect(r);

        // Calculate tooltip position
        const padding = 16;
        const tooltipWidth = isMobile ? Math.min(340, window.innerWidth - padding * 2) : 340;
        const tooltipEstimatedHeight = 220;
        const pos = currentStep.position || "bottom";
        let style: React.CSSProperties = { maxWidth: tooltipWidth };

        switch (pos) {
          case "bottom":
            style.top = r.bottom + padding;
            style.left = Math.max(padding, Math.min(r.left + r.width / 2 - tooltipWidth / 2, window.innerWidth - tooltipWidth - padding));
            break;
          case "top":
            style.bottom = window.innerHeight - r.top + padding;
            style.left = Math.max(padding, Math.min(r.left + r.width / 2 - tooltipWidth / 2, window.innerWidth - tooltipWidth - padding));
            break;
          case "right":
            style.top = Math.max(padding, r.top + r.height / 2 - 80);
            style.left = r.right + padding;
            if (style.left as number + tooltipWidth > window.innerWidth) {
              style.left = Math.max(padding, r.left);
              style.top = r.bottom + padding;
            }
            break;
          case "left":
            style.top = Math.max(padding, r.top + r.height / 2 - 80);
            style.right = window.innerWidth - r.left + padding;
            break;
        }

        // Ensure tooltip doesn't go below the viewport
        if (style.top && typeof style.top === 'number') {
          const maxTop = window.innerHeight - tooltipEstimatedHeight - padding;
          if (style.top > maxTop) {
            // Place above the element instead
            style.top = Math.max(padding, r.top - tooltipEstimatedHeight - padding);
          }
        }

        // Ensure tooltip doesn't go above viewport
        if (style.top && typeof style.top === 'number' && style.top < padding) {
          style.top = padding;
        }

        setTooltipStyle(style);
        setVisible(true);
      });
    };

    // Delay slightly to let route changes render
    const timeout = setTimeout(update, 300);
    return () => {
      clearTimeout(timeout);
      clearTimeout(retryTimer);
    };
  }, [isActive, currentStep, currentStepIndex, findTarget, location.pathname]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!isActive) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") skipTutorial();
      if (e.key === "ArrowRight" || e.key === "Enter") nextStep();
      if (e.key === "ArrowLeft") prevStep();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isActive, skipTutorial, nextStep, prevStep]);

  if (!isActive || !currentStep) return null;

  const spotlightPadding = 8;

  return (
    <div className="fixed inset-0 z-[9999]" data-tutorial-active="true" onClick={(e) => { e.stopPropagation(); skipTutorial(); }} onTouchEnd={(e) => e.stopPropagation()}>
      {/* Overlay with spotlight cutout using CSS clip-path */}
      <svg className="fixed inset-0 w-full h-full" style={{ pointerEvents: "none" }}>
        <defs>
          <mask id="tutorial-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {rect && (
              <rect
                x={rect.left - spotlightPadding}
                y={rect.top - spotlightPadding}
                width={rect.width + spotlightPadding * 2}
                height={rect.height + spotlightPadding * 2}
                rx="8"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.65)"
          mask="url(#tutorial-mask)"
          style={{ pointerEvents: "auto" }}
        />
      </svg>

      {/* Spotlight ring */}
      {rect && visible && (
        <div
          className="fixed border-2 border-blue-400 rounded-lg pointer-events-none animate-pulse"
          style={{
            top: rect.top - spotlightPadding,
            left: rect.left - spotlightPadding,
            width: rect.width + spotlightPadding * 2,
            height: rect.height + spotlightPadding * 2,
            boxShadow: "0 0 20px rgba(59,130,246,0.4), 0 0 40px rgba(59,130,246,0.2)",
          }}
        />
      )}

      {/* Tooltip card */}
      {visible && (
        <div
          className="fixed bg-white rounded-xl shadow-2xl border border-slate-200 p-5 z-[10000] animate-in fade-in slide-in-from-bottom-2 duration-300"
          style={tooltipStyle}
          onClick={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
        >
          {/* Close button */}
          <button
            onClick={skipTutorial}
            className="absolute top-2 right-2 p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Step counter */}
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
              {currentStepIndex + 1} de {totalSteps}
            </span>
          </div>

          {/* Content */}
          <h3 className="text-base font-bold text-slate-900 mb-1.5">
            {currentStep.title}
          </h3>
          <p className="text-sm text-slate-600 leading-relaxed mb-4">
            {currentStep.description}
          </p>

          {/* Progress bar */}
          <div className="w-full h-1 bg-slate-100 rounded-full mb-4 overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-500"
              style={{ width: `${((currentStepIndex + 1) / totalSteps) * 100}%` }}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={skipTutorial}
              className="text-slate-400 hover:text-slate-600 text-xs h-8 px-2"
            >
              <SkipForward className="h-3.5 w-3.5 mr-1" />
              Pular
            </Button>

            <div className="flex items-center gap-2">
              {currentStepIndex > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={prevStep}
                  className="h-8 px-3 text-xs"
                >
                  <ChevronLeft className="h-3.5 w-3.5 mr-1" />
                  Anterior
                </Button>
              )}
              <Button
                size="sm"
                onClick={nextStep}
                className="h-8 px-4 text-xs bg-blue-600 hover:bg-blue-700 text-white"
              >
                {currentStepIndex === totalSteps - 1 ? (
                  "Finalizar 🎉"
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
