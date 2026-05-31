import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Search, Pencil, Trash2, Phone, Package, CalendarClock, CheckCircle2, XCircle, ClipboardList, ShoppingCart } from "lucide-react";
import {
  usePedidos,
  FormularioPedido,
  Pedido,
  StatusPedido,
  STATUS_LABELS,
  STATUS_CORES,
} from "@/hooks/usePedidos";
import { formatCurrency } from "@/lib/formatters";
import { ListaCompras } from "@/components/pedidos/ListaCompras";

const STATUS_OPCOES: { value: StatusPedido; label: string }[] = [
  { value: "aguardando", label: "Aguardando" },
  { value: "confirmado", label: "Confirmado" },
  { value: "chegou", label: "Chegou" },
  { value: "entregue", label: "Entregue" },
  { value: "cancelado", label: "Cancelado" },
];

const FORM_VAZIO: FormularioPedido = {
  cliente_nome: "",
  cliente_telefone: "",
  descricao: "",
  status: "aguardando",
  pago: false,
  valor_total: "",
  previsao_chegada: "",
  observacoes: "",
};

type Aba = "pedidos" | "lista";

export default function Pedidos() {
  const { pedidos, loading, carregarPedidos, criarPedido, atualizarPedido, excluirPedido } = usePedidos();
  const [aba, setAba] = useState<Aba>("pedidos");
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<StatusPedido | "todos">("todos");
  const [dialogAberto, setDialogAberto] = useState(false);
  const [pedidoEditando, setPedidoEditando] = useState<Pedido | null>(null);
  const [pedidoExcluindo, setPedidoExcluindo] = useState<Pedido | null>(null);
  const [form, setForm] = useState<FormularioPedido>(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    carregarPedidos();
  }, [carregarPedidos]);

  const abrirNovo = () => {
    setPedidoEditando(null);
    setForm(FORM_VAZIO);
    setDialogAberto(true);
  };

  const abrirEditar = (pedido: Pedido) => {
    setPedidoEditando(pedido);
    setForm({
      cliente_nome: pedido.cliente_nome,
      cliente_telefone: pedido.cliente_telefone || "",
      descricao: pedido.descricao,
      status: pedido.status,
      pago: pedido.pago,
      valor_total: pedido.valor_total?.toString() || "",
      previsao_chegada: pedido.previsao_chegada || "",
      observacoes: pedido.observacoes || "",
    });
    setDialogAberto(true);
  };

  const handleSalvar = async () => {
    if (!form.cliente_nome.trim() || !form.descricao.trim()) return;
    setSalvando(true);
    let ok = false;
    if (pedidoEditando) {
      ok = await atualizarPedido(pedidoEditando.id, form);
    } else {
      ok = await criarPedido(form);
    }
    setSalvando(false);
    if (ok) {
      setDialogAberto(false);
      setForm(FORM_VAZIO);
    }
  };

  const handleExcluir = async () => {
    if (!pedidoExcluindo) return;
    await excluirPedido(pedidoExcluindo.id);
    setPedidoExcluindo(null);
  };

  const pedidosFiltrados = pedidos.filter((p) => {
    const matchBusca =
      p.cliente_nome.toLowerCase().includes(busca.toLowerCase()) ||
      p.descricao.toLowerCase().includes(busca.toLowerCase()) ||
      p.cliente_telefone?.includes(busca);
    const matchStatus = filtroStatus === "todos" || p.status === filtroStatus;
    return matchBusca && matchStatus;
  });

  const contadores = {
    total: pedidos.length,
    aguardando: pedidos.filter((p) => p.status === "aguardando").length,
    chegou: pedidos.filter((p) => p.status === "chegou").length,
    nao_pago: pedidos.filter((p) => !p.pago && p.status !== "cancelado" && p.status !== "entregue").length,
  };

  return (
    <AppLayout>
      <div className="container mx-auto p-4 space-y-6">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Pedidos / Encomendas</h1>
            <p className="text-sm text-muted-foreground">Gerencie pedidos e encomendas de clientes</p>
          </div>
          {aba === "pedidos" && (
            <Button onClick={abrirNovo}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Pedido
            </Button>
          )}
        </div>

        {/* Abas */}
        <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
          <button
            onClick={() => setAba("pedidos")}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              aba === "pedidos"
                ? "bg-background shadow text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <ClipboardList className="h-4 w-4" />
            Pedidos
          </button>
          <button
            onClick={() => setAba("lista")}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              aba === "lista"
                ? "bg-background shadow text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <ShoppingCart className="h-4 w-4" />
            Lista de Compras
          </button>
        </div>

        {/* Aba Lista de Compras */}
        {aba === "lista" && <ListaCompras />}

        {/* Conteúdo da aba Pedidos */}
        {aba === "pedidos" && <>

        {/* Cards de resumo */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-2xl font-bold">{contadores.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground">Aguardando</p>
              <p className="text-2xl font-bold text-yellow-600">{contadores.aguardando}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground">Chegaram</p>
              <p className="text-2xl font-bold text-purple-600">{contadores.chegou}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground">A Receber</p>
              <p className="text-2xl font-bold text-red-600">{contadores.nao_pago}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por cliente, descrição ou telefone..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select
            value={filtroStatus}
            onValueChange={(v) => setFiltroStatus(v as StatusPedido | "todos")}
          >
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              {STATUS_OPCOES.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Lista */}
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Carregando...</div>
        ) : pedidosFiltrados.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            {pedidos.length === 0 ? "Nenhum pedido cadastrado ainda." : "Nenhum pedido encontrado com esses filtros."}
          </div>
        ) : (
          <div className="space-y-3">
            {pedidosFiltrados.map((pedido) => (
              <Card key={pedido.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {/* Nome + status */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold truncate">{pedido.cliente_nome}</span>
                        <Badge className={`text-xs ${STATUS_CORES[pedido.status]}`}>
                          {STATUS_LABELS[pedido.status]}
                        </Badge>
                        {pedido.pago ? (
                          <Badge className="text-xs bg-green-100 text-green-800">
                            <CheckCircle2 className="h-3 w-3 mr-1" />Pago
                          </Badge>
                        ) : (
                          <Badge className="text-xs bg-orange-100 text-orange-800">
                            <XCircle className="h-3 w-3 mr-1" />Não pago
                          </Badge>
                        )}
                      </div>

                      {/* Descrição */}
                      <div className="flex items-start gap-1.5 mt-1.5">
                        <Package className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                        <p className="text-sm text-muted-foreground line-clamp-2">{pedido.descricao}</p>
                      </div>

                      {/* Telefone + previsão */}
                      <div className="flex items-center gap-4 mt-1.5 flex-wrap">
                        {pedido.cliente_telefone && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            {pedido.cliente_telefone}
                          </span>
                        )}
                        {pedido.previsao_chegada && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <CalendarClock className="h-3 w-3" />
                            Previsão: {new Date(pedido.previsao_chegada + "T00:00:00").toLocaleDateString("pt-BR")}
                          </span>
                        )}
                        {pedido.valor_total && (
                          <span className="text-sm font-semibold text-primary">
                            {formatCurrency(pedido.valor_total)}
                          </span>
                        )}
                      </div>

                      {pedido.observacoes && (
                        <p className="text-xs text-muted-foreground mt-1 italic line-clamp-1">
                          {pedido.observacoes}
                        </p>
                      )}
                    </div>

                    {/* Ações */}
                    <div className="flex gap-1 shrink-0">
                      <Button size="icon" variant="ghost" onClick={() => abrirEditar(pedido)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setPedidoExcluindo(pedido)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        </>}
      </div>

      {/* Dialog Novo / Editar */}
      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{pedidoEditando ? "Editar Pedido" : "Novo Pedido / Encomenda"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Cliente */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Nome do cliente *</Label>
                <Input
                  placeholder="Ex: João Silva"
                  value={form.cliente_nome}
                  onChange={(e) => setForm({ ...form, cliente_nome: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Telefone</Label>
                <Input
                  placeholder="Ex: (11) 99999-9999"
                  value={form.cliente_telefone}
                  onChange={(e) => setForm({ ...form, cliente_telefone: e.target.value })}
                />
              </div>
            </div>

            {/* O que pediu */}
            <div className="space-y-1.5">
              <Label>O que o cliente pediu *</Label>
              <Textarea
                placeholder="Ex: iPhone 15 Pro Max 256GB Titânio Natural"
                value={form.descricao}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                rows={3}
              />
            </div>

            {/* Status + Previsão */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm({ ...form, status: v as StatusPedido })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPCOES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Previsão de chegada</Label>
                <Input
                  type="date"
                  value={form.previsao_chegada}
                  onChange={(e) => setForm({ ...form, previsao_chegada: e.target.value })}
                />
              </div>
            </div>

            {/* Valor */}
            <div className="space-y-1.5">
              <Label>Valor total (R$)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="Ex: 4500,00"
                value={form.valor_total}
                onChange={(e) => setForm({ ...form, valor_total: e.target.value })}
              />
            </div>

            {/* Pago */}
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">Pagamento recebido</p>
                <p className="text-xs text-muted-foreground">Marque se o cliente já pagou</p>
              </div>
              <Switch
                checked={form.pago}
                onCheckedChange={(v) => setForm({ ...form, pago: v })}
              />
            </div>

            {/* Observações */}
            <div className="space-y-1.5">
              <Label>Observações</Label>
              <Textarea
                placeholder="Informações adicionais sobre o pedido..."
                value={form.observacoes}
                onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogAberto(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSalvar}
              disabled={salvando || !form.cliente_nome.trim() || !form.descricao.trim()}
            >
              {salvando ? "Salvando..." : pedidoEditando ? "Salvar alterações" : "Cadastrar pedido"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmar exclusão */}
      <AlertDialog open={!!pedidoExcluindo} onOpenChange={(o) => { if (!o) setPedidoExcluindo(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir pedido?</AlertDialogTitle>
            <AlertDialogDescription>
              O pedido de <strong>{pedidoExcluindo?.cliente_nome}</strong> será excluído permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleExcluir} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
