import {
  Wrench,
  Package,
  Smartphone,
  LayoutGrid,
  ClipboardList,
  ShoppingCart,
  DollarSign,
  Sparkles,
  X,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePrimeirosPassos } from "@/hooks/usePrimeirosPassos";
import { OPCOES_TIPO_NEGOCIO } from "@/lib/primeirosPassos";
import { OnboardingChecklist } from "./OnboardingChecklist";

const ICONES: Record<string, LucideIcon> = {
  Wrench,
  Package,
  Smartphone,
  LayoutGrid,
  ClipboardList,
  ShoppingCart,
  DollarSign,
};

/**
 * Card "Primeiros Passos" — topo do Dashboard. Não bloqueia nada:
 * fechável a qualquer momento, some sozinho quando o checklist termina, e
 * reabre por um botão discreto. Ver [usePrimeirosPassos].
 */
export function CardPrimeirosPassos() {
  const {
    cardVisivel,
    reabrirVisivel,
    tipoNegocio,
    itens,
    progressoPct,
    escolherTipo,
    dispensar,
    reabrir,
  } = usePrimeirosPassos();

  // Estado 3: dispensado, mas ainda há o que fazer → só o gatilho discreto.
  if (!cardVisivel) {
    if (!reabrirVisivel) return null;
    return (
      <div className="mb-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => void reabrir()}
          className="gap-2 text-muted-foreground"
        >
          <Sparkles className="h-4 w-4" />
          Primeiros passos
        </Button>
      </div>
    );
  }

  // Estado 1: ainda não escolheu o perfil → pergunta com 4 botões.
  if (!tipoNegocio) {
    return (
      <div className="mb-6 rounded-xl border bg-card p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-semibold text-foreground">O que melhor descreve seu negócio?</h3>
            <p className="text-sm text-muted-foreground">
              Pra te mostrar só o que importa pra começar. Você pode fechar isso quando quiser.
            </p>
          </div>
          <button
            onClick={() => void dispensar()}
            aria-label="Fechar"
            className="text-muted-foreground hover:text-foreground mt-0.5"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {OPCOES_TIPO_NEGOCIO.map((op) => {
            const Icone = ICONES[op.icone];
            return (
              <button
                key={op.slug}
                onClick={() => void escolherTipo(op.slug)}
                className="flex items-center gap-3 rounded-lg border-2 border-border p-3 text-left transition-all hover:border-primary hover:bg-primary/5"
              >
                <div className="rounded-lg bg-primary/10 p-2">
                  <Icone className="h-5 w-5 text-primary" />
                </div>
                <span className="text-sm font-medium">{op.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // Estado 2: perfil escolhido → checklist curto.
  return (
    <div className="mb-6">
      <OnboardingChecklist
        titulo="Primeiros passos"
        subtitulo="Marque tudo pra tirar o máximo do sistema"
        percent={progressoPct}
        onClose={() => void dispensar()}
        items={itens.map((item) => {
          const Icone = ICONES[item.icone];
          return {
            id: item.id,
            title: item.label,
            route: item.rota,
            completed: item.concluido,
            icon: <Icone className="h-4 w-4" />,
          };
        })}
      />
    </div>
  );
}
