import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Bell, Send, Users, Clock, CheckCircle, Loader2, Smartphone, Eye, TestTube, Image, Link } from "lucide-react";
import NotificacoesAutomaticasAdmin from "@/components/admin/NotificacoesAutomaticasAdmin";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PushLog {
  id: string;
  created_at: string;
  titulo: string;
  mensagem: string;
  dados: {
    filter?: string;
    total_subscriptions?: number;
    sent?: number;
    failed?: number;
    notification?: {
      title: string;
      body: string;
    };
  };
}

interface SubscriptionStats {
  total: number;
  active: number;
}

export default function AdminPushNotifications() {
  const [titulo, setTitulo] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [url, setUrl] = useState("/dashboard");
  const [icone, setIcone] = useState("/pwa-192x192.png");
  const [filtro, setFiltro] = useState<string>("all");
  const [enviando, setEnviando] = useState(false);
  const [testando, setTestando] = useState(false);
  const [logs, setLogs] = useState<PushLog[]>([]);
  const [stats, setStats] = useState<SubscriptionStats>({ total: 0, active: 0 });
  const [loadingStats, setLoadingStats] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const carregarStats = async () => {
      try {
        setLoadingStats(true);
        const { count: activeCount } = await supabase
          .from("push_subscriptions")
          .select("*", { count: "exact", head: true })
          .eq("is_active", true);
        const { count: totalCount } = await supabase
          .from("push_subscriptions")
          .select("*", { count: "exact", head: true });
        setStats({ total: totalCount || 0, active: activeCount || 0 });
      } catch (error) {
        console.error("Erro ao carregar stats:", error);
      } finally {
        setLoadingStats(false);
      }
    };
    carregarStats();
  }, []);

  useEffect(() => {
    const carregarLogs = async () => {
      const { data } = await supabase
        .from("admin_notifications")
        .select("*")
        .eq("tipo", "push_enviado")
        .order("created_at", { ascending: false })
        .limit(10);
      if (data) setLogs(data as unknown as PushLog[]);
    };
    carregarLogs();
  }, [enviando, testando]);

  const enviarNotificacao = async (apenasAdmin = false) => {
    if (!titulo.trim() || !mensagem.trim()) {
      toast({ title: "Erro", description: "Título e mensagem são obrigatórios.", variant: "destructive" });
      return;
    }

    if (apenasAdmin) {
      setTestando(true);
    } else {
      setEnviando(true);
    }

    try {
      const { data, error } = await supabase.functions.invoke("send-push-notification", {
        body: {
          filter: apenasAdmin ? "admin" : filtro,
          notification: {
            title: titulo,
            body: mensagem,
            url: url || "/dashboard",
            icon: icone || "/pwa-192x192.png",
          },
        },
      });

      if (error) throw error;

      toast({
        title: apenasAdmin ? "Teste enviado!" : "Notificação enviada!",
        description: `Enviada para ${data.sent || 0} de ${data.total || 0} dispositivos.`,
      });

      if (!apenasAdmin) {
        setTitulo("");
        setMensagem("");
        setUrl("/dashboard");
        setIcone("/pwa-192x192.png");
      }
    } catch (error) {
      console.error("Erro ao enviar notificação:", error);
      toast({
        title: "Erro ao enviar",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setEnviando(false);
      setTestando(false);
    }
  };

  const templatesProntos = [
    {
      nome: "Trial Expirando",
      titulo: "⏰ Seu trial está acabando!",
      mensagem: "Restam poucos dias para aproveitar todos os recursos. Assine agora e não perca nada!",
      filtro: "trial_expiring",
    },
    {
      nome: "Trial Expirado",
      titulo: "😢 Seu acesso expirou",
      mensagem: "Que tal voltar? Assine agora e continue gerenciando sua assistência técnica com o Méc.",
      filtro: "expired",
    },
    {
      nome: "Novidade",
      titulo: "🚀 Novidade no Méc!",
      mensagem: "Acabamos de lançar uma nova funcionalidade. Confira agora!",
      filtro: "all",
    },
    {
      nome: "Agradecimento",
      titulo: "💜 Obrigado por usar o Méc!",
      mensagem: "Estamos sempre trabalhando para melhorar sua experiência. Conte com a gente!",
      filtro: "paid",
    },
  ];

  const aplicarTemplate = (template: (typeof templatesProntos)[0]) => {
    setTitulo(template.titulo);
    setMensagem(template.mensagem);
    setFiltro(template.filtro);
  };

  const filtroLabel: Record<string, string> = {
    all: "Todos",
    trial: "Em trial",
    trial_expiring: "Trial expirando",
    expired: "Expirados",
    paid: "Pagantes",
    admin: "Admins",
  };

  return (
    <AppLayout>
      <main className="flex-1 p-4 sm:p-6 overflow-auto">
        <div className="max-w-6xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
              <Bell className="h-7 w-7" />
              Push Notifications
            </h1>
            <p className="text-muted-foreground">
              Personalize e envie notificações push para os usuários
            </p>
          </div>

          {/* Stats */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Dispositivos Registrados</CardTitle>
                <Smartphone className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {loadingStats ? <Loader2 className="h-5 w-5 animate-spin" /> : stats.total}
                </div>
                <p className="text-xs text-muted-foreground">{stats.active} ativos</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Taxa de Ativação</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {loadingStats ? <Loader2 className="h-5 w-5 animate-spin" /> : stats.total > 0 ? `${Math.round((stats.active / stats.total) * 100)}%` : "0%"}
                </div>
                <p className="text-xs text-muted-foreground">dispositivos com notificações ativas</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Últimas Enviadas</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{logs.length}</div>
                <p className="text-xs text-muted-foreground">registros recentes</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Formulário */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Send className="h-5 w-5" />
                  Compor Notificação
                </CardTitle>
                <CardDescription>Personalize todos os campos da notificação push</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Templates */}
                <div>
                  <Label className="text-xs text-muted-foreground">Templates prontos</Label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {templatesProntos.map((template) => (
                      <Button key={template.nome} variant="outline" size="sm" onClick={() => aplicarTemplate(template)}>
                        {template.nome}
                      </Button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="filtro">Destinatários</Label>
                    <Select value={filtro} onValueChange={setFiltro}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o público" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os usuários</SelectItem>
                        <SelectItem value="trial">Em trial ativo</SelectItem>
                        <SelectItem value="trial_expiring">Trial expirando (2 dias)</SelectItem>
                        <SelectItem value="expired">Trial expirado</SelectItem>
                        <SelectItem value="paid">Assinantes pagos</SelectItem>
                        <SelectItem value="admin">Apenas admins</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="icone" className="flex items-center gap-1">
                      <Image className="h-3.5 w-3.5" />
                      Ícone
                    </Label>
                    <Input
                      id="icone"
                      placeholder="/pwa-192x192.png"
                      value={icone}
                      onChange={(e) => setIcone(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="titulo">Título</Label>
                  <Input
                    id="titulo"
                    placeholder="Ex: 🚀 Novidade no Méc!"
                    value={titulo}
                    onChange={(e) => setTitulo(e.target.value)}
                    maxLength={60}
                  />
                  <p className="text-xs text-muted-foreground">{titulo.length}/60 caracteres</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="mensagem">Mensagem</Label>
                  <Textarea
                    id="mensagem"
                    placeholder="Escreva a mensagem da notificação..."
                    value={mensagem}
                    onChange={(e) => setMensagem(e.target.value)}
                    maxLength={200}
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground">{mensagem.length}/200 caracteres</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="url" className="flex items-center gap-1">
                    <Link className="h-3.5 w-3.5" />
                    URL de destino
                  </Label>
                  <Input
                    id="url"
                    placeholder="/dashboard"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Página que abrirá ao clicar na notificação</p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => enviarNotificacao(true)}
                    disabled={testando || enviando || !titulo.trim() || !mensagem.trim()}
                    className="gap-2"
                  >
                    {testando ? <Loader2 className="h-4 w-4 animate-spin" /> : <TestTube className="h-4 w-4" />}
                    Testar (apenas admin)
                  </Button>
                  <Button
                    className="flex-1 gap-2"
                    onClick={() => enviarNotificacao(false)}
                    disabled={enviando || testando || !titulo.trim() || !mensagem.trim()}
                  >
                    {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Enviar para {filtroLabel[filtro] || filtro}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Preview */}
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    Preview — Android
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-zinc-900 rounded-2xl p-4 space-y-3">
                    {/* Status bar mock */}
                    <div className="flex items-center justify-between text-[10px] text-zinc-400 px-1">
                      <span>9:41</span>
                      <div className="flex gap-1 items-center">
                        <div className="w-4 h-2 border border-zinc-500 rounded-sm">
                          <div className="w-3 h-1.5 bg-zinc-400 rounded-sm" />
                        </div>
                      </div>
                    </div>
                    {/* Notification card */}
                    <div className="bg-zinc-800 rounded-xl p-3 shadow-lg border border-zinc-700">
                      <div className="flex gap-2.5 items-start">
                        <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center shrink-0 overflow-hidden">
                          {icone ? (
                            <img
                              src={icone}
                              alt="icon"
                              className="w-6 h-6 object-contain"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = "none";
                              }}
                            />
                          ) : (
                            <Bell className="h-4 w-4 text-primary" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] text-zinc-400 font-medium">Méc</span>
                            <span className="text-[9px] text-zinc-500">agora</span>
                          </div>
                          <p className="text-xs font-semibold text-zinc-100 leading-tight mt-0.5 truncate">
                            {titulo || "Título da notificação"}
                          </p>
                          <p className="text-[11px] text-zinc-400 leading-snug mt-0.5 line-clamp-3">
                            {mensagem || "Corpo da mensagem aparecerá aqui..."}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    Preview — iOS
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-gradient-to-b from-sky-100 to-sky-200 dark:from-zinc-800 dark:to-zinc-900 rounded-2xl p-4 space-y-3">
                    <div className="bg-white/90 dark:bg-zinc-700/90 rounded-2xl p-3 shadow-sm backdrop-blur">
                      <div className="flex gap-2.5 items-start">
                        <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shrink-0 overflow-hidden">
                          {icone ? (
                            <img
                              src={icone}
                              alt="icon"
                              className="w-7 h-7 object-contain"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = "none";
                              }}
                            />
                          ) : (
                            <Bell className="h-4 w-4 text-primary-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-semibold text-zinc-900 dark:text-zinc-100">MÉC</span>
                            <span className="text-[10px] text-zinc-500 dark:text-zinc-400">agora</span>
                          </div>
                          <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 leading-tight mt-0.5 truncate">
                            {titulo || "Título da notificação"}
                          </p>
                          <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-snug mt-0.5 line-clamp-3">
                            {mensagem || "Corpo da mensagem aparecerá aqui..."}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Notificações Automáticas */}
          <NotificacoesAutomaticasAdmin />

          {/* Histórico */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Histórico de Envios
              </CardTitle>
              <CardDescription>Últimas notificações enviadas</CardDescription>
            </CardHeader>
            <CardContent>
              {logs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Bell className="h-12 w-12 mx-auto mb-2 opacity-20" />
                  <p>Nenhuma notificação enviada ainda</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {logs.map((log) => (
                    <div key={log.id} className="p-3 rounded-lg border bg-muted/30">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">
                            {log.dados?.notification?.title || log.titulo}
                          </p>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {log.dados?.notification?.body || log.mensagem}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <Badge variant="secondary">
                            {log.dados?.sent ?? log.dados?.total_subscriptions ?? 0} enviadas
                          </Badge>
                          {(log.dados?.failed ?? 0) > 0 && (
                            <Badge variant="destructive" className="text-[10px]">
                              {log.dados?.failed} falharam
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                        <Users className="h-3 w-3" />
                        <span>{filtroLabel[log.dados?.filter || ""] || log.dados?.filter || "?"}</span>
                        <span>•</span>
                        <span>{format(new Date(log.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Info */}
          <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-800">
            <CardContent className="pt-6">
              <div className="flex gap-3">
                <Bell className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-medium text-amber-800 dark:text-amber-400">
                    Como funcionam as Push Notifications
                  </p>
                  <ul className="text-sm text-amber-700 dark:text-amber-500 space-y-1 list-disc list-inside">
                    <li>Usuários precisam permitir notificações nas configurações do app</li>
                    <li>As notificações são enviadas mesmo com o app fechado (Android)</li>
                    <li>No iOS, funciona apenas quando o app PWA está instalado (iOS 16.4+)</li>
                    <li>Use com moderação para não incomodar os usuários</li>
                    <li>Use o botão "Testar" para enviar apenas para admins antes de disparar para todos</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </AppLayout>
  );
}
