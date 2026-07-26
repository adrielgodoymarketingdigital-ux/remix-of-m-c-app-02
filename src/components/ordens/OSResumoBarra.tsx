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

// ── Popover de ajuda ─────────────────────────────────────────────────────────

function HelpButton({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="absolute top-1.5 right-1.5 flex items-center justify-center h-4 w-4 rounded-full bg-muted border border-border text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors focus:outline-none"
          aria-label={title}
        >
          <HelpCircle className="h-2.5 w-2.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="bottom" align="end" className="w-72 text-xs space-y-2">
        {children}
      </PopoverContent>
    </Popover>
  );
}

// ── Skeleton ─────────────────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-lg border border-border/50 bg-card p-2 animate-pulse flex flex-col">
      <div className="h-6 w-6 rounded-md bg-muted mb-1" />
      <div className="h-[3.6em] w-full rounded bg-muted mb-1" />
      <div className="h-4 w-12 rounded bg-muted" />
    </div>
  );
}

// ── Card premium ─────────────────────────────────────────────────────────────

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
      className="relative overflow-hidden rounded-lg border border-border/50 bg-card px-1.5 py-2 flex flex-col transition-opacity duration-500"
      style={{ opacity: visible ? 1 : 0 }}
    >
      <span
        className="absolute top-1.5 right-6 h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: cor }}
      />
      <div
        className="h-6 w-6 rounded-md flex items-center justify-center mb-1"
        style={{ backgroundColor: `${cor}1a` }}
      >
        <span style={{ color: cor }}>{icon}</span>
      </div>
      <p className="text-[9px] font-medium text-foreground leading-[1.2] min-h-[3.6em] uppercase tracking-wide">
        {label}
      </p>

      {children}

      <HelpButton title={helpTitle}>{helpContent}</HelpButton>
    </div>
  );
}

// ── Barra de progresso ───────────────────────────────────────────────────────

function ProgressBar({ pct, cor, visible }: { pct: number; cor: string; visible: boolean }) {
  return (
    <div className="h-1 w-full rounded-full bg-muted overflow-hidden mt-1">
      <div
        className="h-full rounded-full transition-all duration-700 ease-out"
        style={{
          width: visible ? `${pct}%` : "0%",
          backgroundColor: cor,
        }}
      />
    </div>
  );
}

// ── Snapshot type ─────────────────────────────────────────────────────────────

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

// ── Orquestrador (não renderiza nada, expõe snapshot via hook) ───────────────

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
  const corMeta = metaValor > 0 ? (pctMeta >= 80 ? "#22c55e" : pctMeta >= 50 ? "#eab308" : "#ef4444") : "#6b7280";
  const ratioSemaforo = pctEsperado > 0 ? pctReal / pctEsperado : 0;
  const corSemaforo = metaValor > 0 ? (ratioSemaforo >= 1 ? "#22c55e" : ratioSemaforo >= 0.7 ? "#eab308" : "#ef4444") : "#6b7280";
  const labelSemaforo = ratioSemaforo >= 1 ? "No ritmo" : ratioSemaforo >= 0.7 ? "Atenção" : "Crítico";
  const corRitmo = metaValor > 0 ? (ritmoDiario * diasUteisMes >= metaValor ? "#22c55e" : ritmoDiario * diasUteisMes >= metaValor * 0.8 ? "#eab308" : "#ef4444") : "#6b7280";
  const corProjecao = metaValor > 0 ? (projecao >= metaValor ? "#22c55e" : projecao >= metaValor * 0.8 ? "#eab308" : "#ef4444") : "#6b7280";

  const snapshot: OSGerencialSnapshot = {
    valorRealizado, metaValor, osParadasCount,
    osParadas: data?.osParadas ?? [], pctMeta, pctEsperado, pctReal,
    ritmoDiario, projecao, diasUteisMes, diasUteisPassados,
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
    <div className="flex items-center gap-3 rounded-xl border border-amber-500/40 bg-amber-500/8 px-4 py-2.5">
      <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-amber-500/15 border border-amber-500/30 shrink-0">
        <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-foreground leading-snug">
          <span className="font-semibold text-amber-500">Atenção imediata</span>
          {" — "}
          {snapshot.osParadasCount === 1
            ? "1 OS com 3 dias ou mais parada."
            : `${snapshot.osParadasCount} OS com 3 dias ou mais paradas.`}
          {" "}
          <span className="text-muted-foreground">Elas precisam de ação agora.</span>
        </p>
      </div>
      <button
        onClick={onVerOSParadas}
        className="shrink-0 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-[11px] font-medium text-amber-500 hover:bg-amber-500/20 hover:text-amber-400 transition-colors"
      >
        Ver OS paradas
      </button>
    </div>
  );
}

