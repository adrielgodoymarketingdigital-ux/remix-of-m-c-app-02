import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  CreditCard,
  QrCode,
  Loader2,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  Lock,
  CheckCircle2,
  Zap,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PLANOS } from "@/types/plano";
import { CartaoCheckoutDialog } from "./CartaoCheckoutDialog";
import { PixCheckoutDialog } from "./PixCheckoutDialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

interface BotoesPagamentoPagarmeProps {
  planoKey: string;
  planoAtual?: boolean;
  popular?: boolean;
  carregando?: boolean;
  onSuccess?: () => void;
}

export function BotoesPagamentoPagarme({
  planoKey,
  planoAtual,
  popular,
  carregando,
  onSuccess,
}: BotoesPagamentoPagarmeProps) {
  const [abrirCartao, setAbrirCartao] = useState(false);
  const [abrirPix, setAbrirPix] = useState(false);
  const [abrirEscolha, setAbrirEscolha] = useState(false);

  const plano = PLANOS[planoKey];

  if (!plano || planoKey === "free") {
    return null;
  }

  const escolherCartao = () => {
    setAbrirEscolha(false);
    setAbrirCartao(true);
  };

  const escolherPix = () => {
    setAbrirEscolha(false);
    setAbrirPix(true);
  };

  return (
    <>
      <Button
        onClick={() => setAbrirEscolha(true)}
        disabled={carregando}
        variant={planoAtual ? "outline" : "default"}
        className={cn(
          "w-full h-12 text-base font-semibold transition-all duration-300",
          popular && !planoAtual && "shadow-lg hover:shadow-xl",
          planoAtual && "border-primary/40 text-primary hover:bg-primary/10"
        )}
      >
        {carregando ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : planoAtual ? (
          <>
            <RefreshCw className="mr-2 h-4 w-4" />
            Renovar Plano
          </>
        ) : (
          <>
            <Sparkles className="mr-2 h-4 w-4" />
            Assinar Plano
          </>
        )}
      </Button>

      <Dialog open={abrirEscolha} onOpenChange={setAbrirEscolha}>
        <DialogContent className="sm:max-w-lg p-0 overflow-hidden gap-0">
          {/* Header com gradiente */}
          <div className="relative bg-gradient-to-br from-primary via-primary to-primary/80 p-6 text-primary-foreground">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.15),transparent_60%)]" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15 backdrop-blur-sm">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <Badge className="bg-white/20 hover:bg-white/20 text-primary-foreground border-0 backdrop-blur-sm">
                  <Lock className="h-3 w-3 mr-1" />
                  Checkout Seguro
                </Badge>
              </div>
              <DialogHeader className="space-y-1.5 text-left">
                <DialogTitle className="text-2xl font-bold text-primary-foreground">
                  {planoAtual ? "Renovar" : "Assinar"} {plano.nome}
                </DialogTitle>
                <DialogDescription className="text-primary-foreground/85 text-sm">
                  Selecione a forma de pagamento desejada
                </DialogDescription>
              </DialogHeader>
              <div className="mt-4 flex items-baseline gap-1.5">
                <span className="text-3xl font-bold">
                  R$ {plano.preco.toFixed(2).replace(".", ",")}
                </span>
                <span className="text-sm text-primary-foreground/80">
                  {plano.periodo || "/mês"}
                </span>
              </div>
            </div>
          </div>

          {/* Opções de pagamento */}
          <div className="p-6 space-y-3 bg-background">
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              Forma de pagamento
            </p>

            <button
              onClick={escolherCartao}
              className="group relative w-full flex items-center gap-4 rounded-xl border-2 border-border bg-card p-4 text-left transition-all duration-200 hover:border-primary hover:shadow-md hover:shadow-primary/10 hover:-translate-y-0.5"
            >
              <div className="absolute top-3 right-3">
                <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px] font-bold dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800">
                  RECOMENDADO
                </Badge>
              </div>
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-md shadow-primary/20">
                <CreditCard className="h-7 w-7" />
              </div>
              <div className="flex-1 min-w-0 pr-20">
                <p className="font-semibold text-base">Cartão de Crédito</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Renovação automática · Sem preocupações
                </p>
                <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                    Visa
                  </span>
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                    Master
                  </span>
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                    Elo
                  </span>
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                    Amex
                  </span>
                </div>
              </div>
              <ChevronRight className="absolute bottom-4 right-4 h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
            </button>

            <button
              onClick={escolherPix}
              className="group relative w-full flex items-center gap-4 rounded-xl border-2 border-border bg-card p-4 text-left transition-all duration-200 hover:border-primary hover:shadow-md hover:shadow-primary/10 hover:-translate-y-0.5"
            >
              <div className="absolute top-3 right-3">
                <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-blue-200 text-[10px] font-bold dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800">
                  <Zap className="h-2.5 w-2.5 mr-0.5" />
                  INSTANTÂNEO
                </Badge>
              </div>
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white shadow-md shadow-teal-500/20">
                <QrCode className="h-7 w-7" />
              </div>
              <div className="flex-1 min-w-0 pr-20">
                <p className="font-semibold text-base">Pix</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Aprovação imediata · Renovação manual
                </p>
                <div className="flex items-center gap-1.5 mt-2 text-[10px] text-muted-foreground">
                  <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                  <span>QR Code · Copia e Cola</span>
                </div>
              </div>
              <ChevronRight className="absolute bottom-4 right-4 h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
            </button>
          </div>

          {/* Footer de segurança */}
          <div className="border-t bg-muted/40 px-6 py-4 space-y-3">
            <div className="flex items-center justify-center gap-4 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-emerald-600" />
                <span className="font-medium">Criptografia SSL</span>
              </span>
              <span className="text-border">•</span>
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                <span className="font-medium">PCI DSS</span>
              </span>
              <span className="text-border">•</span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                <span className="font-medium">LGPD</span>
              </span>
            </div>
            <p className="text-center text-[11px] text-muted-foreground leading-relaxed">
              Pagamentos processados por <strong className="text-foreground">Pagar.me</strong>,
              empresa do grupo Stone. Seus dados são criptografados e nunca armazenados em nossos servidores.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      <CartaoCheckoutDialog
        open={abrirCartao}
        onOpenChange={setAbrirCartao}
        planoKey={planoKey}
        planoNome={plano.nome}
        planoPreco={plano.preco}
        onSuccess={onSuccess}
      />

      <PixCheckoutDialog
        open={abrirPix}
        onOpenChange={setAbrirPix}
        planoKey={planoKey}
        planoNome={plano.nome}
        planoPreco={plano.preco}
        onSuccess={onSuccess}
      />
    </>
  );
}
