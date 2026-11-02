import type { ComponentType } from "react";
import { ChartNoAxesColumn, Coins } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SeloVariacao } from "@/components/dashboard/desktop/SeloVariacao";
import { Skeleton } from "@/components/ui/skeleton";
import { ValorMonetario } from "@/components/ui/valor-monetario";
import { cn } from "@/lib/utils";

const ESTILOS = {
  azul: {
    card: "border-blue-200 bg-blue-50 dark:border-blue-500/25 dark:bg-blue-500/10",
    icone: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
    barra: "bg-blue-400 dark:bg-blue-400/80",
  },
  verde: {
    card: "border-emerald-200 bg-emerald-50 dark:border-emerald-500/25 dark:bg-emerald-500/10",
    icone: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
    barra: "bg-emerald-400 dark:bg-emerald-400/80",
  },
  vermelho: {
    card: "border-red-200 bg-red-50 dark:border-red-500/25 dark:bg-red-500/10",
    icone: "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300",
    barra: "bg-red-400 dark:bg-red-400/80",
  },
};

/** Barrinhas da série de 7 dias: altura pelo valor absoluto, vermelho nos dias de prejuízo. */
function BarrasSerie({ dados, classeBarra }: { dados: number[]; classeBarra: string }) {
  const maior = Math.max(0, ...dados.map(Math.abs));
  return (
    <div aria-hidden className="hidden h-[70px] shrink-0 items-end gap-1.5 min-[1200px]:flex">
      {dados.map((valor, i) => (
        <span
          key={i}
          className={cn("w-3 rounded-t", valor < 0 ? ESTILOS.vermelho.barra : classeBarra)}
          style={{ height: `${maior > 0 ? Math.max((Math.abs(valor) / maior) * 100, 6) : 6}%` }}
        />
      ))}
    </div>
  );
}

interface CardHojeProps {
  estilo: keyof typeof ESTILOS;
  icone: ComponentType<{ className?: string }>;
  rotulo: string;
  valor: number;
  variacao: number;
  serie: number[];
  carregando: boolean;
}

function CardHoje({ estilo, icone: Icone, rotulo, valor, variacao, serie, carregando }: CardHojeProps) {
  const { t } = useTranslation("dashboard");
  const cores = ESTILOS[estilo];
  return (
    <div className={cn("flex min-h-[128px] items-center justify-between gap-4 rounded-2xl border p-5", cores.card)}>
      <div className="flex min-w-0 items-center gap-4">
        <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-xl", cores.icone)}>
          <Icone className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <p className="text-sm text-foreground">{rotulo}</p>
          <div className="my-1 whitespace-nowrap text-2xl font-extrabold tracking-tight text-foreground">
            {carregando ? <Skeleton className="h-7 w-32" /> : <ValorMonetario valor={valor} />}
          </div>
          <div className="flex items-center gap-2">
            <SeloVariacao valor={variacao} variante="suave" className="px-2 py-0.5" />
            <span className="text-xs text-muted-foreground">{t("resumo.vsOntemCurto")}</span>
          </div>
        </div>
      </div>
      <BarrasSerie dados={serie} classeBarra={cores.barra} />
    </div>
  );
}

interface CardsHojeDesktopProps {
  carregando: boolean;
  faturamento: number;
  lucro: number;
  variacaoFaturamento: number;
  variacaoLucro: number;
  serieFaturamento: number[];
  serieLucro: number[];
}

export function CardsHojeDesktop(props: CardsHojeDesktopProps) {
  const { t } = useTranslation("dashboard");
  return (
    <section className="mt-4 grid grid-cols-2 gap-4">
      <CardHoje
        estilo="azul"
        icone={ChartNoAxesColumn}
        rotulo={t("resumo.faturamentoHoje")}
        valor={props.faturamento}
        variacao={props.variacaoFaturamento}
        serie={props.serieFaturamento}
        carregando={props.carregando}
      />
      <CardHoje
        estilo={props.lucro < 0 ? "vermelho" : "verde"}
        icone={Coins}
        rotulo={t("resumo.lucroHoje")}
        valor={props.lucro}
        variacao={props.variacaoLucro}
        serie={props.serieLucro}
        carregando={props.carregando}
      />
    </section>
  );
}
