import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Cliente } from "@/types/cliente";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { ValorMonetario } from "@/components/ui/valor-monetario";
import { Skeleton } from "@/components/ui/skeleton";
import { Share2 } from "lucide-react";
import { toast } from "sonner";
import { useClienteTracking } from "@/hooks/useClienteTracking";
import { useFuncionarioPermissoes } from "@/hooks/useFuncionarioPermissoes";

interface DialogHistoricoClienteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cliente: Cliente | null;
}

export function DialogHistoricoCliente({
  open,
  onOpenChange,
  cliente,
}: DialogHistoricoClienteProps) {
  const [loading, setLoading] = useState(true);
  const [vendas, setVendas] = useState<any[]>([]);
  const [ordensServico, setOrdensServico] = useState<any[]>([]);

  const { gerarLink, gerando } = useClienteTracking();
  const { lojaUserId, podeCompartilharLink } = useFuncionarioPermissoes();

  const handleCompartilharLink = async () => {
    if (!cliente) return;
    if (!podeCompartilharLink) {
      toast.error("Você não tem permissão para compartilhar o link de acompanhamento");
      return;
    }
    const link = await gerarLink(cliente.id, lojaUserId ?? undefined);
    if (!link) return;
    await navigator.clipboard.writeText(link);
    toast.success("Link de acompanhamento copiado!", {
      description: "O cliente vê todas as OS dele numa única página.",
    });
  };

  useEffect(() => {
    if (cliente && open) {
      carregarHistorico();
    }
  }, [cliente, open]);

  const carregarHistorico = async () => {
    if (!cliente) return;

    // Verificar usuário autenticado
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setLoading(true);
    try {
      // Buscar vendas do usuário atual
      const { data: vendasData } = await supabase
        .from("vendas")
        .select(`
          *,
          dispositivos (marca, modelo),
          produtos (nome)
        `)
        .eq("cliente_id", cliente.id)
        .eq("user_id", user.id)
        .order("data", { ascending: false });

      // Buscar ordens de serviço do usuário atual
      const { data: ordensData } = await supabase
        .from("ordens_servico")
        .select("*")
        .eq("cliente_id", cliente.id)
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      setVendas(vendasData || []);
      setOrdensServico(ordensData || []);
    } catch (error) {
      console.error("Erro ao carregar histórico:", error);
    } finally {
      setLoading(false);
    }
  };

  const totalGasto = vendas.reduce((acc, v) => acc + Number(v.total), 0) +
    ordensServico.reduce((acc, o) => acc + Number(o.total || 0), 0);

  if (!cliente) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl sm:max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-3 pr-6">
            <DialogTitle>Histórico de {cliente.nome}</DialogTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCompartilharLink}
              disabled={gerando}
              className="shrink-0"
            >
              <Share2 className="h-4 w-4 mr-2" />
              Compartilhar link
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Resumo */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-4">
              <p className="text-sm text-muted-foreground">Total Gasto</p>
              <p className="text-2xl font-bold"><ValorMonetario valor={totalGasto} /></p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-muted-foreground">Total de Compras</p>
              <p className="text-2xl font-bold">{vendas.length}</p>
            </Card>
            <Card className="p-4">
              <p className="text-sm text-muted-foreground">Ordens de Serviço</p>
              <p className="text-2xl font-bold">{ordensServico.length}</p>
            </Card>
          </div>

          {/* Histórico Detalhado */}
          <Tabs defaultValue="vendas">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="vendas">Vendas</TabsTrigger>
              <TabsTrigger value="servicos">Ordens de Serviço</TabsTrigger>
            </TabsList>

            <TabsContent value="vendas" className="space-y-4">
              {loading ? (
                <div className="space-y-2">
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
              ) : vendas.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhuma venda registrada
                </p>
              ) : (
                vendas.map((venda) => (
                  <Card key={venda.id} className="p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold">
                          {venda.tipo === "dispositivo"
                            ? `${venda.dispositivos?.marca} ${venda.dispositivos?.modelo}`
                            : venda.produtos?.nome}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(venda.data)}
                        </p>
                        <Badge variant="outline" className="mt-2">
                          {venda.tipo === "dispositivo" ? "Dispositivo" : "Produto"}
                        </Badge>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold">
                          <ValorMonetario valor={venda.total} />
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Qtd: {venda.quantidade}
                        </p>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </TabsContent>

            <TabsContent value="servicos" className="space-y-4">
              {loading ? (
                <div className="space-y-2">
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
              ) : ordensServico.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhuma ordem de serviço registrada
                </p>
              ) : (
                ordensServico.map((ordem) => (
                  <Card key={ordem.id} className="p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold">{ordem.numero_os}</p>
                        <p className="text-sm text-muted-foreground">
                          {ordem.dispositivo_marca} {ordem.dispositivo_modelo}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {formatDate(ordem.created_at)}
                        </p>
                        <Badge variant="outline" className="mt-2">
                          {ordem.status}
                        </Badge>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold">
                          <ValorMonetario valor={ordem.total || 0} />
                        </p>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
