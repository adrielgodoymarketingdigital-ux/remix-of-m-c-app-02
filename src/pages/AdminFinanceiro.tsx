import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAdminFinanceiro } from "@/hooks/useAdminFinanceiro";
import { DollarSign, Users, TrendingUp, CreditCard, RefreshCcw, AlertCircle, PieChart as PieIcon, CalendarClock, UserX, UserCheck, History, Search, MessageCircle, AlertTriangle } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
  const { data, isLoading, error, refetch, isFetching } = useAdminFinanceiro();
  const planRows = Object.entries(data?.plan_breakdown ?? {}).sort(([a], [b]) => a.localeCompare(b));
  const totalDetalhamento = planRows.reduce((sum, [, plano]) => sum + plano.count, 0);
  const mrrDetalhamento = planRows.reduce((sum, [, plano]) => sum + plano.mrr, 0);

  const [buscaAssinantes, setBuscaAssinantes] = useState("");
  const [buscaExpirados, setBuscaExpirados] = useState("");

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
        .select("payment_provider, status, data_fim, plano_tipo")
        .in("plano_tipo", [
          "basico_mensal", "basico_anual",
          "intermediario_mensal", "intermediario_anual",
          "profissional_mensal", "profissional_anual",
        ]);

      const agora = new Date();

      const tictoAtivos = data?.filter((d) =>
        d.payment_provider === "ticto" &&
        d.status === "active" &&
        (!d.data_fim || new Date(d.data_fim) > agora)
      ).length || 0;

      const tictoVencidos = data?.filter((d) =>
        d.payment_provider === "ticto" &&
        d.status === "active" &&
        d.data_fim && new Date(d.data_fim) <= agora
      ).length || 0;

      const pagarmeAtivos = data?.filter((d) =>
        d.payment_provider === "pagarme" &&
        d.status === "active" &&
        (!d.data_fim || new Date(d.data_fim) > agora)
      ).length || 0;

      const stripeAtivos = data?.filter((d) =>
        d.payment_provider === "stripe" &&
        d.status === "active" &&
        (!d.data_fim || new Date(d.data_fim) > agora)
      ).length || 0;

      return { tictoAtivos, tictoVencidos, pagarmeAtivos, stripeAtivos };
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
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              <DollarSign className="h-7 w-7 text-primary" />
              Financeiro
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Visão consolidada de assinaturas e receitas (banco de dados + Pagar.me)
            </p>
          </div>
          <Button onClick={() => refetch()} disabled={isFetching} variant="outline" size="sm">
            <RefreshCcw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
            Atualizar
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
            icon={<Users className="h-5 w-5" />}
            title="Assinantes pagantes (vigentes)"
            value={isLoading ? null : String(data?.assinantes_db ?? 0)}
            description="Pagaram e estão em dia"
          />
          <KpiCard
            icon={<UserX className="h-5 w-5" />}
            title="Inadimplentes"
            value={isLoading ? null : String(data?.assinantes_inadimplentes ?? 0)}
            description="Status ativo, mas com cobrança vencida"
          />
          <KpiCard
            icon={<TrendingUp className="h-5 w-5" />}
            title="MRR Banco de Dados"
            value={isLoading ? null : formatBRL(data?.mrr_db ?? 0)}
            description="Considera apenas assinantes vigentes"
          />
          <KpiCard
            icon={<TrendingUp className="h-5 w-5" />}
            title="MRR Pagar.me (líquido)"
            value={isLoading ? null : formatBRL(data?.mrr_pagarme_liquido ?? 0)}
            description={
              data
                ? `Bruto: ${formatBRL(data.mrr_pagarme_bruto)}`
                : "Após descontos da Pagar.me"
            }
          />
        </div>

        {/* Breakdown por plataforma */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-amber-200 bg-amber-50/30 dark:bg-amber-950/10">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-amber-700 uppercase tracking-wider">Ticto Ativos</span>
                <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center">
                  <Users className="h-4 w-4 text-amber-600" />
                </div>
              </div>
              <div className="text-3xl font-bold text-amber-600">{breakdown?.tictoAtivos || 0}</div>
              <div className="text-xs text-muted-foreground mt-1">Vigentes no Ticto</div>
            </CardContent>
          </Card>

          <Card className="border-red-200 bg-red-50/30 dark:bg-red-950/10">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-red-700 uppercase tracking-wider">Ticto Vencidos</span>
                <div className="h-8 w-8 rounded-full bg-red-100 flex items-center justify-center">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                </div>
              </div>
              <div className="text-3xl font-bold text-red-600">{breakdown?.tictoVencidos || 0}</div>
              <div className="text-xs text-muted-foreground mt-1">Não renovaram no Pagar.me</div>
            </CardContent>
          </Card>

          <Card className="border-green-200 bg-green-50/30 dark:bg-green-950/10">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-green-700 uppercase tracking-wider">Pagar.me</span>
                <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                  <CreditCard className="h-4 w-4 text-green-600" />
                </div>
              </div>
              <div className="text-3xl font-bold text-green-600">{breakdown?.pagarmeAtivos || 0}</div>
              <div className="text-xs text-muted-foreground mt-1">Migraram para Pagar.me</div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 bg-slate-50/30 dark:bg-slate-950/10">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-700 uppercase tracking-wider">Stripe</span>
                <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center">
                  <CreditCard className="h-4 w-4 text-slate-600" />
                </div>
              </div>
              <div className="text-3xl font-bold text-slate-600">{breakdown?.stripeAtivos || 0}</div>
              <div className="text-xs text-muted-foreground mt-1">Legado Stripe</div>
            </CardContent>
          </Card>
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
        <Card className="border-amber-500/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserX className="h-5 w-5 text-amber-600" />
              Assinantes inadimplentes
            </CardTitle>
            <CardDescription>
              Assinaturas com status "ativo" no banco, mas com data de cobrança vencida (acesso já bloqueado pelo sistema)
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
                      <TableHead>Provedor</TableHead>
                      <TableHead>Vencido em</TableHead>
                      <TableHead className="text-right">Valor mensal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.inadimplentes_detalhes.map((u) => (
                      <TableRow key={u.user_id}>
                        <TableCell>
                          <div className="font-medium text-sm">{u.nome || "—"}</div>
                          <div className="text-xs text-muted-foreground">{u.email || "—"}</div>
                        </TableCell>
                        <TableCell className="text-sm">{u.plano_nome}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs capitalize">
                            {u.payment_provider || "—"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {u.data_vencimento ? formatDate(u.data_vencimento) : "—"}
                        </TableCell>
                        <TableCell className="text-right text-sm">{formatBRL(u.valor_mensal)}</TableCell>
                      </TableRow>
                    ))}
                    {(!data || data.inadimplentes_detalhes.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-6">
                          Nenhum inadimplente 🎉
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

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
}: {
  icon: React.ReactNode;
  title: string;
  value: string | null;
  description?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground font-medium">{title}</p>
          <div className="text-primary">{icon}</div>
        </div>
        <div className="mt-2">
          {value === null ? (
            <Skeleton className="h-8 w-24" />
          ) : (
            <p className="text-2xl font-bold">{value}</p>
          )}
          {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
        </div>
      </CardContent>
    </Card>
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