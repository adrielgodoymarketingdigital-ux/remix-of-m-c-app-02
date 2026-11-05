import { Package, Coins, DollarSign, TrendingUp, TrendingDown, Wrench, ClipboardCheck, CircleCheck, CirclePlay, Clock, CircleX, PackageCheck, Shield, TriangleAlert, LucideIcon } from "lucide-react";
import { getEstiloDaCor } from "@/components/tutoriais/CardCategoriaTutorial";
import { Skeleton } from "@/components/ui/skeleton";
import { ValorMonetario } from "@/components/ui/valor-monetario";
import { useOcultarValores } from "@/contexts/OcultarValoresContext";
import { cn } from "@/lib/utils";
import { useIsDesktop } from "@/hooks/use-mobile";
import { useFuncionarioPermissoes } from "@/hooks/useFuncionarioPermissoes";
import { useOSStatusConfigContext as useOSStatusConfig } from "@/contexts/OSStatusConfigContext";

const ICONE_POR_STATUS: Record<string, LucideIcon> = {
  aguardando_aprovacao: Clock,
  em_andamento: Clock,
  finalizado: CircleCheck,
  aguardando_retirada: Clock,
  entregue: PackageCheck,
  cancelada: CircleX,
  garantia: Shield,
  estornado: TriangleAlert,
};

const ICONE_POR_STATUS_DESKTOP: Record<string, LucideIcon> = {
  ...ICONE_POR_STATUS,
  em_andamento: CirclePlay,
};

interface OrdemServico {
  id: string;
  status: string | null;
  total: number | null;
}

interface ServicoAvulso {
  id: string;
  nome: string;
  custo: number;
  preco: number;
  lucro: number;
  status: string;
}

interface DashboardOrdensServicoProps {
  ordens: OrdemServico[];
  servicosAvulsos?: ServicoAvulso[];
  lucroOrdensEntregues?: number | null;
  /** Só no computador: primeira carga ainda não terminou. */
  carregando?: boolean;
  /** Só no computador: há data no filtro (com "Todos os meses" sem datas, não há período a citar). */
  temPeriodo?: boolean;
}

