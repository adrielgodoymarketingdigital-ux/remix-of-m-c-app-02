import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAssinatura } from "@/hooks/useAssinatura";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Lock, Plus, Home, TrendingUp, Target, Bell, Info, X,
  ChevronDown, ChevronUp, ExternalLink, AlertTriangle, RefreshCw,
  Pencil, UserCog, Trash2, Calendar, Download, BarChart2, FileText,
  CreditCard, Package, Trophy, Activity, Layers, LayoutDashboard,
  ArrowUpRight, ArrowDownRight, Minus, TrendingDown, Zap, CheckCircle2,
  Clock, ShoppingBag, DollarSign, Users, BarChart, PieChart as PieChartIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
  BarChart as ReBarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend, LineChart, Line, CartesianGrid, RadarChart,
  PolarGrid, PolarAngleAxis, Radar,
} from "recharts";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface VendaPorForma {
  forma: string; label: string; total: number; quantidade: number;
}
interface TopProduto {
  id: string; nome: string; tipo: string; label: string; total: number; quantidade: number;
}
interface MetricasEmpresa {
  faturamento_mes: number; faturamento_os: number; faturamento_vendas: number;
  os_mes: number; os_em_aberto: number; os_finalizadas: number;
  vendas_mes: number; ultimas_vendas: VendaItem[];
  vendas_por_tipo: VendaTipo[]; vendas_por_forma: VendaPorForma[];
  top_produtos: TopProduto[];
}
interface VendaItem {
  id: string; data: string; tipo: string; label: string; nome: string;
  cliente: string | null; valor: number; forma_pagamento: string; quantidade: number;
}
interface VendaTipo { tipo: string; label: string; total: number; quantidade: number; }
interface Meta {
  id: string; empresa_id: string; tipo: "faturamento" | "os" | "vendas" | "clientes";
  valor: number; periodo: "mensal" | "semanal";
}
interface EmpresaCard {
  id: string; nome: string; tipo: string; cidade: string | null; estado: string | null;
  cnpj: string | null; telefone: string | null; proprietario_id: string;
  metricas: MetricasEmpresa; metas: Meta[];
}
type TipoPeriodo = "mes_atual" | "mes_passado" | "trimestre" | "semestre" | "ano" | "customizado";
interface Periodo { tipo: TipoPeriodo; data_inicio: string; data_fim: string; }
type AbaAtiva = "dashboard" | "empresas" | "relatorios";

// ─── Constantes ───────────────────────────────────────────────────────────────

const CORES = ["#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#ef4444", "#06b6d4"];
const COR_FORMA: Record<string, string> = {
  pix: "#10b981", dinheiro: "#3b82f6", cartao_credito: "#8b5cf6",
  cartao_debito: "#6366f1", a_receber: "#f59e0b", a_prazo: "#ef4444",
};
const TIPO_COR: Record<string, string> = {
  produto: "text-violet-400", peca: "text-blue-400",
  servico: "text-emerald-400", dispositivo: "text-amber-400", servico_avulso: "text-pink-400",
};
const PERIODOS_OPCOES: { valor: TipoPeriodo; label: string }[] = [
  { valor: "mes_atual", label: "Mês atual" },
  { valor: "mes_passado", label: "Mês passado" },
  { valor: "trimestre", label: "Últimos 3 meses" },
  { valor: "semestre", label: "Últimos 6 meses" },
  { valor: "ano", label: "Este ano" },
  { valor: "customizado", label: "Personalizado" },
];

// ─── Utils ────────────────────────────────────────────────────────────────────

function calcularPeriodo(tipo: TipoPeriodo): { data_inicio: string; data_fim: string } {
  const hoje = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  if (tipo === "mes_atual") { const ini = new Date(hoje.getFullYear(), hoje.getMonth(), 1); return { data_inicio: fmt(ini), data_fim: fmt(hoje) }; }
  if (tipo === "mes_passado") { const ini = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1); const fim = new Date(hoje.getFullYear(), hoje.getMonth(), 0); return { data_inicio: fmt(ini), data_fim: fmt(fim) }; }
  if (tipo === "trimestre") { const ini = new Date(hoje.getFullYear(), hoje.getMonth() - 2, 1); return { data_inicio: fmt(ini), data_fim: fmt(hoje) }; }
  if (tipo === "semestre") { const ini = new Date(hoje.getFullYear(), hoje.getMonth() - 5, 1); return { data_inicio: fmt(ini), data_fim: fmt(hoje) }; }
  if (tipo === "ano") { const ini = new Date(hoje.getFullYear(), 0, 1); return { data_inicio: fmt(ini), data_fim: fmt(hoje) }; }
  return { data_inicio: fmt(new Date(hoje.getFullYear(), hoje.getMonth(), 1)), data_fim: fmt(hoje) };
}

const formatarMoeda = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const formatarData = (iso: string) => { if (!iso) return ""; const [y, m, d] = iso.split("-"); return `${d}/${m}/${y}`; };
const formatarMoedaCompacta = (v: number) => formatarMoeda(v);

// ─── Seletor de Período ───────────────────────────────────────────────────────

