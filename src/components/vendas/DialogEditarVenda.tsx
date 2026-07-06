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
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useFormasPagamentoCustomizadas } from "@/hooks/useFormasPagamentoCustomizadas";
import { extrairNomeFormaCustomizada } from "@/lib/formaPagamento";

interface DialogEditarVendaProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  venda: Venda | null;
  onSalvar: (vendaId: string, dados: {
    forma_pagamento: string;
    data_prevista_recebimento?: string | null;
    parcela_numero?: number | null;
    total_parcelas?: number | null;
    total?: number;
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

// Valor sintético para representar, no Select, uma forma customizada já salva na venda
// (tanto vendas normais, gravadas como "outro" + nome no sufixo de observacoes, quanto
// vendas avulsas, que já guardam "custom_<id>" diretamente).
const VALOR_FORMA_ATUAL_CUSTOMIZADA = "__forma_atual_customizada__";

export const DialogEditarVenda = ({
  open,
  onOpenChange,
  venda,
  onSalvar,
  salvando = false,
}: DialogEditarVendaProps) => {
  const { empresaAtiva } = useEmpresa();
  const { formas: formasCustomizadas } = useFormasPagamentoCustomizadas(empresaAtiva);
  const [formaPagamento, setFormaPagamento] = useState<string>("dinheiro");
  const [dataPrevista, setDataPrevista] = useState<string>("");
  const [parcelaNumero, setParcelaNumero] = useState<string>("");
  const [totalParcelas, setTotalParcelas] = useState<string>("");
  const [valorTotal, setValorTotal] = useState<string>("");

  const nomeFormaCustomizadaAtual = venda
    ? venda.forma_pagamento?.startsWith("custom_")
      ? formasCustomizadas.find((f) => `custom_${f.id}` === venda.forma_pagamento)?.nome
        ?? venda.forma_pagamento.replace("custom_", "")
      : venda.forma_pagamento === "outro"
        ? extrairNomeFormaCustomizada(venda.observacoes) ?? "Personalizada"
        : null
    : null;

  useEffect(() => {
    if (venda && open) {
      const forma = venda.forma_pagamento || "dinheiro";
      const ehCustomizada = forma.startsWith("custom_") || forma === "outro";
      setFormaPagamento(ehCustomizada ? VALOR_FORMA_ATUAL_CUSTOMIZADA : forma);
      setDataPrevista(venda.data_prevista_recebimento || "");
      setParcelaNumero(venda.parcela_numero?.toString() || "");
      setTotalParcelas(venda.total_parcelas?.toString() || "");
      setValorTotal(venda.total.toFixed(2));
    }
  }, [venda, open]);

  const valorTotalNumero = parseFloat(valorTotal);
  const valorTotalValido = Number.isFinite(valorTotalNumero) && valorTotalNumero > 0;

  const isAPrazo = formaPagamento === "a_receber";

  const handleSalvar = async () => {
    if (!venda || !valorTotalValido) return;

    // Se o usuário deixou selecionada a forma customizada original da venda,
    // reenvia o valor cru (custom_<id> ou "outro") sem alteração.
    const formaParaSalvar =
      formaPagamento === VALOR_FORMA_ATUAL_CUSTOMIZADA
        ? (venda.forma_pagamento as string)
        : formaPagamento;

    const dados: any = {
      forma_pagamento: formaParaSalvar,
    };

    if (valorTotalNumero !== venda.total) {
      dados.total = valorTotalNumero;
    }

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
          </div>

          {/* Valor da venda */}
          <div className="space-y-2">
            <Label htmlFor="valorTotal">Valor da Venda</Label>
            <Input
              id="valorTotal"
              type="number"
              step="0.01"
              min="0.01"
              value={valorTotal}
              onChange={(e) => setValorTotal(e.target.value)}
            />
            {!valorTotalValido && (
              <p className="text-sm text-destructive">O valor deve ser maior que zero.</p>
            )}
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
                {nomeFormaCustomizadaAtual && (
                  <SelectItem value={VALOR_FORMA_ATUAL_CUSTOMIZADA}>
                    {nomeFormaCustomizadaAtual}
                  </SelectItem>
                )}
                {formasCustomizadas.filter((f) => `custom_${f.id}` !== venda?.forma_pagamento).length > 0 && (
                  <>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-t mt-1 pt-2">
                      Personalizadas
                    </div>
                    {formasCustomizadas
                      .filter((f) => `custom_${f.id}` !== venda?.forma_pagamento)
                      .map((f) => (
                        <SelectItem key={f.id} value={`custom_${f.id}`}>
                          {f.nome}
                        </SelectItem>
                      ))}
                  </>
                )}
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
          <Button onClick={handleSalvar} disabled={salvando || !valorTotalValido}>
            {salvando ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