// ── 4 cards gerenciais ────────────────────────────────────────────────────────
// Renderiza os 4 filhos diretos — o pai deve envolvê-los em grid grid-cols-4

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
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </>
    );
  }

  return (
    <>
      {/* META OS */}
      {editandoMeta ? (
        <div className="relative overflow-hidden rounded-lg border border-border bg-card p-2 flex flex-col gap-1.5">
          <p className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">Meta OS</p>
          <Input
            autoFocus
            className="h-6 text-[10px] font-mono px-1.5"
            placeholder="Ex: 15000"
            value={inputMeta}
            onChange={(e) => setInputMeta(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") confirmarMeta();
              if (e.key === "Escape") setEditandoMeta(false);
            }}
          />
          <div className="flex gap-1">
            <button
              onClick={confirmarMeta}
              className="flex items-center gap-1 rounded-md bg-green-500/20 border border-green-500/30 px-1.5 py-1 text-[9px] text-green-400 hover:bg-green-500/30 transition-colors"
            >
              <Check className="h-2.5 w-2.5" /> Salvar
            </button>
            <button
              onClick={() => setEditandoMeta(false)}
              className="flex items-center gap-1 rounded-md border border-border bg-muted px-1.5 py-1 text-[9px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-2.5 w-2.5" /> Cancelar
            </button>
          </div>
        </div>
      ) : (
        <PremiumCard
          cor={corMeta}
          icon={<Target className="h-3 w-3" style={{ color: corMeta }} />}
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
              <p className="text-xs font-bold tabular-nums text-foreground leading-tight mt-0.5">
                {formatCurrency(valorRealizado)}
              </p>
              <ProgressBar pct={pctMeta} cor={corMeta} visible={visible} />
              <p className="text-[9px] mt-1 text-muted-foreground">
                {pctMeta.toFixed(0)}% da meta
              </p>
            </>
          ) : (
            <>
              <p className="text-xs font-bold tabular-nums text-muted-foreground leading-tight mt-0.5">
                {formatCurrency(valorRealizado)}
              </p>
              <button
                onClick={abrirEdicao}
                className="mt-1 flex items-center gap-1 text-[9px] text-muted-foreground hover:text-foreground transition-colors"
              >
                <Pencil className="h-2.5 w-2.5" />
                Definir meta
              </button>
            </>
          )}
          {/* lápis de edição */}
          {metaValor > 0 && (
            <button
              onClick={abrirEdicao}
              className="absolute bottom-1.5 right-1.5 text-muted-foreground/30 hover:text-muted-foreground transition-colors"
              title="Editar meta"
            >
              <Pencil className="h-2.5 w-2.5" />
            </button>
          )}
        </PremiumCard>
      )}

      {/* SEMÁFORO */}
      <PremiumCard
        cor={corSemaforo}
        icon={<TrendingUp className="h-3 w-3" style={{ color: corSemaforo }} />}
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
            <p className="text-xs font-bold leading-tight mt-0.5" style={{ color: corSemaforo }}>
              {labelSemaforo}
            </p>
            <p className="text-[9px] mt-1 text-muted-foreground">
              Real {pctReal.toFixed(0)}% / Esp. {pctEsperado.toFixed(0)}%
            </p>
          </>
        ) : (
          <>
            <p className="text-xs font-bold text-muted-foreground/30 leading-tight mt-0.5">—</p>
            <p className="text-[9px] mt-1 text-muted-foreground">Defina uma meta</p>
          </>
        )}
      </PremiumCard>

      {/* RITMO DIÁRIO */}
      <PremiumCard
        cor={corRitmo}
        icon={<Zap className="h-3 w-3" style={{ color: corRitmo }} />}
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
        <p className="text-xs font-bold tabular-nums text-foreground leading-tight mt-0.5">
          {diasUteisPassados > 0 ? formatCurrency(ritmoDiario) : "—"}
        </p>
        <p className="text-[9px] mt-1 text-muted-foreground">
          {diasUteisPassados}/{diasUteisMes} dias úteis
        </p>
      </PremiumCard>

      {/* PROJEÇÃO */}
      <PremiumCard
        cor={corProjecao}
        icon={<BarChart2 className="h-3 w-3" style={{ color: corProjecao }} />}
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
        <p className="text-xs font-bold tabular-nums text-foreground leading-tight mt-0.5">
          {diasUteisPassados > 0 ? formatCurrency(projecao) : "—"}
        </p>
        <p className="text-[9px] mt-1 text-muted-foreground">
          Fechamento do mês
        </p>
      </PremiumCard>
    </>
  );
}
