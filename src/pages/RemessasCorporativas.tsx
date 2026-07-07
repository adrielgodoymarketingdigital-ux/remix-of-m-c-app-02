import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { useRemessasCorporativas } from "@/hooks/useRemessasCorporativas";
import { useClientes } from "@/hooks/useClientes";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Package, Plus } from "lucide-react";

const STATUS_LABEL: Record<string, string> = {
  ativa: "Ativa",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  ativa: "default",
  concluida: "secondary",
  cancelada: "destructive",
};

function RemessasCorporativasContent() {
  const navigate = useNavigate();
  const { remessas, loading, criarRemessa } = useRemessasCorporativas();
  const { clientes } = useClientes();

  const [dialogAberto, setDialogAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [clienteId, setClienteId] = useState<string>("");

  const resetForm = () => {
    setNome("");
    setDescricao("");
    setClienteId("");
  };

  const handleCriar = async () => {
    if (!nome.trim()) return;

    setSalvando(true);
    const nova = await criarRemessa({
      nome: nome.trim(),
      descricao: descricao.trim() || undefined,
      cliente_id: clienteId || undefined,
    });
    setSalvando(false);

    if (nova) {
      setDialogAberto(false);
      resetForm();
    }
  };

  return (
    <main className="flex-1 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Remessas Corporativas</h1>
          <p className="text-muted-foreground">
            Gerencie remessas de dispositivos de clientes corporativos
          </p>
        </div>
        <Button onClick={() => setDialogAberto(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Remessa
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-6">
              <Skeleton className="h-24 w-full" />
            </Card>
          ))}
        </div>
      ) : remessas.length === 0 ? (
        <Card className="p-12 flex flex-col items-center justify-center text-center gap-3">
          <Package className="h-10 w-10 text-muted-foreground" />
          <div>
            <p className="font-medium">Nenhuma remessa cadastrada</p>
            <p className="text-sm text-muted-foreground">
              Crie uma nova remessa para começar a receber dispositivos corporativos.
            </p>
          </div>
          <Button onClick={() => setDialogAberto(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Remessa
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {remessas.map((remessa) => {
            const totalItens = remessa.itens?.length || 0;
            const recebidos = remessa.itens?.filter((i) => i.status === "recebido").length || 0;
            const pendentes = totalItens - recebidos;

            return (
              <Card
                key={remessa.id}
                className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => navigate(`/remessas/${remessa.id}`)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{remessa.nome}</CardTitle>
                    <Badge variant={STATUS_VARIANT[remessa.status] || "default"}>
                      {STATUS_LABEL[remessa.status] || remessa.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p className="text-muted-foreground">
                    {remessa.cliente_nome || "Sem cliente vinculado"}
                  </p>
                  <p className="text-muted-foreground">
                    {new Date(remessa.created_at).toLocaleDateString("pt-BR")}
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <Badge variant="outline">{totalItens} dispositivo(s)</Badge>
                    <Badge variant="secondary">{pendentes} pendente(s)</Badge>
                    <Badge variant="secondary">{recebidos} recebido(s)</Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog
        open={dialogAberto}
        onOpenChange={(v) => {
          setDialogAberto(v);
          if (!v) resetForm();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Remessa</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input
                placeholder="Ex: Remessa Loja Centro - Julho"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Textarea
                placeholder="Observações sobre esta remessa (opcional)"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Cliente</Label>
              <Select value={clienteId} onValueChange={setClienteId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um cliente (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  {clientes.map((cliente) => (
                    <SelectItem key={cliente.id} value={cliente.id}>
                      {cliente.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogAberto(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCriar} disabled={!nome.trim() || salvando}>
              {salvando ? "Salvando..." : "Criar Remessa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

export default function RemessasCorporativas() {
  return (
    <AppLayout>
      <RemessasCorporativasContent />
    </AppLayout>
  );
}
