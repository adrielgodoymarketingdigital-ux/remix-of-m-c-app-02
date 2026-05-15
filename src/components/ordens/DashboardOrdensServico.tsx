import { Package, DollarSign, TrendingUp, Wrench } from "lucide-react";
import { ValorMonetario } from "@/components/ui/valor-monetario";
import { useFuncionarioPermissoes } from "@/hooks/useFuncionarioPermissoes";
import { useOSStatusConfig } from "@/hooks/useOSStatusConfig";
import { useEmpresa } from "@/contexts/EmpresaContext";

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
  const { isProprietario, empresaAtiva } = useEmpresa();
  const isFilialAtiva = isProprietario && !!empresaAtiva;

  const statusCounts = statusList
    .filter((s) => s.ativo)
    .map((s) => ({
      slug: s.slug,
      nome: s.nome,
      cor: s.cor,
      count: ordens.filter((o) => o.status === s.slug).length,
    }));

  const visibleStatuses = statusCounts.filter((s) => {
    const config = statusList.find((st) => st.slug === s.slug);
    return s.count > 0 || config?.is_sistema;
  });

  const ordensEntregues = ordens.filter((o) => o.status === "entregue");
  const valorFaturado = ordensEntregues.reduce((acc, ordem) => acc + (ordem.total || 0), 0);

  const totalAvulsos = servicosAvulsos.length;
  const valorAvulsos = servicosAvulsos.reduce((acc, sa) => acc + sa.preco, 0);
  const avulsosEntregues = servicosAvulsos.filter(sa => sa.status === "entregue");
  const lucroAvulsosEntregues = avulsosEntregues.reduce((acc, sa) => acc + (Number(sa.preco || 0) - Number(sa.custo || 0)), 0);
  const lucroTotal = (lucroOrdensEntregues || 0) + lucroAvulsosEntregues;

  return (
    <div className="space-y-3 mb-6">
      {/* Cards de status dinâmicos */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {visibleStatuses.map((s) => (
          <StatusCard key={s.slug} cor={s.cor} label={s.nome} ping>
            <div className="text-3xl sm:text-4xl font-black tabular-nums tracking-tight font-mono" style={{ color: s.cor }}>
              {s.count}
            </div>
          </StatusCard>
        ))}
      </div>

      {/* Linha com cards fixos: Avulsos + financeiros */}
      {!isFuncionario ? (
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
          <StatusCard cor="#8b5cf6" label="Avulsos" icon={<Wrench className="h-3.5 w-3.5 text-violet-400" />}>
            <div className="text-3xl sm:text-4xl font-black tabular-nums tracking-tight font-mono text-violet-500">{totalAvulsos}</div>
            {totalAvulsos > 0 && (
              <p className="text-[11px] text-violet-400/70 mt-0.5 font-mono"><ValorMonetario valor={valorAvulsos} /></p>
            )}
          </StatusCard>

          <FinanceCard
            cor="#3b82f6"
            label="Total de Ordens"
            icon={<Package className="h-4 w-4 text-blue-400" />}
            iconBg="bg-blue-500/10 border-blue-500/20"
          >
            <span className="text-3xl sm:text-4xl font-black tabular-nums tracking-tight font-mono text-blue-500">
              {ordens.length}
            </span>
          </FinanceCard>

          <FinanceCard
            cor="#22c55e"
            label="Valor Faturado"
            icon={<DollarSign className="h-4 w-4 text-green-400" />}
            iconBg="bg-green-500/10 border-green-500/20"
          >
            <span className="text-xl sm:text-2xl font-black tabular-nums tracking-tight font-mono text-green-500">
              <ValorMonetario valor={valorFaturado + valorAvulsos} />
            </span>
          </FinanceCard>

          {podeVerLucros && !isFilialAtiva && (
            <FinanceCard
              cor="#10b981"
              label="Lucro Total"
              icon={<TrendingUp className="h-4 w-4 text-emerald-400" />}
              iconBg="bg-emerald-500/10 border-emerald-500/20"
            >
              <span className="text-xl sm:text-2xl font-black tabular-nums tracking-tight font-mono text-emerald-500">
                <ValorMonetario valor={lucroTotal} />
              </span>
            </FinanceCard>
          )}
        </div>
      ) : (
        <div className="grid gap-3 grid-cols-2">
          <StatusCard cor="#8b5cf6" label="Avulsos" icon={<Wrench className="h-3.5 w-3.5 text-violet-400" />}>
            <div className="text-3xl sm:text-4xl font-black tabular-nums tracking-tight font-mono text-violet-500">{totalAvulsos}</div>
            {totalAvulsos > 0 && (
              <p className="text-[11px] text-violet-400/70 mt-0.5 font-mono"><ValorMonetario valor={valorAvulsos} /></p>
            )}
          </StatusCard>
          {podeVerLucros && (
            <StatusCard cor="#10b981" label="Lucro Avulsos" icon={<TrendingUp className="h-3.5 w-3.5 text-emerald-400" />}>
              <div className="text-xl sm:text-2xl font-black tabular-nums tracking-tight font-mono text-emerald-500">
                <ValorMonetario valor={lucroAvulsosEntregues} />
              </div>
            </StatusCard>
          )}
        </div>
      )}
    </div>
  );
};

