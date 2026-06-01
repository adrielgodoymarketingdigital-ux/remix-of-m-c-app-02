import { useState, useEffect, useCallback } from "react";
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
  CreditCard, Package, Trophy,
} from "lucide-react";
import { toast } from "sonner";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
} from "recharts";

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface VendaPorForma {
  forma: string;
  label: string;
  total: number;
  quantidade: number;
}

interface TopProduto {
  id: string;
  nome: string;
  tipo: string;
  label: string;
  total: number;
  quantidade: number;
}

interface MetricasEmpresa {
  faturamento_mes: number;
  faturamento_os: number;
  faturamento_vendas: number;
  os_mes: number;
  os_em_aberto: number;
  os_finalizadas: number;
  vendas_mes: number;
  ultimas_vendas: VendaItem[];
  vendas_por_tipo: VendaTipo[];
  vendas_por_forma: VendaPorForma[];
  top_produtos: TopProduto[];
}

interface VendaItem {
  id: string;
  data: string;
  tipo: string;
  label: string;
  nome: string;
  cliente: string | null;
  valor: number;
  forma_pagamento: string;
  quantidade: number;
}

interface VendaTipo {
  tipo: string;
  label: string;
  total: number;
  quantidade: number;
}

interface Meta {
  id: string;
  empresa_id: string;
  tipo: "faturamento" | "os" | "vendas" | "clientes";
  valor: number;
  periodo: "mensal" | "semanal";
}

interface EmpresaCard {
  id: string;
  nome: string;
  tipo: string;
  cidade: string | null;
  estado: string | null;
  cnpj: string | null;
  telefone: string | null;
  proprietario_id: string;
  metricas: MetricasEmpresa;
  metas: Meta[];
}

// ─── Tipos de período ─────────────────────────────────────────────────────────

type TipoPeriodo = "mes_atual" | "mes_passado" | "trimestre" | "semestre" | "ano" | "customizado";

interface Periodo {
  tipo: TipoPeriodo;
  data_inicio: string;
  data_fim: string;
}

function calcularPeriodo(tipo: TipoPeriodo): { data_inicio: string; data_fim: string } {
  const hoje = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  if (tipo === "mes_atual") {
    const ini = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    return { data_inicio: fmt(ini), data_fim: fmt(hoje) };
  }
  if (tipo === "mes_passado") {
    const ini = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
    const fim = new Date(hoje.getFullYear(), hoje.getMonth(), 0);
    return { data_inicio: fmt(ini), data_fim: fmt(fim) };
  }
  if (tipo === "trimestre") {
    const ini = new Date(hoje.getFullYear(), hoje.getMonth() - 2, 1);
    return { data_inicio: fmt(ini), data_fim: fmt(hoje) };
  }
  if (tipo === "semestre") {
    const ini = new Date(hoje.getFullYear(), hoje.getMonth() - 5, 1);
    return { data_inicio: fmt(ini), data_fim: fmt(hoje) };
  }
  if (tipo === "ano") {
    const ini = new Date(hoje.getFullYear(), 0, 1);
    return { data_inicio: fmt(ini), data_fim: fmt(hoje) };
  }
  return { data_inicio: fmt(new Date(hoje.getFullYear(), hoje.getMonth(), 1)), data_fim: fmt(hoje) };
}

// ─── Constantes ──────────────────────────────────────────────────────────────

const CORES = ["#3b82f6", "#10b981", "#8b5cf6", "#f59e0b"];
const COR_FORMA: Record<string, string> = {
  pix: "#10b981", dinheiro: "#3b82f6", cartao_credito: "#8b5cf6",
  cartao_debito: "#6366f1", a_receber: "#f59e0b", a_prazo: "#ef4444",
};