function SeletorPeriodo({ periodo, onChange }: { periodo: Periodo; onChange: (p: Periodo) => void }) {
  const [customInicio, setCustomInicio] = useState(periodo.data_inicio);
  const [customFim, setCustomFim] = useState(periodo.data_fim);

  const handleTipo = (tipo: TipoPeriodo) => {
    if (tipo === "customizado") { onChange({ tipo, data_inicio: customInicio, data_fim: customFim }); }
    else { const datas = calcularPeriodo(tipo); onChange({ tipo, ...datas }); }
  };
  const aplicarCustom = () => {
    if (!customInicio || !customFim) return;
    if (customInicio > customFim) { toast.error("Data inicial não pode ser maior que a final"); return; }
    onChange({ tipo: "customizado", data_inicio: customInicio, data_fim: customFim });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Calendar className="h-3.5 w-3.5" /><span>Período:</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {PERIODOS_OPCOES.map(op => (
          <button key={op.valor} onClick={() => handleTipo(op.valor)}
            className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${periodo.tipo === op.valor ? "bg-blue-500 text-white border-blue-500" : "border-border/60 text-muted-foreground hover:text-foreground hover:border-border"}`}>
            {op.label}
          </button>
        ))}
      </div>
      {periodo.tipo === "customizado" && (
        <div className="flex items-center gap-1.5">
          <Input type="date" value={customInicio} onChange={e => setCustomInicio(e.target.value)} className="h-7 text-xs w-36" />
          <span className="text-xs text-muted-foreground">até</span>
          <Input type="date" value={customFim} onChange={e => setCustomFim(e.target.value)} className="h-7 text-xs w-36" />
          <Button size="sm" className="h-7 text-xs px-2" onClick={aplicarCustom}>Aplicar</Button>
        </div>
      )}
      {periodo.tipo !== "customizado" && (
        <span className="text-xs text-muted-foreground">({formatarData(periodo.data_inicio)} – {formatarData(periodo.data_fim)})</span>
      )}
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ titulo, valor, sub, icon: Icon, cor, variacao }: {
  titulo: string; valor: string; sub?: string;
  icon: React.ElementType; cor: string; variacao?: number;
}) {
  return (
    <Card className={`border-l-4`} style={{ borderLeftColor: cor }}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider truncate">{titulo}</p>
            <p className="text-2xl font-bold mt-0.5 truncate" style={{ color: cor }}>{valor}</p>
            {sub && <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{sub}</p>}
          </div>
          <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${cor}18` }}>
            <Icon className="h-5 w-5" style={{ color: cor }} />
          </div>
        </div>
        {variacao !== undefined && (
          <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${variacao > 0 ? "text-emerald-500" : variacao < 0 ? "text-red-500" : "text-muted-foreground"}`}>
            {variacao > 0 ? <ArrowUpRight className="h-3 w-3" /> : variacao < 0 ? <ArrowDownRight className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
            {variacao > 0 ? "+" : ""}{variacao.toFixed(1)}% vs período anterior
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Dashboard Principal ──────────────────────────────────────────────────────

function DashboardConsolidada({ empresas, isLoading, periodo, onAbrirMetas }: {
  empresas: EmpresaCard[];
  isLoading: boolean;
  periodo: Periodo;
  onAbrirMetas: (e: EmpresaCard) => void;
}) {
  const fatTotal = useMemo(() => empresas.reduce((s, e) => s + e.metricas.faturamento_mes, 0), [empresas]);
  const osTotal = useMemo(() => empresas.reduce((s, e) => s + e.metricas.os_mes, 0), [empresas]);
  const osAbertas = useMemo(() => empresas.reduce((s, e) => s + e.metricas.os_em_aberto, 0), [empresas]);
  const osFinalizadas = useMemo(() => empresas.reduce((s, e) => s + e.metricas.os_finalizadas, 0), [empresas]);
  const vendasTotal = useMemo(() => empresas.reduce((s, e) => s + e.metricas.vendas_mes, 0), [empresas]);
  const fatOS = useMemo(() => empresas.reduce((s, e) => s + (e.metricas.faturamento_os ?? 0), 0), [empresas]);
  const fatVendas = useMemo(() => empresas.reduce((s, e) => s + (e.metricas.faturamento_vendas ?? 0), 0), [empresas]);
  const ticketMedioGlobal = osTotal > 0 ? fatTotal / osTotal : 0;
  const taxaFinalizacao = osTotal > 0 ? Math.round((osFinalizadas / osTotal) * 100) : 0;

  // Ranking faturamento por empresa
  const ranking = useMemo(() =>
    [...empresas].sort((a, b) => b.metricas.faturamento_mes - a.metricas.faturamento_mes),
    [empresas]
  );

  // Dados para gráfico de barras comparativo
  const dadosBarras = useMemo(() =>
    empresas.map((e, i) => ({
      nome: e.nome.length > 12 ? e.nome.slice(0, 12) + "…" : e.nome,
      Faturamento: e.metricas.faturamento_mes,
      OS: e.metricas.os_mes,
      Vendas: e.metricas.vendas_mes,
      cor: e.tipo === "matriz" ? "#f59e0b" : CORES[i % CORES.length],
    })),
    [empresas]
  );

  // Top produtos consolidado
  const topProdutosConsolidado = useMemo(() => {
    const mapa: Record<string, { nome: string; tipo: string; label: string; total: number; quantidade: number }> = {};
    for (const emp of empresas) {
      for (const p of (emp.metricas.top_produtos || [])) {
        if (!mapa[p.nome]) mapa[p.nome] = { nome: p.nome, tipo: p.tipo, label: p.label, total: 0, quantidade: 0 };
        mapa[p.nome].total += p.total;
        mapa[p.nome].quantidade += p.quantidade;
      }
    }
    return Object.values(mapa).sort((a, b) => b.total - a.total).slice(0, 8);
  }, [empresas]);

  // Formas de pagamento consolidado
  const formasConsolidado = useMemo(() => {
    const mapa: Record<string, { label: string; total: number; quantidade: number }> = {};
    for (const emp of empresas) {
      for (const f of (emp.metricas.vendas_por_forma || [])) {
        if (!mapa[f.forma]) mapa[f.forma] = { label: f.label, total: 0, quantidade: 0 };
        mapa[f.forma].total += f.total;
        mapa[f.forma].quantidade += f.quantidade;
      }
    }
    return Object.entries(mapa).map(([forma, v]) => ({ forma, ...v })).sort((a, b) => b.total - a.total);
  }, [empresas]);

  // Dados radar para comparativo multidimensional
  const dadosRadar = useMemo(() => {
    if (empresas.length < 2) return [];
    const maxFat = Math.max(...empresas.map(e => e.metricas.faturamento_mes)) || 1;
    const maxOS = Math.max(...empresas.map(e => e.metricas.os_mes)) || 1;
    const maxVendas = Math.max(...empresas.map(e => e.metricas.vendas_mes)) || 1;
    const maxFin = Math.max(...empresas.map(e => e.metricas.os_finalizadas)) || 1;
    const maxTicket = Math.max(...empresas.map(e => e.metricas.os_mes > 0 ? e.metricas.faturamento_mes / e.metricas.os_mes : 0)) || 1;

    return [
      { indicador: "Faturamento", ...Object.fromEntries(empresas.map(e => [e.nome, Math.round((e.metricas.faturamento_mes / maxFat) * 100)])) },
      { indicador: "OS Total", ...Object.fromEntries(empresas.map(e => [e.nome, Math.round((e.metricas.os_mes / maxOS) * 100)])) },
      { indicador: "Vendas", ...Object.fromEntries(empresas.map(e => [e.nome, Math.round((e.metricas.vendas_mes / maxVendas) * 100)])) },
      { indicador: "Finalizadas", ...Object.fromEntries(empresas.map(e => [e.nome, Math.round((e.metricas.os_finalizadas / maxFin) * 100)])) },
      { indicador: "Ticket Médio", ...Object.fromEntries(empresas.map(e => { const t = e.metricas.os_mes > 0 ? e.metricas.faturamento_mes / e.metricas.os_mes : 0; return [e.nome, Math.round((t / maxTicket) * 100)]; })) },
    ];
  }, [empresas]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-48 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (empresas.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <LayoutDashboard className="h-12 w-12 mx-auto mb-3 opacity-30" />
        <p>Nenhuma empresa encontrada.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPIs principais */}
      <div>
        <p className="text-xs text-muted-foreground mb-2">Resumo consolidado de todas as empresas no período selecionado.</p>
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard titulo="Faturamento Total" valor={formatarMoedaCompacta(fatTotal)} sub={`OS: ${formatarMoedaCompacta(fatOS)} · Vendas: ${formatarMoedaCompacta(fatVendas)}`} icon={DollarSign} cor="#3b82f6" />
          <KpiCard titulo="Ordens de Serviço" valor={String(osTotal)} sub={`${osFinalizadas} finalizadas · ${osAbertas} em aberto`} icon={Activity} cor="#10b981" />
          <KpiCard titulo="Ticket Médio Global" valor={formatarMoedaCompacta(ticketMedioGlobal)} sub={`${taxaFinalizacao}% taxa de finalização`} icon={TrendingUp} cor="#8b5cf6" />
          <KpiCard titulo="Vendas Realizadas" valor={String(vendasTotal)} sub={`${empresas.length} empresa(s) ativas`} icon={ShoppingBag} cor="#f59e0b" />
        </div>
      </div>

      {/* KPIs secundários */}
      <div>
        <p className="text-xs text-muted-foreground mb-2">Indicadores de desempenho operacional — qualidade e eficiência das OS.</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl border border-border/40 bg-muted/20 p-3 text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">OS Em Aberto</p>
            <p className={`text-xl font-bold mt-1 ${osAbertas > 0 ? "text-amber-400" : "text-emerald-400"}`}>{osAbertas}</p>
            <p className="text-[10px] text-muted-foreground">{osTotal > 0 ? `${Math.round((osAbertas / osTotal) * 100)}% do total` : "—"}</p>
          </div>
          <div className="rounded-xl border border-border/40 bg-muted/20 p-3 text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Taxa Finalização</p>
            <p className={`text-xl font-bold mt-1 ${taxaFinalizacao >= 70 ? "text-emerald-400" : taxaFinalizacao >= 40 ? "text-amber-400" : "text-red-400"}`}>{taxaFinalizacao}%</p>
            <p className="text-[10px] text-muted-foreground">{osFinalizadas} de {osTotal}</p>
          </div>
          <div className="rounded-xl border border-border/40 bg-muted/20 p-3 text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Fat. por OS</p>
            <p className="text-xl font-bold mt-1 text-blue-400">{formatarMoedaCompacta(osTotal > 0 ? fatOS / osTotal : 0)}</p>
            <p className="text-[10px] text-muted-foreground">receita média por OS</p>
          </div>
          <div className="rounded-xl border border-border/40 bg-muted/20 p-3 text-center">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Melhor Filial</p>
            <p className="text-sm font-bold mt-1 text-violet-400 truncate px-1">{ranking[0]?.nome || "—"}</p>
            <p className="text-[10px] text-muted-foreground">{ranking[0] ? formatarMoedaCompacta(ranking[0].metricas.faturamento_mes) : "—"}</p>
          </div>
        </div>
      </div>

      {/* Linha 1: Comparativo faturamento + Ranking */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Gráfico comparativo faturamento */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BarChart2 className="h-4 w-4 text-blue-500" />
              Faturamento por Empresa
            </CardTitle>
            <p className="text-[11px] text-muted-foreground">Receita total gerada por OS finalizadas + vendas diretas em cada empresa.</p>
          </CardHeader>
          <CardContent>
            {empresas.length === 1 ? (
              <div className="py-6 text-center text-xs text-muted-foreground">
                Adicione filiais para ver o comparativo
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <ReBarChart data={dadosBarras} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="nome" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v) => [formatarMoeda(Number(v)), "Faturamento"]} contentStyle={{ fontSize: 11 }} />
                  <Bar dataKey="Faturamento" radius={[4, 4, 0, 0]}>
                    {dadosBarras.map((d, i) => <Cell key={i} fill={d.cor} />)}
                  </Bar>
                </ReBarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Tabela ranking */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-500" />
              Ranking Geral
            </CardTitle>
            <p className="text-[11px] text-muted-foreground">Empresas ordenadas por faturamento. A barra mostra a participação percentual no total geral.</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {ranking.map((emp, i) => {
                const ticket = emp.metricas.os_mes > 0 ? emp.metricas.faturamento_mes / emp.metricas.os_mes : 0;
                const pct = fatTotal > 0 ? (emp.metricas.faturamento_mes / fatTotal) * 100 : 0;
                const cor = emp.tipo === "matriz" ? "#f59e0b" : CORES[i % CORES.length];
                return (
                  <div key={emp.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/20 hover:bg-muted/40 transition-colors">
                    <div className="w-6 flex items-center justify-center shrink-0">
                      {i === 0 ? <Trophy className="h-4 w-4 text-amber-400" /> :
                       i === 1 ? <span className="text-sm font-bold text-gray-400">2</span> :
                       i === 2 ? <span className="text-sm font-bold text-orange-600">3</span> :
                       <span className="text-xs text-muted-foreground">{i + 1}</span>}
                    </div>
                    <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: cor }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-semibold truncate">{emp.nome}</p>
                        {emp.tipo === "matriz" && <Badge variant="outline" className="text-[9px] px-1 py-0 border-amber-500/30 text-amber-500 shrink-0">Matriz</Badge>}
                      </div>
                      <div className="h-1 bg-muted rounded-full overflow-hidden mt-1">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: cor }} />
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-bold" style={{ color: cor }}>{formatarMoedaCompacta(emp.metricas.faturamento_mes)}</p>
                      <p className="text-[10px] text-muted-foreground">{pct.toFixed(1)}%</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Linha 2: OS comparativo + Formas de pagamento */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* OS: Abertas vs Finalizadas por empresa */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4 text-emerald-500" />
              OS por Empresa
            </CardTitle>
            <p className="text-[11px] text-muted-foreground">Ordens de serviço abertas (âmbar) vs finalizadas (verde) por empresa. TM = ticket médio da empresa no período.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {empresas.map((emp, i) => {
              const total = emp.metricas.os_mes || 0;
              const pctFin = total > 0 ? Math.round((emp.metricas.os_finalizadas / total) * 100) : 0;
              const cor = emp.tipo === "matriz" ? "#f59e0b" : CORES[i % CORES.length];
              const ticket = emp.metricas.os_mes > 0 ? emp.metricas.faturamento_mes / emp.metricas.os_mes : 0;
              return (
                <div key={emp.id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: cor }} />
                      <span className="font-medium">{emp.nome}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span className="text-emerald-400 font-medium">{emp.metricas.os_finalizadas} fin.</span>
                      <span>/</span>
                      <span className={emp.metricas.os_em_aberto > 0 ? "text-amber-400 font-medium" : ""}>{emp.metricas.os_em_aberto} ab.</span>
                      <span className="text-muted-foreground">· TM {formatarMoedaCompacta(ticket)}</span>
                    </div>
                  </div>
                  <div className="flex h-2 gap-0.5">
                    <div className="h-full rounded-l-full transition-all bg-emerald-500/60" style={{ width: `${pctFin}%` }} />
                    <div className="h-full rounded-r-full transition-all bg-amber-500/40 flex-1" />
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>Total: {total} OS</span>
                    <span>{pctFin}% finalizada(s)</span>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Formas de pagamento consolidado */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-violet-500" />
              Formas de Pagamento (Consolidado)
            </CardTitle>
            <p className="text-[11px] text-muted-foreground">Distribuição do faturamento por meio de pagamento somando todas as empresas. Considera apenas vendas diretas (não OS).</p>
          </CardHeader>
          <CardContent>
            {formasConsolidado.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground">Nenhuma venda no período</div>
            ) : (
              <div className="grid grid-cols-2 gap-4 items-center">
                <div className="space-y-2">
                  {formasConsolidado.slice(0, 5).map(f => {
                    const totalGeral = formasConsolidado.reduce((s, x) => s + x.total, 0) || 1;
                    const pct = Math.round((f.total / totalGeral) * 100);
                    const cor = COR_FORMA[f.forma] || "#6b7280";
                    return (
                      <div key={f.forma} className="text-xs">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="font-medium">{f.label}</span>
                          <span className="text-muted-foreground">{pct}%</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: cor }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <ResponsiveContainer width="100%" height={130}>
                  <PieChart>
                    <Pie data={formasConsolidado.map(f => ({ name: f.label, value: f.total }))} cx="50%" cy="50%" outerRadius={55} dataKey="value">
                      {formasConsolidado.map((f, i) => <Cell key={i} fill={COR_FORMA[f.forma] || CORES[i % CORES.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v) => [formatarMoeda(Number(v)), ""]} contentStyle={{ fontSize: 10 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Linha 3: Radar comparativo + Top produtos consolidado */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Radar multidimensional */}
        {empresas.length >= 2 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Layers className="h-4 w-4 text-pink-500" />
                Comparativo Multidimensional
              </CardTitle>
              <p className="text-[11px] text-muted-foreground">Cada eixo é normalizado de 0 a 100 em relação à melhor empresa naquele indicador. Quanto maior a área, melhor o desempenho geral.</p>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <RadarChart data={dadosRadar}>
                  <PolarGrid stroke="rgba(255,255,255,0.1)" />
                  <PolarAngleAxis dataKey="indicador" tick={{ fontSize: 10 }} />
                  {empresas.map((emp, i) => (
                    <Radar
                      key={emp.id}
                      name={emp.nome}
                      dataKey={emp.nome}
                      stroke={emp.tipo === "matriz" ? "#f59e0b" : CORES[i % CORES.length]}
                      fill={emp.tipo === "matriz" ? "#f59e0b" : CORES[i % CORES.length]}
                      fillOpacity={0.15}
                    />
                  ))}
                  <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ fontSize: 10 }} formatter={(v) => [`${v}/100`, ""]} />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Top produtos consolidado */}
        <Card className={empresas.length < 2 ? "lg:col-span-2" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Package className="h-4 w-4 text-orange-500" />
              Top Produtos / Peças (Consolidado)
            </CardTitle>
            <p className="text-[11px] text-muted-foreground">Os itens mais vendidos somando todas as empresas, ordenados por receita total gerada no período.</p>
          </CardHeader>
          <CardContent>
            {topProdutosConsolidado.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground">Nenhum produto vendido no período</div>
            ) : (
              <div className="space-y-2">
                {topProdutosConsolidado.map((p, i) => {
                  const maxTotal = topProdutosConsolidado[0]?.total || 1;
                  const pct = Math.round((p.total / maxTotal) * 100);
                  return (
                    <div key={p.nome} className="flex items-center gap-3 text-xs">
                      <span className="text-[10px] text-muted-foreground w-4 shrink-0 text-right">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="font-medium truncate">{p.nome}</span>
                          <div className="flex items-center gap-2 shrink-0 ml-2">
                            <span className="text-muted-foreground">{p.quantidade}x</span>
                            <span className="font-semibold">{formatarMoedaCompacta(p.total)}</span>
                          </div>
                        </div>
                        <div className="h-1 bg-muted rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-orange-500/60 transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Linha 4: Comparativo detalhado de indicadores */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <BarChart2 className="h-4 w-4 text-blue-500" />
            Tabela Comparativa Completa
          </CardTitle>
          <p className="text-[11px] text-muted-foreground">Visão lado a lado de todos os indicadores por empresa. "Part. %" é a fatia de cada empresa no faturamento total consolidado.</p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/40">
                  <th className="text-left py-2 pr-3 font-medium text-muted-foreground">#</th>
                  <th className="text-left py-2 pr-3 font-medium text-muted-foreground">Empresa</th>
                  <th className="text-right py-2 pr-3 font-medium text-muted-foreground">Faturamento</th>
                  <th className="text-right py-2 pr-3 font-medium text-muted-foreground">OS Total</th>
                  <th className="text-right py-2 pr-3 font-medium text-muted-foreground">Em Aberto</th>
                  <th className="text-right py-2 pr-3 font-medium text-muted-foreground">Finalizadas</th>
                  <th className="text-right py-2 pr-3 font-medium text-muted-foreground">Vendas</th>
                  <th className="text-right py-2 pr-3 font-medium text-muted-foreground">Ticket Médio</th>
                  <th className="text-right py-2 pr-3 font-medium text-muted-foreground">Fat. OS</th>
                  <th className="text-right py-2 font-medium text-muted-foreground">Part. %</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((emp, i) => {
                  const ticket = emp.metricas.os_mes > 0 ? emp.metricas.faturamento_mes / emp.metricas.os_mes : 0;
                  const pct = fatTotal > 0 ? (emp.metricas.faturamento_mes / fatTotal) * 100 : 0;
                  const taxaFin = emp.metricas.os_mes > 0 ? Math.round((emp.metricas.os_finalizadas / emp.metricas.os_mes) * 100) : 0;
                  const cor = emp.tipo === "matriz" ? "#f59e0b" : CORES[i % CORES.length];
                  return (
                    <tr key={emp.id} className="border-b border-border/20 last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="py-2.5 pr-3">
                        {i === 0 ? <Trophy className="h-3.5 w-3.5 text-amber-400" /> : <span className="text-muted-foreground">{i + 1}</span>}
                      </td>
                      <td className="py-2.5 pr-3">
                        <div className="flex items-center gap-2">
                          <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: cor }} />
                          <span className="font-medium">{emp.nome}</span>
                          {emp.tipo === "matriz" && <Badge variant="outline" className="text-[9px] px-1 py-0 border-amber-500/30 text-amber-500">Matriz</Badge>}
                        </div>
                      </td>
                      <td className="py-2.5 pr-3 text-right font-bold text-emerald-400">{formatarMoedaCompacta(emp.metricas.faturamento_mes)}</td>
                      <td className="py-2.5 pr-3 text-right text-blue-400 font-semibold">{emp.metricas.os_mes}</td>
                      <td className="py-2.5 pr-3 text-right">
                        <span className={emp.metricas.os_em_aberto > 0 ? "text-amber-400 font-semibold" : "text-muted-foreground"}>{emp.metricas.os_em_aberto}</span>
                      </td>
                      <td className="py-2.5 pr-3 text-right">
                        <span className="text-emerald-400 font-semibold">{emp.metricas.os_finalizadas}</span>
                        <span className="text-[10px] text-muted-foreground ml-1">({taxaFin}%)</span>
                      </td>
                      <td className="py-2.5 pr-3 text-right text-violet-400 font-semibold">{emp.metricas.vendas_mes}</td>
                      <td className="py-2.5 pr-3 text-right">{formatarMoedaCompacta(ticket)}</td>
                      <td className="py-2.5 pr-3 text-right text-blue-300">{formatarMoedaCompacta(emp.metricas.faturamento_os ?? 0)}</td>
                      <td className="py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <div className="w-14 bg-muted rounded-full h-1.5 hidden sm:block">
                            <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, backgroundColor: cor }} />
                          </div>
                          <span className="text-muted-foreground">{pct.toFixed(1)}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {/* Linha totais */}
                {empresas.length > 1 && (
                  <tr className="border-t-2 border-border/60 bg-muted/10 font-semibold">
                    <td className="py-2.5 pr-3" />
                    <td className="py-2.5 pr-3 text-xs text-muted-foreground">TOTAL</td>
                    <td className="py-2.5 pr-3 text-right text-emerald-400">{formatarMoedaCompacta(fatTotal)}</td>
                    <td className="py-2.5 pr-3 text-right text-blue-400">{osTotal}</td>
                    <td className="py-2.5 pr-3 text-right text-amber-400">{osAbertas}</td>
                    <td className="py-2.5 pr-3 text-right text-emerald-400">{osFinalizadas}</td>
                    <td className="py-2.5 pr-3 text-right text-violet-400">{vendasTotal}</td>
                    <td className="py-2.5 pr-3 text-right">{formatarMoedaCompacta(ticketMedioGlobal)}</td>
                    <td className="py-2.5 pr-3 text-right text-blue-300">{formatarMoedaCompacta(fatOS)}</td>
                    <td className="py-2.5 text-right text-muted-foreground">100%</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Metas por filial */}
      {empresas.some(e => e.metas.length > 0) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Target className="h-4 w-4 text-violet-500" />
              Progresso de Metas
            </CardTitle>
            <p className="text-[11px] text-muted-foreground">Quanto cada empresa já atingiu das metas definidas no período. Verde = meta batida. Clique em "Definir metas" para configurar.</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {empresas.map((emp, i) => {
                const metaFat = emp.metas.find(m => m.tipo === "faturamento");
                const metaOS = emp.metas.find(m => m.tipo === "os");
                const cor = emp.tipo === "matriz" ? "#f59e0b" : CORES[i % CORES.length];
                const pctFat = metaFat ? Math.min(100, Math.round((emp.metricas.faturamento_mes / metaFat.valor) * 100)) : null;
                const pctOS = metaOS ? Math.min(100, Math.round((emp.metricas.os_mes / metaOS.valor) * 100)) : null;
                if (!metaFat && !metaOS) return (
                  <div key={emp.id} className="text-xs text-muted-foreground p-3 rounded-lg border border-dashed border-border/40 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full" style={{ backgroundColor: cor }} />
                      <span>{emp.nome}</span>
                    </div>
                    <button onClick={() => onAbrirMetas(emp)} className="underline text-blue-400 hover:text-blue-300">Definir metas</button>
                  </div>
                );
                return (
                  <div key={emp.id} className="p-3 rounded-lg border border-border/40 bg-muted/10 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: cor }} />
                      <span className="text-xs font-semibold">{emp.nome}</span>
                      {emp.tipo === "matriz" && <Badge variant="outline" className="text-[9px] px-1 py-0 border-amber-500/30 text-amber-500">Matriz</Badge>}
                    </div>
                    {pctFat !== null && (
                      <div>
                        <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                          <span>Faturamento</span>
                          <span className={pctFat >= 100 ? "text-emerald-400 font-semibold" : ""}>{formatarMoedaCompacta(emp.metricas.faturamento_mes)} / {formatarMoedaCompacta(metaFat!.valor)} · {pctFat}%</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${pctFat}%`, backgroundColor: pctFat >= 100 ? "#10b981" : cor }} />
                        </div>
                      </div>
                    )}
                    {pctOS !== null && (
                      <div>
                        <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                          <span>OS</span>
                          <span className={pctOS >= 100 ? "text-emerald-400 font-semibold" : ""}>{emp.metricas.os_mes} / {metaOS!.valor} · {pctOS}%</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all bg-blue-500/70" style={{ width: `${pctOS}%` }} />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Dialog Nova Filial ───────────────────────────────────────────────────────

function DialogNovaFilial({ open, onClose, onCriar, salvando }: {
  open: boolean; onClose: () => void;
  onCriar: (dados: Record<string, string>) => Promise<void>; salvando: boolean;
}) {
  const [form, setForm] = useState({ nome: "", cnpj: "", telefone: "", endereco: "", cidade: "", estado: "", email_gerente: "", senha_gerente: "", confirmar_senha: "" });
  const [erros, setErros] = useState<Record<string, string>>({});
  const set = (campo: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [campo]: e.target.value }));
  const validar = () => {
    const e: Record<string, string> = {};
    if (!form.nome.trim()) e.nome = "Nome obrigatório";
    if (!form.email_gerente.trim()) e.email_gerente = "Email obrigatório";
    if (!form.senha_gerente) e.senha_gerente = "Senha obrigatória";
    if (form.senha_gerente.length < 6) e.senha_gerente = "Mínimo 6 caracteres";
    if (form.senha_gerente !== form.confirmar_senha) e.confirmar_senha = "Senhas não conferem";
    setErros(e); return Object.keys(e).length === 0;
  };
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!validar()) return;
    const { confirmar_senha, ...dados } = form; await onCriar(dados);
    setForm({ nome: "", cnpj: "", telefone: "", endereco: "", cidade: "", estado: "", email_gerente: "", senha_gerente: "", confirmar_senha: "" });
  };
  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Nova Filial</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2"><Label>Nome da filial *</Label><Input value={form.nome} onChange={set("nome")} placeholder="Ex: Filial Centro" />{erros.nome && <p className="text-xs text-destructive">{erros.nome}</p>}</div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>CNPJ</Label><Input value={form.cnpj} onChange={set("cnpj")} placeholder="00.000.000/0001-00" /></div>
            <div className="space-y-2"><Label>Telefone</Label><Input value={form.telefone} onChange={set("telefone")} placeholder="(00) 00000-0000" /></div>
          </div>
          <div className="space-y-2"><Label>Endereço</Label><Input value={form.endereco} onChange={set("endereco")} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Cidade</Label><Input value={form.cidade} onChange={set("cidade")} /></div>
            <div className="space-y-2"><Label>Estado</Label><Input value={form.estado} onChange={set("estado")} placeholder="SP" maxLength={2} /></div>
          </div>
          <Separator />
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Acesso do gerente da filial</p>
          <div className="space-y-2"><Label>Email de login *</Label><Input type="email" value={form.email_gerente} onChange={set("email_gerente")} />{erros.email_gerente && <p className="text-xs text-destructive">{erros.email_gerente}</p>}</div>
          <div className="space-y-2"><Label>Senha *</Label><Input type="password" value={form.senha_gerente} onChange={set("senha_gerente")} placeholder="Mínimo 6 caracteres" />{erros.senha_gerente && <p className="text-xs text-destructive">{erros.senha_gerente}</p>}</div>
          <div className="space-y-2"><Label>Confirmar senha *</Label><Input type="password" value={form.confirmar_senha} onChange={set("confirmar_senha")} />{erros.confirmar_senha && <p className="text-xs text-destructive">{erros.confirmar_senha}</p>}</div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={salvando}>{salvando ? "Criando..." : "Criar Filial"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Painel de Vendas ─────────────────────────────────────────────────────────

function PainelVendas({ ultimas, porTipo, onVerTodas }: { ultimas: VendaItem[]; porTipo: VendaTipo[]; onVerTodas: () => void }) {
  const [aba, setAba] = useState<"recentes" | "tipo">("recentes");
  return (
    <div className="mt-3 border-t border-border/40 pt-3 space-y-3">
      <div className="flex gap-1">
        {(["recentes", "tipo"] as const).map(a => (
          <button key={a} onClick={() => setAba(a)}
            className={`text-[11px] px-2.5 py-1 rounded-md transition-colors ${aba === a ? "bg-blue-500/20 text-blue-400 font-medium" : "text-muted-foreground hover:text-foreground"}`}>
            {a === "recentes" ? "Últimas vendas" : "Por tipo"}
          </button>
        ))}
      </div>
      {aba === "recentes" && (
        <div className="space-y-1.5">
          {ultimas.length === 0
            ? <p className="text-xs text-muted-foreground text-center py-2">Nenhuma venda no período</p>
            : ultimas.map(v => (
              <div key={v.id} className="flex items-center justify-between text-xs gap-2 py-1 border-b border-border/20 last:border-0">
                <div className="flex-1 min-w-0"><p className="truncate font-medium">{v.nome}</p><p className="text-muted-foreground truncate">{v.cliente || "Sem cliente"}</p></div>
                <p className={`font-semibold shrink-0 ${TIPO_COR[v.tipo] || ""}`}>{formatarMoeda(v.valor)}</p>
              </div>
            ))
          }
        </div>
      )}
      {aba === "tipo" && (
        <div className="space-y-1.5">
          {porTipo.length === 0
            ? <p className="text-xs text-muted-foreground text-center py-2">Nenhuma venda</p>
            : porTipo.map(t => (
              <div key={t.tipo} className="flex items-center justify-between text-xs py-1 border-b border-border/20 last:border-0">
                <span className={`font-medium ${TIPO_COR[t.tipo] || ""}`}>{t.label}</span>
                <div className="text-right"><span className="font-semibold">{formatarMoeda(t.total)}</span><span className="text-muted-foreground ml-1.5">{t.quantidade}x</span></div>
              </div>
            ))
          }
        </div>
      )}
      <button onClick={onVerTodas} className="w-full flex items-center justify-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 transition-colors pt-1">
        <ExternalLink className="h-3 w-3" />Ver todas as vendas
      </button>
    </div>
  );
}

// ─── Card de Empresa ──────────────────────────────────────────────────────────

function CardEmpresa({ empresa, isMatriz, cor, fatTotal, onMetas, onNotificacoes, onVerVendas, onAcessar, onConfigurarDados, onEditarNome, onEditarGerente, onExcluir }: {
  empresa: EmpresaCard; isMatriz: boolean; cor: string; fatTotal: number;
  onMetas: () => void; onNotificacoes: () => void; onVerVendas: () => void; onAcessar: () => void; onConfigurarDados: () => void;
  onEditarNome: () => void; onEditarGerente?: () => void; onExcluir?: () => void;
}) {
  const [expandido, setExpandido] = useState(false);
  const metaFat = empresa.metas.find(m => m.tipo === "faturamento");
  const pctFat = metaFat && metaFat.valor > 0 ? Math.min(100, (empresa.metricas.faturamento_mes / metaFat.valor) * 100) : null;
  const pctTotal = fatTotal > 0 ? Math.min(100, (empresa.metricas.faturamento_mes / fatTotal) * 100) : 0;
  const ticketMedio = empresa.metricas.os_mes > 0 ? empresa.metricas.faturamento_mes / empresa.metricas.os_mes : 0;

  return (
    <Card className={`flex flex-col ${isMatriz ? "border-amber-200 dark:border-amber-800/50" : "border-border/60"}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2 min-w-0">
          <CardTitle className="text-base flex items-center gap-2 min-w-0 flex-1">
            {isMatriz ? <Home className="h-4 w-4 text-amber-500 shrink-0" /> : <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: cor }} />}
            <span className="truncate">{empresa.nome}</span>
          </CardTitle>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={onEditarNome} title="Editar nome" className="text-muted-foreground hover:text-foreground transition-colors p-0.5"><Pencil className="h-3.5 w-3.5" /></button>
            <Badge variant="outline" className={`text-xs whitespace-nowrap ${isMatriz ? "border-amber-500/30 text-amber-500" : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"}`}>{isMatriz ? "Matriz" : "Filial"}</Badge>
            <Badge variant="outline" className="text-xs whitespace-nowrap text-green-500 border-green-500/30">Ativa</Badge>
          </div>
        </div>
        {empresa.cidade && <p className="text-xs text-muted-foreground">{empresa.cidade}{empresa.estado ? ` — ${empresa.estado}` : ""}</p>}
      </CardHeader>
      <CardContent className="flex-1 space-y-4">
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Faturamento total</p>
          <p className="text-2xl font-bold text-emerald-400">{formatarMoeda(empresa.metricas.faturamento_mes)}</p>
          <div className="flex gap-3 mt-1 text-[11px] text-muted-foreground">
            <span>OS: {formatarMoeda(empresa.metricas.faturamento_os ?? 0)}</span>
            <span>Vendas: {formatarMoeda(empresa.metricas.faturamento_vendas ?? 0)}</span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-md bg-muted/40 p-2 text-center">
            <p className="text-[10px] text-muted-foreground">Total OS</p>
            <p className="text-lg font-semibold text-blue-400">{empresa.metricas.os_mes}</p>
          </div>
          <div className="rounded-md bg-muted/40 p-2 text-center">
            <p className="text-[10px] text-muted-foreground">Em aberto</p>
            <p className={`text-lg font-semibold ${(empresa.metricas.os_em_aberto ?? 0) > 0 ? "text-amber-400" : "text-foreground"}`}>{empresa.metricas.os_em_aberto ?? 0}</p>
          </div>
          <div className="rounded-md bg-muted/40 p-2 text-center">
            <p className="text-[10px] text-muted-foreground">Finalizadas</p>
            <p className="text-lg font-semibold text-emerald-400">{empresa.metricas.os_finalizadas ?? 0}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-md bg-muted/40 p-2">
            <p className="text-[10px] text-muted-foreground">Vendas</p>
            <p className="text-lg font-semibold text-violet-400">{empresa.metricas.vendas_mes}</p>
          </div>
          <div className="rounded-md bg-muted/40 p-2">
            <p className="text-[10px] text-muted-foreground">Ticket médio</p>
            <p className="text-sm font-semibold">{formatarMoeda(ticketMedio)}</p>
          </div>
        </div>
        <div>
          <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
            <span>Participação no faturamento total</span><span>{pctTotal.toFixed(1)}%</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pctTotal}%`, backgroundColor: cor }} />
          </div>
        </div>
        {pctFat !== null && (
          <div>
            <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
              <span>Meta faturamento</span><span>{pctFat.toFixed(0)}%</span>
            </div>
            <Progress value={pctFat} className="h-1.5" />
          </div>
        )}
        <div className="flex items-center justify-center">
          <button onClick={() => setExpandido(v => !v)} className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
            {expandido ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {expandido ? "Ocultar vendas" : "Ver últimas vendas"}
          </button>
        </div>
        {expandido && <PainelVendas ultimas={empresa.metricas.ultimas_vendas || []} porTipo={empresa.metricas.vendas_por_tipo || []} onVerTodas={onVerVendas} />}
        <div className="flex flex-col gap-2 pt-1">
          <Button size="sm" variant="outline" className="w-full text-xs h-8" onClick={onAcessar}>Acessar empresa</Button>
          <Button size="sm" variant="outline" className="w-full text-xs h-8" onClick={onConfigurarDados}>
            Configurar dados para recibos
          </Button>
          <div className="flex gap-2">
            <Button size="sm" className="flex-1 text-xs h-8" onClick={onMetas}>Metas</Button>
            <Button size="sm" variant="outline" className="text-xs h-8 px-2" onClick={onNotificacoes} title="Notificações"><Bell className="h-4 w-4" /></Button>
            {!isMatriz && onEditarGerente && (
              <Button size="sm" variant="outline" className="text-xs h-8 px-2" onClick={onEditarGerente} title="Dados de acesso do gerente"><UserCog className="h-4 w-4" /></Button>
            )}
            {!isMatriz && onExcluir && (
              <Button size="sm" variant="outline" className="text-xs h-8 px-2 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30" onClick={onExcluir} title="Excluir filial"><Trash2 className="h-4 w-4" /></Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Relatórios por Filial ────────────────────────────────────────────────────

function RelatoriosFilial({ empresa, periodo }: { empresa: EmpresaCard; periodo: Periodo }) {
  const [aba, setAba] = useState<"faturamento" | "produtos" | "pagamento">("faturamento");
  const exportarCSV = () => {
    const linhas: string[][] = [];
    if (aba === "faturamento") {
      linhas.push(["Tipo", "Faturamento (R$)", "Quantidade"]);
      linhas.push(["OS Finalizadas", empresa.metricas.faturamento_os.toFixed(2), String(empresa.metricas.os_finalizadas)]);
      for (const t of empresa.metricas.vendas_por_tipo) linhas.push([t.label, t.total.toFixed(2), String(t.quantidade)]);
    } else if (aba === "produtos") {
      linhas.push(["Produto/Peça", "Tipo", "Total (R$)", "Quantidade"]);
      for (const p of (empresa.metricas.top_produtos || [])) linhas.push([p.nome, p.label, p.total.toFixed(2), String(p.quantidade)]);
    } else {
      linhas.push(["Forma de Pagamento", "Total (R$)", "Quantidade"]);
      for (const f of (empresa.metricas.vendas_por_forma || [])) linhas.push([f.label, f.total.toFixed(2), String(f.quantidade)]);
    }
    const csv = linhas.map(l => l.join(";")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `relatorio_${empresa.nome.replace(/\s/g, "_")}_${periodo.data_inicio}_${periodo.data_fim}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };
  const abas = [
    { key: "faturamento" as const, label: "Faturamento", icon: FileText },
    { key: "produtos" as const, label: "Top Produtos", icon: Package },
    { key: "pagamento" as const, label: "Pagamentos", icon: CreditCard },
  ];
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {abas.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setAba(key)}
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md transition-colors ${aba === key ? "bg-blue-500/20 text-blue-400 font-medium" : "text-muted-foreground hover:text-foreground"}`}>
              <Icon className="h-3 w-3" />{label}
            </button>
          ))}
        </div>
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={exportarCSV}><Download className="h-3 w-3" />CSV</Button>
      </div>
      {aba === "faturamento" && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between py-1.5 border-b border-border/30 text-xs">
            <span className="font-medium text-blue-400">OS Finalizadas</span>
            <div className="text-right"><span className="font-semibold">{formatarMoeda(empresa.metricas.faturamento_os)}</span><span className="text-muted-foreground ml-2">{empresa.metricas.os_finalizadas}x</span></div>
          </div>
          {(empresa.metricas.vendas_por_tipo || []).map(t => (
            <div key={t.tipo} className="flex items-center justify-between py-1.5 border-b border-border/20 last:border-0 text-xs">
              <span className={`font-medium ${TIPO_COR[t.tipo] || ""}`}>{t.label}</span>
              <div className="text-right"><span className="font-semibold">{formatarMoeda(t.total)}</span><span className="text-muted-foreground ml-2">{t.quantidade}x</span></div>
            </div>
          ))}
          {empresa.metricas.vendas_por_tipo.length === 0 && empresa.metricas.faturamento_os === 0 && <p className="text-xs text-muted-foreground text-center py-3">Nenhum faturamento</p>}
        </div>
      )}
      {aba === "produtos" && (
        <div className="space-y-1.5">
          {(empresa.metricas.top_produtos || []).length === 0
            ? <p className="text-xs text-muted-foreground text-center py-3">Nenhum produto vendido</p>
            : (empresa.metricas.top_produtos || []).map((p, i) => (
              <div key={p.id} className="flex items-center gap-2 py-1.5 border-b border-border/20 last:border-0 text-xs">
                <span className="text-muted-foreground w-4 shrink-0">{i + 1}.</span>
                <div className="flex-1 min-w-0"><p className="truncate font-medium">{p.nome}</p><p className={`text-[10px] ${TIPO_COR[p.tipo] || "text-muted-foreground"}`}>{p.label}</p></div>
                <div className="text-right shrink-0"><p className="font-semibold">{formatarMoeda(p.total)}</p><p className="text-[10px] text-muted-foreground">{p.quantidade}x</p></div>
              </div>
            ))
          }
        </div>
      )}
      {aba === "pagamento" && (
        <div className="space-y-3">
          {(empresa.metricas.vendas_por_forma || []).length === 0
            ? <p className="text-xs text-muted-foreground text-center py-3">Nenhuma venda</p>
            : (
              <>
                <div className="space-y-1.5">
                  {(empresa.metricas.vendas_por_forma || []).map(f => {
                    const totalGeral = empresa.metricas.faturamento_vendas || 1;
                    const pct = Math.round((f.total / totalGeral) * 100);
                    const cor = COR_FORMA[f.forma] || "#6b7280";
                    return (
                      <div key={f.forma} className="text-xs">
                        <div className="flex items-center justify-between mb-1"><span className="font-medium">{f.label}</span><div className="text-right"><span className="font-semibold">{formatarMoeda(f.total)}</span><span className="text-muted-foreground ml-2">{f.quantidade}x · {pct}%</span></div></div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: cor }} /></div>
                      </div>
                    );
                  })}
                </div>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={(empresa.metricas.vendas_por_forma || []).map(f => ({ name: f.label, value: f.total }))} cx="50%" cy="50%" outerRadius={60} dataKey="value">
                      {(empresa.metricas.vendas_por_forma || []).map((f, i) => <Cell key={i} fill={COR_FORMA[f.forma] || "#6b7280"} />)}
                    </Pie>
                    <Tooltip formatter={(v) => [formatarMoeda(Number(v)), ""]} />
                    <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                  </PieChart>
                </ResponsiveContainer>
              </>
            )
          }
        </div>
      )}
    </div>
  );
}

function DialogRelatorios({ open, onClose, empresas, periodo }: { open: boolean; onClose: () => void; empresas: EmpresaCard[]; periodo: Periodo }) {
  const [empresaSel, setEmpresaSel] = useState<string>(empresas[0]?.id || "");
  const empresa = empresas.find(e => e.id === empresaSel) || empresas[0];
  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileText className="h-4 w-4" />Relatórios por Filial</DialogTitle>
          <DialogDescription>Período: {formatarData(periodo.data_inicio)} – {formatarData(periodo.data_fim)}</DialogDescription>
        </DialogHeader>
        {empresas.length > 1 && (
          <div className="flex flex-wrap gap-1">
            {empresas.map(e => (
              <button key={e.id} onClick={() => setEmpresaSel(e.id)}
                className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${empresaSel === e.id ? "bg-blue-500 text-white border-blue-500" : "border-border/60 text-muted-foreground hover:text-foreground"}`}>
                {e.nome}
              </button>
            ))}
          </div>
        )}
        {empresa && <RelatoriosFilial empresa={empresa} periodo={periodo} />}
        <DialogFooter><Button variant="outline" onClick={onClose}>Fechar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Página Principal ─────────────────────────────────────────────────────────