function hexToRgbStr(hex: string): string {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return "59 130 246";
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `${r} ${g} ${b}`;
}

interface StatusCardProps {
  cor: string;
  label: string;
  ping?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

function StatusCard({ cor, label, ping, icon, children }: StatusCardProps) {
  const rgb = hexToRgbStr(cor);
  return (
    <div
      className="os-card-glow group relative overflow-hidden rounded-xl border bg-card p-4 cursor-default transition-all duration-200"
      style={{
        borderColor: `rgba(${rgb} / 0.25)`,
        ["--glow-rgb" as string]: rgb,
        boxShadow: `inset 0 1px 0 0 rgba(${rgb} / 0.15)`,
      }}
    >
      {/* Glow no topo interno */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent 10%, rgba(${rgb} / 0.6) 50%, transparent 90%)` }}
      />
      {/* Reflexo de canto */}
      <div
        className="absolute top-0 right-0 h-16 w-16 opacity-10 pointer-events-none"
        style={{ background: `radial-gradient(circle at 100% 0%, ${cor} 0%, transparent 70%)` }}
      />

      <div className="flex items-center justify-between mb-2.5">
        <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/70">
          {label}
        </span>
        {ping ? (
          <div className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-50" style={{ backgroundColor: cor }} />
            <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: cor }} />
          </div>
        ) : icon}
      </div>
      {children}
    </div>
  );
}

interface FinanceCardProps {
  cor: string;
  label: string;
  icon: React.ReactNode;
  iconBg: string;
  children: React.ReactNode;
}

function FinanceCard({ cor, label, icon, iconBg, children }: FinanceCardProps) {
  const rgb = hexToRgbStr(cor);
  return (
    <div
      className="os-card-glow group relative overflow-hidden rounded-xl border bg-card p-4 cursor-default transition-all duration-200"
      style={{
        borderColor: `rgba(${rgb} / 0.2)`,
        ["--glow-rgb" as string]: rgb,
        boxShadow: `inset 0 1px 0 0 rgba(${rgb} / 0.12)`,
      }}
    >
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent 10%, rgba(${rgb} / 0.5) 50%, transparent 90%)` }}
      />
      <div
        className="absolute top-0 right-0 h-16 w-16 opacity-[0.07] pointer-events-none"
        style={{ background: `radial-gradient(circle at 100% 0%, ${cor} 0%, transparent 70%)` }}
      />
      <div className="relative flex items-start justify-between">
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/70 block mb-2.5">
            {label}
          </span>
          {children}
        </div>
        <div className={`h-8 w-8 rounded-lg border flex items-center justify-center shrink-0 ${iconBg}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}
