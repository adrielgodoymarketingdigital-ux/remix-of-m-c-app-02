import { Caixa } from "@/types/caixa";
import { formatCurrency } from "@/lib/formatters";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  DollarSign,
  XCircle,
  CircleDot,
  Clock,
  TrendingUp,
  Banknote,
  QrCode,
  CreditCard,
  Calendar,
} from "lucide-react";

interface DialogStatusCaixaProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caixaAtual: Caixa | null;
  caixaEstaAberto: boolean;
  onAbrirCaixa: () => void;
  onFecharCaixa: () => void;
}

function calcularTempoAberto(dataAbertura: string): string {
  const abertura = new Date(dataAbertura);
  const agora = new Date();
  const diffMs = agora.getTime() - abertura.getTime();
  const totalMinutos = Math.floor(diffMs / 60000);
  const horas = Math.floor(totalMinutos / 60);
  const minutos = totalMinutos % 60;
  if (horas === 0) return `${minutos}min`;
  return `${horas}h ${minutos}min`;
}

function formatarDataHora(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function DialogStatusCaixa({
  open,
  onOpenChange,
  caixaAtual,
  caixaEstaAberto,
  onAbrirCaixa,
  onFecharCaixa,
}: DialogStatusCaixaProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        {caixaEstaAberto ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CircleDot className="h-5 w-5 text-green-500 animate-pulse" />
                Status do Caixa
              </DialogTitle>
            </DialogHeader>

            <div className="flex justify-center py-2">
              <Badge className="bg-green-100 text-green-700 border-green-300 text-sm px-4 py-1.5">
                ● Caixa Aberto
              </Badge>
            </div>

            {caixaAtual && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    Aberto em:
                  </span>
                  <span className="font-medium">{formatarDataHora(caixaAtual.data_abertura)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Banknote className="h-4 w-4" />
                    Saldo Inicial:
                  </span>
                  <span className="font-medium">{formatCurrency(caixaAtual.saldo_inicial)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    Tempo aberto:
                  </span>
                  <span className="font-medium">{calcularTempoAberto(caixaAtual.data_abertura)}</span>
                </div>
              </div>
            )}

            <Separator />

            <p className="text-xs text-muted-foreground text-center">
              As vendas realizadas estão sendo registradas neste caixa.
            </p>

            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                className="flex-1 gap-2 border-red-500 text-red-600 hover:bg-red-50"
                onClick={() => {
                  onFecharCaixa();
                  onOpenChange(false);
                }}
              >
                <XCircle className="h-4 w-4" />
                Fechar Caixa
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => onOpenChange(false)}
              >
                Fechar
              </Button>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-red-500" />
                Status do Caixa
              </DialogTitle>
            </DialogHeader>

            <div className="flex justify-center py-2">
              <Badge className="bg-red-100 text-red-700 border-red-300 text-sm px-4 py-1.5">
                Caixa Fechado
              </Badge>
            </div>

            {caixaAtual && caixaAtual.status === "fechado" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    Fechado em:
                  </span>
                  <span className="font-medium">
                    {caixaAtual.data_fechamento
                      ? formatarDataHora(caixaAtual.data_fechamento)
                      : "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Banknote className="h-4 w-4" />
                    Saldo Final:
                  </span>
                  <span className="font-bold text-green-600">
                    {formatCurrency(caixaAtual.saldo_final ?? 0)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <TrendingUp className="h-4 w-4" />
                    Total de Vendas:
                  </span>
                  <span className="font-medium">{formatCurrency(caixaAtual.total_vendas)}</span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="rounded-md border p-2 text-xs space-y-0.5">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Banknote className="h-3 w-3" />
                      Dinheiro
                    </div>
                    <div className="font-medium">{formatCurrency(caixaAtual.total_dinheiro)}</div>
                  </div>
                  <div className="rounded-md border p-2 text-xs space-y-0.5">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <QrCode className="h-3 w-3" />
                      PIX
                    </div>
                    <div className="font-medium">{formatCurrency(caixaAtual.total_pix)}</div>
                  </div>
                  <div className="rounded-md border p-2 text-xs space-y-0.5">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <CreditCard className="h-3 w-3" />
                      Cartão
                    </div>
                    <div className="font-medium">{formatCurrency(caixaAtual.total_cartao)}</div>
                  </div>
                  <div className="rounded-md border p-2 text-xs space-y-0.5">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      A Receber
                    </div>
                    <div className="font-medium">{formatCurrency(caixaAtual.total_a_receber)}</div>
                  </div>
                </div>
              </div>
            )}

            <Separator />

            <p className="text-xs text-muted-foreground text-center">
              Abra o caixa para começar a registrar vendas.
            </p>

            <div className="flex gap-2 pt-1">
              <Button
                className="flex-1 gap-2 bg-green-600 hover:bg-green-700 text-white"
                onClick={() => {
                  onAbrirCaixa();
                  onOpenChange(false);
                }}
              >
                <DollarSign className="h-4 w-4" />
                Abrir Caixa
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => onOpenChange(false)}
              >
                Fechar
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
