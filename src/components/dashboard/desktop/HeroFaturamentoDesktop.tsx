import type { ComponentType, ReactNode } from "react";
import { Info, Package, Smartphone, TrendingDown, TrendingUp, Wrench } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Sparkline } from "@/components/dashboard/Sparkline";
import { SeloVariacao } from "@/components/dashboard/desktop/SeloVariacao";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ValorMonetario } from "@/components/ui/valor-monetario";
import { cn } from "@/lib/utils";

interface HeroFaturamentoDesktopProps {
  /** Fundo já resolvido: gradiente do design ou a cor personalizada da loja. */
  fundo: string;
  carregando: boolean;
  carregandoComparacao: boolean;
  mesEmAndamento: boolean;
  total: number;
  variacaoTotal: number;
  serieDoMes: number[];
  assistencia: number;
  produtos: number;
  dispositivos: number;
  lucroLiquido: number;
  variacaoLucro: number;
}

const PlaceholderValor = ({ className }: { className: string }) => (
  <Skeleton className={cn("bg-white/20", className)} />
);

function ItemBreakdown({ icone: Icone, rotulo, children }: { icone: ComponentType<{ className?: string }>; rotulo: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-white/15 bg-black/20 px-4 py-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15">
        <Icone className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="mb-0.5 text-xs text-white/90">{rotulo}</p>
        <div className="whitespace-nowrap text-base font-bold">{children}</div>
      </div>
    </div>
  );
}

export function HeroFaturamentoDesktop(props: HeroFaturamentoDesktopProps) {
  const { t } = useTranslation("dashboard");
  const { fundo, carregando, carregandoComparacao, total, serieDoMes, lucroLiquido } = props;
  const lucroNegativo = lucroLiquido < 0;
  const IconeLucro = lucroNegativo ? TrendingDown : TrendingUp;

  return (
    <section className="rounded-3xl px-5 py-4 text-white shadow-lg shadow-blue-950/20" style={{ background: fundo }}>
      <div className="flex items-center justify-between gap-6 pb-3">
        <div className="shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold leading-6">{t("resumo.faturamentoTotal")}</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" aria-label={t(props.mesEmAndamento ? "resumo.comparacaoAndamento" : "resumo.comparacaoFechado")} className="text-white/80 hover:text-white">
                  <Info className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>{t(props.mesEmAndamento ? "resumo.comparacaoAndamento" : "resumo.comparacaoFechado")}</TooltipContent>
            </Tooltip>
          </div>
          <div className="my-1 text-[40px] font-extrabold leading-[44px] tracking-tight min-[1280px]:text-[44px]">
            {carregando ? <PlaceholderValor className="h-11 w-72" /> : <ValorMonetario valor={total} />}
          </div>
          <div className="flex h-6 items-center gap-2.5">
            {carregando || carregandoComparacao
              ? <PlaceholderValor className="h-6 w-40" />
              : (
                <>
                  <SeloVariacao valor={props.variacaoTotal} variante="solido" />
                  <span className="text-sm text-white/90">{t("resumo.vsMesAnteriorCurto")}</span>
                </>
              )}
          </div>
        </div>
        <div className="relative h-[100px] min-w-0 flex-1 bg-[repeating-linear-gradient(90deg,rgba(255,255,255,0.07)_0_1px,transparent_1px_64px)]">
          {!carregando && serieDoMes.length >= 2 && (
            <Sparkline dados={serieDoMes} cor="#22d3ee" altura={100} destacarUltimoPonto />
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 min-[1300px]:grid-cols-[1fr_1fr_1fr_1.25fr]">
        <ItemBreakdown icone={Wrench} rotulo={t("resumo.assistencia")}>
          {carregando ? <PlaceholderValor className="h-5 w-24" /> : <ValorMonetario valor={props.assistencia} />}
        </ItemBreakdown>
        <ItemBreakdown icone={Package} rotulo={t("resumo.produtos")}>
          {carregando ? <PlaceholderValor className="h-5 w-24" /> : <ValorMonetario valor={props.produtos} />}
        </ItemBreakdown>
        <ItemBreakdown icone={Smartphone} rotulo={t("resumo.dispositivos")}>
          {carregando ? <PlaceholderValor className="h-5 w-24" /> : <ValorMonetario valor={props.dispositivos} />}
        </ItemBreakdown>
        <div className={cn(
          "flex min-w-0 items-center gap-3 rounded-2xl border px-4 py-3",
          lucroNegativo ? "border-red-400 bg-[#3b0a14]" : "border-emerald-400 bg-[#002c3b]"
        )}>
          <IconeLucro className={cn("h-7 w-7 shrink-0", lucroNegativo ? "text-red-300" : "text-emerald-300")} />
          {/* flex-wrap: com valor grande, o selo desce em vez de estourar o card */}
          <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-2 gap-y-1">
            <div>
              <p className="mb-0.5 text-xs text-white/90">{t("resumo.lucroLiquido")}</p>
              <div className={cn("whitespace-nowrap text-base font-bold", lucroNegativo ? "text-red-200" : "text-emerald-200")}>
                {carregando ? <PlaceholderValor className="h-5 w-24" /> : <ValorMonetario valor={lucroLiquido} />}
              </div>
            </div>
            {!carregando && !carregandoComparacao && (
              <SeloVariacao valor={props.variacaoLucro} variante="solido" />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