const FORMA_PAGAMENTO_LABEL: Record<string, string> = {
  dinheiro: "Dinheiro", pix: "Pix", cartao_credito: "Crédito",
  cartao_debito: "Débito", a_receber: "A receber", a_prazo: "A prazo",
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

const formatarMoeda = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const formatarData = (iso: string) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

// ─── Seletor de Período ───────────────────────────────────────────────────────

function SeletorPeriodo({ periodo, onChange }: {
  periodo: Periodo;
  onChange: (p: Periodo) => void;
}) {
  const [customInicio, setCustomInicio] = useState(periodo.data_inicio);
  const [customFim, setCustomFim] = useState(periodo.data_fim);

  const handleTipo = (tipo: TipoPeriodo) => {
    if (tipo === "customizado") {
      onChange({ tipo, data_inicio: customInicio, data_fim: customFim });
    } else {
      const datas = calcularPeriodo(tipo);
      onChange({ tipo, ...datas });
    }
  };

  const aplicarCustom = () => {
    if (!customInicio || !customFim) return;
    if (customInicio > customFim) { toast.error("Data inicial não pode ser maior que a final"); return; }
    onChange({ tipo: "customizado", data_inicio: customInicio, data_fim: customFim });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Calendar className="h-3.5 w-3.5" />
        <span>Período:</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {PERIODOS_OPCOES.map(op => (
          <button
            key={op.valor}
            onClick={() => handleTipo(op.valor)}
            className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${
              periodo.tipo === op.valor
                ? "bg-blue-500 text-white border-blue-500"
                : "border-border/60 text-muted-foreground hover:text-foreground hover:border-border"
            }`}
          >
            {op.label}
          </button>
        ))}
      </div>
      {periodo.tipo === "customizado" && (
        <div className="flex items-center gap-1.5">
          <Input
            type="date"
            value={customInicio}
            onChange={e => setCustomInicio(e.target.value)}
            className="h-7 text-xs w-36"
          />
          <span className="text-xs text-muted-foreground">até</span>
          <Input
            type="date"
            value={customFim}
            onChange={e => setCustomFim(e.target.value)}
            className="h-7 text-xs w-36"
          />
          <Button size="sm" className="h-7 text-xs px-2" onClick={aplicarCustom}>
            Aplicar
          </Button>
        </div>
      )}
      {periodo.tipo !== "customizado" && (
        <span className="text-xs text-muted-foreground">
          ({formatarData(periodo.data_inicio)} – {formatarData(periodo.data_fim)})
        </span>
      )}
    </div>
  );
}

// ─── Dialog Nova Filial ───────────────────────────────────────────────────────

function DialogNovaFilial({ open, onClose, onCriar, salvando }: {
  open: boolean; onClose: () => void;
  onCriar: (dados: Record<string, string>) => Promise<void>; salvando: boolean;
}) {
  const [form, setForm] = useState({
    nome: "", cnpj: "", telefone: "", endereco: "", cidade: "", estado: "",
    email_gerente: "", senha_gerente: "", confirmar_senha: "",
  });
  const [erros, setErros] = useState<Record<string, string>>({});
  const set = (campo: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [campo]: e.target.value }));

  const validar = () => {
    const e: Record<string, string> = {};
    if (!form.nome.trim()) e.nome = "Nome obrigatório";
    if (!form.email_gerente.trim()) e.email_gerente = "Email obrigatório";
    if (!form.senha_gerente) e.senha_gerente = "Senha obrigatória";
    if (form.senha_gerente.length < 6) e.senha_gerente = "Mínimo 6 caracteres";
    if (form.senha_gerente !== form.confirmar_senha) e.confirmar_senha = "Senhas não conferem";
    setErros(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validar()) return;
    const { confirmar_senha, ...dados } = form;
    await onCriar(dados);
    setForm({ nome: "", cnpj: "", telefone: "", endereco: "", cidade: "", estado: "", email_gerente: "", senha_gerente: "", confirmar_senha: "" });
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Nova Filial</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome da filial *</Label>
            <Input id="nome" value={form.nome} onChange={set("nome")} placeholder="Ex: Filial Centro" />
            {erros.nome && <p className="text-xs text-destructive">{erros.nome}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="cnpj">CNPJ</Label>
              <Input id="cnpj" value={form.cnpj} onChange={set("cnpj")} placeholder="00.000.000/0001-00" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="telefone">Telefone</Label>
              <Input id="telefone" value={form.telefone} onChange={set("telefone")} placeholder="(00) 00000-0000" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="endereco">Endereço</Label>
            <Input id="endereco" value={form.endereco} onChange={set("endereco")} placeholder="Rua, número" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="cidade">Cidade</Label>
              <Input id="cidade" value={form.cidade} onChange={set("cidade")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="estado">Estado</Label>
              <Input id="estado" value={form.estado} onChange={set("estado")} placeholder="SP" maxLength={2} />
            </div>
          </div>
          <Separator />
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Acesso do gerente da filial</p>
          <div className="space-y-2">
            <Label htmlFor="email_gerente">Email de login *</Label>
            <Input id="email_gerente" type="email" value={form.email_gerente} onChange={set("email_gerente")} placeholder="gerente@filial.com" />
            {erros.email_gerente && <p className="text-xs text-destructive">{erros.email_gerente}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="senha_gerente">Senha *</Label>
            <Input id="senha_gerente" type="password" value={form.senha_gerente} onChange={set("senha_gerente")} placeholder="Mínimo 6 caracteres" />
            {erros.senha_gerente && <p className="text-xs text-destructive">{erros.senha_gerente}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmar_senha">Confirmar senha *</Label>
            <Input id="confirmar_senha" type="password" value={form.confirmar_senha} onChange={set("confirmar_senha")} />
            {erros.confirmar_senha && <p className="text-xs text-destructive">{erros.confirmar_senha}</p>}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={salvando}>{salvando ? "Criando..." : "Criar Filial"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Painel de Vendas Expansível ──────────────────────────────────────────────

function PainelVendas({ ultimas, porTipo, onVerTodas }: {
  ultimas: VendaItem[]; porTipo: VendaTipo[]; onVerTodas: () => void;
}) {
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
                <div className="flex-1 min-w-0">
                  <p className="truncate font-medium">{v.nome}</p>
                  <p className="text-muted-foreground truncate">
                    {v.cliente || "Sem cliente"} · {FORMA_PAGAMENTO_LABEL[v.forma_pagamento] || v.forma_pagamento}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`font-semibold ${TIPO_COR[v.tipo] || "text-foreground"}`}>{formatarMoeda(v.valor)}</p>
                  <p className="text-[10px] text-muted-foreground">{v.label}</p>
                </div>
              </div>
            ))
          }
        </div>
      )}
      {aba === "tipo" && (
        <div className="space-y-1.5">
          {porTipo.length === 0
            ? <p className="text-xs text-muted-foreground text-center py-2">Nenhuma venda no período</p>
            : porTipo.map(t => (
              <div key={t.tipo} className="flex items-center justify-between text-xs py-1 border-b border-border/20 last:border-0">
                <span className={`font-medium ${TIPO_COR[t.tipo] || "text-foreground"}`}>{t.label}</span>
                <div className="text-right">
                  <span className="font-semibold">{formatarMoeda(t.total)}</span>
                  <span className="text-muted-foreground ml-1.5">{t.quantidade}x</span>
                </div>
              </div>
            ))
          }
        </div>
      )}
      <button onClick={onVerTodas}
        className="w-full flex items-center justify-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 transition-colors pt-1">
        <ExternalLink className="h-3 w-3" />
        Ver todas as vendas
      </button>
    </div>
  );
}

// ─── Card de Empresa ──────────────────────────────────────────────────────────

function CardEmpresa({ empresa, isMatriz, cor, fatTotal, onMetas, onNotificacoes, onVerVendas, onAcessar, onEditarNome, onEditarGerente, onExcluir }: {
  empresa: EmpresaCard; isMatriz: boolean; cor: string; fatTotal: number;
  onMetas: () => void; onNotificacoes: () => void; onVerVendas: () => void; onAcessar: () => void;
  onEditarNome: () => void; onEditarGerente?: () => void; onExcluir?: () => void;
}) {
  const [expandido, setExpandido] = useState(false);
  const metaFat = empresa.metas.find(m => m.tipo === "faturamento");
  const pctFat = metaFat && metaFat.valor > 0
    ? Math.min(100, (empresa.metricas.faturamento_mes / metaFat.valor) * 100) : null;
  const pctTotal = fatTotal > 0
    ? Math.min(100, (empresa.metricas.faturamento_mes / fatTotal) * 100) : 0;
  const ticketMedio = empresa.metricas.os_mes > 0
    ? empresa.metricas.faturamento_mes / empresa.metricas.os_mes : 0;

  return (
    <Card className={`flex flex-col ${isMatriz ? "border-amber-200 dark:border-amber-800/50" : "border-border/60"}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2 min-w-0">
          <CardTitle className="text-base flex items-center gap-2 min-w-0 flex-1">
            {isMatriz
              ? <Home className="h-4 w-4 text-amber-500 shrink-0" />
              : <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: cor }} />
            }
            <span className="truncate">{empresa.nome}</span>
          </CardTitle>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={onEditarNome} title="Editar nome" className="text-muted-foreground hover:text-foreground transition-colors p-0.5">
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <Badge variant="outline" className={`text-xs whitespace-nowrap ${isMatriz ? "border-amber-500/30 text-amber-500" : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"}`}>
              {isMatriz ? "Matriz" : "Filial"}
            </Badge>
            <Badge variant="outline" className="text-xs whitespace-nowrap text-green-500 border-green-500/30">Ativa</Badge>
          </div>
        </div>
        {empresa.cidade && (
          <p className="text-xs text-muted-foreground">{empresa.cidade}{empresa.estado ? ` — ${empresa.estado}` : ""}</p>
        )}
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
            <p className={`text-lg font-semibold ${(empresa.metricas.os_em_aberto ?? 0) > 0 ? "text-amber-400" : "text-foreground"}`}>
              {empresa.metricas.os_em_aberto ?? 0}
            </p>
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
            <span>Participação no faturamento total</span>
            <span>{pctTotal.toFixed(1)}%</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pctTotal}%`, backgroundColor: cor }} />
          </div>
        </div>
        {pctFat !== null && (
          <div>
            <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
              <span>Meta faturamento</span>
              <span>{pctFat.toFixed(0)}%</span>
            </div>
            <Progress value={pctFat} className="h-1.5" />
          </div>
        )}
        <div className="flex items-center justify-center">
          <button onClick={() => setExpandido(v => !v)}
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
            {expandido ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {expandido ? "Ocultar vendas" : "Ver últimas vendas"}
          </button>
        </div>
        {expandido && (
          <PainelVendas
            ultimas={empresa.metricas.ultimas_vendas || []}
            porTipo={empresa.metricas.vendas_por_tipo || []}
            onVerTodas={onVerVendas}
          />
        )}
        <div className="flex flex-col gap-2 pt-1">
          <Button size="sm" variant="outline" className="w-full text-xs h-8" onClick={onAcessar}>
            Acessar empresa
          </Button>
          <div className="flex gap-2">
            <Button size="sm" className="flex-1 text-xs h-8" onClick={onMetas}>Metas</Button>
            <Button size="sm" variant="outline" className="text-xs h-8 px-2" onClick={onNotificacoes} title="Notificações">
              <Bell className="h-4 w-4" />
            </Button>
            {!isMatriz && onEditarGerente && (
              <Button size="sm" variant="outline" className="text-xs h-8 px-2" onClick={onEditarGerente} title="Dados de acesso do gerente">
                <UserCog className="h-4 w-4" />
              </Button>
            )}
            {!isMatriz && onExcluir && (
              <Button size="sm" variant="outline" className="text-xs h-8 px-2 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30" onClick={onExcluir} title="Excluir filial">
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Comparativo entre Filiais ────────────────────────────────────────────────

function ComparativoFiliais({ empresas, fatTotal }: {
  empresas: EmpresaCard[];
  fatTotal: number;
}) {
  const ranking = [...empresas].sort((a, b) => b.metricas.faturamento_mes - a.metricas.faturamento_mes);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <BarChart2 className="h-4 w-4 text-blue-500" />
          Comparativo entre Empresas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Tabela ranking */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border/40">
                <th className="text-left py-2 pr-3 font-medium text-muted-foreground w-6">#</th>
                <th className="text-left py-2 pr-3 font-medium text-muted-foreground">Empresa</th>
                <th className="text-right py-2 pr-3 font-medium text-muted-foreground">Faturamento</th>
                <th className="text-right py-2 pr-3 font-medium text-muted-foreground">OS</th>
                <th className="text-right py-2 pr-3 font-medium text-muted-foreground">Vendas</th>
                <th className="text-right py-2 pr-3 font-medium text-muted-foreground">Ticket Médio</th>
                <th className="text-right py-2 font-medium text-muted-foreground">Part. %</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map((emp, i) => {
                const ticket = emp.metricas.os_mes > 0 ? emp.metricas.faturamento_mes / emp.metricas.os_mes : 0;
                const pct = fatTotal > 0 ? (emp.metricas.faturamento_mes / fatTotal) * 100 : 0;
                const cor = emp.tipo === "matriz" ? "#f59e0b" : CORES[i % CORES.length];
                return (
                  <tr key={emp.id} className="border-b border-border/20 last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="py-2.5 pr-3">
                      {i === 0
                        ? <Trophy className="h-3.5 w-3.5 text-amber-400" />
                        : <span className="text-muted-foreground">{i + 1}</span>
                      }
                    </td>
                    <td className="py-2.5 pr-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: cor }} />
                        <span className="font-medium">{emp.nome}</span>
                        {emp.tipo === "matriz" && <Badge variant="outline" className="text-[10px] px-1 py-0 border-amber-500/30 text-amber-500">Matriz</Badge>}
                      </div>
                    </td>
                    <td className="py-2.5 pr-3 text-right font-semibold text-emerald-400">
                      {formatarMoeda(emp.metricas.faturamento_mes)}
                    </td>
                    <td className="py-2.5 pr-3 text-right text-blue-400">{emp.metricas.os_mes}</td>
                    <td className="py-2.5 pr-3 text-right text-violet-400">{emp.metricas.vendas_mes}</td>
                    <td className="py-2.5 pr-3 text-right">{formatarMoeda(ticket)}</td>
                    <td className="py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <div className="w-16 bg-muted rounded-full h-1.5 hidden sm:block">
                          <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, backgroundColor: cor }} />
                        </div>
                        <span className="text-muted-foreground">{pct.toFixed(1)}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Gráfico comparativo de barras */}
        {empresas.length > 1 && (
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Faturamento por empresa</p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={empresas.map((e, i) => ({
                nome: e.nome.length > 10 ? e.nome.substring(0, 10) + "…" : e.nome,
                "Faturamento": e.metricas.faturamento_mes,
                cor: e.tipo === "matriz" ? "#f59e0b" : CORES[i % CORES.length],
              }))}>
                <XAxis dataKey="nome" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `R$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => [formatarMoeda(Number(v)), "Faturamento"]} />
                <Bar dataKey="Faturamento" radius={[4, 4, 0, 0]}>
                  {empresas.map((e, i) => (
                    <Cell key={i} fill={e.tipo === "matriz" ? "#f59e0b" : CORES[i % CORES.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Comparativo OS */}
        {empresas.length > 1 && (
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">OS abertas vs finalizadas</p>
            <div className="space-y-2">
              {empresas.map((emp, i) => {
                const total = emp.metricas.os_mes || 1;
                const pctFin = Math.round((emp.metricas.os_finalizadas / total) * 100);
                const cor = emp.tipo === "matriz" ? "#f59e0b" : CORES[i % CORES.length];
                return (
                  <div key={emp.id}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium">{emp.nome}</span>
                      <span className="text-muted-foreground">
                        {emp.metricas.os_finalizadas} fin. / {emp.metricas.os_em_aberto} aberto(s)
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pctFin}%`, backgroundColor: cor }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Relatórios por Filial ────────────────────────────────────────────────────

function RelatoriosFilial({ empresa, periodo }: {
  empresa: EmpresaCard;
  periodo: Periodo;
}) {
  const [aba, setAba] = useState<"faturamento" | "produtos" | "pagamento">("faturamento");

  const exportarCSV = () => {
    const linhas: string[][] = [];

    if (aba === "faturamento") {
      linhas.push(["Tipo", "Faturamento (R$)", "Quantidade"]);
      linhas.push(["OS Finalizadas", empresa.metricas.faturamento_os.toFixed(2), String(empresa.metricas.os_finalizadas)]);
      for (const t of empresa.metricas.vendas_por_tipo) {
        linhas.push([t.label, t.total.toFixed(2), String(t.quantidade)]);
      }
    } else if (aba === "produtos") {
      linhas.push(["Produto/Peça", "Tipo", "Total (R$)", "Quantidade"]);
      for (const p of (empresa.metricas.top_produtos || [])) {
        linhas.push([p.nome, p.label, p.total.toFixed(2), String(p.quantidade)]);
      }
    } else {
      linhas.push(["Forma de Pagamento", "Total (R$)", "Quantidade"]);
      for (const f of (empresa.metricas.vendas_por_forma || [])) {
        linhas.push([f.label, f.total.toFixed(2), String(f.quantidade)]);
      }
    }

    const csv = linhas.map(l => l.join(";")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio_${empresa.nome.replace(/\s/g, "_")}_${periodo.data_inicio}_${periodo.data_fim}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
            <button
              key={key}
              onClick={() => setAba(key)}
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md transition-colors ${
                aba === key
                  ? "bg-blue-500/20 text-blue-400 font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-3 w-3" />
              {label}
            </button>
          ))}
        </div>
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={exportarCSV}>
          <Download className="h-3 w-3" />
          CSV
        </Button>
      </div>

      {aba === "faturamento" && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between py-1.5 border-b border-border/30 text-xs">
            <span className="font-medium text-blue-400">OS Finalizadas</span>
            <div className="text-right">
              <span className="font-semibold">{formatarMoeda(empresa.metricas.faturamento_os)}</span>
              <span className="text-muted-foreground ml-2">{empresa.metricas.os_finalizadas}x</span>
            </div>
          </div>
          {(empresa.metricas.vendas_por_tipo || []).map(t => (
            <div key={t.tipo} className="flex items-center justify-between py-1.5 border-b border-border/20 last:border-0 text-xs">
              <span className={`font-medium ${TIPO_COR[t.tipo] || ""}`}>{t.label}</span>
              <div className="text-right">
                <span className="font-semibold">{formatarMoeda(t.total)}</span>
                <span className="text-muted-foreground ml-2">{t.quantidade}x</span>
              </div>
            </div>
          ))}
          {empresa.metricas.vendas_por_tipo.length === 0 && empresa.metricas.faturamento_os === 0 && (
            <p className="text-xs text-muted-foreground text-center py-3">Nenhum faturamento no período</p>
          )}
        </div>
      )}

      {aba === "produtos" && (
        <div className="space-y-1.5">
          {(empresa.metricas.top_produtos || []).length === 0
            ? <p className="text-xs text-muted-foreground text-center py-3">Nenhum produto vendido no período</p>
            : (empresa.metricas.top_produtos || []).map((p, i) => (
              <div key={p.id} className="flex items-center gap-2 py-1.5 border-b border-border/20 last:border-0 text-xs">
                <span className="text-muted-foreground w-4 shrink-0">{i + 1}.</span>
                <div className="flex-1 min-w-0">
                  <p className="truncate font-medium">{p.nome}</p>
                  <p className={`text-[10px] ${TIPO_COR[p.tipo] || "text-muted-foreground"}`}>{p.label}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-semibold">{formatarMoeda(p.total)}</p>
                  <p className="text-[10px] text-muted-foreground">{p.quantidade}x</p>
                </div>
              </div>
            ))
          }
        </div>
      )}

      {aba === "pagamento" && (
        <div className="space-y-3">
          {(empresa.metricas.vendas_por_forma || []).length === 0
            ? <p className="text-xs text-muted-foreground text-center py-3">Nenhuma venda no período</p>
            : (
              <>
                <div className="space-y-1.5">
                  {(empresa.metricas.vendas_por_forma || []).map(f => {
                    const totalGeral = empresa.metricas.faturamento_vendas || 1;
                    const pct = Math.round((f.total / totalGeral) * 100);
                    const cor = COR_FORMA[f.forma] || "#6b7280";
                    return (
                      <div key={f.forma} className="text-xs">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium">{f.label}</span>
                          <div className="text-right">
                            <span className="font-semibold">{formatarMoeda(f.total)}</span>
                            <span className="text-muted-foreground ml-2">{f.quantidade}x · {pct}%</span>
                          </div>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: cor }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* Mini pizza chart */}
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie
                      data={(empresa.metricas.vendas_por_forma || []).map(f => ({
                        name: f.label,
                        value: f.total,
                        fill: COR_FORMA[f.forma] || "#6b7280",
                      }))}
                      cx="50%"
                      cy="50%"
                      outerRadius={60}
                      dataKey="value"
                    >
                      {(empresa.metricas.vendas_por_forma || []).map((f, i) => (
                        <Cell key={i} fill={COR_FORMA[f.forma] || "#6b7280"} />
                      ))}
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

// ─── Dialog Relatórios ────────────────────────────────────────────────────────

function DialogRelatorios({ open, onClose, empresas, periodo }: {
  open: boolean; onClose: () => void;
  empresas: EmpresaCard[];
  periodo: Periodo;
}) {
  const [empresaSel, setEmpresaSel] = useState<string>(empresas[0]?.id || "");
  const empresa = empresas.find(e => e.id === empresaSel) || empresas[0];

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Relatórios por Filial
          </DialogTitle>
          <DialogDescription>
            Período: {formatarData(periodo.data_inicio)} – {formatarData(periodo.data_fim)}
          </DialogDescription>
        </DialogHeader>

        {empresas.length > 1 && (
          <div className="flex flex-wrap gap-1">
            {empresas.map(e => (
              <button
                key={e.id}
                onClick={() => setEmpresaSel(e.id)}
                className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${
                  empresaSel === e.id
                    ? "bg-blue-500 text-white border-blue-500"
                    : "border-border/60 text-muted-foreground hover:text-foreground"
                }`}
              >
                {e.nome}
              </button>
            ))}
          </div>
        )}

        {empresa && <RelatoriosFilial empresa={empresa} periodo={periodo} />}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
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

  // Período
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
  const [bannerFechado, setBannerFechado] = useState(() =>
    localStorage.getItem("multiempresas_banner_fechado") === "1"
  );

  const fecharBanner = () => {
    localStorage.setItem("multiempresas_banner_fechado", "1");
    setBannerFechado(true);
  };

  const filiais = todasEmpresas.filter(e => e.tipo !== "matriz");
  const matriz = todasEmpresas.find(e => e.tipo === "matriz");

  const carregarDados = useCallback(async (p?: Periodo) => {
    const periodoUsar = p || periodo;
    setIsLoading(true);
    setErro(null);
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
      supabase.from("user_roles").select("role").eq("user_id", data.user.id).eq("role", "admin").maybeSingle()
        .then(({ data: r }) => setIsAdmin(!!r));
    });
  }, []);

  useEffect(() => { carregarDados(); }, [carregarDados]);

  const handlePeriodoChange = (novoPeriodo: Periodo) => {
    setPeriodo(novoPeriodo);
    carregarDados(novoPeriodo);
  };

  const isUltra = ["profissional_ultra_mensal", "profissional_ultra_anual"].includes(assinatura?.plano_tipo ?? "");
  const semAcesso = !carregandoAssinatura && assinatura !== null && !isAdmin && !isUltra;

  const handleCriar = async (dados: Record<string, string>) => {
    setSalvando(true);
    try {
      const response = await supabase.functions.invoke("criar-filial", { body: dados });
      if (response.error) {
        let msg = "Erro ao criar filial";
        try {
          const ctx = (response.error as any)?.context;
          if (ctx && typeof ctx.json === "function") {
            const body = await ctx.json();
            msg = body?.error || msg;
          } else { msg = response.error.message || msg; }
        } catch { msg = response.error.message || msg; }
        toast.error(msg);
        return;
      }
      if (response.data?.error) { toast.error(response.data.error); return; }
      toast.success(response.data.mensagem || "Filial criada com sucesso!");
      setDialogNova(false);
      await Promise.all([carregarDados(), carregarEmpresas()]);
    } catch (e: any) {
      toast.error("Erro ao criar filial: " + e.message);
    } finally {
      setSalvando(false);
    }
  };

  const abrirMetas = (empresa: EmpresaCard) => {
    setEmpresaMetas(empresa);
    setMetasForm({
      faturamento: empresa.metas.find(m => m.tipo === "faturamento")?.valor.toString() || "",
      os: empresa.metas.find(m => m.tipo === "os")?.valor.toString() || "",
      vendas: empresa.metas.find(m => m.tipo === "vendas")?.valor.toString() || "",
      clientes: empresa.metas.find(m => m.tipo === "clientes")?.valor.toString() || "",
      periodo: empresa.metas[0]?.periodo || "mensal",
    });
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
      if (metaExistente) {
        await supabase.from("empresa_metas").update({ valor, periodo: metasForm.periodo }).eq("id", metaExistente.id);
      } else {
        await supabase.from("empresa_metas").insert({
          empresa_id: empresaMetas.id, proprietario_id: user.id,
          tipo, valor, periodo: metasForm.periodo,
          mes: agora.getMonth() + 1, ano: agora.getFullYear(),
        });
      }
    }
    toast.success("Metas salvas!");
    setDialogMetasAberto(false);
    await carregarDados();
  };

  const abrirNotificacoes = async (empresa: EmpresaCard) => {
    setEmpresaNotif(empresa);
    const { data } = await supabase.from("user_notification_preferences")
      .select("*").eq("empresa_id", empresa.id).maybeSingle();
    if (data?.preferences) setNotifForm(data.preferences as typeof notifForm);
    setDialogNotifAberto(true);
  };

  const salvarNotificacoes = async () => {
    if (!empresaNotif) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("user_notification_preferences").upsert({ user_id: user.id, empresa_id: empresaNotif.id, preferences: notifForm });
    toast.success("Preferências salvas!");
    setDialogNotifAberto(false);
  };

  const abrirGerente = async (empresa: EmpresaCard) => {
    setEmpresaGerente(empresa);
    setGerenteEmail(""); setGerenteNome(""); setGerenteSenha(""); setGerenteConfirmarSenha("");
    setDialogGerente(true);
    setCarregandoGerente(true);
    try {
      const { data, error } = await supabase.functions.invoke("gerente-filial", {
        body: { empresa_id: empresa.id, acao: "buscar" },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      setGerenteEmail(data.email || "");
      setGerenteNome(data.nome || "");
    } catch (e: any) {
      toast.error("Erro ao buscar dados do gerente: " + e.message);
    } finally {
      setCarregandoGerente(false);
    }
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
      if (error) {
        let msg = "Erro ao salvar";
        try {
          const ctx = (error as any)?.context;
          if (ctx && typeof ctx.json === "function") { const b = await ctx.json(); msg = b?.error || msg; }
          else msg = error.message || msg;
        } catch { msg = error.message || msg; }
        throw new Error(msg);
      }
      if (data?.error) throw new Error(data.error);
      toast.success("Dados do gerente atualizados com sucesso!");
      setDialogGerente(false);
    } catch (e: any) {
      toast.error("Erro ao salvar: " + e.message);
    } finally {
      setSalvandoGerente(false);
    }
  };

  const abrirExcluir = (empresa: EmpresaCard) => {
    setEmpresaExcluindo(empresa);
    setConfirmacaoNome("");
    setDialogExcluir(true);
  };

  const handleExcluir = async () => {
    if (!empresaExcluindo) return;
    if (confirmacaoNome !== empresaExcluindo.nome) { toast.error("Nome digitado não confere com o nome da filial"); return; }
    setExcluindo(true);
    try {
      const response = await supabase.functions.invoke("excluir-filial", { body: { empresa_id: empresaExcluindo.id } });
      if (response.error) {
        let msg = "Erro ao excluir filial";
        try {
          const ctx = (response.error as any)?.context;
          if (ctx && typeof ctx.json === "function") { const body = await ctx.json(); msg = body?.error || msg; }
          else msg = response.error.message || msg;
        } catch { msg = response.error.message || msg; }
        toast.error(msg); return;
      }
      if (response.data?.error) { toast.error(response.data.error); return; }
      toast.success(response.data.mensagem || "Filial excluída com sucesso!");
      setDialogExcluir(false);
      await Promise.all([carregarDados(), carregarEmpresas()]);
    } catch (e: any) {
      toast.error("Erro ao excluir filial: " + e.message);
    } finally {
      setExcluindo(false);
    }
  };

  const abrirEditarNome = (empresa: EmpresaCard) => {
    setEmpresaEditando(empresa);
    setNovoNome(empresa.nome);
    setDialogEditarNome(true);
  };

  const salvarNome = async () => {
    if (!empresaEditando || !novoNome.trim()) return;
    setSalvandoNome(true);
    try {
      const { error } = await supabase
        .from("empresas" as never)
        .update({ nome: novoNome.trim() } as never)
        .eq("id" as never, empresaEditando.id);
      if (error) throw error;
      toast.success("Nome atualizado com sucesso!");
      setDialogEditarNome(false);
      await carregarDados();
    } catch (e: unknown) {
      toast.error("Erro ao salvar nome: " + (e instanceof Error ? e.message : "Erro desconhecido"));
    } finally {
      setSalvandoNome(false);
    }
  };

  // ─── Render: loading ───────────────────────────────────────────────────────

  if (carregandoAssinatura) {
    return <AppLayout><div className="p-6 space-y-4 max-w-5xl mx-auto">{[1,2,3].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}</div></AppLayout>;
  }

  if (semAcesso) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center p-8">
          <div className="h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center">
            <Lock className="h-8 w-8 text-blue-600" />
          </div>
          <h2 className="text-2xl font-bold">Funcionalidade Exclusiva</h2>
          <p className="text-muted-foreground max-w-md">
            O Multi Empresas está disponível apenas no <strong>Plano Ultra</strong>.
          </p>
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
          <Button onClick={() => carregarDados()} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" /> Tentar novamente
          </Button>
        </div>
      </AppLayout>
    );
  }

  const fatTotal = todasEmpresas.reduce((s, e) => s + e.metricas.faturamento_mes, 0);
  const osTotal = todasEmpresas.reduce((s, e) => s + e.metricas.os_mes, 0);
  const vendasTotal = todasEmpresas.reduce((s, e) => s + e.metricas.vendas_mes, 0);

  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">Multi Empresas</h1>
              <Badge variant="outline" className="text-xs">
                {isLoading ? "..." : filiais.length}/3 filiais
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Gerencie todas as suas filiais em um único lugar.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" onClick={() => setDialogRelatorios(true)} disabled={isLoading || todasEmpresas.length === 0} className="text-sm">
              <FileText className="h-4 w-4 mr-2" />
              Relatórios
            </Button>
            <Button onClick={() => setDialogNova(true)} disabled={isLoading || filiais.length >= 3}>
              <Plus className="h-4 w-4 mr-2" /> Nova Filial
            </Button>
          </div>
        </div>

        {/* Filtro de Período */}
        <div className="rounded-xl border border-border/40 bg-muted/20 p-3">
          <SeletorPeriodo periodo={periodo} onChange={handlePeriodoChange} />
        </div>

        {/* Banner informativo */}
        {!bannerFechado && !isLoading && (
          <div className="relative rounded-xl border border-blue-500/30 bg-blue-500/5 p-4">
            <button
              onClick={fecharBanner}
              className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="flex gap-3 pr-6">
              <Info className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
              <div className="space-y-2 text-sm">
                <p className="font-semibold text-blue-400">Como funciona o Multi Empresas</p>
                <p className="text-muted-foreground">
                  Cada empresa (matriz + filiais) tem seus próprios dados de OS, vendas e faturamento.
                  Ao acessar uma empresa pelo botão <strong className="text-foreground">Acessar</strong>, o sistema muda o contexto e você opera dentro daquela empresa.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* KPI consolidado */}
        <Card className="border-blue-500/40 bg-blue-500/5">
          <CardContent className="p-4">
            {isLoading ? <Skeleton className="h-16 w-full" /> : (
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Faturamento Total Consolidado</div>
                  <div className="text-3xl font-bold text-blue-500">{formatarMoeda(fatTotal)}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {todasEmpresas.length} empresa(s) — {PERIODOS_OPCOES.find(p => p.valor === periodo.tipo)?.label || "período selecionado"}
                  </div>
                </div>
                <div className="flex gap-4 text-center">
                  <div><div className="text-lg font-bold text-emerald-500">{osTotal}</div><div className="text-[10px] text-muted-foreground">OS</div></div>
                  <div><div className="text-lg font-bold text-violet-500">{vendasTotal}</div><div className="text-[10px] text-muted-foreground">Vendas</div></div>
                  <div><div className="text-lg font-bold text-amber-500">{filiais.length}/3</div><div className="text-[10px] text-muted-foreground">Filiais</div></div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Comparativo entre filiais */}
        {!isLoading && todasEmpresas.length > 1 && (
          <ComparativoFiliais empresas={todasEmpresas} fatTotal={fatTotal} />
        )}

        {/* Progresso de metas */}
        {!isLoading && filiais.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Target className="h-4 w-4 text-violet-500" />
                Progresso de Metas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filiais.map((empresa, i) => {
                  const metaFat = empresa.metas.find(m => m.tipo === "faturamento");
                  const pct = metaFat ? Math.min(100, Math.round((empresa.metricas.faturamento_mes / metaFat.valor) * 100)) : null;
                  return (
                    <div key={empresa.id}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <div className="h-3 w-3 rounded-full" style={{ backgroundColor: CORES[i % CORES.length] }} />
                          <span className="text-sm font-medium">{empresa.nome}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-medium">{formatarMoeda(empresa.metricas.faturamento_mes)}</span>
                          {metaFat && <span className="text-xs text-muted-foreground ml-1">/ {formatarMoeda(metaFat.valor)}</span>}
                        </div>
                      </div>
                      {pct !== null
                        ? <div className="w-full bg-muted rounded-full h-2"><div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: CORES[i % CORES.length] }} /></div>
                        : <p className="text-xs text-muted-foreground">Sem meta — <button className="underline" onClick={() => abrirMetas(empresa)}>definir</button></p>
                      }
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Grid de cards */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2].map(i => <Skeleton key={i} className="h-56 rounded-xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {matriz && (
              <CardEmpresa
                empresa={matriz} isMatriz={true} cor="#f59e0b" fatTotal={fatTotal}
                onMetas={() => abrirMetas(matriz)}
                onNotificacoes={() => abrirNotificacoes(matriz)}
                onVerVendas={() => navigate("/vendas")}
                onAcessar={() => { setEmpresaAtiva(matriz.id); navigate("/os"); }}
                onEditarNome={() => abrirEditarNome(matriz)}
              />
            )}
            {filiais.map((empresa, i) => (
              <CardEmpresa
                key={empresa.id}
                empresa={empresa} isMatriz={false} cor={CORES[i % CORES.length]} fatTotal={fatTotal}
                onMetas={() => abrirMetas(empresa)}
                onNotificacoes={() => abrirNotificacoes(empresa)}
                onVerVendas={() => navigate("/vendas")}
                onAcessar={() => { setEmpresaAtiva(empresa.id); navigate("/os"); }}
                onEditarNome={() => abrirEditarNome(empresa)}
                onEditarGerente={() => abrirGerente(empresa)}
                onExcluir={() => abrirExcluir(empresa)}
              />
            ))}
            {filiais.length < 3 && (
              <button onClick={() => setDialogNova(true)}
                className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-white/10 hover:border-blue-500/40 hover:bg-blue-500/5 transition-all min-h-[200px] text-muted-foreground hover:text-blue-400">
                <div className="h-12 w-12 rounded-full bg-muted/40 flex items-center justify-center">
                  <Plus className="h-6 w-6" />
                </div>
                <span className="text-sm font-medium">Adicionar Filial</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Dialog Nova Filial */}
      <DialogNovaFilial open={dialogNova} onClose={() => setDialogNova(false)} onCriar={handleCriar} salvando={salvando} />

      {/* Dialog Relatórios */}
      <DialogRelatorios
        open={dialogRelatorios}
        onClose={() => setDialogRelatorios(false)}
        empresas={todasEmpresas}
        periodo={periodo}
      />

      {/* Dialog Dados do Gerente */}
      <Dialog open={dialogGerente} onOpenChange={v => { setDialogGerente(v); if (!v) { setGerenteSenha(""); setGerenteConfirmarSenha(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCog className="h-4 w-4" />
              Acesso do Gerente — {empresaGerente?.nome}
            </DialogTitle>
            <DialogDescription>
              Visualize ou atualize o email e senha usados pelo gerente para fazer login.
            </DialogDescription>
          </DialogHeader>
          {carregandoGerente ? (
            <div className="space-y-3 py-2">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Nome</Label>
                <Input value={gerenteNome} disabled className="bg-muted/40 text-muted-foreground" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="gerente-email">Email de login</Label>
                <Input id="gerente-email" type="email" value={gerenteEmail} onChange={e => setGerenteEmail(e.target.value)} placeholder="email@gerente.com" />
              </div>
              <Separator />
              <p className="text-xs text-muted-foreground">Preencha os campos abaixo somente se quiser alterar a senha.</p>
              <div className="space-y-1.5">
                <Label htmlFor="gerente-senha">Nova senha</Label>
                <Input id="gerente-senha" type="password" value={gerenteSenha} onChange={e => setGerenteSenha(e.target.value)} placeholder="Mínimo 6 caracteres" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="gerente-confirmar">Confirmar nova senha</Label>
                <Input id="gerente-confirmar" type="password" value={gerenteConfirmarSenha} onChange={e => setGerenteConfirmarSenha(e.target.value)} placeholder="Repita a senha" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogGerente(false)} disabled={salvandoGerente}>Cancelar</Button>
            <Button onClick={salvarGerente} disabled={salvandoGerente || carregandoGerente}>
              {salvandoGerente ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Editar Nome */}
      <Dialog open={dialogEditarNome} onOpenChange={setDialogEditarNome}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Editar nome — {empresaEditando?.tipo === "matriz" ? "Matriz" : "Filial"}</DialogTitle>
            <DialogDescription>Altere o nome exibido para esta empresa</DialogDescription>
          </DialogHeader>
          <div>
            <Label htmlFor="novo-nome">Nome</Label>
            <Input
              id="novo-nome" className="mt-1" value={novoNome}
              onChange={e => setNovoNome(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") salvarNome(); }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogEditarNome(false)} disabled={salvandoNome}>Cancelar</Button>
            <Button onClick={salvarNome} disabled={salvandoNome || !novoNome.trim()}>
              {salvandoNome ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Excluir Filial */}
      <Dialog open={dialogExcluir} onOpenChange={v => { setDialogExcluir(v); if (!v) setConfirmacaoNome(""); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-4 w-4" />
              Excluir Filial
            </DialogTitle>
            <DialogDescription>
              Esta ação é irreversível. Todos os dados de configuração da filial serão removidos e o acesso do gerente será revogado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
              <p className="text-sm font-semibold">{empresaExcluindo?.nome}</p>
              {empresaExcluindo?.cidade && (
                <p className="text-xs text-muted-foreground">{empresaExcluindo.cidade}{empresaExcluindo.estado ? ` — ${empresaExcluindo.estado}` : ""}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirmar-nome" className="text-sm">
                Digite <strong>{empresaExcluindo?.nome}</strong> para confirmar:
              </Label>
              <Input
                id="confirmar-nome" value={confirmacaoNome}
                onChange={e => setConfirmacaoNome(e.target.value)}
                placeholder={empresaExcluindo?.nome}
                autoComplete="off"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogExcluir(false)} disabled={excluindo}>Cancelar</Button>
            <Button
              variant="destructive" onClick={handleExcluir}
              disabled={excluindo || confirmacaoNome !== empresaExcluindo?.nome}
            >
              {excluindo ? "Excluindo..." : "Excluir Filial"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Metas */}
      <Dialog open={dialogMetasAberto} onOpenChange={setDialogMetasAberto}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Metas — {empresaMetas?.nome}</DialogTitle>
            <DialogDescription>Defina as metas mensais para esta empresa</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Período:</label>
              <select value={metasForm.periodo} onChange={e => setMetasForm(f => ({ ...f, periodo: e.target.value as "mensal" | "semanal" }))}
                className="rounded-md border border-input bg-background px-3 py-1.5 text-sm">
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
                <Input type="number" placeholder="0" className="mt-1"
                  value={metasForm[key]}
                  onChange={e => setMetasForm(f => ({ ...f, [key]: e.target.value }))}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogMetasAberto(false)}>Cancelar</Button>
            <Button onClick={salvarTodasMetas}>Salvar Metas</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Notificações */}
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
                <div className="flex items-center gap-2">
                  <span>{icon}</span>
                  <p className="text-sm font-medium">{label}</p>
                </div>
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
