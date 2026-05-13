import { useState } from "react";
import {
  Target, TrendingUp, Activity, Zap, BarChart2,
  Pencil, Check, X, RefreshCw, Clock, HelpCircle,
  ChevronUp, ChevronDown
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatCurrency } from "@/lib/formatters";
import { useOSGerencial } from "@/hooks/useOSGerencial";

interface Props {
  dataInicio?: Date;
  dataFim?: Date;
  onAbrirOS?: (id: string) => void;
}

// ─── helpers visuais ────────────────────────────────────────────────────────

function hexToRgbStr(hex: string): string {
  const c = hex.replace("#", "");
  if (c.length !== 6) return "59 130 246";
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return `${r} ${g} ${b}`;
}

interface GlowCardProps {
  cor: string;
  label: string;
  icon: React.ReactNode;
  iconBg: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}

function GlowCard({ cor, label, icon, iconBg, children, action }: GlowCardProps) {
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
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent 10%, rgba(${rgb} / 0.6) 50%, transparent 90%)` }}
      />
      <div
        className="absolute top-0 right-0 h-16 w-16 opacity-10 pointer-events-none"
        style={{ background: `radial-gradient(circle at 100% 0%, ${cor} 0%, transparent 70%)` }}
      />
      <div className="relative flex items-start justify-between mb-2.5">
        <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/70">
          {label}
        </span>
        <div className="flex items-center gap-1.5">
          {action}
          <div className={`h-7 w-7 rounded-lg border flex items-center justify-center shrink-0 ${iconBg}`}>
            {icon}
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}

function MiniCard({
  label, count, valor, cor,
}: {
  label: string; count: number; valor: number; cor: string;
}) {
  const rgb = hexToRgbStr(cor);
  return (
    <div
      className="relative overflow-hidden rounded-xl border bg-card p-3 transition-all duration-200"
      style={{ borderColor: `rgba(${rgb} / 0.25)`, boxShadow: `inset 0 1px 0 0 rgba(${rgb} / 0.12)` }}
    >
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent 10%, rgba(${rgb} / 0.5) 50%, transparent 90%)` }}
      />
      <p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/60 mb-1.5">{label}</p>
      <p className="text-2xl font-black tabular-nums tracking-tight font-mono" style={{ color: cor }}>{count}</p>
      <p className="text-[10px] font-mono text-muted-foreground/60 mt-0.5">{formatCurrency(valor)}</p>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border bg-card p-4 space-y-2">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-7 w-32" />
      <Skeleton className="h-3 w-24" />
    </div>
  );
}

function corBorda(dias: number) {
  if (dias >= 3) return "border-red-500/70";
  if (dias >= 1) return "border-yellow-500/70";
  return "border-green-500/70";
}

function corTextoStatus(status: string) {
  const map: Record<string, string> = {
    pendente: "text-yellow-500",
    aguardando_aprovacao: "text-amber-500",
    em_andamento: "text-blue-500",
    concluida: "text-emerald-500",
    finalizado: "text-green-600",
    entregue: "text-purple-500",
    aguardando_retirada: "text-orange-500",
    cancelada: "text-red-500",
  };
  return map[status] ?? "text-muted-foreground";
}

function labelStatus(status: string) {
  const map: Record<string, string> = {
    pendente: "Pendente",
    aguardando_aprovacao: "Aguard. aprovação",
    em_andamento: "Em andamento",
    concluida: "Concluída",
    finalizado: "Finalizado",
    entregue: "Entregue",
    aguardando_retirada: "Aguard. retirada",
    cancelada: "Cancelada",
    garantia: "Garantia",
    estornado: "Estornado",
  };
  return map[status] ?? status;
}

// ─── Componente principal ────────────────────────────────────────────────────

