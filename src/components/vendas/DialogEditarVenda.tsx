import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Venda } from "@/types/venda";
import { formatCurrency } from "@/lib/formatters";
import { ValorMonetario } from "@/components/ui/valor-monetario";

interface DialogEditarVendaProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  venda: Venda | null;
  onSalvar: (vendaId: string, dados: {
    forma_pagamento: string;
    data_prevista_recebimento?: string | null;
    parcela_numero?: number | null;
    total_parcelas?: number | null;
  }) => Promise<boolean>;
  salvando?: boolean;
}

const FORMAS_PAGAMENTO = [
  { value: "dinheiro", label: "Dinheiro" },
  { value: "pix", label: "PIX" },
  { value: "debito", label: "Cartão de Débito" },
  { value: "credito", label: "Cartão de Crédito" },
  { value: "credito_parcelado", label: "Cartão Parcelado" },
  { value: "a_receber", label: "A Receber (A Prazo)" },
];

export const DialogEditarVenda = ({
  open,
  onOpenChange,
  venda,
  onSalvar,
  salvando = false,
}: DialogEditarVendaProps) => {
  const [formaPagamento, setFormaPagamento] = useState<string>("dinheiro");
  const [dataPrevista, setDataPrevista] = useState<string>("");
  const [parcelaNumero, setParcelaNumero] = useState<string>("");
  const [totalParcelas, setTotalParcelas] = useState<string>("");

  useEffect(() => {
    if (venda && open) {
      setFormaPagamento(venda.forma_pagamento || "dinheiro");
      setDataPrevista(venda.data_prevista_recebimento || "");
      setParcelaNumero(venda.parcela_numero?.toString() || "");
      setTotalParcelas(venda.total_parcelas?.toString() || "");
    }
  }, [venda, open]);

  const isAPrazo = formaPagamento === "a_receber";

  const handleSalvar = async () => {
    if (!venda) return;

    const dados: any = {
      forma_pagamento: formaPagamento,
    };

    if (isAPrazo) {
      dados.data_prevista_recebimento = dataPrevista || null;
      dados.parcela_numero = parcelaNumero ? parseInt(parcelaNumero) : null;
      dados.total_parcelas = totalParcelas ? parseInt(totalParcelas) : null;
    } else {
      // Se mudou de a_receber para outra forma, limpar os campos
      dados.data_prevista_recebimento = null;
      dados.parcela_numero = null;
      dados.total_parcelas = null;
    }

    const sucesso = await onSalvar(venda.id, dados);
    if (sucesso) {
      onOpenChange(false);
    }
  };

  if (!venda) return null;

  const itemNome =
    venda.tipo === "dispositivo" && venda.dispositivos
      ? `${venda.dispositivos.marca} ${venda.dispositivos.modelo}`
      : venda.produtos?.nome || venda.pecas?.nome || "Item";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Venda</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Info da venda */}
          <div className="rounded-lg border p-3 bg-muted/50 space-y-1">
            <p className="text-sm font-medium">{itemNome}</p>
            <p className="text-sm text-muted-foreground">
              Cliente: {venda.clientes?.nome || "Não informado"}
            </p>
            <p className="text-sm font-semibold">
              Valor: <ValorMonetario valor={venda.total} tipo="preco" />
            </p>
          </div>

          {/* Forma de pagamento */}
          <div className="space-y-2">
            <Label>Forma de Pagamento</Label>
            <Select value={formaPagamento} onValueChange={setFormaPagamento}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {FORMAS_PAGAMENTO.map((fp) => (
                  <SelectItem key={fp.value} value={fp.value}>
                    {fp.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Campos A Prazo / A Receber */}
          {isAPrazo && (
            <div className="space-y-4 rounded-lg border p-3 bg-muted/30">
              <p className="text-sm font-medium text-muted-foreground">
                Configuração do Pagamento a Prazo
              </p>

              <div className="space-y-2">
                <Label htmlFor="dataPrevista">Data Prevista de Recebimento</Label>
                <Input
                  id="dataPrevista"
                  type="date"
                  value={dataPrevista}
                  onChange={(e) => setDataPrevista(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="parcelaNumero">Parcela Nº</Label>
                  <Input
                    id="parcelaNumero"
                    type="number"
                    min="1"
                    placeholder="Ex: 1"
                    value={parcelaNumero}
                    onChange={(e) => setParcelaNumero(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="totalParcelas">Total de Parcelas</Label>
                  <Input
                    id="totalParcelas"
                    type="number"
                    min="1"
                    placeholder="Ex: 3"
                    value={totalParcelas}
                    onChange={(e) => setTotalParcelas(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={handleSalvar} disabled={salvando}>
            {salvando ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
