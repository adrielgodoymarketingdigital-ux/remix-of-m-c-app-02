import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, DollarSign, Info, ShoppingCart, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { ValorMonetario } from "@/components/ui/valor-monetario";
import { Sparkline } from "@/components/dashboard/Sparkline";
import { cn } from "@/lib/utils";

/**
 * Cartões de métricas da aba Desempenho (Equipe) no computador (>= 1024px).
 * Só apresentação: valores, variação e séries chegam prontos do DashboardEquipe,
 * que continua dono das consultas e dos cálculos. O celular não usa este arquivo.
 */

interface CartoesDesempenhoDesktopProps {
  totalVendido: number;
  totalComissoes: number;
  funcionariosAtivos: number;
  mesLabel: string;
  mesAnteriorLabel: string;
  variacaoTotalVendido: number;
  variacaoTotalComissoes: number;
  sparklineTotalVendido: number[];
  sparklineTotalComissoes: number[];
}

// Valor grande ("R$ 1.234.567,89") encolhe pela largura do cartão em vez de cortar.
const CLASSE_VALOR =
  "block whitespace-nowrap font-bold tracking-tight tabular-nums text-[length:clamp(1.25rem,9.5cqi,1.75rem)] leading-tight";

function Variacao({ valor, mesAnteriorLabel }: { valor: number; mesAnteriorLabel: string }) {
  const subiu = valor >= 0;
  return (
    <span
      className={cn(
        "inline-flex min-w-0 items-center gap-1 text-xs font-semibold",
        subiu ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"
      )}
    >
      {subiu ? <ArrowUpRight className="h-3.5 w-3.5 shrink-0" /> : <ArrowDownRight className="h-3.5 w-3.5 shrink-0" />}
      <span className="whitespace-nowrap tabular-nums">{Math.abs(valor).toFixed(1)}%</span>
      <span className="truncate capitalize">vs {mesAnteriorLabel}</span>
    </span>
  );
}

function CartaoMetrica({
  icone,
  classeIcone,
  titulo,
  extraTitulo,
  variacao,
  rodape,
  grafico,
  children,
}: {
  icone: ReactNode;
  classeIcone: string;
  titulo: string;
  extraTitulo?: ReactNode;
  variacao?: ReactNode;
  rodape: ReactNode;
  grafico?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="flex min-w-0 flex-col overflow-hidden shadow-sm">
      <CardContent className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-center gap-3">
          <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", classeIcone)}>
            {icone}
          </span>
          <div className="flex min-w-0 items-center gap-1.5">
            <p className="truncate text-sm font-medium text-muted-foreground">{titulo}</p>
            {extraTitulo}
          </div>
        </div>
        <div className="min-w-0 [container-type:inline-size]">
          {children}
          {variacao && <div className="mt-1 flex min-w-0">{variacao}</div>}
        </div>
        <div className="mt-auto flex min-h-11 items-end justify-between gap-3">
          <div className="min-w-0 truncate text-xs text-muted-foreground">{rodape}</div>
          {grafico && <div className="w-24 shrink-0 xl:w-28">{grafico}</div>}
        </div>
      </CardContent>
    </Card>
  );
}

export function CartoesDesempenhoDesktop({
  totalVendido,
  totalComissoes,
  funcionariosAtivos,
  mesLabel,
  mesAnteriorLabel,
  variacaoTotalVendido,
  variacaoTotalComissoes,
  sparklineTotalVendido,
  sparklineTotalComissoes,
}: CartoesDesempenhoDesktopProps) {
  return (
    <div className="grid grid-cols-3 gap-4">
      <CartaoMetrica
        titulo="Total Vendido (Equipe)"
        icone={<ShoppingCart className="h-5 w-5" />}
        classeIcone="bg-blue-100 text-blue-600 dark:bg-blue-900/60 dark:text-blue-300"
        variacao={<Variacao valor={variacaoTotalVendido} mesAnteriorLabel={mesAnteriorLabel} />}
        rodape={<span className="capitalize">{mesLabel}</span>}
        grafico={
          sparklineTotalVendido.length > 0 ? (
            <Sparkline dados={sparklineTotalVendido} cor="#3b82f6" altura={44} destacarUltimoPonto />
          ) : undefined
        }
      >
        <ValorMonetario valor={totalVendido} className={CLASSE_VALOR} />
      </CartaoMetrica>

      <CartaoMetrica
        titulo="Comissões a Pagar"
        icone={<DollarSign className="h-5 w-5" />}
        classeIcone="bg-red-100 text-red-600 dark:bg-red-900/60 dark:text-red-300"
        extraTitulo={
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="shrink-0 rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                title="Como este valor é calculado"
                aria-label="Como este valor é calculado"
              >
                <Info className="h-3.5 w-3.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-80 text-xs leading-relaxed" align="start">
              Cada OS entra com a comissão calculada <strong>no momento em que foi salva</strong>
              {" "}(por tipo de serviço, item a item). Por isso o total de um mês anterior pode
              mudar se uma OS daquele período for <strong>entregue</strong> ou <strong>editada</strong>
              {" "}depois. O detalhamento por técnico está no botão <span className="font-medium">Perfil</span>.
            </PopoverContent>
          </Popover>
        }
        variacao={<Variacao valor={variacaoTotalComissoes} mesAnteriorLabel={mesAnteriorLabel} />}
        rodape={<span className="capitalize">{mesLabel}</span>}
        grafico={
          sparklineTotalComissoes.length > 0 ? (
            <Sparkline dados={sparklineTotalComissoes} cor="#ef4444" altura={44} destacarUltimoPonto />
          ) : undefined
        }
      >
        <ValorMonetario valor={totalComissoes} className={cn(CLASSE_VALOR, "text-destructive")} />
      </CartaoMetrica>

      <CartaoMetrica
        titulo="Funcionários Ativos"
        icone={<Users className="h-5 w-5" />}
        classeIcone="bg-green-100 text-green-600 dark:bg-green-900/60 dark:text-green-300"
        rodape="Com vendas/OS no mês"
      >
        <span className={CLASSE_VALOR}>{funcionariosAtivos}</span>
      </CartaoMetrica>
    </div>
  );
}

/** Esqueleto com o mesmo formato dos cartões (ícone, título, valor, rodapé). */
export function EsqueletoCartoesDesempenhoDesktop() {
  return (
    <div className="grid grid-cols-3 gap-4" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <Card key={i} className="shadow-sm">
          <CardContent className="flex flex-col gap-3 p-5">
            <div className="flex items-center gap-3">
              <Skeleton className="h-11 w-11 rounded-xl" />
              <Skeleton className="h-4 w-32" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-8 w-40" />
              {i < 2 && <Skeleton className="h-3 w-36" />}
            </div>
            <div className="flex min-h-11 items-end justify-between gap-3">
              <Skeleton className="h-3 w-24" />
              {i < 2 && <Skeleton className="h-11 w-24 xl:w-28" />}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
