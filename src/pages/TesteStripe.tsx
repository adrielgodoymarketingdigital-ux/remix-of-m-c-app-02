import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAssinatura } from "@/hooks/useAssinatura";
import { PLANOS } from "@/types/plano";
import { STRIPE_PRICE_IDS } from "@/types/assinatura";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle2, XCircle, Clock, RefreshCw, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/formatters";
import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";

export default function TesteStripe() {
  const { assinatura, carregando, abrirPaginaPagamento, recarregar } = useAssinatura();
  const { toast } = useToast();
  const [testando, setTestando] = useState<string | null>(null);
  const [ultimosEventos, setUltimosEventos] = useState<any[]>([]);
  const [carregandoEventos, setCarregandoEventos] = useState(false);

  const carregarUltimosEventos = async () => {
    setCarregandoEventos(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("assinaturas").select("*").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(5);
      setUltimosEventos(data || []);
    } catch (error) { console.error("Erro:", error); }
    finally { setCarregandoEventos(false); }
  };

  useEffect(() => { carregarUltimosEventos(); }, [assinatura]);

  const handleTestarPlano = async (planoKey: string) => {
    setTestando(planoKey);
    try { await abrirPaginaPagamento(planoKey); }
    catch (error) { toast({ title: "Erro", description: error instanceof Error ? error.message : "Erro", variant: "destructive" }); }
    finally { setTestando(null); }
  };

  const getStatusColor = (status: string) => ({ active: "bg-green-100 text-green-800", trialing: "bg-blue-100 text-blue-800", canceled: "bg-red-100 text-red-800", past_due: "bg-orange-100 text-orange-800" }[status] || "bg-gray-100 text-gray-800");
  const getStatusIcon = (status: string) => ({ active: <CheckCircle2 className="h-4 w-4" />, trialing: <Clock className="h-4 w-4" />, canceled: <XCircle className="h-4 w-4" /> }[status] || <Clock className="h-4 w-4" />);

  return (
    <AppLayout>
      <main className="flex-1 p-6 space-y-6">
        <Card><CardHeader><div className="flex items-center justify-between"><div><CardTitle>Status da Assinatura</CardTitle><CardDescription>Estado atual</CardDescription></div><Button onClick={() => { recarregar(); carregarUltimosEventos(); }} variant="outline" size="sm" disabled={carregando}>{carregando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}Atualizar</Button></div></CardHeader><CardContent>{carregando ? <div className="flex items-center justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> : assinatura ? <div className="grid grid-cols-1 md:grid-cols-4 gap-4"><div><p className="text-sm text-muted-foreground mb-1">Plano</p><Badge variant="outline">{assinatura.plano_tipo}</Badge></div><div><p className="text-sm text-muted-foreground mb-1">Status</p><Badge className={getStatusColor(assinatura.status)}>{getStatusIcon(assinatura.status)}<span className="ml-1">{assinatura.status}</span></Badge></div><div><p className="text-sm text-muted-foreground mb-1">Customer ID</p><code className="text-xs bg-muted px-2 py-1 rounded">{assinatura.stripe_customer_id || "N/A"}</code></div><div><p className="text-sm text-muted-foreground mb-1">Subscription ID</p><code className="text-xs bg-muted px-2 py-1 rounded">{assinatura.stripe_subscription_id || "N/A"}</code></div></div> : <Alert><AlertDescription>Nenhuma assinatura</AlertDescription></Alert>}</CardContent></Card>
        <Card><CardHeader><CardTitle>Testar Checkout</CardTitle></CardHeader><CardContent><div className="grid grid-cols-1 md:grid-cols-3 gap-4">{Object.entries(PLANOS).map(([key, plano]) => <Card key={key} className="p-4"><div className="space-y-3"><h3 className="font-semibold">{plano.nome}</h3><p className="text-lg font-bold text-primary">{formatCurrency(plano.preco)}</p><code className="text-xs bg-muted px-2 py-1 rounded block truncate">{STRIPE_PRICE_IDS[key as keyof typeof STRIPE_PRICE_IDS]}</code><Button onClick={() => handleTestarPlano(key)} disabled={testando !== null} className="w-full" size="sm">{testando === key ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ExternalLink className="mr-2 h-4 w-4" />}Testar</Button></div></Card>)}</div></CardContent></Card>
      </main>
    </AppLayout>
  );
}
