import type { ComponentType } from "react";
import { AlertTriangle, ChevronRight, ClipboardList, CreditCard, Package, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Skeleton } from "@/components/ui/skeleton";
import type { DashboardResumo } from "@/hooks/useDashboardResumo";
import { cn } from "@/lib/utils";

interface Kpi {
  icone: ComponentType<{ className?: string }>;
  cor: string;
  valor: number;
  rotulo: string;
  detalhe?: string;
  rota: string;
}

/** Abaixo de 1080px, 3 + 2 (grade de 6); até 1400px, os 5 compactos; depois, completos. */
export function KpisDesktop({ resumo }: { resumo: DashboardResumo }) {
  const { t } = useTranslation("dashboard");
  const navigate = useNavigate();

  const kpis: Kpi[] = [
    { icone: ClipboardList, cor: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300", valor: resumo.osAbertas, rotulo: t("atalhos.ordens"), detalhe: t("atalhos.abertas"), rota: "/os" },
    { icone: Users, cor: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300", valor: resumo.totalClientes, rotulo: t("atalhos.clientes"), rota: "/clientes" },
    { icone: Package, cor: "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300", valor: resumo.totalProdutos, rotulo: t("atalhos.produtos"), rota: "/produtos" },
    { icone: CreditCard, cor: "bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300", valor: resumo.pagamentosPendentes, rotulo: t("atalhos.pagamentos"), detalhe: t("atalhos.pendentes"), rota: "/vendas" },
    { icone: AlertTriangle, cor: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300", valor: resumo.alertasUrgentes, rotulo: t("atalhos.alertas"), detalhe: t("atalhos.urgentes"), rota: "/os?status=atrasadas" },
  ];

  return (
    <section className="mb-6 mt-4 grid grid-cols-6 gap-3 min-[1080px]:grid-cols-5 min-[1400px]:gap-4">
      {kpis.map(({ icone: Icone, cor, valor, rotulo, detalhe, rota }, i) => (
        <button
          key={rota}
          type="button"
          onClick={() => navigate(rota)}
          className={cn(
            "flex min-w-0 items-center gap-2.5 rounded-2xl border border-border bg-card p-3 text-left shadow-sm transition-colors hover:bg-accent min-[1080px]:col-span-1 min-[1400px]:gap-3 min-[1400px]:px-4 min-[1400px]:py-5",
            i < 3 ? "col-span-2" : "col-span-3"
          )}
        >
          <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl min-[1400px]:h-11 min-[1400px]:w-11", cor)}>
            <Icone className="h-[18px] w-[18px] min-[1400px]:h-[22px] min-[1400px]:w-[22px]" />
          </div>
          <div className="min-w-0">
            {resumo.carregando
              ? <Skeleton className="mb-1 h-6 w-10" />
              : <p className="text-xl font-extrabold leading-tight text-foreground min-[1400px]:text-[23px]">{valor}</p>}
            <p className="text-xs font-medium leading-tight text-foreground min-[1400px]:text-sm">{rotulo}</p>
            {detalhe && <p className="text-[11px] leading-tight text-muted-foreground">{detalhe}</p>}
          </div>
          <ChevronRight className="ml-auto hidden h-4 w-4 shrink-0 text-muted-foreground min-[1400px]:block" />
        </button>
      ))}
    </section>
  );
}
