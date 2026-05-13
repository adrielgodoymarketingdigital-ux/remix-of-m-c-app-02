import { useState, useEffect } from "react";
import {
  Target, TrendingUp, Zap, BarChart2,
  AlertTriangle, Pencil, Check, X, HelpCircle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatCurrency } from "@/lib/formatters";
import { useOSGerencial } from "@/hooks/useOSGerencial";

interface Props {
  dataInicio?: Date;
  dataFim?: Date;
  onAbrirOS?: (id: string) => void;
  onVerOSParadas?: () => void;
}

// ── Popover de ajuda ────────────────────────────────────────────────────────

function HelpButton({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="absolute top-1.5 right-1.5 flex items-center justify-center h-3.5 w-3.5 rounded-full bg-white/5 border border-white/10 text-white/25 hover:text-white/50 hover:bg-white/10 transition-colors focus:outline-none"
          aria-label={title}
        >
          <HelpCircle className="h-2 w-2" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="bottom" align="end" className="w-72 text-xs space-y-2">
        {children}
      </PopoverContent>
    </Popover>
  );
}

// ── Skeleton compacto ────────────────────────────────────────────────────────

function ChipSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-lg border border-white/8 bg-gradient-to-br from-zinc-900 to-zinc-800 px-3 py-2 w-36 animate-pulse">
      <div className="h-1.5 w-12 rounded bg-white/10 mb-2" />
      <div className="h-4 w-20 rounded bg-white/10 mb-1.5" />
      <div className="h-1 w-16 rounded-full bg-white/10" />
    </div>
  );
}

// ── Card premium compacto ─────────────────────────────────────────────────────

function PremiumCard({
  cor,
  icon,
  label,
  visible,
  helpTitle,
  helpContent,
  children,
}: {
  cor: string;
  icon: React.ReactNode;
  label: string;
  visible: boolean;
  helpTitle: string;
  helpContent: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      className="relative overflow-hidden rounded-lg border border-white/8 bg-gradient-to-br from-zinc-900 to-zinc-800 px-3 py-2 min-w-[130px] transition-all duration-500"
      style={{
        boxShadow: `0 0 0 1px ${cor}20, 0 2px 12px ${cor}10`,
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(6px)",
      }}
    >
      {/* glow de fundo */}
      <div
        className="pointer-events-none absolute -top-4 -right-4 h-14 w-14 rounded-full opacity-15"
        style={{ background: `radial-gradient(circle, ${cor} 0%, transparent 70%)` }}
      />
      {/* linha superior */}
      <div
        className="absolute top-0 left-4 right-4 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${cor}70, transparent)` }}
      />

      <div className="flex items-center gap-1.5 mb-1.5">
        <div
          className="h-4 w-4 rounded flex items-center justify-center shrink-0"
          style={{ background: `${cor}20` }}
        >
          {icon}
        </div>
        <p className="text-[8px] font-semibold uppercase tracking-[0.14em] text-white/40 leading-none">
          {label}
        </p>
      </div>

      {children}

      <HelpButton title={helpTitle}>{helpContent}</HelpButton>
    </div>
  );
}

// ── Barra de progresso ───────────────────────────────────────────────────────

function ProgressBar({ pct, cor, visible }: { pct: number; cor: string; visible: boolean }) {
  return (
    <div className="h-1 w-full rounded-full bg-white/8 overflow-hidden mt-1">
      <div
        className="h-full rounded-full transition-all duration-700 ease-out"
        style={{
          width: visible ? `${pct}%` : "0%",
          background: `linear-gradient(90deg, ${cor}80, ${cor})`,
          boxShadow: `0 0 4px ${cor}60`,
        }}
      />
    </div>
  );
}

// ── Hook compartilhado — exporta dados para quem precisar ───────────────────
// Os dois componentes públicos (OSBannerParadas + OSChipsGerenciais) recebem
// os dados via prop para não duplicar a query no banco.

