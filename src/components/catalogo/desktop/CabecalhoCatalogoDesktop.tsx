// Cabeçalho da tela Catálogo no computador (>= 1024px): ícone, título, subtítulo, os passos
// (Itens → Aparência → Compartilhar, e Landing Page só com o módulo) e, à direita dos passos,
// o Salvar único (recebido pronto em `acoes`). Fica dentro do <Tabs> da casca (CatalogoDesktop).
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { BookOpen, Globe, ListChecks, Palette, Share2 } from "lucide-react";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export type PassoCatalogo = "itens" | "aparencia" | "compartilhar" | "landingpage";

interface CabecalhoCatalogoDesktopProps {
  temLandingPage: boolean;
  acoes: ReactNode;
}

interface Passo {
  valor: PassoCatalogo;
  rotulo: string;
  Icone: LucideIcon;
  /** Número do passo (Landing Page fica sem número: é um extra, não um passo do fluxo). */
  numero?: number;
}

export function CabecalhoCatalogoDesktop({ temLandingPage, acoes }: CabecalhoCatalogoDesktopProps) {
  const { t } = useTranslation("catalogo", { keyPrefix: "telaDesktop" });

  const passos: Passo[] = [
    { valor: "itens", rotulo: t("passos.itens"), Icone: ListChecks, numero: 1 },
    { valor: "aparencia", rotulo: t("passos.aparencia"), Icone: Palette, numero: 2 },
    { valor: "compartilhar", rotulo: t("passos.compartilhar"), Icone: Share2, numero: 3 },
    ...(temLandingPage ? [{ valor: "landingpage" as const, rotulo: t("passos.landingPage"), Icone: Globe }] : []),
  ];

  return (
    <div className="space-y-5">
      {/* pt-6: o olho flutuante do layout (fixed top-4 right-4) não fica por cima do título. */}
      <div className="flex min-w-0 items-center gap-4 pt-6">
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-blue-200 bg-blue-50 text-blue-600 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-400">
          <BookOpen className="h-7 w-7" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h1 className="text-[28px] font-bold leading-9 tracking-tight">{t("titulo")}</h1>
          <p className="text-sm leading-5 text-muted-foreground">{t("subtitulo")}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <TabsList
          aria-label={t("passosRotulo")}
          className="h-auto gap-1 rounded-xl border border-border/60 bg-muted/70 p-1 dark:bg-muted/40"
        >
          {passos.map(({ valor, rotulo, Icone, numero }) => (
            <TabsTrigger
              key={valor}
              value={valor}
              className={cn(
                "group h-10 gap-2 rounded-lg px-4 text-sm font-semibold text-muted-foreground",
                "hover:text-foreground",
                // Passo ativo com o mesmo degradê do botão padrão do app (btn-primary-gradient).
                "data-[state=active]:[background:linear-gradient(to_right,var(--custom-primary-from),var(--custom-primary-via),var(--custom-primary-to))]",
                "data-[state=active]:text-white data-[state=active]:shadow-md",
              )}
            >
              {numero ? (
                <span
                  className={cn(
                    "grid h-5 w-5 place-items-center rounded-full bg-background text-[11px] font-bold text-muted-foreground ring-1 ring-border",
                    "group-data-[state=active]:bg-white/20 group-data-[state=active]:text-white group-data-[state=active]:ring-white/40",
                  )}
                  aria-hidden="true"
                >
                  {numero}
                </span>
              ) : (
                <Icone className="h-4 w-4" aria-hidden="true" />
              )}
              {rotulo}
            </TabsTrigger>
          ))}
        </TabsList>
        {acoes}
      </div>
    </div>
  );
}