export const DashboardOrdensServico = ({
  ordens,
  servicosAvulsos = [],
  lucroOrdensEntregues,
  carregando = false,
  temPeriodo = true,
}: DashboardOrdensServicoProps) => {
  const { podeVerLucros, isFuncionario } = useFuncionarioPermissoes();
  const { statusList } = useOSStatusConfig();
  const isDesktop = useIsDesktop();

  const statusCounts = statusList
    .filter((s) => s.ativo)
    .map((s) => ({
      slug: s.slug,
      nome: s.nome,
      cor: s.cor,
      count: ordens.filter((o) => o.status === s.slug).length,
    }));

  const aguardandoRetiradaOS = ordens.filter(o => o.status === "aguardando_retirada");
  const aguardandoRetiradaCount = aguardandoRetiradaOS.length;
  const aguardandoRetiradaValor = aguardandoRetiradaOS.reduce((acc, o) => acc + (o.total ?? 0), 0);
  const aguardandoRetiradaStatus = statusList.find(s => s.slug === "aguardando_retirada");
  const aguardandoRetiradaNome = aguardandoRetiradaStatus?.nome ?? "Aguardando Retirada";
  const aguardandoRetiradaCor = aguardandoRetiradaStatus?.cor ?? "#f97316";

  const visibleStatuses = statusCounts.filter((s) => {
    const config = statusList.find((st) => st.slug === s.slug);
    return s.count > 0 || config?.is_sistema;
  });

  const aguardandoRetiradaNaLista = visibleStatuses.some((s) => s.slug === "aguardando_retirada");

  const ordensEntregues = ordens.filter((o) => o.status === "entregue" || o.status === "garantia");
  const valorFaturado = ordensEntregues.reduce((acc, ordem) => acc + (ordem.total || 0), 0);

  const totalAvulsos = servicosAvulsos.length;
  const valorAvulsos = servicosAvulsos.reduce((acc, sa) => acc + sa.preco, 0);
  const avulsosEntregues = servicosAvulsos.filter(sa => sa.status === "entregue");
  const lucroAvulsosEntregues = avulsosEntregues.reduce((acc, sa) => acc + (Number(sa.preco || 0) - Number(sa.custo || 0)), 0);
  const lucroTotal = (lucroOrdensEntregues || 0) + lucroAvulsosEntregues;

  return (
    <div className={isDesktop ? "mb-4 space-y-4" : "space-y-2 mb-4"}>
      {/* Cards de status dinâmicos */}
      {isDesktop && carregando ? (
        <div className="grid grid-cols-3 gap-3 min-[1152px]:grid-cols-5">
          {Array.from({ length: 10 }, (_, i) => (
            <div key={i} className="flex min-h-[76px] items-center gap-3 rounded-[14px] border border-border bg-card px-3 py-[11px] shadow-sm">
              <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-3 w-full max-w-[90px]" />
                <Skeleton className="h-6 w-10" />
              </div>
            </div>
          ))}
        </div>
      ) : isDesktop ? (
        <div className="grid grid-cols-3 gap-3 min-[1152px]:grid-cols-5">
          <StatusCardDesktop cor="#3b82f6" label="Total de Ordens" icone={Package} valor={ordens.length} />

          {visibleStatuses.map((s) => (
            <StatusCardDesktop
              key={s.slug}
              cor={s.cor}
              label={s.nome}
              icone={ICONE_POR_STATUS_DESKTOP[s.slug] ?? ClipboardCheck}
              valor={s.count}
              detalhe={s.slug === "aguardando_retirada" && aguardandoRetiradaCount > 0 ? aguardandoRetiradaValor : undefined}
            />
          ))}

          {/* Status desativado pela loja, mas ainda com OS: o card continua aparecendo */}
          {!aguardandoRetiradaNaLista && aguardandoRetiradaCount > 0 && (
            <StatusCardDesktop
              cor={aguardandoRetiradaCor}
              label={aguardandoRetiradaNome}
              icone={Clock}
              valor={aguardandoRetiradaCount}
              detalhe={aguardandoRetiradaValor}
            />
          )}

          <StatusCardDesktop
            cor="#8b5cf6"
            label="Avulsos"
            icone={Wrench}
            valor={totalAvulsos}
            detalhe={totalAvulsos > 0 ? valorAvulsos : undefined}
          />
        </div>
      ) : (
        <div className="grid gap-2 grid-cols-5">
          <StatusCard cor="#3b82f6" label="Total de Ordens" icon={<Package className="h-3.5 w-3.5" />}>
            <p className="text-lg font-bold tabular-nums mt-0.5">{ordens.length}</p>
          </StatusCard>

          {visibleStatuses.map((s) => {
            const Icone = ICONE_POR_STATUS[s.slug] ?? ClipboardCheck;
            return (
              <StatusCard key={s.slug} cor={s.cor} label={s.nome} icon={<Icone className="h-3.5 w-3.5" />}>
                <p className="text-lg font-bold tabular-nums mt-0.5">{s.count}</p>
                {s.slug === "aguardando_retirada" && aguardandoRetiradaCount > 0 && (
                  <p className="text-[9px] text-muted-foreground truncate"><ValorMonetario valor={aguardandoRetiradaValor} /></p>
                )}
              </StatusCard>
            );
          })}

          {/* Status desativado pela loja, mas ainda com OS: o card continua aparecendo */}
          {!aguardandoRetiradaNaLista && aguardandoRetiradaCount > 0 && (
            <StatusCard cor={aguardandoRetiradaCor} label={aguardandoRetiradaNome} icon={<Clock className="h-3.5 w-3.5" />}>
              <p className="text-lg font-bold tabular-nums mt-0.5">{aguardandoRetiradaCount}</p>
              <p className="text-[9px] text-muted-foreground truncate"><ValorMonetario valor={aguardandoRetiradaValor} /></p>
            </StatusCard>
          )}

          <StatusCard cor="#8b5cf6" label="Avulsos" icon={<Wrench className="h-3.5 w-3.5" />}>
            <p className="text-lg font-bold tabular-nums mt-0.5">{totalAvulsos}</p>
            {totalAvulsos > 0 && (
              <p className="text-[9px] text-muted-foreground truncate"><ValorMonetario valor={valorAvulsos} /></p>
            )}
          </StatusCard>
        </div>
      )}

      {/* Linha com cards financeiros */}
      {isDesktop ? (
        !isFuncionario ? (
          <div className="grid grid-cols-2 gap-5">
            <ValorCardDesktop
              tom="azul"
              label="Valor Faturado"
              sublabel={temPeriodo ? "Total faturado no período" : "Total faturado"}
              valor={valorFaturado + valorAvulsos}
              icone={Coins}
              carregando={carregando}
            />

            {podeVerLucros && (
              <ValorCardDesktop
                tom="verde"
                label="Lucro Total"
                sublabel={temPeriodo ? "Lucro líquido no período" : "Lucro líquido"}
                valor={lucroTotal}
                icone={TrendingUp}
                carregando={carregando}
              />
            )}
          </div>
        ) : (
          podeVerLucros && (
            <div className="grid grid-cols-2 gap-5">
              <ValorCardDesktop
                tom="verde"
                label="Lucro Avulsos"
                sublabel="Serviços avulsos entregues"
                valor={lucroAvulsosEntregues}
                icone={TrendingUp}
                carregando={carregando}
              />
            </div>
          )
        )
      ) : !isFuncionario ? (
        <div className="grid gap-2 grid-cols-2">
          <ValorCard
            label="Valor Faturado"
            sublabel="Total faturado"
            valor={valorFaturado + valorAvulsos}
            icon={<DollarSign className="h-3.5 w-3.5" />}
          />

          {podeVerLucros && (
            <ValorCard
              label="Lucro Total"
              sublabel="Lucro líquido"
              valor={lucroTotal}
              icon={<TrendingUp className="h-3.5 w-3.5" />}
            />
          )}
        </div>
      ) : (
        podeVerLucros && (
          <div className="grid gap-2 grid-cols-2">
            <StatusCard cor="#10b981" label="Lucro Avulsos" icon={<TrendingUp className="h-3.5 w-3.5" />}>
              <p className="text-lg font-bold tabular-nums mt-0.5">
                <ValorMonetario valor={lucroAvulsosEntregues} />
              </p>
            </StatusCard>
          </div>
        )
      )}
    </div>
  );
};

