import { Suspense, lazy, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePrimeirosPassos } from "@/hooks/usePrimeirosPassos";
import { OPCOES_TIPO_NEGOCIO } from "@/lib/primeirosPassos";
import { OnboardingChecklist } from "./OnboardingChecklist";

const DialogOrdemServico = lazy(() =>
  import("@/components/ordens/DialogOrdemServico").then((m) => ({ default: m.DialogOrdemServico })),
);
const DialogOrdemServicoSimplificada = lazy(() =>
  import("@/components/ordens/DialogOrdemServicoSimplificada").then((m) => ({
    default: m.DialogOrdemServicoSimplificada,
  })),
);

const ICONES: Record<string, LucideIcon> = {
  Wrench,
  Package,
  Smartphone,
  LayoutGrid,
  ClipboardList,
  ShoppingCart,
  DollarSign,
};

/** Estado do fluxo da 1ª OS disparado pelo checklist. */
type OsDialogState = null | "escolha" | "completa" | "simplificada";

// Itens do checklist que, em vez de só navegar, levam a um walkthrough guiado
// na tela de destino (ver OnboardingWalkthroughHost + walkthroughs.ts).
const ROTA_WALKTHROUGH: Record<string, string> = {
  cadastrar_produto: "/produtos?walkthrough=produto",
  venda_pdv: "/pdv?walkthrough=venda",
  fazer_venda: "/pdv?walkthrough=venda",
};

/**
 * Card "Primeiros Passos" — topo do Dashboard. Não bloqueia nada:
 * fechável a qualquer momento, some sozinho quando o checklist termina, e
 * reabre por um botão discreto. Ver [usePrimeirosPassos].
 *
 * As ações do checklist usam as telas/dialogs REAIS do sistema:
 * - "Crie sua primeira OS" abre o dialog real (Completa ou Simplificada), aqui
 *   mesmo sobre o Dashboard, com a OS fora da cota do plano.
 * - "Cadastre seu primeiro produto" / "Faça sua primeira venda" navegam para a
 *   tela real e disparam um walkthrough curto mostrando onde clicar.
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
    recarregarProgresso,
  } = usePrimeirosPassos();

  const navigate = useNavigate();
  const [osDialog, setOsDialog] = useState<OsDialogState>(null);

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
          const rotaWalkthrough = ROTA_WALKTHROUGH[item.id];
          return {
            id: item.id,
            title: item.label,
            route: item.rota,
            completed: item.concluido,
            icon: <Icone className="h-4 w-4" />,
            // Itens concluídos: sem onClick → navega normal para ver o que já foi
            // feito. Pendentes: "criar_os" abre o dialog real aqui mesmo; os
            // demais vão para a tela real com o walkthrough guiado.
            onClick: item.concluido
              ? undefined
              : item.id === "criar_os"
                ? () => setOsDialog("escolha")
                : rotaWalkthrough
                  ? () => navigate(rotaWalkthrough)
                  : undefined,
          };
        })}
      />

      {/* Escolha do tipo de OS — espelha o dropdown "Nova OS" da tela de OS. */}
      <Dialog open={osDialog === "escolha"} onOpenChange={(v) => !v && setOsDialog(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Como você quer criar sua primeira OS?</DialogTitle>
            <DialogDescription>
              É uma OS de verdade — só não conta no limite do seu plano.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Button
              variant="outline"
              className="h-auto flex-col items-start gap-0.5 py-3 text-left"
              onClick={() => setOsDialog("completa")}
            >
              <span className="font-semibold">Completa</span>
              <span className="text-xs font-normal text-muted-foreground">
                Passo a passo com cliente, dispositivo, checklist e serviços.
              </span>
            </Button>
            <Button
              variant="outline"
              className="h-auto flex-col items-start gap-0.5 py-3 text-left"
              onClick={() => setOsDialog("simplificada")}
            >
              <span className="font-semibold">Simplificada</span>
              <span className="text-xs font-normal text-muted-foreground">
                Uma tela só, o essencial pra registrar rápido.
              </span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Suspense fallback={null}>
        {osDialog === "completa" && (
          <DialogOrdemServico
            open
            ordem={null}
            primeiraOsOnboarding
            onOpenChange={(v) => !v && setOsDialog(null)}
            onSuccess={() => {
              setOsDialog(null);
              void recarregarProgresso();
            }}
          />
        )}
        {osDialog === "simplificada" && (
          <DialogOrdemServicoSimplificada
            open
            primeiraOsOnboarding
            onOpenChange={(v) => !v && setOsDialog(null)}
            onSuccess={() => {
              setOsDialog(null);
              void recarregarProgresso();
            }}
          />
        )}
      </Suspense>
    </div>
  );
}
