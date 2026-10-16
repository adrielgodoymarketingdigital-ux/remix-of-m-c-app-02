import { Conta } from "@/types/conta";
import { TrendingUp, TrendingDown, AlertTriangle, DollarSign, ChevronRight, type LucideIcon } from "lucide-react";
import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatters";
import { TextoAjustado } from "@/components/vendas/TextoAjustado";
import { useFuncionarioPermissoes } from "@/hooks/useFuncionarioPermissoes";
import { ValorMonetario } from "@/components/ui/valor-monetario";

interface DashboardContasProps {
  contas: Conta[];
}

export function DashboardContas({ contas }: DashboardContasProps) {
  const { isFuncionario } = useFuncionarioPermissoes();

  if (isFuncionario) return null;
  const totalAPagar = contas
    .filter((c) => c.tipo === "pagar" && c.status === "pendente")
    .reduce((acc, c) => acc + Number(c.valor), 0);

  const totalAReceber = contas
    .filter((c) => c.tipo === "receber" && c.status === "pendente")
    .reduce((acc, c) => acc + Number(c.valor), 0);

  const totalPago = contas
    .filter((c) => c.tipo === "pagar" && c.status === "pago")
    .reduce((acc, c) => acc + Number(c.valor), 0);

  const totalRecebido = contas
    .filter((c) => c.tipo === "receber" && c.status === "recebido")
    .reduce((acc, c) => acc + Number(c.valor), 0);

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0); // Zerar horas para comparar apenas data
  
  const contasVencidasList = contas.filter((c) => {
    const dataVencimento = new Date(c.data + "T00:00:00");
    return dataVencimento < hoje && c.status === "pendente";
  });
  
  const contasVencidas = contasVencidasList.length;
  const valorVencidas = contasVencidasList.reduce((acc, c) => acc + Number(c.valor), 0);

  const saldo = totalAReceber - totalAPagar;

  return (
    <div className="grid grid-cols-1 gap-[13px] md:grid-cols-2">
      <CardIndicador
        cor="vermelho"
        rotulo="Total a Pagar"
        Icone={TrendingDown}
        caracteres={formatCurrency(totalAPagar).length}
        valor={<ValorMonetario valor={totalAPagar} />}
      />
      <CardIndicador
        cor="verde"
        rotulo="Total a Receber"
        Icone={TrendingUp}
        caracteres={formatCurrency(totalAReceber).length}
        valor={<ValorMonetario valor={totalAReceber} />}
      />
      <CardIndicador
        // Saldo: azul quando positivo (referência) e vermelho quando negativo (como antes)
        cor={saldo >= 0 ? "azul" : "vermelho"}
        icone="azul"
        rotulo="Saldo Previsto"
        Icone={DollarSign}
        caracteres={formatCurrency(saldo).length}
        valor={<ValorMonetario valor={saldo} />}
      />
      <CardIndicador
        cor="laranja"
        decoracao="barras"
        rotulo="Contas Vencidas"
        Icone={AlertTriangle}
        caracteres={String(contasVencidas).length}
        valor={contasVencidas}
        complemento={valorVencidas > 0 && (
          <>Total: <ValorMonetario valor={valorVencidas} /></>
        )}
      />
    </div>
  );
}

type CorIndicador = "vermelho" | "verde" | "azul" | "laranja";

// Cores da referência no claro; no escuro, tons do Tailwind sobre o card do tema.
const CORES: Record<CorIndicador, { icone: string; valor: string; grafico: string }> = {
  vermelho: { icone: "bg-[#FFE8E8] text-[#F02828] dark:bg-red-500/15 dark:text-red-400", valor: "text-[#F02828] dark:text-red-400", grafico: "#F26B6B" },
  verde: { icone: "bg-[#E1FAEB] text-[#08A653] dark:bg-green-500/15 dark:text-green-400", valor: "text-[#08A653] dark:text-green-400", grafico: "#1DB868" },
  azul: { icone: "bg-[#E3EEFF] text-[#246BFF] dark:bg-blue-500/15 dark:text-blue-400", valor: "text-[#246BFF] dark:text-blue-400", grafico: "#3D7EFF" },
  laranja: { icone: "bg-[#FFF0E1] text-[#FF6B00] dark:bg-orange-500/15 dark:text-orange-400", valor: "text-[#FF6B00] dark:text-orange-400", grafico: "#FF8A39" },
};

