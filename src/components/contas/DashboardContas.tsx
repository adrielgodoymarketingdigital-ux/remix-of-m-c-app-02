import { Conta } from "@/types/conta";
import { TrendingUp, TrendingDown, AlertTriangle, DollarSign, ChevronRight, type LucideIcon } from "lucide-react";
import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatters";
import { TextoAjustado } from "@/components/vendas/TextoAjustado";
import { inicioDoDiaHoje, isContaVencida } from "@/lib/contas/contaVencida";
import { useFuncionarioPermissoes } from "@/hooks/useFuncionarioPermissoes";
import { ValorMonetario } from "@/components/ui/valor-monetario";

export type CardContas = "pagar" | "receber" | "saldo" | "vencidas";

interface DashboardContasProps {
  contas: Conta[];
  /** Card cujo filtro está aplicado na lista (destaque + aria-pressed). */
  cardAtivo?: CardContas | null;
  /** Toque no card: a página aplica (ou desfaz) o filtro correspondente. */
  onSelecionarCard?: (card: CardContas) => void;
}

export function DashboardContas({ contas, cardAtivo = null, onSelecionarCard }: DashboardContasProps) {
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

  // Mesma regra do filtro "Vencidas" da lista (lib/contas/contaVencida)
  const hoje = inicioDoDiaHoje();
  const contasVencidasList = contas.filter((c) => isContaVencida(c, hoje));
  
  const contasVencidas = contasVencidasList.length;
  const valorVencidas = contasVencidasList.reduce((acc, c) => acc + Number(c.valor), 0);

  const saldo = totalAReceber - totalAPagar;

  return (
    <div className="grid grid-cols-1 gap-[13px] md:grid-cols-2">
      <CardIndicador
        id="pagar"
        ativo={cardAtivo === "pagar"}
        onSelecionar={onSelecionarCard}
        acao="Filtrar contas a pagar pendentes"
        cor="vermelho"
        rotulo="Total a Pagar"
        Icone={TrendingDown}
        caracteres={formatCurrency(totalAPagar).length}
        valor={<ValorMonetario valor={totalAPagar} />}
      />
      <CardIndicador
        id="receber"
        ativo={cardAtivo === "receber"}
        onSelecionar={onSelecionarCard}
        acao="Filtrar contas a receber pendentes"
        cor="verde"
        rotulo="Total a Receber"
        Icone={TrendingUp}
        caracteres={formatCurrency(totalAReceber).length}
        valor={<ValorMonetario valor={totalAReceber} />}
      />
      <CardIndicador
        id="saldo"
        ativo={cardAtivo === "saldo"}
        onSelecionar={onSelecionarCard}
        acao="Filtrar todas as contas pendentes"
        // Saldo: azul quando positivo (referência) e vermelho quando negativo (como antes)
        cor={saldo >= 0 ? "azul" : "vermelho"}
        icone="azul"
        rotulo="Saldo Previsto"
        Icone={DollarSign}
        caracteres={formatCurrency(saldo).length}
        valor={<ValorMonetario valor={saldo} />}
      />
      <CardIndicador
        id="vencidas"
        ativo={cardAtivo === "vencidas"}
        onSelecionar={onSelecionarCard}
        acao="Filtrar contas vencidas"
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
  id: CardContas;
  ativo: boolean;
  onSelecionar?: (card: CardContas) => void;
  /** Texto do aria-label (o que o toque faz). */
  acao: string;
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

// Card = botão que filtra a lista; o gráfico é só decoração (não representa dados).
function CardIndicador({ id, ativo, onSelecionar, acao, cor, icone, decoracao = "curva", rotulo, Icone, valor, caracteres, complemento }: CardIndicadorProps) {
  const c = CORES[cor];
  const corIcone = CORES[icone ?? cor].icone;
  const idGradiente = useId().replace(/:/g, "");
  return (
    <button
      type="button"
      onClick={() => onSelecionar?.(id)}
      disabled={!onSelecionar}
      aria-pressed={ativo}
      aria-label={ativo ? `${acao} (ativo — toque para desfazer)` : acao}
      className={cn(
        "relative flex min-h-[105px] w-full items-center gap-2.5 overflow-hidden rounded-[17px] border bg-card px-[15px] py-[17px] text-left min-[381px]:gap-3.5",
        "shadow-[0_5px_18px_rgba(16,24,40,0.055)] transition-[transform,box-shadow,border-color] duration-150 dark:shadow-none",
        "hover:shadow-[0_8px_22px_rgba(16,24,40,0.09)] active:scale-[0.985] disabled:pointer-events-none",
        "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#246BFF]/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        ativo
          ? "border-[#246BFF] bg-[linear-gradient(135deg,hsl(var(--card)),rgba(36,107,255,0.06))] ring-2 ring-[#246BFF]/15 dark:border-blue-400"
          : "border-[#EDF0F5] dark:border-border",
      )}
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
        <span aria-hidden="true" className="pointer-events-none absolute bottom-[19px] right-9 z-0 flex h-[45px] items-end gap-[5px] opacity-25 min-[381px]:opacity-40">
          {[17, 12, 25, 33, 23, 37, 45].map((altura, i) => (
            <span key={i} className="w-2.5 rounded-[3px_3px_0_0] bg-[linear-gradient(#FF8A39,#FFE0C6)] dark:bg-[linear-gradient(#FB923C,rgba(251,146,60,0.15))]" style={{ height: altura }} />
          ))}
        </span>
      )}

      <span className={cn("relative z-10 flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-2xl min-[381px]:h-[59px] min-[381px]:w-[59px]", corIcone)}>
        <Icone className="h-[29px] w-[29px]" aria-hidden="true" />
      </span>
      <span className="relative z-10 block min-w-0 flex-1">
        <span className="mb-[7px] block text-[13px] text-muted-foreground">{rotulo}</span>
        <span className={cn("block font-extrabold leading-tight tracking-[-0.7px]", c.valor)}>
          <TextoAjustado caracteres={caracteres} min={15} max={28} classeReserva="text-[21px] min-[381px]:text-2xl" classeContainer="pr-[44px] min-[381px]:pr-[58px]">
            {valor}
          </TextoAjustado>
        </span>
        {complemento && <span className="mt-[7px] block text-xs text-[#FF6B00] dark:text-orange-400">{complemento}</span>}
      </span>
      <ChevronRight
        className={cn(
          "relative z-10 h-[18px] w-[18px] shrink-0 transition-transform duration-200",
          ativo ? "rotate-90 text-[#246BFF] dark:text-blue-400" : "text-[#0B1429] dark:text-foreground",
        )}
        aria-hidden="true"
      />
    </button>
  );
}
