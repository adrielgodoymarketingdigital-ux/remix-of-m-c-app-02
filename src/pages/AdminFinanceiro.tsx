import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useAdminFinanceiro } from "@/hooks/useAdminFinanceiro";
import { DollarSign, Users, TrendingUp, CreditCard, RefreshCcw, AlertCircle, PieChart as PieIcon, CalendarClock, UserX, UserCheck, History, Search, MessageCircle, AlertTriangle, CheckCircle2, Clock, Phone, Download } from "lucide-react";
import { SecaoDesempenhoSistema } from "@/components/admin/SecaoDesempenhoSistema";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { aplicarMascaraTelefone } from "@/lib/mascaras";
import { toast } from "sonner";

const COLORS = ["hsl(var(--primary))", "#10b981", "#f59e0b", "#3b82f6", "#8b5cf6", "#ef4444"];

const formatBRL = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n || 0);

const formatDate = (iso: string) => {
  try {
    return format(new Date(iso), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return "—";
  }
};

export default function AdminFinanceiro() {
  const { data, isLoading: isLoadingRaw, error, refetch, isFetching } = useAdminFinanceiro();
  const isLoading = isLoadingRaw || isFetching;
  const planRows = Object.entries(data?.plan_breakdown ?? {}).sort(([a], [b]) => a.localeCompare(b));
  const totalDetalhamento = planRows.reduce((sum, [, plano]) => sum + plano.count, 0);
  const mrrDetalhamento = planRows.reduce((sum, [, plano]) => sum + plano.mrr, 0);

  const [buscaAssinantes, setBuscaAssinantes] = useState("");
  const [buscaExpirados, setBuscaExpirados] = useState("");
  const [mostrarInadimplentes, setMostrarInadimplentes] = useState(false);
  const [mostrarFaltaEntrar, setMostrarFaltaEntrar] = useState(false);
  const inadimplentesSectionRef = useRef<HTMLDivElement>(null);

  const inadimplenteIds = (data?.inadimplentes_detalhes ?? []).map((u) => u.user_id);

  const { data: cancelamentos } = useQuery({
    queryKey: ["admin-cancelamentos"],
    queryFn: async () => {
      const { data } = await supabase
        .from("assinaturas")
        .select("user_id, plano_tipo, status, motivo_cancelamento, cancelado_em, data_fim, payment_provider")
        .eq("status", "canceled")
        .order("cancelado_em", { ascending: false });

      const userIds = data?.map((d) => d.user_id) ?? [];
      const { data: profiles } = userIds.length
        ? await supabase.from("profiles").select("user_id, nome, email, celular").in("user_id", userIds)
        : { data: [] };

      return (data ?? []).map((d) => ({
        ...d,
        profile: profiles?.find((p) => p.user_id === d.user_id),
      }));
    },
  });

  const { data: tictoVencidos } = useQuery({
    queryKey: ["admin-ticto-vencidos"],
    queryFn: async () => {
      const { data } = await supabase
        .from("assinaturas")
        .select("user_id, plano_tipo, data_fim, payment_provider")
        .eq("status", "active")
        .eq("payment_provider", "ticto")
        .lt("data_fim", new Date().toISOString());

      const userIds = data?.map((d) => d.user_id) ?? [];
      const { data: profiles } = userIds.length
        ? await supabase.from("profiles").select("user_id, nome, email, celular").in("user_id", userIds)
        : { data: [] };

      return (data ?? []).map((d) => ({
        ...d,
        profile: profiles?.find((p) => p.user_id === d.user_id),
      }));
    },
  });

  const { data: emCarencia } = useQuery({
    queryKey: ["admin-em-carencia"],
    queryFn: async () => {
      const agora = new Date();
      const tresDiasAtras = new Date();
      tresDiasAtras.setDate(tresDiasAtras.getDate() - 3);

      const { data } = await supabase
        .from("assinaturas")
        .select("user_id, plano_tipo, data_fim, payment_provider")
        .eq("status", "active")
        .eq("payment_provider", "ticto")
        .lt("data_fim", agora.toISOString())
        .gt("data_fim", tresDiasAtras.toISOString())
        .order("data_fim", { ascending: true });

      const userIds = data?.map((d) => d.user_id) ?? [];
      if (userIds.length === 0) return [];

      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, nome, email, celular")
        .in("user_id", userIds);

      return (data ?? []).map((d) => {
        const profile = profiles?.find((p) => p.user_id === d.user_id);
        const dataFim = new Date(d.data_fim);
        const diasVencido = Math.floor((agora.getTime() - dataFim.getTime()) / (1000 * 60 * 60 * 24));
        const diasParaCancelar = 3 - diasVencido;
        return { ...d, profile, diasVencido, diasParaCancelar };
      });
    },
  });

  const PLANOS_PAGOS_KEYS = [
    "basico_mensal", "basico_anual",
    "intermediario_mensal", "intermediario_anual",
    "profissional_mensal", "profissional_anual",
    "profissional_ultra_mensal", "profissional_ultra_anual",
  ];

  const { data: naoRenovados } = useQuery({
    queryKey: ["admin-nao-renovados"],
    queryFn: async () => {
      const { data } = await supabase
        .from("assinaturas")
        .select("user_id, plano_tipo, status, data_fim, payment_provider, updated_at")
        .eq("status", "canceled")
        .in("plano_tipo", PLANOS_PAGOS_KEYS)
        .order("data_fim", { ascending: false });

      const userIds = data?.map((d) => d.user_id) ?? [];
      const { data: profiles } = userIds.length
        ? await supabase.from("profiles").select("user_id, nome, email, celular").in("user_id", userIds)
        : { data: [] };

      const agora = new Date();
      return (data ?? []).map((d) => {
        const dataFim = d.data_fim ? new Date(d.data_fim) : null;
        const diasVencido = dataFim ? Math.floor((agora.getTime() - dataFim.getTime()) / (1000 * 60 * 60 * 24)) : null;
        return {
          ...d,
          profile: profiles?.find((p) => p.user_id === d.user_id),
          diasVencido,
        };
      });
    },
  });

  const naoRenovadosSectionRef = useRef<HTMLDivElement>(null);
  const [mostrarNaoRenovados, setMostrarNaoRenovados] = useState(false);

  const exportarNaoRenovadosCsv = () => {
    const usuarios = naoRenovados ?? [];
    if (usuarios.length === 0) {
      toast.error("Nenhum usuário não renovado para exportar");
      return;
    }

    const escapeCsvValue = (value: string) => {
      if (value.includes(",") || value.includes('"') || value.includes("\n")) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };

    const headers = ["Nome", "Telefone", "Email"];
    const rows = usuarios.map((u) => [
      u.profile?.nome || "",
      u.profile?.celular ? aplicarMascaraTelefone(u.profile.celular) : "",
      u.profile?.email || "",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map(escapeCsvValue).join(",")),
    ].join("\n");

    const BOM = "﻿";
    const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `nao_renovados_${format(new Date(), "yyyy-MM-dd_HH-mm")}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(`${usuarios.length} usuário(s) exportado(s) com sucesso!`);
  };

  const { data: inadimplenteProfiles } = useQuery({
    queryKey: ["admin-inadimplentes-profiles", inadimplenteIds],
    queryFn: async () => {
      if (inadimplenteIds.length === 0) return [];
      const { data } = await supabase
        .from("profiles")
        .select("user_id, nome, celular")
        .in("user_id", inadimplenteIds);
      return data ?? [];
    },
    enabled: inadimplenteIds.length > 0,
  });

  const { data: whatsappTemplate } = useQuery({
    queryKey: ["admin-whatsapp-template-cancelamento"],
    queryFn: async () => {
      const { data } = await supabase
        .from("admin_whatsapp_templates")
        .select("mensagem")
        .eq("type", "cancelamento")
        .maybeSingle();
      return data?.mensagem ?? null;
    },
  });

  const buildWhatsAppUrl = (celular: string | null | undefined, nome: string | null | undefined) => {
    const numero = (celular ?? "").replace(/\D/g, "");
    if (!numero) return null;
    const mensagem = whatsappTemplate
      ? whatsappTemplate.replace("{nome}", nome ?? "")
      : `Olá ${nome ?? ""}! Vi que você cancelou seu plano no Méc App. Posso te ajudar com algo ou entender o motivo?`;
    return `https://wa.me/55${numero}?text=${encodeURIComponent(mensagem)}`;
  };

  const { data: breakdown } = useQuery({
    queryKey: ["admin-breakdown-plataforma"],
    queryFn: async () => {
      const { data } = await supabase
        .from("assinaturas")
        .select("payment_provider, status, data_fim")
        .in("payment_provider", ["ticto", "pagarme"]);

      const agora = new Date();

      const tictoAtivos = data?.filter((d) =>
        d.payment_provider === "ticto" &&
        d.status === "active" &&
        (!d.data_fim || new Date(d.data_fim) > agora)
      ).length || 0;

      const tictoVencidos = data?.filter((d) =>
        d.payment_provider === "ticto" &&
        d.status === "active" &&
        d.data_fim !== null &&
        new Date(d.data_fim) <= agora
      ).length || 0;

      const pagarmeAtivos = data?.filter((d) =>
        d.payment_provider === "pagarme" &&
        d.status === "active" &&
        (!d.data_fim || new Date(d.data_fim) > agora)
      ).length || 0;

      return { tictoAtivos, tictoVencidos, pagarmeAtivos };
    },
  });

  const assinantesFiltrados = useMemo(() => {
    const lista = data?.assinantes_detalhes ?? [];
    const q = buscaAssinantes.trim().toLowerCase();
    if (!q) return lista;
    return lista.filter((a) =>
      (a.nome || "").toLowerCase().includes(q) ||
      (a.email || "").toLowerCase().includes(q) ||
      (a.plano_nome || "").toLowerCase().includes(q)
    );
  }, [data?.assinantes_detalhes, buscaAssinantes]);

  const expiradosFiltrados = useMemo(() => {
    const lista = data?.expirados_detalhes ?? [];
    const q = buscaExpirados.trim().toLowerCase();
    if (!q) return lista;
    return lista.filter((a) =>
      (a.nome || "").toLowerCase().includes(q) ||
      (a.email || "").toLowerCase().includes(q) ||
      (a.plano_nome || "").toLowerCase().includes(q) ||
      (a.status || "").toLowerCase().includes(q)
    );
  }, [data?.expirados_detalhes, buscaExpirados]);

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-6 space-y-6 max-w-7xl">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2 tracking-tight">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-primary" />
              </div>
              Financeiro
            </h1>
            <p className="text-sm text-muted-foreground mt-1 ml-0.5">
              Visão consolidada de assinaturas e receitas — atualiza automaticamente
            </p>
          </div>
          <Button onClick={() => refetch()} disabled={isFetching} variant="outline" size="sm" className="gap-2">
            <RefreshCcw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            {isFetching ? "Atualizando…" : "Atualizar"}
          </Button>
        </div>

        {error && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="p-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-destructive">Erro ao carregar dados</p>
                <p className="text-muted-foreground">{(error as Error).message}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {data?.pagarme_error && (
          <Card className="border-amber-500/50 bg-amber-500/5">
            <CardContent className="p-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-amber-700 dark:text-amber-400">Aviso Pagar.me</p>
                <p className="text-muted-foreground">{data.pagarme_error}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            icon={<Users className="h-4 w-4" />}
            title="Assinantes Ativos"
            value={isLoading ? null : String(data?.assinantes_db ?? 0)}
            description="Pagaram e estão em dia"
            accent="blue"
          />
          <KpiCard
            icon={<UserX className="h-4 w-4" />}
            title="Inadimplentes"
            value={isLoading ? null : String(data?.assinantes_inadimplentes ?? 0)}
            description="Plano ativo com cobrança vencida"
            accent="red"
            onClick={() => {
              setMostrarInadimplentes(true);
              setTimeout(() => {
                inadimplentesSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
              }, 50);
            }}
          />
          <KpiCard
            icon={<TrendingUp className="h-4 w-4" />}
            title="MRR Total"
            value={isLoading ? null : formatBRL(data?.mrr_db ?? 0)}
            description="Receita recorrente mensal"
            accent="green"
          />
          <KpiCard
            icon={<CreditCard className="h-4 w-4" />}
            title="MRR Líquido Pagar.me"
            value={isLoading ? null : formatBRL(data?.mrr_pagarme_liquido ?? 0)}
            description={data ? `Bruto: ${formatBRL(data.mrr_pagarme_bruto)}` : "Após taxas"}
            accent="purple"
          />
          <KpiCard
            icon={<History className="h-4 w-4" />}
            title="Não Renovados"
            value={isLoading ? null : String(naoRenovados?.length ?? 0)}
            description="Plano vencido sem renovação"
            accent="red"
            onClick={() => {
              setMostrarNaoRenovados(true);
              setTimeout(() => {
                naoRenovadosSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
              }, 50);
            }}
          />
        </div>

        {/* Recorrência do mês */}
        {(() => {
          const entrou = data?.recorrencia_entrou_mes ?? 0;
          const falta = data?.recorrencia_falta_mes ?? 0;
          const faltaAte = data?.recorrencia_falta_ate
            ? format(new Date(data.recorrencia_falta_ate), "dd/MM", { locale: ptBR })
            : null;
          const total = entrou + falta;
          const pctEntrou = total > 0 ? (entrou / total) * 100 : 0;
          const mesNome = data?.mes
            ? format(new Date(data.mes.replace(/-/g, "/") + "/01"), "MMMM 'de' yyyy", { locale: ptBR })
            : format(new Date(), "MMMM 'de' yyyy", { locale: ptBR });
          return (
            <Card className="border-primary/20">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <DollarSign className="h-4 w-4 text-primary" />
                  Recorrência de Assinaturas — {mesNome.charAt(0).toUpperCase() + mesNome.slice(1)}
                </CardTitle>
                <CardDescription>Receita recorrente que já entrou e o que ainda falta receber dos assinantes vigentes</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="relative rounded-xl border border-sky-500/20 bg-card overflow-hidden mb-4">
                  <div className="h-0.5 w-full bg-gradient-to-r from-sky-500 to-cyan-400" />
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Recebido real este mês (Pagar.me)</span>
                      <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-sky-500/10 text-sky-400">
                        <CreditCard className="h-4 w-4" />
                      </div>
                    </div>
                    {isLoading ? (
                      <Skeleton className="h-8 w-32" />
                    ) : data?.recebido_real_error ? (
                      <div className="text-sm text-amber-600">Indisponível: {data.recebido_real_error}</div>
                    ) : (
                      <div className="text-2xl font-bold tracking-tight text-sky-500">{formatBRL(data?.recebido_real_mes ?? 0)}</div>
                    )}
                    <div className="text-xs text-muted-foreground mt-1">
                      Valor bruto efetivamente cobrado/liquidado na Pagar.me — igual ao extrato
                      {!isLoading && !data?.recebido_real_error && (
                        <span className="ml-1 font-medium text-sky-500">· {data?.recebido_real_mes_count ?? 0} cobrança(s)</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  <div className="relative rounded-xl border border-emerald-500/20 bg-card overflow-hidden">
                    <div className="h-0.5 w-full bg-gradient-to-r from-emerald-500 to-green-400" />
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Já entrou este mês</span>
                        <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-emerald-500/10 text-emerald-400">
                          <CheckCircle2 className="h-4 w-4" />
                        </div>
                      </div>
                      {isLoading ? (
                        <Skeleton className="h-8 w-32" />
                      ) : (
                        <div className="text-2xl font-bold tracking-tight text-emerald-500">{formatBRL(entrou)}</div>
                      )}
                      <div className="text-xs text-muted-foreground mt-1">Período pago — próxima cobrança além do mês</div>
                    </div>
                  </div>

                  <div
                    className={`relative rounded-xl border border-amber-500/20 bg-card overflow-hidden ${!isLoading ? "cursor-pointer hover:shadow-lg hover:shadow-black/20 transition-all duration-300" : ""}`}
                    onClick={() => !isLoading && setMostrarFaltaEntrar(true)}
                    title={!isLoading ? "Clique para ver quem falta pagar" : undefined}
                  >
                    <div className="h-0.5 w-full bg-gradient-to-r from-amber-500 to-orange-400" />
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Falta entrar este mês</span>
                        <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-amber-500/10 text-amber-400">
                          <Clock className="h-4 w-4" />
                        </div>
                      </div>
                      {isLoading ? (
                        <Skeleton className="h-8 w-32" />
                      ) : (
                        <div className="text-2xl font-bold tracking-tight text-amber-500">{formatBRL(falta)}</div>
                      )}
                      <div className="text-xs text-muted-foreground mt-1">
                        Renovação vence este mês — vigentes em dia
                        {!isLoading && faltaAte && (
                          <span className="ml-1 font-medium text-amber-500">· última renovação em {faltaAte}</span>
                        )}
                      </div>
                      {!isLoading && (
                        <p className="text-xs text-primary mt-2 font-medium">Clique para ver quem falta →</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Barra de progresso */}
                {!isLoading && total > 0 && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{pctEntrou.toFixed(0)}% recebido</span>
                      <span>Total esperado: {formatBRL(total)}</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-green-400 rounded-full transition-all duration-500"
                        style={{ width: `${pctEntrou}%` }}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })()}

        {/* Desempenho do Sistema */}
        <SecaoDesempenhoSistema data={data?.historico_crescimento} isLoading={isLoading} />

        {/* Breakdown por plataforma */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Ticto Ativos",   value: breakdown?.tictoAtivos   || 0, desc: "Vigentes no Ticto",    icon: <Users className="h-4 w-4" />,         bar: "from-amber-500 to-orange-400",  iconBg: "bg-amber-500/10 text-amber-400",     border: "border-amber-500/20"   },
            { label: "Ticto Vencidos", value: breakdown?.tictoVencidos || 0, desc: "Aguardando renovação", icon: <AlertTriangle className="h-4 w-4" />, bar: "from-red-500 to-rose-400",      iconBg: "bg-red-500/10 text-red-400",         border: "border-red-500/20"     },
            { label: "Pagar.me",       value: breakdown?.pagarmeAtivos || 0, desc: "Ativos no Pagar.me",   icon: <CreditCard className="h-4 w-4" />,    bar: "from-emerald-500 to-green-400", iconBg: "bg-emerald-500/10 text-emerald-400", border: "border-emerald-500/20" },
          ].map((item) => (
            <div key={item.label} className={`relative rounded-xl border ${item.border} bg-card overflow-hidden hover:shadow-lg hover:shadow-black/20 transition-all duration-300`}>
              <div className={`h-0.5 w-full bg-gradient-to-r ${item.bar}`} />
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">{item.label}</span>
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${item.iconBg}`}>
                    {item.icon}
                  </div>
                </div>
                <div className="text-3xl font-bold tracking-tight">{item.value}</div>
                <div className="text-xs text-muted-foreground mt-1">{item.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Card cancelamentos */}
        <Card className="border-red-500/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserX className="h-5 w-5 text-red-500" />
              Cancelamentos e Ticto Vencidos
            </CardTitle>
            <CardDescription>
              Assinaturas canceladas e assinaturas Ticto com período expirado
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="cancelados">
              <TabsList>
                <TabsTrigger value="cancelados">
                  Cancelados ({cancelamentos?.length ?? 0})
                </TabsTrigger>
                <TabsTrigger value="ticto-vencidos">
                  Ticto Vencidos ({tictoVencidos?.length ?? 0})
                </TabsTrigger>
                <TabsTrigger value="em-carencia" className="text-amber-600">
                  ⏳ Em Carência ({emCarencia?.length ?? 0})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="cancelados">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Plano</TableHead>
                        <TableHead>Motivo</TableHead>
                        <TableHead>Cancelado em</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(cancelamentos ?? []).map((c, i) => {
                        const waUrl = buildWhatsAppUrl(c.profile?.celular, c.profile?.nome);
                        return (
                          <TableRow key={`${c.user_id}-${i}`}>
                            <TableCell>
                              <div className="font-medium text-sm">{c.profile?.nome || "—"}</div>
                              <div className="text-xs text-muted-foreground">{c.profile?.email || "—"}</div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="text-xs">{c.plano_tipo || "—"}</Badge>
                            </TableCell>
                            <TableCell>
                              {c.motivo_cancelamento ? (
                                <Badge variant="outline" className="text-xs text-muted-foreground">
                                  {c.motivo_cancelamento}
                                </Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-sm">
                              {c.cancelado_em ? formatDate(c.cancelado_em) : "—"}
                            </TableCell>
                            <TableCell>
                              {waUrl && (
                                <Button asChild size="sm" variant="ghost" className="h-7 px-2">
                                  <a href={waUrl} target="_blank" rel="noopener noreferrer">
                                    <MessageCircle className="h-4 w-4 text-green-600" />
                                  </a>
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {(cancelamentos ?? []).length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                            Nenhum cancelamento registrado
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              <TabsContent value="ticto-vencidos">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Plano</TableHead>
                        <TableHead>Venceu em</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(tictoVencidos ?? []).map((c, i) => {
                        const waUrl = buildWhatsAppUrl(c.profile?.celular, c.profile?.nome);
                        return (
                          <TableRow key={`${c.user_id}-${i}`}>
                            <TableCell>
                              <div className="font-medium text-sm">{c.profile?.nome || "—"}</div>
                              <div className="text-xs text-muted-foreground">{c.profile?.email || "—"}</div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className="text-xs">{c.plano_tipo || "—"}</Badge>
                            </TableCell>
                            <TableCell className="text-sm">
                              {c.data_fim ? formatDate(c.data_fim) : "—"}
                            </TableCell>
                            <TableCell>
                              {waUrl && (
                                <Button asChild size="sm" variant="ghost" className="h-7 px-2">
                                  <a href={waUrl} target="_blank" rel="noopener noreferrer">
                                    <MessageCircle className="h-4 w-4 text-green-600" />
                                  </a>
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {(tictoVencidos ?? []).length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                            Nenhum Ticto vencido
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>
              <TabsContent value="em-carencia">
                {(emCarencia?.length ?? 0) === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhum usuário em período de carência
                  </p>
                ) : (
                  <div className="space-y-2">
                    {emCarencia?.map((u) => (
                      <div key={u.user_id} className="flex items-center justify-between p-3 rounded-lg border border-amber-200 bg-amber-50/30 dark:bg-amber-950/10">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{u.profile?.nome || "Sem nome"}</span>
                            <Badge variant="outline" className="text-amber-600 border-amber-400 text-[10px]">
                              {u.plano_tipo.replace(/_/g, " ")}
                            </Badge>
                            <Badge variant="outline" className="text-red-600 border-red-400 text-[10px]">
                              Venceu há {u.diasVencido}d
                            </Badge>
                            <Badge variant="outline" className={`text-[10px] ${u.diasParaCancelar <= 1 ? "text-red-600 border-red-400" : "text-amber-600 border-amber-400"}`}>
                              Cancela em {u.diasParaCancelar}d
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{u.profile?.email}</p>
                        </div>
                        {u.profile?.celular && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="ml-2 shrink-0 text-green-600 border-green-400 hover:bg-green-50"
                            onClick={() => {
                              const mensagem = encodeURIComponent(
                                `Olá ${u.profile?.nome}! Vimos que seu plano no Méc App venceu. Renove agora para continuar usando sem interrupções!`
                              );
                              const celular = u.profile?.celular?.replace(/\D/g, "");
                              window.open(`https://wa.me/55${celular}?text=${mensagem}`, "_blank");
                            }}
                          >
                            <MessageCircle className="h-4 w-4 mr-1" />
                            WhatsApp
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Recebimentos do mês cartão */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CreditCard className="h-5 w-5 text-primary" />
                A receber no mês (cartão)
              </CardTitle>
              <CardDescription>
                Cobranças automáticas previstas para {data?.mes ?? "—"} (repasse Pagar.me ~D+30)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {isLoading ? (
                <Skeleton className="h-20 w-full" />
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <Stat label="Bruto previsto" value={formatBRL(data?.total_receber_mes_bruto ?? 0)} />
                    <Stat label="Líquido estimado" value={formatBRL(data?.total_receber_mes_liquido ?? 0)} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {data?.recebimentos_cartao_mes.length ?? 0} cobrança(s) prevista(s)
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Distribuição por plano */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <PieIcon className="h-5 w-5 text-primary" />
                Assinaturas por plano
              </CardTitle>
              <CardDescription>Distribuição (banco de dados)</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : planRows.length > 0 ? (
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={planRows.map(([, v]) => ({
                          name: v.nome,
                          value: v.count,
                          mrr: v.mrr,
                        }))}
                        dataKey="value"
                        nameKey="name"
                        outerRadius={70}
                        label={(e) => `${e.name}: ${e.value}`}
                      >
                        {planRows.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: any, _name: any, props: any) => [
                          `${value} assinatura(s) — MRR ${formatBRL(props.payload.mrr)}`,
                          props.payload.name,
                        ]}
                      />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-8 text-center">Sem dados</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Tabela: assinaturas por plano */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Detalhamento por plano</CardTitle>
            {!isLoading && (
              <CardDescription>
                Total do detalhamento: {totalDetalhamento} assinatura(s)
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Plano</TableHead>
                    <TableHead className="text-right">Assinaturas</TableHead>
                    <TableHead className="text-right">MRR</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {planRows.map(([k, v]) => (
                    <TableRow key={k}>
                      <TableCell className="font-medium">{v.nome}</TableCell>
                      <TableCell className="text-right">{v.count}</TableCell>
                      <TableCell className="text-right">{formatBRL(v.mrr)}</TableCell>
                    </TableRow>
                  ))}
                  {planRows.length > 0 && (
                    <TableRow className="font-semibold bg-muted/40">
                      <TableCell>Total</TableCell>
                      <TableCell className="text-right">{totalDetalhamento}</TableCell>
                      <TableCell className="text-right">{formatBRL(mrrDetalhamento)}</TableCell>
                    </TableRow>
                  )}
                  {planRows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground py-6">
                        Sem assinaturas pagas ativas
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Renovações pendentes do mês */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClock className="h-5 w-5 text-primary" />
              Renovações pendentes do mês
            </CardTitle>
            <CardDescription>
              Cartão = renovação automática · Pix = ação manual do cliente
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Plano</TableHead>
                      <TableHead>Método</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="text-right">Líquido</TableHead>
                      <TableHead>Data prevista</TableHead>
                      <TableHead>Repasse</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.renovacoes_pendentes_mes.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <div className="font-medium text-sm">{r.customer_name || "—"}</div>
                          <div className="text-xs text-muted-foreground">{r.customer_email || "—"}</div>
                        </TableCell>
                        <TableCell className="text-sm">{r.plan_name}</TableCell>
                        <TableCell>
                          {r.payment_method === "credit_card" || r.payment_method === "cartao" ? (
                            <Badge variant="secondary" className="text-xs">Cartão (auto)</Badge>
                          ) : (
                            <Badge variant="default" className="text-xs bg-amber-500 hover:bg-amber-500/90">Pix (manual)</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-sm">{formatBRL(r.amount)}</TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">{formatBRL(r.amount_liquido)}</TableCell>
                        <TableCell className="text-sm">{formatDate(r.next_billing_at)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{formatDate(r.expected_payout_at)}</TableCell>
                      </TableRow>
                    ))}
                    {(!data || data.renovacoes_pendentes_mes.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                          Sem renovações pendentes neste mês
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Inadimplentes */}
        {mostrarInadimplentes && (
          <div ref={inadimplentesSectionRef}>
            <Card className="border-red-500/40">
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <UserX className="h-5 w-5 text-red-500" />
                      Inadimplentes
                      <Badge variant="destructive" className="ml-1">{data?.inadimplentes_detalhes.length ?? 0}</Badge>
                    </CardTitle>
                    <CardDescription>
                      Plano ativo com cobrança vencida — acesso bloqueado pelo sistema
                    </CardDescription>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setMostrarInadimplentes(false)}>
                    Fechar
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-32 w-full" />
                ) : (data?.inadimplentes_detalhes.length ?? 0) === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Nenhum inadimplente 🎉</p>
                ) : (
                  <div className="space-y-2">
                    {data?.inadimplentes_detalhes.map((u) => {
                      const profile = inadimplenteProfiles?.find((p) => p.user_id === u.user_id);
                      const celular = profile?.celular?.replace(/\D/g, "");
                      const mensagemWa = encodeURIComponent(
                        `Olá ${u.nome ?? ""}! Seu plano no Méc App está com pagamento em atraso. Regularize para continuar usando o sistema sem interrupções. Podemos te ajudar?`
                      );
                      const waUrl = celular ? `https://wa.me/55${celular}?text=${mensagemWa}` : null;
                      return (
                        <div key={u.user_id} className="flex items-center justify-between p-3 rounded-lg border border-red-200 bg-red-50/30 dark:bg-red-950/10 gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm">{u.nome || "Sem nome"}</span>
                              <Badge variant="secondary" className="text-[10px]">
                                {u.plano_nome}
                              </Badge>
                              <Badge variant="outline" className="text-[10px] capitalize">
                                {u.payment_provider || "—"}
                              </Badge>
                              {u.data_vencimento && (
                                <Badge variant="outline" className="text-red-600 border-red-400 text-[10px]">
                                  Venceu {formatDate(u.data_vencimento)}
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">{u.email || "—"}</p>
                            {profile?.celular && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                <Phone className="h-3 w-3" />
                                {profile.celular}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-sm font-semibold text-red-600">{formatBRL(u.valor_mensal)}</span>
                            {waUrl ? (
                              <Button asChild size="sm" variant="outline" className="text-green-600 border-green-400 hover:bg-green-50 dark:hover:bg-green-950">
                                <a href={waUrl} target="_blank" rel="noopener noreferrer">
                                  <MessageCircle className="h-4 w-4 mr-1" />
                                  WhatsApp
                                </a>
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground italic">Sem celular</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {mostrarNaoRenovados && (
          <div ref={naoRenovadosSectionRef}>
            <Card className="border-red-500/40">
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <History className="h-5 w-5 text-red-500" />
                      Não Renovados
                      <Badge variant="destructive" className="ml-1">{naoRenovados?.length ?? 0}</Badge>
                    </CardTitle>
                    <CardDescription>
                      Tinham plano pago, venceu há mais de 3 dias e não renovaram — acesso bloqueado
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={exportarNaoRenovadosCsv}
                      disabled={(naoRenovados?.length ?? 0) === 0}
                      className="gap-2"
                    >
                      <Download className="h-4 w-4" />
                      Exportar
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setMostrarNaoRenovados(false)}>
                      Fechar
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-32 w-full" />
                ) : (naoRenovados?.length ?? 0) === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Nenhum não renovado 🎉</p>
                ) : (
                  <div className="space-y-2">
                    {naoRenovados?.map((u) => {
                      const celular = u.profile?.celular?.replace(/\D/g, "");
                      const mensagemWa = encodeURIComponent(
                        `Olá ${u.profile?.nome ?? ""}! Notei que seu plano no Méc App venceu e não foi renovado. Posso te ajudar a reativar seu acesso?`
                      );
                      const waUrl = celular ? `https://wa.me/55${celular}?text=${mensagemWa}` : null;
                      return (
                        <div key={u.user_id} className="flex items-center justify-between p-3 rounded-lg border border-red-200 bg-red-50/30 dark:bg-red-950/10 gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-sm">{u.profile?.nome || "Sem nome"}</span>
                              <Badge variant="secondary" className="text-[10px] capitalize">
                                {u.plano_tipo.replace(/_/g, " ")}
                              </Badge>
                              <Badge variant="outline" className="text-[10px] capitalize">
                                {u.payment_provider || "—"}
                              </Badge>
                              {u.data_fim && (
                                <Badge variant="outline" className="text-red-600 border-red-400 text-[10px]">
                                  Venceu {formatDate(u.data_fim)}
                                  {u.diasVencido !== null ? ` (${u.diasVencido}d)` : ""}
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">{u.profile?.email || "—"}</p>
                            {u.profile?.celular && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                <Phone className="h-3 w-3" />
                                {u.profile.celular}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {waUrl ? (
                              <Button asChild size="sm" variant="outline" className="text-green-600 border-green-400 hover:bg-green-50 dark:hover:bg-green-950">
                                <a href={waUrl} target="_blank" rel="noopener noreferrer">
                                  <MessageCircle className="h-4 w-4 mr-1" />
                                  WhatsApp
                                </a>
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground italic">Sem celular</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Lista completa de assinantes vigentes */}
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <UserCheck className="h-5 w-5 text-emerald-600" />
                  Assinantes ativos
                </CardTitle>
                <CardDescription>
                  {data?.assinantes_detalhes.length ?? 0} assinante(s) pagante(s) em dia
                </CardDescription>
              </div>
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, email ou plano..."
                  value={buscaAssinantes}
                  onChange={(e) => setBuscaAssinantes(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Plano</TableHead>
                      <TableHead>Provedor</TableHead>
                      <TableHead>Próxima cobrança</TableHead>
                      <TableHead className="text-right">Valor mensal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assinantesFiltrados.map((u) => (
                      <TableRow key={u.user_id}>
                        <TableCell>
                          <div className="font-medium text-sm">{u.nome || "—"}</div>
                          <div className="text-xs text-muted-foreground">{u.email || "—"}</div>
                        </TableCell>
                        <TableCell className="text-sm">
                          <Badge variant="secondary" className="text-xs">{u.plano_nome}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs capitalize">
                            {u.payment_provider || "—"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {u.proxima_cobranca ? formatDate(u.proxima_cobranca) : "—"}
                        </TableCell>
                        <TableCell className="text-right text-sm">{formatBRL(u.valor_mensal)}</TableCell>
                      </TableRow>
                    ))}
                    {assinantesFiltrados.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                          {buscaAssinantes ? "Nenhum assinante encontrado" : "Sem assinantes ativos"}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Lista de planos expirados */}
        <Card className="border-muted-foreground/20">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <History className="h-5 w-5 text-muted-foreground" />
                  Planos expirados
                </CardTitle>
                <CardDescription>
                  {data?.total_expirados ?? 0} usuário(s) com assinatura cancelada, vencida ou em atraso
                </CardDescription>
              </div>
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, email, plano ou status..."
                  value={buscaExpirados}
                  onChange={(e) => setBuscaExpirados(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Último plano</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Provedor</TableHead>
                      <TableHead>Expirou em</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expiradosFiltrados.map((u) => (
                      <TableRow key={`${u.user_id}-${u.plano_tipo}`}>
                        <TableCell>
                          <div className="font-medium text-sm">{u.nome || "—"}</div>
                          <div className="text-xs text-muted-foreground">{u.email || "—"}</div>
                        </TableCell>
                        <TableCell className="text-sm">{u.plano_nome}</TableCell>
                        <TableCell>
                          <Badge
                            variant={u.status === "past_due" ? "destructive" : "outline"}
                            className="text-xs capitalize"
                          >
                            {u.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs capitalize">
                            {u.payment_provider || "—"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {u.data_expiracao ? formatDate(u.data_expiracao) : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                    {expiradosFiltrados.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                          {buscaExpirados ? "Nenhum resultado" : "Sem planos expirados"}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dialog: quem falta entrar este mês */}
        <Dialog open={mostrarFaltaEntrar} onOpenChange={setMostrarFaltaEntrar}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-amber-500" />
                Falta entrar este mês
                <Badge variant="outline" className="ml-1 text-amber-600 border-amber-400">
                  {data?.recorrencia_falta_detalhes?.length ?? 0}
                </Badge>
              </DialogTitle>
              <DialogDescription>
                Assinantes vigentes (Pagar.me, em dia) cuja renovação ainda está pendente neste mês
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              {(data?.recorrencia_falta_detalhes?.length ?? 0) === 0 ? (
                <p className="text-center text-muted-foreground py-8">Ninguém pendente este mês 🎉</p>
              ) : (
                data?.recorrencia_falta_detalhes.map((u) => (
                  <div key={u.user_id} className="flex items-center justify-between p-3 rounded-lg border border-amber-200 bg-amber-50/30 dark:bg-amber-950/10 gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{u.nome || "Sem nome"}</span>
                        <Badge variant="secondary" className="text-[10px]">{u.plano_nome}</Badge>
                        <Badge variant="outline" className="text-[10px] capitalize">{u.payment_provider || "—"}</Badge>
                        <Badge variant="outline" className="text-amber-600 border-amber-400 text-[10px]">
                          Vence {formatDate(u.data_vencimento)}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{u.email || "—"}</p>
                    </div>
                    <span className="text-sm font-semibold text-amber-600 shrink-0">{formatBRL(u.valor_mensal)}</span>
                  </div>
                ))
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Footer info */}
        {data && (
          <p className="text-xs text-muted-foreground text-center">
            Última atualização: {format(new Date(data.last_update), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
            {" · "}
            Taxas Pagar.me consideradas: cartão {(data.taxas.cartao_percentual * 100).toFixed(2)}% + {formatBRL(data.taxas.cartao_fixa)},
            Pix {(data.taxas.pix_percentual * 100).toFixed(2)}%
          </p>
        )}
      </div>
    </AppLayout>
  );
}

function KpiCard({
  icon,
  title,
  value,
  description,
  accent = "blue",
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  value: string | null;
  description?: string;
  accent?: "blue" | "red" | "green" | "purple";
  onClick?: () => void;
}) {
  const accents = {
    blue:   { glow: "before:from-blue-500/20",   iconBg: "bg-blue-500/10 text-blue-400",   bar: "from-blue-500 to-blue-400",   border: "border-blue-500/20"   },
    red:    { glow: "before:from-red-500/20",     iconBg: "bg-red-500/10 text-red-400",     bar: "from-red-500 to-red-400",     border: "border-red-500/20"    },
    green:  { glow: "before:from-emerald-500/20", iconBg: "bg-emerald-500/10 text-emerald-400", bar: "from-emerald-500 to-emerald-400", border: "border-emerald-500/20" },
    purple: { glow: "before:from-violet-500/20",  iconBg: "bg-violet-500/10 text-violet-400",  bar: "from-violet-500 to-violet-400",  border: "border-violet-500/20"  },
  };
  const a = accents[accent];
  return (
    <div
      className={`relative rounded-xl border ${a.border} bg-card overflow-hidden group hover:shadow-lg hover:shadow-black/20 transition-all duration-300 ${onClick ? "cursor-pointer" : ""}`}
      onClick={onClick}
      title={onClick ? "Clique para ver detalhes" : undefined}
    >
      {/* barra superior colorida */}
      <div className={`h-0.5 w-full bg-gradient-to-r ${a.bar}`} />
      <div className="p-5">
        <div className="flex items-start justify-between mb-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest leading-tight">{title}</p>
          <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${a.iconBg}`}>
            {icon}
          </div>
        </div>
        {value === null ? (
          <Skeleton className="h-9 w-28 mb-1" />
        ) : (
          <p className="text-3xl font-bold tracking-tight">{value}</p>
        )}
        {description && <p className="text-xs text-muted-foreground mt-1.5">{description}</p>}
        {onClick && <p className="text-xs text-primary mt-2 font-medium">Clique para ver →</p>}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/30 rounded-md p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}