export interface OSGerencialSnapshot {
  valorRealizado: number;
  metaValor: number;
  osParadasCount: number;
  osParadas: { id: string }[];
  pctMeta: number;
  pctEsperado: number;
  pctReal: number;
  ritmoDiario: number;
  projecao: number;
  diasUteisMes: number;
  diasUteisPassados: number;
  corMeta: string;
  corSemaforo: string;
  corRitmo: string;
  corProjecao: string;
  labelSemaforo: string;
  carregando: boolean;
  salvarMeta: (v: number) => Promise<unknown>;
}

// ── Componente orquestrador (mantém uma única instância do hook) ─────────────

export function OSResumoBarra({ dataInicio, dataFim, onAbrirOS, onVerOSParadas }: Props) {
  const { data, diasUteis, meta, carregando, salvarMeta } = useOSGerencial(dataInicio, dataFim);

  const { diasUteisMes, diasUteisPassados } = diasUteis;
  const valorRealizado = data?.valorRealizado ?? 0;
  const metaValor = meta ?? 0;
  const osParadasCount = data?.osParadasCount ?? 0;

  const pctMeta = metaValor > 0 ? Math.min((valorRealizado / metaValor) * 100, 100) : 0;
  const pctEsperado = diasUteisMes > 0 ? (diasUteisPassados / diasUteisMes) * 100 : 0;
  const pctReal = metaValor > 0 ? (valorRealizado / metaValor) * 100 : 0;
  const ritmoDiario = diasUteisPassados > 0 ? valorRealizado / diasUteisPassados : 0;
  const projecao = ritmoDiario * diasUteisMes;

  const corMeta = metaValor > 0
    ? pctMeta >= 80 ? "#22c55e" : pctMeta >= 50 ? "#eab308" : "#ef4444"
    : "#6b7280";
  const ratioSemaforo = pctEsperado > 0 ? pctReal / pctEsperado : 0;
  const corSemaforo = metaValor > 0
    ? ratioSemaforo >= 1 ? "#22c55e" : ratioSemaforo >= 0.7 ? "#eab308" : "#ef4444"
    : "#6b7280";
  const labelSemaforo = ratioSemaforo >= 1 ? "No ritmo" : ratioSemaforo >= 0.7 ? "Atenção" : "Crítico";
  const corRitmo = metaValor > 0
    ? ritmoDiario * diasUteisMes >= metaValor ? "#22c55e"
      : ritmoDiario * diasUteisMes >= metaValor * 0.8 ? "#eab308" : "#ef4444"
    : "#6b7280";
  const corProjecao = metaValor > 0
    ? projecao >= metaValor ? "#22c55e"
      : projecao >= metaValor * 0.8 ? "#eab308" : "#ef4444"
    : "#6b7280";

  const snapshot: OSGerencialSnapshot = {
    valorRealizado, metaValor, osParadasCount,
    osParadas: data?.osParadas ?? [],
    pctMeta, pctEsperado, pctReal, ritmoDiario, projecao,
    diasUteisMes, diasUteisPassados,
    corMeta, corSemaforo, corRitmo, corProjecao, labelSemaforo,
    carregando, salvarMeta,
  };

  return (
    <>
      <OSBannerParadas snapshot={snapshot} onAbrirOS={onAbrirOS} onVerOSParadas={onVerOSParadas} />
      <OSChipsGerenciais snapshot={snapshot} />
    </>
  );
}

// ── Banner de OS paradas ─────────────────────────────────────────────────────

export function OSBannerParadas({
  snapshot,
  onAbrirOS,
  onVerOSParadas,
}: {
  snapshot: OSGerencialSnapshot;
  onAbrirOS?: (id: string) => void;
  onVerOSParadas?: () => void;
}) {
  if (snapshot.osParadasCount === 0) return null;

  return (
    <div className="flex items-center gap-3 rounded-xl border border-amber-500/25 bg-zinc-900 px-4 py-2.5 shadow-[0_0_0_1px_rgba(245,158,11,0.15),0_2px_12px_rgba(245,158,11,0.08)]">
      <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-amber-500/15 border border-amber-500/25 shrink-0">
        <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-white/90 leading-snug">
          <span className="font-semibold text-amber-400">Atenção imediata</span>
          {" — "}
          {snapshot.osParadasCount === 1
            ? "1 OS com 3 dias ou mais parada."
            : `${snapshot.osParadasCount} OS com 3 dias ou mais paradas.`}
          {" "}
          <span className="text-white/50">Elas precisam de ação agora.</span>
        </p>
      </div>
      <button
        onClick={onVerOSParadas}
        className="shrink-0 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-[11px] font-medium text-amber-300 hover:bg-amber-500/20 hover:text-amber-200 transition-colors"
      >
        Ver OS paradas
      </button>
    </div>
  );
}