interface CardIndicadorProps {
  cor: CorIndicador;
  /** Cor do ícone, quando diferente da cor do valor (Saldo negativo). */
  icone?: CorIndicador;
  decoracao?: "curva" | "barras";
  rotulo: string;
  Icone: LucideIcon;
  valor: ReactNode;
  /** Caracteres do valor exibido, para a fonte caber sem cortar dígitos. */
  caracteres: number;
  complemento?: ReactNode;
}

// Card não clicável (como antes): a seta e o gráfico são só decoração.
function CardIndicador({ cor, icone, decoracao = "curva", rotulo, Icone, valor, caracteres, complemento }: CardIndicadorProps) {
  const c = CORES[cor];
  const corIcone = CORES[icone ?? cor].icone;
  const idGradiente = useId().replace(/:/g, "");
  return (
    <article
      aria-label={rotulo}
      className="relative flex min-h-[105px] items-center gap-2.5 overflow-hidden rounded-[17px] border border-[#EDF0F5] bg-card px-[15px] py-[17px] shadow-[0_5px_18px_rgba(16,24,40,0.055)] min-[381px]:gap-3.5 dark:border-border dark:shadow-none"
    >
      {/* Gráfico decorativo: atrás do texto, opacidade baixa, não representa dados */}
      {decoracao === "curva" ? (
        <svg aria-hidden="true" viewBox="0 0 90 40" preserveAspectRatio="none" className="pointer-events-none absolute bottom-[15px] right-[30px] z-0 h-10 w-[65px] opacity-25 min-[381px]:w-[90px] min-[381px]:opacity-50">
          <defs>
            <linearGradient id={idGradiente} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={c.grafico} stopOpacity="0.35" />
              <stop offset="1" stopColor={c.grafico} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d="M0 36 C10 32 18 22 30 25 S46 37 56 29 S70 8 79 8 S87 13 90 16 V40 H0 Z" fill={`url(#${idGradiente})`} />
          <path d="M0 36 C10 32 18 22 30 25 S46 37 56 29 S70 8 79 8 S87 13 90 16" fill="none" stroke={c.grafico} strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
        </svg>
      ) : (
        <div aria-hidden="true" className="pointer-events-none absolute bottom-[19px] right-9 z-0 flex h-[45px] items-end gap-[5px] opacity-25 min-[381px]:opacity-40">
          {[17, 12, 25, 33, 23, 37, 45].map((altura, i) => (
            <span key={i} className="w-2.5 rounded-[3px_3px_0_0] bg-[linear-gradient(#FF8A39,#FFE0C6)] dark:bg-[linear-gradient(#FB923C,rgba(251,146,60,0.15))]" style={{ height: altura }} />
          ))}
        </div>
      )}

      <div className={cn("relative z-10 flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-2xl min-[381px]:h-[59px] min-[381px]:w-[59px]", corIcone)}>
        <Icone className="h-[29px] w-[29px]" aria-hidden="true" />
      </div>
      <div className="relative z-10 min-w-0 flex-1">
        <p className="mb-[7px] text-[13px] text-muted-foreground">{rotulo}</p>
        <div className={cn("font-extrabold leading-tight tracking-[-0.7px]", c.valor)}>
          <TextoAjustado caracteres={caracteres} min={15} max={28} classeReserva="text-[21px] min-[381px]:text-2xl" classeContainer="pr-[44px] min-[381px]:pr-[58px]">
            {valor}
          </TextoAjustado>
        </div>
        {complemento && <p className="mt-[7px] text-xs text-[#FF6B00] dark:text-orange-400">{complemento}</p>}
      </div>
      <ChevronRight className="relative z-10 h-[18px] w-[18px] shrink-0 text-[#0B1429] dark:text-foreground" aria-hidden="true" />
    </article>
  );
}