export default function MultiEmpresas() {
  const navigate = useNavigate();
  const { assinatura, carregando: carregandoAssinatura } = useAssinatura();
  const { setEmpresaAtiva, carregarEmpresas } = useEmpresa();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [todasEmpresas, setTodasEmpresas] = useState<EmpresaCard[]>([]);
  const [abaAtiva, setAbaAtiva] = useState<AbaAtiva>("dashboard");

  const periodoInicial = calcularPeriodo("mes_atual");
  const [periodo, setPeriodo] = useState<Periodo>({ tipo: "mes_atual", ...periodoInicial });

  // Dialogs
  const [dialogNova, setDialogNova] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [dialogMetasAberto, setDialogMetasAberto] = useState(false);
  const [empresaMetas, setEmpresaMetas] = useState<EmpresaCard | null>(null);
  const [metasForm, setMetasForm] = useState({ faturamento: "", os: "", vendas: "", clientes: "", periodo: "mensal" as "mensal" | "semanal" });
  const [dialogNotifAberto, setDialogNotifAberto] = useState(false);
  const [empresaNotif, setEmpresaNotif] = useState<EmpresaCard | null>(null);
  const [notifForm, setNotifForm] = useState({ nova_os: true, os_entregue: true, nova_venda: true, meta_atingida: true, estoque_baixo: false });
  const [dialogEditarNome, setDialogEditarNome] = useState(false);
  const [empresaEditando, setEmpresaEditando] = useState<EmpresaCard | null>(null);
  const [novoNome, setNovoNome] = useState("");
  const [salvandoNome, setSalvandoNome] = useState(false);
  const [dialogGerente, setDialogGerente] = useState(false);
  const [empresaGerente, setEmpresaGerente] = useState<EmpresaCard | null>(null);
  const [gerenteEmail, setGerenteEmail] = useState("");
  const [gerenteNome, setGerenteNome] = useState("");
  const [gerenteSenha, setGerenteSenha] = useState("");
  const [gerenteConfirmarSenha, setGerenteConfirmarSenha] = useState("");
  const [carregandoGerente, setCarregandoGerente] = useState(false);
  const [salvandoGerente, setSalvandoGerente] = useState(false);
  const [dialogExcluir, setDialogExcluir] = useState(false);
  const [empresaExcluindo, setEmpresaExcluindo] = useState<EmpresaCard | null>(null);
  const [confirmacaoNome, setConfirmacaoNome] = useState("");
  const [excluindo, setExcluindo] = useState(false);
  const [dialogRelatorios, setDialogRelatorios] = useState(false);
  const [bannerFechado, setBannerFechado] = useState(() => localStorage.getItem("multiempresas_banner_fechado") === "1");

  const filiais = todasEmpresas.filter(e => e.tipo !== "matriz");
  const matriz = todasEmpresas.find(e => e.tipo === "matriz");

  const carregarDados = useCallback(async (p?: Periodo) => {
    const periodoUsar = p || periodo;
    setIsLoading(true); setErro(null);
    try {
      const { data, error } = await supabase.functions.invoke("get-filiais-metricas", {
        body: { data_inicio: periodoUsar.data_inicio, data_fim: periodoUsar.data_fim },
        method: "POST",
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setTodasEmpresas(data.todasEmpresas || []);
    } catch (e: any) {
      setErro(e?.message || "Erro ao carregar dados");
      toast.error("Erro ao carregar Multi Empresas");
    } finally {
      setIsLoading(false);
    }
  }, [periodo]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      supabase.from("user_roles").select("role").eq("user_id", data.user.id).eq("role", "admin").maybeSingle().then(({ data: r }) => setIsAdmin(!!r));
    });
  }, []);

  useEffect(() => { carregarDados(); }, [carregarDados]);

  const handlePeriodoChange = (novoPeriodo: Periodo) => { setPeriodo(novoPeriodo); carregarDados(novoPeriodo); };

  const isUltra = ["profissional_ultra_mensal", "profissional_ultra_anual"].includes(assinatura?.plano_tipo ?? "");
  const semAcesso = !carregandoAssinatura && assinatura !== null && !isAdmin && !isUltra;

  const handleCriar = async (dados: Record<string, string>) => {
    setSalvando(true);
    try {
      const response = await supabase.functions.invoke("criar-filial", { body: dados });
      if (response.error) {
        let msg = "Erro ao criar filial";
        try { const ctx = (response.error as any)?.context; if (ctx && typeof ctx.json === "function") { const body = await ctx.json(); msg = body?.error || msg; } else { msg = response.error.message || msg; } } catch { msg = response.error.message || msg; }
        toast.error(msg); return;
      }
      if (response.data?.error) { toast.error(response.data.error); return; }
      const novaEmpresaId = response.data?.empresa?.id as string | undefined;
      toast.success(response.data.mensagem || "Filial criada com sucesso!", {
        description: "Agora preencha o endereço, CNPJ e logo da filial para que apareçam nos recibos dela.",
        action: novaEmpresaId
          ? { label: "Configurar dados", onClick: () => { setEmpresaAtiva(novaEmpresaId); navigate("/configuracoes"); } }
          : undefined,
        duration: 8000,
      });
      setDialogNova(false);
      await Promise.all([carregarDados(), carregarEmpresas()]);
    } catch (e: any) { toast.error("Erro ao criar filial: " + e.message); }
    finally { setSalvando(false); }
  };

  const abrirMetas = (empresa: EmpresaCard) => {
    setEmpresaMetas(empresa);
    setMetasForm({ faturamento: empresa.metas.find(m => m.tipo === "faturamento")?.valor.toString() || "", os: empresa.metas.find(m => m.tipo === "os")?.valor.toString() || "", vendas: empresa.metas.find(m => m.tipo === "vendas")?.valor.toString() || "", clientes: empresa.metas.find(m => m.tipo === "clientes")?.valor.toString() || "", periodo: empresa.metas[0]?.periodo || "mensal" });
    setDialogMetasAberto(true);
  };

  const salvarTodasMetas = async () => {
    if (!empresaMetas) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const agora = new Date();
    for (const tipo of ["faturamento", "os", "vendas", "clientes"] as const) {
      const valor = parseFloat(metasForm[tipo]);
      if (isNaN(valor) || valor <= 0) continue;
      const metaExistente = empresaMetas.metas.find(m => m.tipo === tipo);
      if (metaExistente) { await supabase.from("empresa_metas").update({ valor, periodo: metasForm.periodo }).eq("id", metaExistente.id); }
      else { await supabase.from("empresa_metas").insert({ empresa_id: empresaMetas.id, proprietario_id: user.id, tipo, valor, periodo: metasForm.periodo, mes: agora.getMonth() + 1, ano: agora.getFullYear() }); }
    }
    toast.success("Metas salvas!"); setDialogMetasAberto(false); await carregarDados();
  };

  const abrirNotificacoes = async (empresa: EmpresaCard) => {
    setEmpresaNotif(empresa);
    const { data } = await supabase.from("user_notification_preferences").select("*").eq("empresa_id", empresa.id).maybeSingle();
    if (data?.preferences) setNotifForm(data.preferences as typeof notifForm);
    setDialogNotifAberto(true);
  };

  const salvarNotificacoes = async () => {
    if (!empresaNotif) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("user_notification_preferences").upsert({ user_id: user.id, empresa_id: empresaNotif.id, preferences: notifForm });
    toast.success("Preferências salvas!"); setDialogNotifAberto(false);
  };

  const abrirGerente = async (empresa: EmpresaCard) => {
    setEmpresaGerente(empresa); setGerenteEmail(""); setGerenteNome(""); setGerenteSenha(""); setGerenteConfirmarSenha("");
    setDialogGerente(true); setCarregandoGerente(true);
    try {
      const { data, error } = await supabase.functions.invoke("gerente-filial", { body: { empresa_id: empresa.id, acao: "buscar" } });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      setGerenteEmail(data.email || ""); setGerenteNome(data.nome || "");
    } catch (e: any) { toast.error("Erro ao buscar dados do gerente: " + e.message); }
    finally { setCarregandoGerente(false); }
  };

  const salvarGerente = async () => {
    if (!empresaGerente) return;
    if (gerenteSenha && gerenteSenha !== gerenteConfirmarSenha) { toast.error("As senhas não conferem"); return; }
    if (gerenteSenha && gerenteSenha.length < 6) { toast.error("Senha deve ter pelo menos 6 caracteres"); return; }
    setSalvandoGerente(true);
    try {
      const body: Record<string, string> = { empresa_id: empresaGerente.id, acao: "atualizar" };
      if (gerenteEmail.trim()) body.email = gerenteEmail.trim();
      if (gerenteSenha) body.senha = gerenteSenha;
      const { data, error } = await supabase.functions.invoke("gerente-filial", { body });
      if (error) { let msg = "Erro ao salvar"; try { const ctx = (error as any)?.context; if (ctx && typeof ctx.json === "function") { const b = await ctx.json(); msg = b?.error || msg; } else msg = error.message || msg; } catch { msg = error.message || msg; } throw new Error(msg); }
      if (data?.error) throw new Error(data.error);
      toast.success("Dados do gerente atualizados!"); setDialogGerente(false);
    } catch (e: any) { toast.error("Erro ao salvar: " + e.message); }
    finally { setSalvandoGerente(false); }
  };

  const abrirExcluir = (empresa: EmpresaCard) => { setEmpresaExcluindo(empresa); setConfirmacaoNome(""); setDialogExcluir(true); };

  const handleExcluir = async () => {
    if (!empresaExcluindo) return;
    if (confirmacaoNome !== empresaExcluindo.nome) { toast.error("Nome digitado não confere"); return; }
    setExcluindo(true);
    try {
      const response = await supabase.functions.invoke("excluir-filial", { body: { empresa_id: empresaExcluindo.id } });
      if (response.error) { let msg = "Erro ao excluir filial"; try { const ctx = (response.error as any)?.context; if (ctx && typeof ctx.json === "function") { const body = await ctx.json(); msg = body?.error || msg; } else msg = response.error.message || msg; } catch { msg = response.error.message || msg; } toast.error(msg); return; }
      if (response.data?.error) { toast.error(response.data.error); return; }
      toast.success(response.data.mensagem || "Filial excluída!");
      setDialogExcluir(false); await Promise.all([carregarDados(), carregarEmpresas()]);
    } catch (e: any) { toast.error("Erro ao excluir filial: " + e.message); }
    finally { setExcluindo(false); }
  };

  const abrirEditarNome = (empresa: EmpresaCard) => { setEmpresaEditando(empresa); setNovoNome(empresa.nome); setDialogEditarNome(true); };

  const salvarNome = async () => {
    if (!empresaEditando || !novoNome.trim()) return;
    setSalvandoNome(true);
    try {
      const { error } = await supabase.from("empresas" as never).update({ nome: novoNome.trim() } as never).eq("id" as never, empresaEditando.id);
      if (error) throw error;
      toast.success("Nome atualizado!"); setDialogEditarNome(false); await carregarDados();
    } catch (e: unknown) { toast.error("Erro ao salvar nome: " + (e instanceof Error ? e.message : "Erro desconhecido")); }
    finally { setSalvandoNome(false); }
  };

  // ─── Render: guards ────────────────────────────────────────────────────────

  if (carregandoAssinatura) {
    return <AppLayout><div className="p-6 space-y-4 max-w-5xl mx-auto">{[1,2,3].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}</div></AppLayout>;
  }
  if (semAcesso) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center p-8">
          <div className="h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center"><Lock className="h-8 w-8 text-blue-600" /></div>
          <h2 className="text-2xl font-bold">Funcionalidade Exclusiva</h2>
          <p className="text-muted-foreground max-w-md">O Multi Empresas está disponível apenas no <strong>Plano Ultra</strong>.</p>
          <Button onClick={() => navigate("/plano")}>Ver Planos</Button>
        </div>
      </AppLayout>
    );
  }
  if (erro && !isLoading) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-8">
          <AlertTriangle className="h-12 w-12 text-destructive" />
          <p className="text-muted-foreground">{erro}</p>
          <Button onClick={() => carregarDados()} variant="outline"><RefreshCw className="h-4 w-4 mr-2" />Tentar novamente</Button>
        </div>
      </AppLayout>
    );
  }

  const fatTotal = todasEmpresas.reduce((s, e) => s + e.metricas.faturamento_mes, 0);

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-5 max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">Multi Empresas</h1>
              <Badge variant="outline" className="text-xs">{isLoading ? "..." : filiais.length}/3 filiais</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">Gerencie e compare todas as suas empresas.</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={() => carregarDados()} disabled={isLoading} className="text-sm">
              <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
            <Button variant="outline" onClick={() => setDialogRelatorios(true)} disabled={isLoading || todasEmpresas.length === 0} className="text-sm">
              <FileText className="h-4 w-4 mr-2" />Relatórios
            </Button>
            <Button onClick={() => setDialogNova(true)} disabled={isLoading || filiais.length >= 3}>
              <Plus className="h-4 w-4 mr-2" />Nova Filial
            </Button>
          </div>
        </div>

        {/* Filtro período */}
        <div className="rounded-xl border border-border/40 bg-muted/20 p-3">
          <SeletorPeriodo periodo={periodo} onChange={handlePeriodoChange} />
        </div>

        {/* Abas */}
        <div className="flex gap-1 border-b border-border/40 pb-0">
          {([
            { key: "dashboard" as AbaAtiva, label: "Dashboard", icon: LayoutDashboard },
            { key: "empresas" as AbaAtiva, label: "Empresas", icon: Layers },
            { key: "relatorios" as AbaAtiva, label: "Relatórios", icon: FileText },
          ] as const).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setAbaAtiva(key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                abaAtiva === key
                  ? "border-blue-500 text-blue-500"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              }`}
            >
              <Icon className="h-4 w-4" />{label}
            </button>
          ))}
        </div>

        {/* Aba Dashboard */}
        {abaAtiva === "dashboard" && (
          <DashboardConsolidada
            empresas={todasEmpresas}
            isLoading={isLoading}
            periodo={periodo}
            onAbrirMetas={abrirMetas}
          />
        )}

        {/* Aba Empresas */}
        {abaAtiva === "empresas" && (
          <div className="space-y-4">
            {/* Banner */}
            {!bannerFechado && !isLoading && (
              <div className="relative rounded-xl border border-blue-500/30 bg-blue-500/5 p-4">
                <button onClick={() => { localStorage.setItem("multiempresas_banner_fechado", "1"); setBannerFechado(true); }} className="absolute top-3 right-3 text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
                <div className="flex gap-3 pr-6">
                  <Info className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
                  <div className="space-y-1 text-sm">
                    <p className="font-semibold text-blue-400">Como funciona o Multi Empresas</p>
                    <p className="text-muted-foreground">Cada empresa tem seus próprios dados. Ao clicar em <strong className="text-foreground">Acessar</strong>, o sistema muda o contexto e você opera dentro daquela empresa.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Grid cards */}
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{[1, 2].map(i => <Skeleton key={i} className="h-56 rounded-xl" />)}</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {matriz && (
                  <CardEmpresa empresa={matriz} isMatriz={true} cor="#f59e0b" fatTotal={fatTotal}
                    onMetas={() => abrirMetas(matriz)} onNotificacoes={() => abrirNotificacoes(matriz)}
                    onVerVendas={() => navigate("/vendas")} onAcessar={() => { setEmpresaAtiva(matriz.id); navigate("/os"); }}
                    onConfigurarDados={() => { setEmpresaAtiva(null); navigate("/configuracoes"); }}
                    onEditarNome={() => abrirEditarNome(matriz)} />
                )}
                {filiais.map((empresa, i) => (
                  <CardEmpresa key={empresa.id} empresa={empresa} isMatriz={false} cor={CORES[i % CORES.length]} fatTotal={fatTotal}
                    onMetas={() => abrirMetas(empresa)} onNotificacoes={() => abrirNotificacoes(empresa)}
                    onVerVendas={() => navigate("/vendas")} onAcessar={() => { setEmpresaAtiva(empresa.id); navigate("/os"); }}
                    onConfigurarDados={() => { setEmpresaAtiva(empresa.id); navigate("/configuracoes"); }}
                    onEditarNome={() => abrirEditarNome(empresa)} onEditarGerente={() => abrirGerente(empresa)} onExcluir={() => abrirExcluir(empresa)} />
                ))}
                {filiais.length < 3 && (
                  <button onClick={() => setDialogNova(true)}
                    className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-white/10 hover:border-blue-500/40 hover:bg-blue-500/5 transition-all min-h-[200px] text-muted-foreground hover:text-blue-400">
                    <div className="h-12 w-12 rounded-full bg-muted/40 flex items-center justify-center"><Plus className="h-6 w-6" /></div>
                    <span className="text-sm font-medium">Adicionar Filial</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Aba Relatórios */}
        {abaAtiva === "relatorios" && (
          <div className="space-y-4">
            {isLoading ? (
              <div className="space-y-3">{[1,2].map(i => <Skeleton key={i} className="h-48 rounded-xl" />)}</div>
            ) : todasEmpresas.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Nenhuma empresa encontrada.</p>
              </div>
            ) : (
              todasEmpresas.map(emp => (
                <Card key={emp.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      {emp.tipo === "matriz"
                        ? <Home className="h-4 w-4 text-amber-500" />
                        : <div className="h-3 w-3 rounded-full" style={{ backgroundColor: CORES[todasEmpresas.indexOf(emp) % CORES.length] }} />
                      }
                      {emp.nome}
                      <Badge variant="outline" className={`text-[10px] px-1 py-0 ${emp.tipo === "matriz" ? "border-amber-500/30 text-amber-500" : "border-emerald-500/20 text-emerald-400"}`}>
                        {emp.tipo === "matriz" ? "Matriz" : "Filial"}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <RelatoriosFilial empresa={emp} periodo={periodo} />
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}
      </div>

      {/* ─── Dialogs ─── */}
      <DialogNovaFilial open={dialogNova} onClose={() => setDialogNova(false)} onCriar={handleCriar} salvando={salvando} />
      <DialogRelatorios open={dialogRelatorios} onClose={() => setDialogRelatorios(false)} empresas={todasEmpresas} periodo={periodo} />

      <Dialog open={dialogGerente} onOpenChange={v => { setDialogGerente(v); if (!v) { setGerenteSenha(""); setGerenteConfirmarSenha(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><UserCog className="h-4 w-4" />Acesso do Gerente — {empresaGerente?.nome}</DialogTitle>
            <DialogDescription>Visualize ou atualize o email e senha do gerente.</DialogDescription>
          </DialogHeader>
          {carregandoGerente ? (
            <div className="space-y-3 py-2"><Skeleton className="h-9 w-full" /><Skeleton className="h-9 w-full" /></div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5"><Label>Nome</Label><Input value={gerenteNome} disabled className="bg-muted/40 text-muted-foreground" /></div>
              <div className="space-y-1.5"><Label>Email de login</Label><Input type="email" value={gerenteEmail} onChange={e => setGerenteEmail(e.target.value)} /></div>
              <Separator />
              <p className="text-xs text-muted-foreground">Preencha abaixo somente se quiser alterar a senha.</p>
              <div className="space-y-1.5"><Label>Nova senha</Label><Input type="password" value={gerenteSenha} onChange={e => setGerenteSenha(e.target.value)} placeholder="Mínimo 6 caracteres" /></div>
              <div className="space-y-1.5"><Label>Confirmar nova senha</Label><Input type="password" value={gerenteConfirmarSenha} onChange={e => setGerenteConfirmarSenha(e.target.value)} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogGerente(false)} disabled={salvandoGerente}>Cancelar</Button>
            <Button onClick={salvarGerente} disabled={salvandoGerente || carregandoGerente}>{salvandoGerente ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogEditarNome} onOpenChange={setDialogEditarNome}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Editar nome — {empresaEditando?.tipo === "matriz" ? "Matriz" : "Filial"}</DialogTitle></DialogHeader>
          <div>
            <Label>Nome</Label>
            <Input className="mt-1" value={novoNome} onChange={e => setNovoNome(e.target.value)} onKeyDown={e => { if (e.key === "Enter") salvarNome(); }} autoFocus />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogEditarNome(false)} disabled={salvandoNome}>Cancelar</Button>
            <Button onClick={salvarNome} disabled={salvandoNome || !novoNome.trim()}>{salvandoNome ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogExcluir} onOpenChange={v => { setDialogExcluir(v); if (!v) setConfirmacaoNome(""); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive"><Trash2 className="h-4 w-4" />Excluir Filial</DialogTitle>
            <DialogDescription>Esta ação é irreversível. O acesso do gerente será revogado.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
              <p className="text-sm font-semibold">{empresaExcluindo?.nome}</p>
              {empresaExcluindo?.cidade && <p className="text-xs text-muted-foreground">{empresaExcluindo.cidade}{empresaExcluindo.estado ? ` — ${empresaExcluindo.estado}` : ""}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Digite <strong>{empresaExcluindo?.nome}</strong> para confirmar:</Label>
              <Input value={confirmacaoNome} onChange={e => setConfirmacaoNome(e.target.value)} placeholder={empresaExcluindo?.nome} autoComplete="off" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogExcluir(false)} disabled={excluindo}>Cancelar</Button>
            <Button variant="destructive" onClick={handleExcluir} disabled={excluindo || confirmacaoNome !== empresaExcluindo?.nome}>{excluindo ? "Excluindo..." : "Excluir Filial"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogMetasAberto} onOpenChange={setDialogMetasAberto}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Metas — {empresaMetas?.nome}</DialogTitle>
            <DialogDescription>Defina as metas para esta empresa</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Período:</label>
              <select value={metasForm.periodo} onChange={e => setMetasForm(f => ({ ...f, periodo: e.target.value as "mensal" | "semanal" }))} className="rounded-md border border-input bg-background px-3 py-1.5 text-sm">
                <option value="mensal">Mensal</option>
                <option value="semanal">Semanal</option>
              </select>
            </div>
            {([
              { key: "faturamento", label: "Meta de Faturamento (R$)" },
              { key: "os", label: "Meta de OS" },
              { key: "vendas", label: "Meta de Vendas" },
              { key: "clientes", label: "Meta de Clientes Novos" },
            ] as const).map(({ key, label }) => (
              <div key={key}>
                <label className="text-sm font-medium">{label}</label>
                <Input type="number" placeholder="0" className="mt-1" value={metasForm[key]} onChange={e => setMetasForm(f => ({ ...f, [key]: e.target.value }))} />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogMetasAberto(false)}>Cancelar</Button>
            <Button onClick={salvarTodasMetas}>Salvar Metas</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogNotifAberto} onOpenChange={setDialogNotifAberto}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Notificações — {empresaNotif?.nome}</DialogTitle>
            <DialogDescription>Escolha quais eventos você quer receber</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {([
              { key: "nova_os", label: "Nova OS cadastrada", icon: "🔧" },
              { key: "os_entregue", label: "OS entregue", icon: "📦" },
              { key: "nova_venda", label: "Nova venda realizada", icon: "🛒" },
              { key: "meta_atingida", label: "Meta atingida", icon: "🎯" },
              { key: "estoque_baixo", label: "Estoque baixo", icon: "⚠️" },
            ] as const).map(({ key, label, icon }) => (
              <div key={key} className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex items-center gap-2"><span>{icon}</span><p className="text-sm font-medium">{label}</p></div>
                <Switch checked={notifForm[key]} onCheckedChange={v => setNotifForm(f => ({ ...f, [key]: v }))} />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogNotifAberto(false)}>Cancelar</Button>
            <Button onClick={salvarNotificacoes}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