// ── 4 chips gerenciais ───────────────────────────────────────────────────────

export function OSChipsGerenciais({ snapshot }: { snapshot: OSGerencialSnapshot }) {
  const [editandoMeta, setEditandoMeta] = useState(false);
  const [inputMeta, setInputMeta] = useState("");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!snapshot.carregando) {
      const t = setTimeout(() => setVisible(true), 60);
      return () => clearTimeout(t);
    } else {
      setVisible(false);
    }
  }, [snapshot.carregando]);

  const {
    valorRealizado, metaValor, pctMeta, pctEsperado, pctReal,
    ritmoDiario, projecao, diasUteisMes, diasUteisPassados,
    corMeta, corSemaforo, corRitmo, corProjecao, labelSemaforo,
    carregando, salvarMeta,
  } = snapshot;

  async function confirmarMeta() {
    const val = parseFloat(inputMeta.replace(",", "."));
    if (isNaN(val) || val <= 0) return;
    await salvarMeta(val);
    setEditandoMeta(false);
  }

  function abrirEdicao() {
    setInputMeta(metaValor > 0 ? String(metaValor) : "");
    setEditandoMeta(true);
  }

  if (carregando) {
    return (
      <>
        <ChipSkeleton />
        <ChipSkeleton />
        <ChipSkeleton />
        <ChipSkeleton />
      </>
    );
  }

  return (
    <>
      {/* META OS */}
      {editandoMeta ? (
        <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-gradient-to-br from-zinc-900 to-zinc-800 px-2.5 py-1.5">
          <Input
            autoFocus
            className="h-6 w-24 text-xs font-mono bg-white/5 border-white/15 text-white"
            placeholder="Ex: 15000"
            value={inputMeta}
            onChange={(e) => setInputMeta(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") confirmarMeta();
              if (e.key === "Escape") setEditandoMeta(false);
            }}
          />
          <button onClick={confirmarMeta} className="text-green-400 hover:text-green-300 transition-colors p-0.5">
            <Check className="h-3 w-3" />
          </button>
          <button onClick={() => setEditandoMeta(false)} className="text-white/30 hover:text-white/60 transition-colors p-0.5">
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <PremiumCard
          cor={corMeta}
          icon={<Target className="h-2.5 w-2.5" style={{ color: corMeta }} />}
          label="Meta OS"
          visible={visible}
          helpTitle="O que é Meta OS?"
          helpContent={
            <>
              <p className="font-semibold text-sm">Meta OS</p>
              <p className="text-muted-foreground leading-relaxed">
                Soma em R$ das suas OS em andamento, finalizadas e entregues no período. Clique no lápis ✏️ para definir sua meta mensal e acompanhar o progresso.
              </p>
            </>
          }
        >
          {metaValor > 0 ? (
            <>
              <p className="text-sm font-bold tabular-nums font-mono text-white leading-none pr-4">
                {formatCurrency(valorRealizado)}
              </p>
              <ProgressBar pct={pctMeta} cor={corMeta} visible={visible} />
              <p className="text-[9px] font-mono mt-1" style={{ color: `${corMeta}cc` }}>
                {pctMeta.toFixed(0)}% da meta
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-bold tabular-nums font-mono text-white/50 leading-none">
                {formatCurrency(valorRealizado)}
              </p>
              <button
                onClick={abrirEdicao}
                className="mt-1 flex items-center gap-1 text-[9px] text-white/35 hover:text-white/60 transition-colors"
              >
                <Pencil className="h-2 w-2" />
                Definir meta
              </button>
            </>
          )}
          {metaValor > 0 && (
            <button
              onClick={abrirEdicao}
              className="absolute bottom-1.5 right-5 text-white/15 hover:text-white/40 transition-colors"
              title="Editar meta"
            >
              <Pencil className="h-2 w-2" />
            </button>
          )}
        </PremiumCard>
      )}

      {/* SEMÁFORO */}
      <PremiumCard
        cor={corSemaforo}
        icon={<TrendingUp className="h-2.5 w-2.5" style={{ color: corSemaforo }} />}
        label="Semáforo"
        visible={visible}
        helpTitle="Como funciona o Semáforo?"
        helpContent={
          <>
            <p className="font-semibold text-sm">Semáforo</p>
            <p className="text-muted-foreground leading-relaxed">
              Compara o que você já fez com o que era esperado para esse momento do mês. Se o mês tem 22 dias úteis e hoje é o dia 11, o esperado é que você já tenha feito 50% da sua meta.
            </p>
            <ul className="space-y-1 text-muted-foreground">
              <li>🟢 <span className="font-medium text-foreground">No ritmo</span> — igual ou acima do esperado</li>
              <li>🟡 <span className="font-medium text-foreground">Atenção</span> — um pouco abaixo do esperado</li>
              <li>🔴 <span className="font-medium text-foreground">Crítico</span> — muito abaixo do esperado</li>
            </ul>
          </>
        }
      >
        {metaValor > 0 ? (
          <>
            <p className="text-sm font-bold font-mono leading-none pr-4" style={{ color: corSemaforo }}>
              {labelSemaforo}
            </p>
            <p className="text-[9px] font-mono mt-1 text-white/40">
              {pctReal.toFixed(0)}% / {pctEsperado.toFixed(0)}%
            </p>
          </>
        ) : (
          <p className="text-xs text-white/25 leading-none">Sem meta</p>
        )}
      </PremiumCard>

      {/* RITMO DIÁRIO */}
      <PremiumCard
        cor={corRitmo}
        icon={<Zap className="h-2.5 w-2.5" style={{ color: corRitmo }} />}
        label="Ritmo Diário"
        visible={visible}
        helpTitle="O que é Ritmo Diário?"
        helpContent={
          <>
            <p className="font-semibold text-sm">Ritmo Diário</p>
            <p className="text-muted-foreground leading-relaxed">
              Quanto você está faturando em média por dia útil trabalhado no mês. Calculado com base no valor real das suas OS dividido pelos dias úteis já passados.
            </p>
          </>
        }
      >
        <p className="text-sm font-bold tabular-nums font-mono text-white leading-none pr-4">
          {diasUteisPassados > 0 ? formatCurrency(ritmoDiario) : "—"}
        </p>
        <p className="text-[9px] font-mono mt-1 text-white/40">
          {diasUteisPassados}/{diasUteisMes} dias úteis
        </p>
      </PremiumCard>

      {/* PROJEÇÃO */}
      <PremiumCard
        cor={corProjecao}
        icon={<BarChart2 className="h-2.5 w-2.5" style={{ color: corProjecao }} />}
        label="Projeção"
        visible={visible}
        helpTitle="O que é Projeção?"
        helpContent={
          <>
            <p className="font-semibold text-sm">Projeção</p>
            <p className="text-muted-foreground leading-relaxed">
              Se você mantiver o ritmo atual até o fim do mês, esse é o valor estimado de fechamento. Calculado multiplicando seu ritmo diário pelo total de dias úteis do mês.
            </p>
          </>
        }
      >
        <p className="text-sm font-bold tabular-nums font-mono text-white leading-none pr-4">
          {diasUteisPassados > 0 ? formatCurrency(projecao) : "—"}
        </p>
        <p className="text-[9px] font-mono mt-1 text-white/40">
          Projeção de fechamento
        </p>
      </PremiumCard>
    </>
  );
}