interface StatusCardProps {
  cor: string;
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}

function StatusCard({ cor, label, icon, children }: StatusCardProps) {
  return (
    <div className="relative overflow-hidden rounded-lg border border-border/50 bg-card p-2 flex flex-col">
      <span
        className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: cor }}
      />
      <div
        className="h-6 w-6 rounded-md flex items-center justify-center mb-1"
        style={{ backgroundColor: `${cor}1a` }}
      >
        <span style={{ color: cor }}>{icon}</span>
      </div>
      <p className="text-[9px] font-medium text-foreground leading-[1.2] min-h-[3.6em]">{label}</p>
      {children}
    </div>
  );
}

const COR_NEUTRA = "#6b7280";

interface StatusCardDesktopProps {
  cor: string;
  label: string;
  icone: LucideIcon;
  valor: number;
  detalhe?: number;
}

function StatusCardDesktop({ cor, label, icone: Icone, valor, detalhe }: StatusCardDesktopProps) {
  // A cor do status vem do banco e pode ter sido digitada à mão
  const corValida = /^#[0-9a-f]{6}$/i.test(cor) ? cor : COR_NEUTRA;

  return (
    <div
      style={getEstiloDaCor(corValida)}
      className="flex min-h-[76px] min-w-0 items-center gap-3 rounded-[14px] border border-l-4 border-border border-l-[color:var(--acento)] bg-card px-3 py-[11px] shadow-sm dark:border-l-[color:var(--acento-escuro)]"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--acento-suave)] text-[color:var(--acento)] dark:bg-[var(--acento-suave-escuro)] dark:text-[color:var(--acento-escuro)]">
        <Icone className="h-[22px] w-[22px]" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold leading-[1.35] text-foreground [overflow-wrap:anywhere]">{label}</p>
        <p className="mt-1 text-2xl font-extrabold leading-none tabular-nums text-foreground">{valor}</p>
        {detalhe !== undefined && (
          <p className="mt-1 truncate text-[11px] text-muted-foreground"><ValorMonetario valor={detalhe} /></p>
        )}
      </div>
    </div>
  );
}

