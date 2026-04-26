import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Search } from "lucide-react";
import { ItemOrcamento, Orcamento } from "@/types/orcamento";
import { useClientes } from "@/hooks/useClientes";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/formatters";

interface DialogCadastroOrcamentoProps {
  aberto: boolean;
  onFechar: () => void;
  onSalvar: (dados: Omit<Orcamento, "id" | "user_id" | "numero_orcamento" | "created_at" | "updated_at">) => Promise<void>;
  orcamentoEdicao?: Orcamento | null;
}

export function DialogCadastroOrcamento({
  aberto,
  onFechar,
  onSalvar,
  orcamentoEdicao,
}: DialogCadastroOrcamentoProps) {
  const { clientes } = useClientes();
  const [clienteId, setClienteId] = useState<string>("");
  const [clienteNome, setClienteNome] = useState("");
  const [clienteTelefone, setClienteTelefone] = useState("");
  const [clienteEmail, setClienteEmail] = useState("");
  const [itens, setItens] = useState<ItemOrcamento[]>([]);
  const [desconto, setDesconto] = useState(0);
  const [validadeDias, setValidadeDias] = useState(30);
  const [observacoes, setObservacoes] = useState("");
  const [termosCondicoes, setTermosCondicoes] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (orcamentoEdicao) {
      setClienteId(orcamentoEdicao.cliente_id || "");
      setClienteNome(orcamentoEdicao.cliente_nome || "");
      setClienteTelefone(orcamentoEdicao.cliente_telefone || "");
      setClienteEmail(orcamentoEdicao.cliente_email || "");
      setItens(orcamentoEdicao.itens || []);
      setDesconto(orcamentoEdicao.desconto || 0);
      setValidadeDias(orcamentoEdicao.validade_dias || 30);
      setObservacoes(orcamentoEdicao.observacoes || "");
      setTermosCondicoes(orcamentoEdicao.termos_condicoes || "");
    } else {
      limparFormulario();
    }
  }, [orcamentoEdicao, aberto]);

  const limparFormulario = () => {
    setClienteId("");
    setClienteNome("");
    setClienteTelefone("");
    setClienteEmail("");
    setItens([]);
    setDesconto(0);
    setValidadeDias(30);
    setObservacoes("");
    setTermosCondicoes("");
  };

  const handleClienteChange = (id: string) => {
    setClienteId(id);
    if (id) {
      const cliente = clientes.find((c) => c.id === id);
      if (cliente) {
        setClienteNome(cliente.nome);
        setClienteTelefone(cliente.telefone || "");
        setClienteEmail("");
      }
    }
  };

  const adicionarItem = () => {
    const novoItem: ItemOrcamento = {
      id: crypto.randomUUID(),
      tipo: "produto",
      descricao: "",
      quantidade: 1,
      valor_unitario: 0,
      valor_total: 0,
    };
    setItens([...itens, novoItem]);
  };

  const atualizarItem = (id: string, campo: keyof ItemOrcamento, valor: any) => {
    setItens(
      itens.map((item) => {
        if (item.id === id) {
          const novoItem = { ...item, [campo]: valor };
          if (campo === "quantidade" || campo === "valor_unitario") {
            novoItem.valor_total = novoItem.quantidade * novoItem.valor_unitario;
          }
          return novoItem;
        }
        return item;
      })
    );
  };

  const removerItem = (id: string) => {
    setItens(itens.filter((item) => item.id !== id));
  };

  const subtotal = itens.reduce((acc, item) => acc + item.valor_total, 0);
  const valorTotal = subtotal - desconto;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (itens.length === 0) return;

    setSalvando(true);
    try {
      await onSalvar({
        cliente_id: clienteId || undefined,
        cliente_nome: clienteNome,
        cliente_telefone: clienteTelefone,
        cliente_email: clienteEmail,
        status: "pendente",
        itens,
        subtotal,
        desconto,
        valor_total: valorTotal,
        validade_dias: validadeDias,
        observacoes,
        termos_condicoes: termosCondicoes,
      });
      onFechar();
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={onFechar}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {orcamentoEdicao ? "Editar Orçamento" : "Novo Orçamento"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Dados do Cliente */}
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Dados do Cliente</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cliente Cadastrado</Label>
                <Select value={clienteId || "none"} onValueChange={(v) => handleClienteChange(v === "none" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um cliente..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {clientes.map((cliente) => (
                      <SelectItem key={cliente.id} value={cliente.id}>
                        {cliente.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Nome do Cliente *</Label>
                <Input
                  value={clienteNome}
                  onChange={(e) => setClienteNome(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input
                  value={clienteTelefone}
                  onChange={(e) => setClienteTelefone(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>E-mail</Label>
                <Input
                  type="email"
                  value={clienteEmail}
                  onChange={(e) => setClienteEmail(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Itens do Orçamento */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg">Itens do Orçamento</h3>
              <Button type="button" variant="outline" size="sm" onClick={adicionarItem}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Item
              </Button>
            </div>

            {itens.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                Nenhum item adicionado. Clique em "Adicionar Item" para começar.
              </p>
            ) : (
              <div className="space-y-3">
                {itens.map((item, index) => (
                  <div
                    key={item.id}
                    className="grid grid-cols-12 gap-2 items-end p-3 border rounded-lg"
                  >
                    <div className="col-span-12 md:col-span-2">
                      <Label className="text-xs">Tipo</Label>
                      <Select
                        value={item.tipo}
                        onValueChange={(v) => atualizarItem(item.id, "tipo", v)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="produto">Produto</SelectItem>
                          <SelectItem value="servico">Serviço</SelectItem>
                          <SelectItem value="dispositivo">Dispositivo</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-12 md:col-span-4">
                      <Label className="text-xs">Descrição</Label>
                      <Input
                        value={item.descricao}
                        onChange={(e) =>
                          atualizarItem(item.id, "descricao", e.target.value)
                        }
                        placeholder="Descrição do item"
                        required
                      />
                    </div>
                    <div className="col-span-4 md:col-span-1">
                      <Label className="text-xs">Qtd</Label>
                      <Input
                        type="number"
                        min="1"
                        value={item.quantidade}
                        onChange={(e) =>
                          atualizarItem(item.id, "quantidade", parseInt(e.target.value) || 1)
                        }
                      />
                    </div>
                    <div className="col-span-4 md:col-span-2">
                      <Label className="text-xs">Valor Unit.</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.valor_unitario}
                        onChange={(e) =>
                          atualizarItem(item.id, "valor_unitario", parseFloat(e.target.value) || 0)
                        }
                      />
                    </div>
                    <div className="col-span-3 md:col-span-2">
                      <Label className="text-xs">Total</Label>
                      <Input
                        value={formatCurrency(item.valor_total)}
                        disabled
                        className="bg-muted"
                      />
                    </div>
                    <div className="col-span-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removerItem(item.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Totais */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted rounded-lg">
            <div className="space-y-2">
              <Label>Subtotal</Label>
              <Input value={formatCurrency(subtotal)} disabled className="bg-background" />
            </div>
            <div className="space-y-2">
              <Label>Desconto (R$)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={desconto}
                onChange={(e) => setDesconto(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-2">
              <Label>Valor Total</Label>
              <Input
                value={formatCurrency(valorTotal)}
                disabled
                className="bg-background font-bold text-lg"
              />
            </div>
          </div>

          {/* Configurações */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Validade (dias)</Label>
              <Input
                type="number"
                min="1"
                value={validadeDias}
                onChange={(e) => setValidadeDias(parseInt(e.target.value) || 30)}
              />
            </div>
          </div>

          {/* Observações */}
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Observações adicionais..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Termos e Condições</Label>
            <Textarea
              value={termosCondicoes}
              onChange={(e) => setTermosCondicoes(e.target.value)}
              placeholder="Termos e condições do orçamento..."
              rows={3}
            />
          </div>

          {/* Botões */}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onFechar}>
              Cancelar
            </Button>
            <Button type="submit" disabled={salvando || itens.length === 0}>
              {salvando ? "Salvando..." : "Salvar Orçamento"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
