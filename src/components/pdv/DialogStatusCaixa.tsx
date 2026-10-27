import { Caixa } from "@/types/caixa";
import { useTranslation } from "react-i18next";
import { useFormatadores, type Formatadores } from "@/hooks/useFormatadores";
import type { TFunction } from "i18next";
import { useNomesFormaPagamento } from "@/hooks/useNomesFormaPagamento";
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
  Wrench,
  Repeat,
} from "lucide-react";

interface DialogStatusCaixaProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caixaAtual: Caixa | null;
  caixaEstaAberto: boolean;
  onAbrirCaixa: () => void;
  onFecharCaixa: () => void;
}

function calcularTempoAberto(dataAbertura: string, t: TFunction): string {
  const abertura = new Date(dataAbertura);
  const agora = new Date();
  const diffMs = agora.getTime() - abertura.getTime();
  const totalMinutos = Math.floor(diffMs / 60000);
  const horas = Math.floor(totalMinutos / 60);
  const minutos = totalMinutos % 60;
  if (horas === 0) return t("caixa.status.minutos", { minutos });
  return t("caixa.status.horasMinutos", { horas, minutos });
}

// Brasil: o toLocaleString de sempre ("26/10/2026, 08:00", com vírgula); outros idiomas/moedas: formatador central.
function formatarDataHora(iso: string, fmt: Formatadores): string {
  if (fmt.ctx.idioma !== "pt-BR" || fmt.ctx.moeda !== "BRL") return fmt.dataHora(iso);
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
  const { t } = useTranslation("pdv");
  const fmt = useFormatadores();
  const { curto } = useNomesFormaPagamento();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        {caixaEstaAberto ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CircleDot className="h-5 w-5 text-green-500 animate-pulse" />
                {t("caixa.status.titulo")}
              </DialogTitle>
            </DialogHeader>

            <div className="flex justify-center py-2">
              <Badge className="bg-green-100 text-green-700 border-green-300 text-sm px-4 py-1.5">
                {t("caixa.status.aberto")}
              </Badge>
            </div>

            {caixaAtual && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    {t("caixa.status.abertoEm")}
                  </span>
                  <span className="font-medium">{formatarDataHora(caixaAtual.data_abertura, fmt)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Banknote className="h-4 w-4" />
                    {t("caixa.status.saldoInicial")}
                  </span>
                  <span className="font-medium">{fmt.moeda(caixaAtual.saldo_inicial)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    {t("caixa.status.tempoAberto")}
                  </span>
                  <span className="font-medium">{calcularTempoAberto(caixaAtual.data_abertura, t)}</span>
                </div>
              </div>
            )}

            <Separator />

            <p className="text-xs text-muted-foreground text-center">
              {t("caixa.status.registrando")}
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
                {t("caixa.status.fecharCaixa")}
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => onOpenChange(false)}
              >
                {t("caixa.status.fechar")}
              </Button>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-red-500" />
                {t("caixa.status.titulo")}
              </DialogTitle>
            </DialogHeader>

            <div className="flex justify-center py-2">
              <Badge className="bg-red-100 text-red-700 border-red-300 text-sm px-4 py-1.5">
                {t("caixa.status.fechado")}
              </Badge>
            </div>

            {caixaAtual && caixaAtual.status === "fechado" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    {t("caixa.status.fechadoEm")}
                  </span>
                  <span className="font-medium">
                    {caixaAtual.data_fechamento
                      ? formatarDataHora(caixaAtual.data_fechamento, fmt)
                      : "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Banknote className="h-4 w-4" />
                    {t("caixa.status.saldoFinal")}
                  </span>
                  <span className="font-bold text-green-600">
                    {fmt.moeda(caixaAtual.saldo_final ?? 0)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <TrendingUp className="h-4 w-4" />
                    {t("caixa.status.totalVendas")}
                  </span>
                  <span className="font-medium">{fmt.moeda(caixaAtual.total_vendas)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Wrench className="h-4 w-4" />
                    {t("caixa.status.servicos")}
                  </span>
                  <span className="font-medium">{fmt.moeda(caixaAtual.total_servicos ?? 0)}</span>
                </div>
                {Number(caixaAtual.total_devolucoes_troca) > 0 && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Repeat className="h-4 w-4" />
                      {t("caixa.status.devolucoes")}
                    </span>
                    <span className="font-medium text-red-600">{t("caixa.status.menosValor", { valor: fmt.moeda(Number(caixaAtual.total_devolucoes_troca)) })}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="rounded-md border p-2 text-xs space-y-0.5">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Banknote className="h-3 w-3" />
                      {curto.dinheiro}
                    </div>
                    <div className="font-medium">{fmt.moeda(caixaAtual.total_dinheiro)}</div>
                  </div>
                  <div className="rounded-md border p-2 text-xs space-y-0.5">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <QrCode className="h-3 w-3" />
                      {curto.pix}
                    </div>
                    <div className="font-medium">{fmt.moeda(caixaAtual.total_pix)}</div>
                  </div>
                  <div className="rounded-md border p-2 text-xs space-y-0.5">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <CreditCard className="h-3 w-3" />
                      {t("caixa.status.cartao")}
                    </div>
                    <div className="font-medium">{fmt.moeda(caixaAtual.total_cartao)}</div>
                  </div>
                  <div className="rounded-md border p-2 text-xs space-y-0.5">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {curto.a_receber}
                    </div>
                    <div className="font-medium">{fmt.moeda(caixaAtual.total_a_receber)}</div>
                  </div>
                </div>
              </div>
            )}

            <Separator />

            <p className="text-xs text-muted-foreground text-center">
              {t("caixa.status.abraCaixa")}
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
                {t("caixa.status.abrirCaixa")}
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => onOpenChange(false)}
              >
                {t("caixa.status.fechar")}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
