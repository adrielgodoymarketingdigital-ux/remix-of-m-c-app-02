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
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Lock, Plus, Building2, Home, TrendingUp, Target, Bell,
  ChevronDown, ChevronUp, ExternalLink, AlertTriangle, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface MetricasEmpresa {
  faturamento_mes: number;
  os_mes: number;
  vendas_mes: number;
  ultimas_vendas: VendaItem[];
  vendas_por_tipo: VendaTipo[];
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

// ─── Constantes ──────────────────────────────────────────────────────────────

const CORES = ["#3b82f6", "#10b981", "#8b5cf6", "#f59e0b"];

const FORMA_PAGAMENTO_LABEL: Record<string, string> = {
  dinheiro: "Dinheiro", pix: "Pix", cartao_credito: "Crédito",
  cartao_debito: "Débito", a_receber: "A receber", a_prazo: "A prazo",
};

const TIPO_COR: Record<string, string> = {
  produto: "text-violet-400", peca: "text-blue-400",
  servico: "text-emerald-400", dispositivo: "text-amber-400", servico_avulso: "text-pink-400",
};

const formatarMoeda = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

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
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Acesso da Filial</p>
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
            ? <p className="text-xs text-muted-foreground text-center py-2">Nenhuma venda este mês</p>
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
            ? <p className="text-xs text-muted-foreground text-center py-2">Nenhuma venda este mês</p>
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

function CardEmpresa({ empresa, isMatriz, cor, onMetas, onNotificacoes, onVerVendas }: {
  empresa: EmpresaCard; isMatriz: boolean; cor: string;
  onMetas: () => void; onNotificacoes: () => void; onVerVendas: () => void;
}) {
  const [expandido, setExpandido] = useState(false);
  const metaFat = empresa.metas.find(m => m.tipo === "faturamento");
  const pctFat = metaFat && metaFat.valor > 0
    ? Math.min(100, (empresa.metricas.faturamento_mes / metaFat.valor) * 100) : null;

  return (
    <Card className={`flex flex-col ${isMatriz ? "border-amber-200 dark:border-amber-800/50" : "border-border/60"}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            {isMatriz
              ? <Home className="h-4 w-4 text-amber-500" />
              : <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: cor }} />
            }
            <span className="truncate">{empresa.nome}</span>
          </CardTitle>
          <Badge variant="outline" className={`text-xs shrink-0 ${isMatriz ? "border-amber-500/30 text-amber-500" : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"}`}>
            {isMatriz ? "Matriz" : "Filial"}
          </Badge>
        </div>
        {empresa.cidade && (
          <p className="text-xs text-muted-foreground">{empresa.cidade}{empresa.estado ? ` — ${empresa.estado}` : ""}</p>
        )}
      </CardHeader>
      <CardContent className="flex-1 space-y-4">
        <button onClick={() => setExpandido(v => !v)} className="w-full grid grid-cols-3 gap-2 text-center group">
          <div className="rounded-md bg-muted/40 p-2 group-hover:bg-muted/60 transition-colors">
            <p className="text-[10px] text-muted-foreground">Faturamento</p>
            <p className="text-sm font-semibold text-emerald-400">{formatarMoeda(empresa.metricas.faturamento_mes)}</p>
          </div>
          <div className="rounded-md bg-muted/40 p-2 group-hover:bg-muted/60 transition-colors">
            <p className="text-[10px] text-muted-foreground">OS</p>
            <p className="text-sm font-semibold text-blue-400">{empresa.metricas.os_mes}</p>
          </div>
          <div className="rounded-md bg-muted/40 p-2 group-hover:bg-muted/60 transition-colors">
            <p className="text-[10px] text-muted-foreground">Vendas</p>
            <p className="text-sm font-semibold text-violet-400">{empresa.metricas.vendas_mes}</p>
          </div>
        </button>

        <div className="flex items-center justify-center">
          <button onClick={() => setExpandido(v => !v)}
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
            {expandido ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {expandido ? "Ocultar vendas" : "Ver vendas"}
          </button>
        </div>

        {expandido && (
          <PainelVendas
            ultimas={empresa.metricas.ultimas_vendas || []}
            porTipo={empresa.metricas.vendas_por_tipo || []}
            onVerTodas={onVerVendas}
          />
        )}

        {pctFat !== null && !expandido && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Meta faturamento</span>
              <span>{pctFat.toFixed(0)}%</span>
            </div>
            <Progress value={pctFat} className="h-1.5" />
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <Button size="sm" className="flex-1 text-xs h-8" onClick={onMetas}>Metas</Button>
          <Button size="sm" variant="outline" className="text-xs h-8 px-2" onClick={onNotificacoes}>
            <Bell className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Página Principal ─────────────────────────────────────────────────────────

const PERMISSOES_PADRAO = {
  pdv: true, os: true, clientes: true, produtos: true,
  financeiro: false, relatorios: false, funcionarios: false, configuracoes: false, metas: false,
};

export default function MultiEmpresas() {
  const navigate = useNavigate();
  const { assinatura, carregando: carregandoAssinatura } = useAssinatura();
  const { nomeMatriz } = useEmpresa();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  // Dados
  const [todasEmpresas, setTodasEmpresas] = useState<EmpresaCard[]>([]);
  const [matrizMetricas, setMatrizMetricas] = useState<MetricasEmpresa>({
    faturamento_mes: 0, os_mes: 0, vendas_mes: 0, ultimas_vendas: [], vendas_por_tipo: [],
  });

  // Dialogs
  const [dialogNova, setDialogNova] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [dialogMetasAberto, setDialogMetasAberto] = useState(false);
  const [empresaMetas, setEmpresaMetas] = useState<EmpresaCard | null>(null);
  const [metasForm, setMetasForm] = useState({ faturamento: "", os: "", vendas: "", clientes: "", periodo: "mensal" as "mensal" | "semanal" });
  const [dialogNotifAberto, setDialogNotifAberto] = useState(false);
  const [empresaNotif, setEmpresaNotif] = useState<EmpresaCard | null>(null);
  const [notifForm, setNotifForm] = useState({ nova_os: true, os_entregue: true, nova_venda: true, meta_atingida: true, estoque_baixo: false });

  const filiais = todasEmpresas.filter(e => e.tipo !== "matriz");
  const matriz = todasEmpresas.find(e => e.tipo === "matriz");

  const carregarDados = useCallback(async () => {
    setIsLoading(true);
    setErro(null);
    try {
      const { data, error } = await supabase.functions.invoke("get-filiais-metricas");
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setTodasEmpresas(data.todasEmpresas || []);
      setMatrizMetricas(data.matrizMetricas || { faturamento_mes: 0, os_mes: 0, vendas_mes: 0, ultimas_vendas: [], vendas_por_tipo: [] });
    } catch (e: any) {
      setErro(e?.message || "Erro ao carregar dados");
      toast.error("Erro ao carregar Multi Empresas");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      supabase.from("user_roles").select("role").eq("user_id", data.user.id).eq("role", "admin").maybeSingle()
        .then(({ data: r }) => setIsAdmin(!!r));
    });
  }, []);

  useEffect(() => { carregarDados(); }, [carregarDados]);

  const isUltra = ["profissional_ultra_mensal", "profissional_ultra_anual"].includes(assinatura?.plano_tipo ?? "");
  const semAcesso = !carregandoAssinatura && assinatura !== null && !isAdmin && !isUltra;

  const handleCriar = async (dados: Record<string, string>) => {
    setSalvando(true);
    try {
      const response = await supabase.functions.invoke("criar-filial", { body: dados });
      if (response.error) { toast.error(response.error.message || "Erro ao criar filial"); return; }
      if (response.data?.error) { toast.error(response.data.error); return; }
      toast.success(response.data.mensagem || "Filial criada com sucesso!");
      setDialogNova(false);
      await carregarDados();
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

  // ─── Render: erro ──────────────────────────────────────────────────────────

  if (erro && !isLoading) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-8">
          <AlertTriangle className="h-12 w-12 text-destructive" />
          <p className="text-muted-foreground">{erro}</p>
          <Button onClick={carregarDados} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" /> Tentar novamente
          </Button>
        </div>
      </AppLayout>
    );
  }

  // Dados consolidados (todas as empresas)
  const fatTotal = todasEmpresas.reduce((s, e) => s + e.metricas.faturamento_mes, 0);
  const osTotal = todasEmpresas.reduce((s, e) => s + e.metricas.os_mes, 0);
  const vendasTotal = todasEmpresas.reduce((s, e) => s + e.metricas.vendas_mes, 0);

  const dadosGrafico = todasEmpresas.map((e, i) => ({
    nome: e.nome.length > 12 ? e.nome.substring(0, 12) + "…" : e.nome,
    faturamento: e.metricas.faturamento_mes,
    cor: e.tipo === "matriz" ? "#f59e0b" : CORES[i % CORES.length],
  }));

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
          <Button onClick={() => setDialogNova(true)} disabled={isLoading || filiais.length >= 3} className="shrink-0">
            <Plus className="h-4 w-4 mr-2" /> Nova Filial
          </Button>
        </div>

        {/* KPI consolidado */}
        <Card className="border-blue-500/40 bg-blue-500/5">
          <CardContent className="p-4">
            {isLoading ? <Skeleton className="h-16 w-full" /> : (
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Faturamento Total Consolidado</div>
                  <div className="text-3xl font-bold text-blue-500">{formatarMoeda(fatTotal)}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {todasEmpresas.length} empresa(s) — mês atual
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

        {/* Gráfico comparativo */}
        {!isLoading && dadosGrafico.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-blue-500" />
                Comparativo de Faturamento por Empresa
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={dadosGrafico}>
                  <XAxis dataKey="nome" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `R$${v}`} />
                  <Tooltip formatter={value => [formatarMoeda(Number(value)), "Faturamento"]} />
                  <Bar dataKey="faturamento" radius={[4, 4, 0, 0]}>
                    {dadosGrafico.map((item, i) => <Cell key={i} fill={item.cor} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
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

        {/* Grid de cards: Matriz + Filiais */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2].map(i => <Skeleton key={i} className="h-56 rounded-xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Card da Matriz */}
            {matriz && (
              <CardEmpresa
                empresa={matriz}
                isMatriz={true}
                cor="#f59e0b"
                onMetas={() => abrirMetas(matriz)}
                onNotificacoes={() => abrirNotificacoes(matriz)}
                onVerVendas={() => navigate("/vendas")}
              />
            )}

            {/* Cards das Filiais */}
            {filiais.map((empresa, i) => (
              <CardEmpresa
                key={empresa.id}
                empresa={empresa}
                isMatriz={false}
                cor={CORES[i % CORES.length]}
                onMetas={() => abrirMetas(empresa)}
                onNotificacoes={() => abrirNotificacoes(empresa)}
                onVerVendas={() => navigate("/vendas")}
              />
            ))}

            {/* Botão adicionar filial */}
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