export function OSGerencialCards({ dataInicio, dataFim, onAbrirOS }: Props) {
  const { data, diasUteis, meta, carregando, erro, carregar, salvarMeta } =
    useOSGerencial(dataInicio, dataFim);

  const [editandoMeta, setEditandoMeta] = useState(false);
  const [inputMeta, setInputMeta] = useState("");
  const [expandido, setExpandido] = useState(() => {
    const salvo = localStorage.getItem("os_cards_gerenciais_expandido");
    return salvo === null ? true : salvo === "true";
  });

  function toggleExpandido() {
    setExpandido((prev) => {
      const proximo = !prev;
      localStorage.setItem("os_cards_gerenciais_expandido", String(proximo));
      return proximo;
    });
  }

  const { diasUteisMes, diasUteisPassados } = diasUteis;

  // ── derived ────────────────────────────────────────────────────────────────
  const valorRealizado = data?.valorRealizado ?? 0;
  const metaValor = meta ?? 0;

  const pctMeta = metaValor > 0 ? Math.min((valorRealizado / metaValor) * 100, 100) : 0;
  const pctEsperado =
    diasUteisMes > 0 ? (diasUteisPassados / diasUteisMes) * 100 : 0;
  const pctReal = metaValor > 0 ? (valorRealizado / metaValor) * 100 : 0;

  const ritmoDiario =
    diasUteisPassados > 0 ? valorRealizado / diasUteisPassados : 0;
  const projecao = ritmoDiario * diasUteisMes;

  // cores semáforo
  const corMeta =
    pctMeta >= 80 ? "#22c55e" : pctMeta >= 50 ? "#eab308" : "#ef4444";
  const ratioSemaforo = pctEsperado > 0 ? pctReal / pctEsperado : 0;
  const corSemaforo =
    ratioSemaforo >= 1 ? "#22c55e" : ratioSemaforo >= 0.7 ? "#eab308" : "#ef4444";
  const labelSemaforo =
    ratioSemaforo >= 1 ? "No ritmo" : ratioSemaforo >= 0.7 ? "Atenção" : "Crítico";
  const corProjecao =
    metaValor > 0 && projecao >= metaValor
      ? "#22c55e"
      : metaValor > 0 && projecao >= metaValor * 0.8
      ? "#eab308"
      : "#ef4444";

  // ── salvar meta ──────────────────────────────────────────────────────────
  async function confirmarMeta() {
    const val = parseFloat(inputMeta.replace(",", "."));
    if (isNaN(val) || val <= 0) return;
    await salvarMeta(val);
    setEditandoMeta(false);
  }

  function abrirEdicaoMeta() {
    setInputMeta(metaValor > 0 ? String(metaValor) : "");
    setEditandoMeta(true);
  }

  // ── loading ───────────────────────────────────────────────────────────────
  if (carregando) {
    return (
      <div className="space-y-4 mt-6">
        <div className="h-px bg-border/40 my-2" />
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    );
  }

  // ── erro ─────────────────────────────────────────────────────────────────
  if (erro) {
    return (
      <div className="mt-6 rounded-xl border border-destructive/30 bg-destructive/5 p-4 flex items-center justify-between gap-3">
        <p className="text-sm text-destructive">{erro}</p>
        <Button size="sm" variant="outline" onClick={carregar} className="gap-1.5 shrink-0">
          <RefreshCw className="h-3.5 w-3.5" /> Tentar novamente
        </Button>
      </div>
    );
  }

  if (!data) return null;

  const ind = data.indicadores;

  return (
    <div className="space-y-4 mt-6">
      {/* divisor */}
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border/40" />
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/50">
          Painel Gerencial
        </span>
        <div className="h-px flex-1 bg-border/40" />
        <button
          onClick={toggleExpandido}
          className="flex items-center gap-1.5 text-xs font-medium text-blue-400 border border-blue-500/40 bg-blue-500/10 hover:bg-blue-500/20 hover:text-blue-300 hover:border-blue-400/60 transition-all px-3 py-1.5 rounded-lg shrink-0"
        >
          {expandido ? (
            <><ChevronUp className="h-3.5 w-3.5 shrink-0" /><span>Ocultar painel</span></>
          ) : (
            <><ChevronDown className="h-3.5 w-3.5 shrink-0" /><span>Ver painel gerencial</span></>
          )}
        </button>
      </div>

      {/* ── Conteúdo colapsável ───────────────────────────────────────────── */}
      <div
        style={{
          maxHeight: expandido ? "2000px" : "0px",
          opacity: expandido ? 1 : 0,
          overflow: "hidden",
          transition: "max-height 300ms ease-in-out, opacity 300ms ease-in-out",
        }}
      >

      {/* ── 5 cards gerenciais ────────────────────────────────────────────── */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">

        {/* Card 1 — META OS */}
        <GlowCard
          cor={corMeta}
          label="Meta OS"
          icon={<Target className="h-3.5 w-3.5" style={{ color: corMeta }} />}
          iconBg={`bg-[${corMeta}]/10 border-[${corMeta}]/20`}
          action={
            !editandoMeta ? (
              <button
                onClick={abrirEdicaoMeta}
                className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                title="Editar meta"
              >
                <Pencil className="h-3 w-3" />
              </button>
            ) : undefined
          }
        >
          {editandoMeta ? (
            <div className="space-y-1.5">
              <Input
                autoFocus
                className="h-7 text-xs font-mono"
                placeholder="Ex: 15000"
                value={inputMeta}
                onChange={(e) => setInputMeta(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") confirmarMeta(); if (e.key === "Escape") setEditandoMeta(false); }}
              />
              <div className="flex gap-1">
                <Button size="sm" className="h-6 text-[10px] px-2 flex-1 gap-1" onClick={confirmarMeta}>
                  <Check className="h-2.5 w-2.5" /> Salvar
                </Button>
                <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2" onClick={() => setEditandoMeta(false)}>
                  <X className="h-2.5 w-2.5" />
                </Button>
              </div>
            </div>
          ) : metaValor > 0 ? (
            <div className="space-y-1.5">
              <p className="text-lg font-black tabular-nums tracking-tight font-mono" style={{ color: corMeta }}>
                {formatCurrency(valorRealizado)}
              </p>
              {/* barra de progresso */}
              <div className="h-1.5 w-full rounded-full bg-muted/50 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pctMeta}%`, backgroundColor: corMeta }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground/60 font-mono">
                {pctMeta.toFixed(0)}% da meta — faltam{" "}
                {formatCurrency(Math.max(0, metaValor - valorRealizado))}
              </p>
            </div>
          ) : (
            <div className="space-y-1.5 pt-1">
              <p className="text-lg font-black tabular-nums tracking-tight font-mono text-muted-foreground/40">
                {formatCurrency(valorRealizado)}
              </p>
              <Button
                size="sm"
                variant="outline"
                className="h-6 text-[10px] px-2 gap-1 w-full"
                onClick={abrirEdicaoMeta}
              >
                <Target className="h-2.5 w-2.5" /> Definir meta do mês
              </Button>
            </div>
          )}
        </GlowCard>

        {/* Card 2 — OS EM FLUXO */}
        <GlowCard
          cor="#3b82f6"
          label="OS em Fluxo"
          icon={<Activity className="h-3.5 w-3.5 text-blue-400" />}
          iconBg="bg-blue-500/10 border-blue-500/20"
        >
          <p className="text-2xl font-black tabular-nums tracking-tight font-mono text-blue-500">
            {formatCurrency(data.valorEmFluxo)}
          </p>
          <p className="text-[10px] text-muted-foreground/60 mt-1">
            {data.countEmFluxo}{" "}
            {data.countEmFluxo === 1 ? "OS ainda não finalizada" : "OS ainda não finalizadas"}
          </p>
        </GlowCard>

        {/* Card 3 — SEMÁFORO */}
        <GlowCard
          cor={corSemaforo}
          label="Semáforo"
          icon={<TrendingUp className="h-3.5 w-3.5" style={{ color: corSemaforo }} />}
          iconBg="bg-muted/30 border-border/40"
          action={
            <Popover>
              <PopoverTrigger asChild>
                <button
                  className="text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors focus:outline-none"
                  aria-label="Como funciona o Semáforo?"
                >
                  <HelpCircle className="h-3.5 w-3.5" />
                </button>
              </PopoverTrigger>
              <PopoverContent side="bottom" align="end" className="w-72 text-xs space-y-2">
                <p className="font-semibold text-sm">Como funciona o Semáforo?</p>
                <p className="text-muted-foreground leading-relaxed">
                  Compara o que você já fez com o que era esperado para esse momento do mês.
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  Se o mês tem 22 dias úteis e hoje é o dia 11, o esperado é que você já tenha feito 50% da sua meta.
                </p>
                <ul className="space-y-1 text-muted-foreground">
                  <li>🟢 <span className="font-medium text-foreground">No ritmo</span> — você está igual ou acima do esperado</li>
                  <li>🟡 <span className="font-medium text-foreground">Atenção</span> — você está um pouco abaixo do esperado</li>
                  <li>🔴 <span className="font-medium text-foreground">Crítico</span> — você está muito abaixo do esperado</li>
                </ul>
                <p className="text-muted-foreground/70 italic">Defina uma meta mensal para ativar o semáforo.</p>
              </PopoverContent>
            </Popover>
          }
        >
          {metaValor > 0 ? (
            <div className="space-y-1">
              <p className="text-base font-black tracking-tight" style={{ color: corSemaforo }}>
                {labelSemaforo}
              </p>
              <p className="text-[10px] text-muted-foreground/60 font-mono">
                Real {pctReal.toFixed(0)}% — Esperado {pctEsperado.toFixed(0)}%
              </p>
            </div>
          ) : (
            <p className="text-[10px] text-muted-foreground/50 pt-1 leading-relaxed">
              Defina uma meta para ver o semáforo
            </p>
          )}
        </GlowCard>

        {/* Card 4 — RITMO DIÁRIO */}
        <GlowCard
          cor="#8b5cf6"
          label="Ritmo Diário"
          icon={<Zap className="h-3.5 w-3.5 text-violet-400" />}
          iconBg="bg-violet-500/10 border-violet-500/20"
        >
          <p className="text-lg font-black tabular-nums tracking-tight font-mono text-violet-500">
            {diasUteisPassados > 0 ? formatCurrency(ritmoDiario) : "—"}
          </p>
          <p className="text-[10px] text-muted-foreground/60 mt-1">
            Média por dia útil ({diasUteisPassados} de {diasUteisMes} dias)
          </p>
        </GlowCard>

        {/* Card 5 — PROJEÇÃO */}
        <GlowCard
          cor={metaValor > 0 ? corProjecao : "#6b7280"}
          label="Projeção"
          icon={<BarChart2 className="h-3.5 w-3.5" style={{ color: metaValor > 0 ? corProjecao : "#6b7280" }} />}
          iconBg="bg-muted/30 border-border/40"
        >
          <p
            className="text-lg font-black tabular-nums tracking-tight font-mono"
            style={{ color: metaValor > 0 ? corProjecao : "#6b7280" }}
          >
            {diasUteisPassados > 0 ? formatCurrency(projecao) : "—"}
          </p>
          <p className="text-[10px] text-muted-foreground/60 mt-1">
            Projeção de fechamento do mês
          </p>
        </GlowCard>
      </div>

      {/* ── Indicadores por status ────────────────────────────────────────── */}
      <div className="grid gap-2 grid-cols-3 sm:grid-cols-3 lg:grid-cols-6">
        <MiniCard label="Total" count={ind.total} valor={ind.totalValor} cor="#6b7280" />
        <MiniCard label="Em aberto" count={ind.pendente} valor={ind.pendenteValor} cor="#eab308" />
        <MiniCard label="Em manutenção" count={ind.emAndamento} valor={ind.emAndamentoValor} cor="#3b82f6" />
        <MiniCard label="Concluída" count={ind.concluida} valor={ind.concluidaValor} cor="#22c55e" />
        <MiniCard
          label="Aguard. retirada"
          count={ind.aguardandoRetirada}
          valor={ind.aguardandoRetiradaValor}
          cor="#f97316"
        />
        <MiniCard
          label="Finalizada"
          count={ind.finalizado + ind.entregue}
          valor={ind.finalizadoValor + ind.entregueValor}
          cor="#a855f7"
        />
      </div>

      {/* ── Kanban por tempo parado ──────────────────────────────────────── */}
      {data.osParadas.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/50">
            OS em aberto — mais antigas primeiro
          </p>
          <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {data.osParadas.map((os) => (
              <div
                key={os.id}
                onClick={() => onAbrirOS?.(os.id)}
                className={`relative overflow-hidden rounded-xl border-2 bg-card p-3 ${corBorda(os.diasParada)} ${onAbrirOS ? "cursor-pointer hover:brightness-110 transition-[filter]" : ""}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground/90 truncate">
                      #{os.numero_os} — {os.cliente_nome}
                    </p>
                    <p className={`text-[10px] font-medium mt-0.5 ${corTextoStatus(os.status)}`}>
                      {labelStatus(os.status)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs font-black font-mono text-foreground/80">
                      {formatCurrency(os.total)}
                    </p>
                    <div className="flex items-center gap-1 justify-end mt-0.5">
                      <Clock className="h-2.5 w-2.5 text-muted-foreground/50" />
                      <p className="text-[10px] text-muted-foreground/60">
                        {os.diasParada === 0
                          ? "Hoje"
                          : `${os.diasParada}d parada`}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Maiores OS abertas ────────────────────────────────────────────── */}
      {data.maioresOS.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/50">
            Maiores OS pendentes — por valor
          </p>
          <div className="rounded-xl border border-border/40 bg-card overflow-hidden">
            {data.maioresOS.map((os, i) => (
              <div
                key={os.id}
                onClick={() => onAbrirOS?.(os.id)}
                className={`flex items-center justify-between gap-3 px-4 py-2.5 ${
                  i < data.maioresOS.length - 1 ? "border-b border-border/30" : ""
                } ${onAbrirOS ? "cursor-pointer hover:bg-muted/40 transition-colors" : ""}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-[10px] font-mono text-muted-foreground/40 shrink-0 w-4 text-right">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground/90 truncate">
                      #{os.numero_os} — {os.cliente_nome}
                    </p>
                    <p className={`text-[10px] ${corTextoStatus(os.status)}`}>
                      {labelStatus(os.status)}
                    </p>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs font-black font-mono text-foreground/80">
                    {formatCurrency(os.total)}
                  </p>
                  {os.diasParada > 0 && (
                    <p className="text-[10px] text-muted-foreground/50">
                      {os.diasParada}d parada
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* sem dados */}
      {ind.total === 0 && (
        <div className="rounded-xl border border-border/30 bg-muted/10 p-6 text-center">
          <p className="text-sm text-muted-foreground/60">
            Nenhuma OS encontrada para o período selecionado.
          </p>
        </div>
      )}

      </div>{/* fim colapsável */}
    </div>
  );
}
