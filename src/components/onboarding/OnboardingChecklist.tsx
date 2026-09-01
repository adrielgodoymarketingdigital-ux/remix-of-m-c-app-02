import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Progress } from "@/components/ui/progress";
import { Check, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface OnboardingChecklistItem {
  id: string;
  title: string;
  /** ícone já renderizado (ex: <ClipboardList className="h-4 w-4" />) */
  icon: ReactNode;
  route: string;
  completed: boolean;
  /** Se presente, roda no lugar de navegar para `route` (ex: abrir dialog). */
  onClick?: () => void;
}

interface OnboardingChecklistProps {
  items: OnboardingChecklistItem[];
  /** 0–100 */
  percent: number;
  titulo?: string;
  subtitulo?: string;
  onClose?: () => void;
  compact?: boolean;
}

/**
 * Checklist genérico, dispensável, com barra de progresso e itens
 * independentes (sem trava sequencial). Cada item navega para sua rota.
 * Usado pelo card "Primeiros Passos" do Dashboard.
 */
export function OnboardingChecklist({
  items,
  percent,
  titulo = "Primeiros passos",
  subtitulo,
  onClose,
  compact = false,
}: OnboardingChecklistProps) {
  const navigate = useNavigate();

  if (compact) {
    return (
      <div className="bg-card border rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium">{titulo}</span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{Math.round(percent)}%</span>
            {onClose && (
              <button
                onClick={onClose}
                aria-label="Fechar"
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
        <Progress value={percent} className="h-1.5 mb-3" />
        <div className="flex flex-col gap-1.5">
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => (item.onClick ? item.onClick() : navigate(item.route))}
              className={cn(
                "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-left transition-colors hover:bg-muted",
                item.completed && "text-primary",
              )}
            >
              <span className="flex-shrink-0">
                {item.completed ? <Check className="h-3.5 w-3.5" /> : item.icon}
              </span>
              <span className={cn("flex-1 truncate", item.completed && "line-through opacity-70")}>
                {item.title}
              </span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border rounded-xl p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-semibold text-foreground">{titulo}</h3>
          {subtitulo && <p className="text-sm text-muted-foreground">{subtitulo}</p>}
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-lg font-bold text-primary">{Math.round(percent)}%</span>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              aria-label="Fechar"
              className="text-muted-foreground hover:text-foreground mt-0.5"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <Progress value={percent} className="h-2 mb-4" />

      <div className="space-y-2">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => (item.onClick ? item.onClick() : navigate(item.route))}
            className={cn(
              "w-full flex items-center gap-3 p-3 rounded-lg transition-all text-left hover:bg-muted",
              item.completed && "bg-primary/5",
            )}
          >
            <div
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                item.completed
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {item.completed ? <Check className="h-4 w-4" /> : item.icon}
            </div>

            <span
              className={cn(
                "flex-1 text-sm font-medium",
                item.completed && "text-primary line-through opacity-70",
              )}
            >
              {item.title}
            </span>

            <ChevronRight
              className={cn(
                "h-4 w-4",
                item.completed ? "text-primary" : "text-muted-foreground",
              )}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
