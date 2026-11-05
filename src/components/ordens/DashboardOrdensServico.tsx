import { Package, DollarSign, TrendingUp, Wrench, ClipboardCheck, CircleCheck, CirclePlay, Clock, CircleX, PackageCheck, Shield, TriangleAlert, LucideIcon } from "lucide-react";
import { getEstiloDaCor } from "@/components/tutoriais/CardCategoriaTutorial";
import { ValorMonetario } from "@/components/ui/valor-monetario";
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
}

export const DashboardOrdensServico = ({
  ordens,
  servicosAvulsos = [],
  lucroOrdensEntregues,
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
    <div className="space-y-2 mb-4">
      {/* Cards de status dinâmicos */}
      {isDesktop ? (
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
      {!isFuncionario ? (
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
      className="flex min-h-[87px] min-w-0 items-center gap-3 rounded-[14px] border border-l-4 border-border border-l-[color:var(--acento)] bg-card px-3 py-3.5 shadow-sm dark:border-l-[color:var(--acento-escuro)]"
    >
      <div className="flex h-[43px] w-[43px] shrink-0 items-center justify-center rounded-full bg-[var(--acento-suave)] text-[color:var(--acento)] dark:bg-[var(--acento-suave-escuro)] dark:text-[color:var(--acento-escuro)]">
        <Icone className="h-[23px] w-[23px]" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold leading-[1.35] text-foreground [overflow-wrap:anywhere]">{label}</p>
        <p className="mt-1.5 text-[25px] font-extrabold leading-none tabular-nums text-foreground">{valor}</p>
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
