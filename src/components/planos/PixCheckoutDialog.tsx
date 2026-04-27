import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Loader2,
  Copy,
  CheckCircle2,
  RefreshCw,
  QrCode,
  Clock,
  AlertCircle,
  Lock,
  ShieldCheck,
  Zap,
  Smartphone,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";

interface PixCheckoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planoKey: string;
  planoNome: string;
  planoPreco: number;
  onSuccess?: () => void;
}

interface PixData {
  order_id: string;
  status: string;
  qr_code: string;
  qr_code_url: string;
  pix_copy_paste: string;
  expires_at: string;
  plan: {
    code: string;
    name: string;
    amount_cents: number;
  };
}

export function PixCheckoutDialog({
  open,
  onOpenChange,
  planoKey,
  planoNome,
  planoPreco,
  onSuccess,
}: PixCheckoutDialogProps) {
  const [loading, setLoading] = useState(false);
  const [pixData, setPixData] = useState<PixData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [checking, setChecking] = useState(false);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [cpf, setCpf] = useState("");
  const { toast } = useToast();

  const cpfDigits = cpf.replace(/\D/g, "");
  const canGeneratePix = cpfDigits.length === 11;

  const formatCPF = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    return digits
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  };

  // Gerar pedido PIX
  const gerarPix = useCallback(async () => {
    if (!canGeneratePix) {
      setError("Informe um CPF válido para gerar o PIX.");
      return;
    }

    setLoading(true);
    setError(null);
    setPixData(null);
    setPaymentConfirmed(false);

    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        "create-pix-order",
        { body: { plan_code: planoKey, cpf: cpfDigits } }
      );

      if (fnError) throw new Error(fnError.message);
      if (data?.error) throw new Error(data.error);

      setPixData(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao gerar PIX";
      setError(msg);
      toast({
        title: "Erro ao gerar PIX",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [planoKey, cpfDigits, canGeneratePix, toast]);

  // Reset ao abrir/fechar
  useEffect(() => {
    if (!open) {
      setPixData(null);
      setError(null);
      setPaymentConfirmed(false);
      setCopied(false);
      setCpf("");
    }
  }, [open]);

  // Timer de expiração
  useEffect(() => {
    if (!pixData?.expires_at) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const exp = new Date(pixData.expires_at).getTime();
      const diff = exp - now;

      if (diff <= 0) {
        setTimeLeft("Expirado");
        clearInterval(interval);
        return;
      }

      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${mins}:${secs.toString().padStart(2, "0")}`);
    }, 1000);

    return () => clearInterval(interval);
  }, [pixData?.expires_at]);

  // Copiar código PIX
  const copiarPix = async () => {
    if (!pixData?.pix_copy_paste) return;
    try {
      await navigator.clipboard.writeText(pixData.pix_copy_paste);
      setCopied(true);
      toast({ title: "Código PIX copiado!" });
      setTimeout(() => setCopied(false), 3000);
    } catch {
      toast({
        title: "Erro ao copiar",
        description: "Copie manualmente o código abaixo",
        variant: "destructive",
      });
    }
  };

  // Verificar pagamento consultando Pagar.me diretamente via edge function
  const verificarPagamento = async () => {
    if (!pixData?.order_id) return;
    setChecking(true);

    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        "check-pix-payment",
        { body: { order_id: pixData.order_id } }
      );

      if (fnError) throw new Error(fnError.message);

      if (data?.paid) {
        setPaymentConfirmed(true);
        toast({
          title: "Pagamento confirmado! 🎉",
          description: "Sua assinatura foi ativada com sucesso.",
        });
        onSuccess?.();
      } else {
        toast({
          title: "Pagamento pendente",
          description: "Ainda não identificamos o pagamento. Tente novamente em alguns instantes.",
        });
      }
    } catch {
      toast({
        title: "Erro ao verificar",
        description: "Tente novamente em instantes.",
        variant: "destructive",
      });
    } finally {
      setChecking(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden gap-0 max-h-[92vh] overflow-y-auto">
        {/* Header em gradiente teal */}
        <div className="relative bg-gradient-to-br from-teal-600 via-emerald-600 to-emerald-700 p-6 text-white">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.18),transparent_60%)]" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15 backdrop-blur-sm">
                <QrCode className="h-5 w-5" />
              </div>
              <Badge className="bg-white/20 hover:bg-white/20 text-white border-0 backdrop-blur-sm">
                <Zap className="h-3 w-3 mr-1" />
                Aprovação Instantânea
              </Badge>
            </div>
            <DialogHeader className="space-y-1.5 text-left">
              <DialogTitle className="text-2xl font-bold text-white">
                Pagar com Pix
              </DialogTitle>
              <DialogDescription className="text-white/85 text-sm">
                {planoNome} · pagamento à vista
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4 flex items-baseline gap-1.5">
              <span className="text-3xl font-bold">{formatCurrency(planoPreco)}</span>
              <span className="text-sm text-white/80">à vista</span>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4 bg-background">
          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
              <p className="text-sm text-muted-foreground">Gerando QR Code PIX...</p>
            </div>
          )}

          {/* CPF Input Step */}
          {!loading && !pixData && !paymentConfirmed && !error && (
            <div className="space-y-5">
              {/* Como funciona */}
              <div className="rounded-xl border bg-muted/40 p-4 space-y-3">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-bold">
                  Como funciona
                </p>
                <div className="space-y-2.5 text-sm">
                  <div className="flex items-start gap-3">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold dark:bg-emerald-950 dark:text-emerald-400">
                      1
                    </div>
                    <span>Informe seu CPF para gerar o QR Code</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold dark:bg-emerald-950 dark:text-emerald-400">
                      2
                    </div>
                    <span>Pague pelo app do seu banco</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold dark:bg-emerald-950 dark:text-emerald-400">
                      3
                    </div>
                    <span>Acesso liberado em segundos</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pix-cpf" className="text-xs font-semibold">
                  CPF do pagador
                </Label>
                <Input
                  id="pix-cpf"
                  value={cpf}
                  onChange={(e) => setCpf(formatCPF(e.target.value))}
                  inputMode="numeric"
                  placeholder="000.000.000-00"
                  maxLength={14}
                  className="h-12 font-mono text-base"
                />
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                  Obrigatório por exigência do Banco Central
                </p>
              </div>

              <Button
                onClick={gerarPix}
                disabled={!canGeneratePix}
                size="lg"
                className="h-12 w-full text-base font-semibold bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white shadow-lg shadow-emerald-500/20"
              >
                <QrCode className="mr-2 h-5 w-5" />
                Gerar código PIX
              </Button>
            </div>
          )}

          {/* Erro */}
          {error && !loading && (
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="p-3 rounded-full bg-destructive/10">
                <AlertCircle className="h-10 w-10 text-destructive" />
              </div>
              <p className="text-sm text-center text-destructive">{error}</p>
              <Button onClick={() => setError(null)} variant="outline" size="sm">
                <RefreshCw className="mr-2 h-4 w-4" />
                Tentar novamente
              </Button>
            </div>
          )}

          {/* Pagamento confirmado */}
          {paymentConfirmed && (
            <div className="flex flex-col items-center gap-4 py-10">
              <div className="p-4 rounded-full bg-emerald-100 dark:bg-emerald-950">
                <CheckCircle2 className="h-12 w-12 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="text-center">
                <h3 className="font-bold text-xl">Pagamento Confirmado!</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Sua assinatura do {planoNome} foi ativada.
                </p>
              </div>
              <Button onClick={() => onOpenChange(false)} className="w-full h-11">
                Fechar
              </Button>
            </div>
          )}

          {/* QR Code e dados PIX */}
          {pixData && !loading && !paymentConfirmed && (
            <>
              {/* Timer */}
              <div className="flex items-center justify-between text-sm rounded-lg bg-muted/40 px-3 py-2">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>Expira em:</span>
                </div>
                <Badge
                  variant={timeLeft === "Expirado" ? "destructive" : "secondary"}
                  className="font-mono text-sm"
                >
                  {timeLeft || "..."}
                </Badge>
              </div>

              {/* QR Code */}
              {pixData.qr_code_url && (
                <div className="flex flex-col items-center gap-3">
                  <div className="bg-white p-4 rounded-2xl shadow-lg border-2 border-emerald-100 dark:border-emerald-900">
                    <img
                      src={pixData.qr_code_url}
                      alt="QR Code PIX"
                      className="w-52 h-52"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Smartphone className="h-3.5 w-3.5" />
                    Aponte a câmera do app do seu banco
                  </p>
                </div>
              )}

              {/* Copia e Cola */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="h-px flex-1 bg-border" />
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-bold">
                    ou use o código copia e cola
                  </p>
                  <div className="h-px flex-1 bg-border" />
                </div>
                <div
                  className={cn(
                    "relative p-3 rounded-lg border-2 border-dashed text-xs font-mono break-all max-h-20 overflow-auto",
                    "bg-muted/40 cursor-pointer hover:bg-muted hover:border-emerald-400 transition-colors"
                  )}
                  onClick={copiarPix}
                >
                  {pixData.pix_copy_paste}
                </div>
                <Button
                  onClick={copiarPix}
                  variant="outline"
                  className="w-full h-11 border-emerald-200 hover:bg-emerald-50 hover:border-emerald-400 dark:border-emerald-900 dark:hover:bg-emerald-950"
                >
                  {copied ? (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-600" />
                      Código copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="mr-2 h-4 w-4" />
                      Copiar código PIX
                    </>
                  )}
                </Button>
              </div>

              {/* Verificar pagamento */}
              <Button
                onClick={verificarPagamento}
                disabled={checking || timeLeft === "Expirado"}
                size="lg"
                className="w-full h-12 text-base font-semibold bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white shadow-lg shadow-emerald-500/20"
              >
                {checking ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Verificando pagamento...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-5 w-5" />
                    Já paguei — Verificar pagamento
                  </>
                )}
              </Button>

              {/* Expirado */}
              {timeLeft === "Expirado" && (
                <Button onClick={gerarPix} variant="outline" className="w-full" size="sm">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Gerar novo QR Code
                </Button>
              )}
            </>
          )}
        </div>

        {/* Footer de segurança */}
        {!paymentConfirmed && (
          <div className="border-t bg-muted/40 px-6 py-4 space-y-2.5">
            <div className="flex items-center justify-center gap-4 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-emerald-600" />
                <span className="font-medium">100% Seguro</span>
              </span>
              <span className="text-border">•</span>
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                <span className="font-medium">Banco Central</span>
              </span>
              <span className="text-border">•</span>
              <span className="flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-emerald-600" />
                <span className="font-medium">Liberação imediata</span>
              </span>
            </div>
            <p className="text-center text-[11px] text-muted-foreground leading-relaxed">
              Pagamento processado por <strong className="text-foreground">Pagar.me</strong>{" "}
              (grupo Stone) com criptografia de ponta a ponta.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
