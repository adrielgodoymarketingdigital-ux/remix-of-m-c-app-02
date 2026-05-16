import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useFuncionarioPermissoes } from "@/hooks/useFuncionarioPermissoes";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/formatters";
import { Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface VendaAvulsa {
  id: string;
  descricao: string;
  valor: number;
  forma_pagamento: string;
  observacao: string | null;
  created_at: string;
}

const FORMAS_PAGAMENTO: Record<string, string> = {
  dinheiro: "Dinheiro",
  pix: "Pix",
  credito: "Cartão de Crédito",
  debito: "Cartão de Débito",
  transferencia: "Transferência",
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVendaSalva?: () => void;
}

export function DialogVendaAvulsa({ open, onOpenChange, onVendaSalva }: Props) {
  const { lojaUserId } = useFuncionarioPermissoes();
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [formaPagamento, setFormaPagamento] = useState("");
  const [observacao, setObservacao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [vendasHoje, setVendasHoje] = useState<VendaAvulsa[]>([]);
  const [carregandoVendas, setCarregandoVendas] = useState(false);

  async function carregarVendasHoje() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const userId = lojaUserId ?? user.id;
    const agora = new Date();
    const inicioDia = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 0, 0, 0, 0).toISOString();
    const fimDia = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 23, 59, 59, 999).toISOString();

    setCarregandoVendas(true);
    const { data } = await supabase
      .from("vendas_avulsas")
      .select("id, descricao, valor, forma_pagamento, observacao, created_at")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .gte("created_at", inicioDia)
      .lte("created_at", fimDia)
      .order("created_at", { ascending: false });

    setVendasHoje(data ?? []);
    setCarregandoVendas(false);
  }

  async function handleOpenChange(nextOpen: boolean) {
    onOpenChange(nextOpen);
    if (nextOpen) {
      limparFormulario();
      await carregarVendasHoje();
    }
  }

  function limparFormulario() {
    setDescricao("");
    setValor("");
    setFormaPagamento("");
    setObservacao("");
  }

  async function salvarVendaAvulsa() {
    if (!descricao.trim()) {
      toast.error("Informe a descrição da venda");
      return;
    }
    if (!valor || parseFloat(valor.replace(",", ".")) <= 0) {
      toast.error("Informe um valor válido");
      return;
    }
    if (!formaPagamento) {
      toast.error("Selecione a forma de pagamento");
      return;
    }

    setSalvando(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSalvando(false); return; }

    const userId = lojaUserId ?? user.id;

    const { error } = await supabase
      .from("vendas_avulsas")
      .insert({
        user_id: userId,
        descricao: descricao.trim(),
        valor: parseFloat(valor.replace(",", ".")),
        forma_pagamento: formaPagamento,
        observacao: observacao.trim() || null,
      });

    if (error) {
      toast.error("Erro ao registrar venda");
      console.error(error);
    } else {
      toast.success("Venda avulsa registrada!");
      limparFormulario();
      await carregarVendasHoje();
      onVendaSalva?.();
    }

    setSalvando(false);
  }

  async function excluirVendaAvulsa(id: string) {
    const { error } = await supabase
      .from("vendas_avulsas")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      toast.error("Erro ao cancelar venda");
      return;
    }
    toast.success("Venda cancelada");
    await carregarVendasHoje();
    onVendaSalva?.();
  }

  const totalHoje = vendasHoje.reduce((acc, v) => acc + Number(v.valor), 0);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Venda Avulsa</DialogTitle>
          <DialogDescription>
            Registre uma venda rápida sem vincular produto ou cliente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Descrição *</Label>
            <Input
              placeholder="Ex: Capinha iPhone 15, Película, Cabo USB..."
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") salvarVendaAvulsa(); }}
            />
          </div>

          <div>
            <Label>Valor *</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="0,00"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
            />
          </div>

          <div>
            <Label>Forma de pagamento *</Label>
            <Select value={formaPagamento} onValueChange={setFormaPagamento}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dinheiro">Dinheiro</SelectItem>
                <SelectItem value="pix">Pix</SelectItem>
                <SelectItem value="credito">Cartão de Crédito</SelectItem>
                <SelectItem value="debito">Cartão de Débito</SelectItem>
                <SelectItem value="transferencia">Transferência</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Observação (opcional)</Label>
            <Textarea
              placeholder="Alguma observação sobre essa venda..."
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={salvarVendaAvulsa} disabled={salvando}>
            {salvando ? "Salvando..." : "Registrar Venda"}
          </Button>
        </DialogFooter>

        {/* Histórico do dia */}
        <div className="mt-2 border-t pt-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-muted-foreground">Vendas avulsas hoje</p>
            {vendasHoje.length > 0 && (
              <span className="text-sm font-semibold text-green-600">{formatCurrency(totalHoje)}</span>
            )}
          </div>

          {carregandoVendas ? (
            <p className="text-xs text-muted-foreground text-center py-3">Carregando...</p>
          ) : vendasHoje.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-3">Nenhuma venda avulsa hoje</p>
          ) : (
            <div className="space-y-2">
              {vendasHoje.map((v) => (
                <div
                  key={v.id}
                  className="flex items-center justify-between gap-2 rounded-lg border p-2.5 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{v.descricao}</p>
                    <p className="text-xs text-muted-foreground">
                      {FORMAS_PAGAMENTO[v.forma_pagamento] ?? v.forma_pagamento}
                      {" · "}
                      {format(new Date(v.created_at), "HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-semibold font-mono">{formatCurrency(Number(v.valor))}</span>
                    <button
                      onClick={() => excluirVendaAvulsa(v.id)}
                      className="p-1 rounded text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors"
                      title="Cancelar venda"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
