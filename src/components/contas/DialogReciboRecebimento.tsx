import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, FileText, Receipt } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { ValorMonetario } from "@/components/ui/valor-monetario";
import { useConfiguracaoLoja } from "@/hooks/useConfiguracaoLoja";
import type { FormatoPapel } from "@/components/recibo/SeletorFormatoPapelDialog";
import type { Conta, PagamentoConta } from "@/types/conta";
import { gerarReciboRecebimentoHtml } from "@/lib/contas/reciboRecebimentoHtml";

const CHAVE_FORMATO = "ultimo_formato_recibo_conta";
const lerFormato = (): FormatoPapel => {
  try {
    const v = localStorage.getItem(CHAVE_FORMATO);
    return v === "80mm" || v === "58mm" || v === "a4" ? v : "a4";
  } catch {
    return "a4";
  }
};

const OPCOES: { value: FormatoPapel; label: string; icon: typeof FileText }[] = [
  { value: "a4", label: "A4", icon: FileText },
  { value: "80mm", label: "80mm", icon: Receipt },
  { value: "58mm", label: "58mm", icon: Receipt },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conta: Conta | null;
  /** O pagamento recém-registrado (ou o selecionado para reimpressão). */
  pagamento: PagamentoConta | null;
  /** Todos os pagamentos NÃO estornados da conta, em ordem cronológica. */
  pagamentos: PagamentoConta[];
}

export function DialogReciboRecebimento({ open, onOpenChange, conta, pagamento, pagamentos }: Props) {
  const { config } = useConfiguracaoLoja();
  const [formato, setFormato] = useState<FormatoPapel>(lerFormato);

  const calc = useMemo(() => {
    if (!conta || !pagamento) return null;
    // total recebido considerando pagamentos até e incluindo este (cronológico)
    const ativos = pagamentos.filter((p) => !p.estornado);
    const idx = ativos.findIndex((p) => p.id === pagamento.id);
    const ateEste = idx >= 0 ? ativos.slice(0, idx + 1) : [...ativos, pagamento];
    const totalPago = ateEste.reduce((s, p) => s + Number(p.valor), 0);
    const saldo = Math.max(Number(conta.valor) - totalPago, 0);
    return { totalPago, saldo, quitou: saldo <= 0.005 };
  }, [conta, pagamento, pagamentos]);

  if (!conta || !pagamento || !calc) return null;

  const escolherFormato = (f: FormatoPapel) => {
    setFormato(f);
    try {
      localStorage.setItem(CHAVE_FORMATO, f);
    } catch {
      /* ignore */
    }
  };

  const imprimir = () => {
    const html = gerarReciboRecebimentoHtml({
      loja: {
        nome_loja: config?.nome_loja,
        cnpj: config?.cnpj,
        endereco: config?.endereco,
        telefone: config?.telefone,
        logo_url: config?.logo_url,
      },
      clienteNome: conta.cliente_nome,
      referencia: conta.nome,
      osNumero: conta.os_numero,
      numeroRecibo: pagamento.id.slice(0, 8).toUpperCase(),
      valorPagamento: Number(pagamento.valor),
      formaPagamento: pagamento.forma_pagamento,
      dataPagamento: pagamento.data_pagamento,
      valorTotalConta: Number(conta.valor),
      totalPago: calc.totalPago,
      saldoRestante: calc.saldo,
      formato,
    });
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(html);
      win.document.close();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-green-600" />
            Recibo de recebimento
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="rounded-lg border p-3 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cliente</span>
              <span className="font-medium">{conta.cliente_nome || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Referente a</span>
              <span className="font-medium text-right">{conta.nome}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Data</span>
              <span className="font-medium">{formatDate(pagamento.data_pagamento)}</span>
            </div>
            <div className="flex justify-between pt-1 border-t">
              <span className="text-green-700">Valor recebido</span>
              <span className="font-bold text-green-700">
                <ValorMonetario valor={Number(pagamento.valor)} tipo="preco" />
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total já recebido</span>
              <span>{formatCurrency(calc.totalPago)}</span>
            </div>
            <div className="flex justify-between">
              <span className={calc.quitou ? "text-muted-foreground" : "text-orange-600 font-medium"}>
                Saldo restante
              </span>
              <span className={calc.quitou ? "" : "font-bold text-orange-600"}>
                {formatCurrency(calc.saldo)}
              </span>
            </div>
          </div>

          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Formato de impressão</p>
            <div className="flex gap-2">
              {OPCOES.map((o) => {
                const Icon = o.icon;
                const sel = formato === o.value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => escolherFormato(o.value)}
                    className={cn(
                      "flex-1 flex flex-col items-center gap-1 rounded-lg border p-2 text-xs transition-colors",
                      sel ? "border-primary bg-primary/5 font-medium" : "border-border hover:bg-muted/50",
                    )}
                  >
                    <Icon className={cn("h-4 w-4", sel ? "text-primary" : "text-muted-foreground")} />
                    {o.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button onClick={imprimir} className="bg-green-600 hover:bg-green-700">
            <Printer className="h-4 w-4 mr-2" />
            Imprimir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