interface ValorCardProps {
  label: string;
  sublabel: string;
  valor: number;
  icon: React.ReactNode;
}

function ValorCard({ label, sublabel, valor, icon }: ValorCardProps) {
  return (
    <div className="relative overflow-hidden rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2.5">
      <div className="flex items-start gap-2 mb-1">
        <p className="text-xs text-muted-foreground truncate flex-1 min-w-0">{label}</p>
        <div className="h-6 w-6 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0 text-emerald-500">
          {icon}
        </div>
      </div>
      <p className="text-lg font-bold tabular-nums text-emerald-500 leading-tight break-words">
        <ValorMonetario valor={valor} />
      </p>
      <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{sublabel}</p>
    </div>
  );
}

const TONS_VALOR_DESKTOP = {
  azul: {
    card: "border-[#b9d8ff] from-[#eff6ff] to-[#e8f3ff] dark:border-blue-500/25 dark:from-blue-500/10 dark:to-blue-500/5",
    icone: "bg-[#d7eaff] text-[#0873eb] dark:bg-blue-500/20 dark:text-blue-300",
    valor: "text-[#0866e9] dark:text-blue-300",
  },
  verde: {
    card: "border-[#b9ecd4] from-[#ecfbf5] to-[#e7faf1] dark:border-emerald-500/25 dark:from-emerald-500/10 dark:to-emerald-500/5",
    icone: "bg-[#d3f5e4] text-[#0bad60] dark:bg-emerald-500/20 dark:text-emerald-400",
    valor: "text-[#047857] dark:text-emerald-400",
  },
};

interface ValorCardDesktopProps {
  tom: keyof typeof TONS_VALOR_DESKTOP;
  label: string;
  sublabel: string;
  valor: number;
  icone: LucideIcon;
  carregando: boolean;
}

function ValorCardDesktop({ tom, label, sublabel, valor, icone: Icone, carregando }: ValorCardDesktopProps) {
  const { valoresOcultos } = useOcultarValores();
  const estilo = TONS_VALOR_DESKTOP[tom];
  // Com os valores ocultos, o vermelho entregaria que houve prejuízo
  const negativo = valor < 0 && !valoresOcultos;
  const IconeFinal = negativo ? TrendingDown : Icone;

  return (
    <div className={cn("flex min-h-[107px] min-w-0 items-center gap-4 rounded-[17px] border bg-gradient-to-r px-5 py-3.5", estilo.card)}>
      {carregando ? (
        <Skeleton className="h-[52px] w-[52px] shrink-0 rounded-full" />
      ) : (
        <div className={cn("flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full", negativo ? "bg-red-500/15 text-red-700 dark:text-red-400" : estilo.icone)}>
          <IconeFinal className="h-6 w-6" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-foreground">{label}</p>
        {carregando ? (
          <Skeleton className="my-1.5 h-7 w-40 max-w-full" />
        ) : (
          <p className={cn("my-0.5 text-[28px] font-extrabold leading-tight tracking-tight tabular-nums [overflow-wrap:anywhere] min-[1152px]:text-[30px]", negativo ? "text-red-700 dark:text-red-400" : estilo.valor)}>
            <ValorMonetario valor={valor} />
          </p>
        )}
        <p className="text-xs text-muted-foreground">{sublabel}</p>
      </div>
    </div>
  );
}
