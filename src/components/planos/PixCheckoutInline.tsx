import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, Copy, CheckCircle2, RefreshCw, Clock, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PixCheckoutInlineProps {
  planoKey: string;
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

const formatCPF = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 11);

  return digits
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
};

export function PixCheckoutInline({ planoKey, onSuccess }: PixCheckoutInlineProps) {
  const [loading, setLoading] = useState(false);
  const [pixData, setPixData] = useState<PixData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [checking, setChecking] = useState(false);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [timeLeft, setTimeLeft] = useState("");
  const [cpf, setCpf] = useState("");

  const cpfDigits = cpf.replace(/\D/g, "");
  const canGeneratePix = cpfDigits.length === 11;

  const gerarPix = useCallback(async () => {
    if (!canGeneratePix) {
      const message = "Informe um CPF válido para gerar o PIX.";
      setError(message);
      toast.error(message);
      return;
    }

    setLoading(true);
    setError(null);
    setPixData(null);
    setPaymentConfirmed(false);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("create-pix-order", {
        body: { plan_code: planoKey, cpf: cpfDigits },
      });

      if (fnError) {
        let message = fnError.message;
        const errorWithContext = fnError as Error & { context?: Response };

        if (errorWithContext.context) {
          try {
            const errorBody = await errorWithContext.context.json();
            if (typeof errorBody?.error === "string") {
              message = errorBody.error;
            }
          } catch {
            // noop
          }
        }

        throw new Error(message);
      }

      if (data?.error) throw new Error(data.error);
      setPixData(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao gerar PIX";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [canGeneratePix, cpfDigits, planoKey]);

  useEffect(() => {
    if (!pixData?.expires_at) return;
    const interval = setInterval(() => {
      const diff = new Date(pixData.expires_at).getTime() - Date.now();
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

  const copiarPix = async () => {
    if (!pixData?.pix_copy_paste) return;
    try {
      await navigator.clipboard.writeText(pixData.pix_copy_paste);
      setCopied(true);
      toast.success("Código PIX copiado!");
      setTimeout(() => setCopied(false), 3000);
    } catch {
      toast.error("Erro ao copiar. Copie manualmente o código.");
    }
  };

  const verificarPagamento = async () => {
    if (!pixData?.order_id) return;
    setChecking(true);
    try {
      const { data, error: queryError } = await supabase
        .from("pagamentos_pix")
        .select("status, paid_at")
        .eq("pagarme_order_id", pixData.order_id)
        .maybeSingle();
      if (queryError) throw queryError;
      if (data?.status === "paid") {
        setPaymentConfirmed(true);
        toast.success("Pagamento confirmado! 🎉 Sua assinatura foi ativada.");
        onSuccess?.();
      } else {
        toast.info("Pagamento pendente. Tente novamente em alguns instantes.");
      }
    } catch {
      toast.error("Erro ao verificar. Tente novamente.");
    } finally {
      setChecking(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-10">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Gerando QR Code PIX...</p>
      </div>
    );
  }

  if (paymentConfirmed) {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <div className="rounded-full bg-primary/10 p-3">
          <CheckCircle2 className="h-10 w-10 text-primary" />
        </div>
        <div className="text-center">
          <h3 className="text-lg font-semibold text-foreground">Pagamento confirmado!</h3>
          <p className="mt-1 text-sm text-muted-foreground">Sua assinatura foi ativada com sucesso.</p>
        </div>
      </div>
    );
  }

  if (!pixData) {
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">CPF do pagador</p>
          <Input
            value={cpf}
            onChange={(event) => {
              setCpf(formatCPF(event.target.value));
              if (error) setError(null);
            }}
            inputMode="numeric"
            placeholder="000.000.000-00"
            maxLength={14}
            className="h-11"
          />
          <p className="text-xs text-muted-foreground">O CPF é obrigatório para gerar o código PIX.</p>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <Button onClick={gerarPix} disabled={!canGeneratePix} className="h-11 w-full">
          <RefreshCw className="mr-2 h-4 w-4" /> Gerar código PIX
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span>Expira em:</span>
        </div>
        <Badge variant={timeLeft === "Expirado" ? "destructive" : "secondary"} className="font-mono">
          {timeLeft || "..."}
        </Badge>
      </div>

      {pixData.qr_code_url && (
        <div className="flex justify-center">
          <div className="rounded-xl border border-border bg-card p-3">
            <img src={pixData.qr_code_url} alt="QR Code PIX" className="h-44 w-44" />
          </div>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-center text-sm font-medium text-foreground">Ou copie o código:</p>
        <div
          className="relative max-h-20 cursor-pointer overflow-auto break-all rounded-lg border border-border bg-muted/40 p-3 font-mono text-xs text-muted-foreground transition-colors hover:bg-muted"
          onClick={copiarPix}
        >
          {pixData.pix_copy_paste}
        </div>
        <Button onClick={copiarPix} variant="outline" className="w-full" size="sm">
          {copied ? (
            <><CheckCircle2 className="mr-2 h-4 w-4 text-primary" /> Copiado!</>
          ) : (
            <><Copy className="mr-2 h-4 w-4" /> Copiar código PIX</>
          )}
        </Button>
      </div>

      <Button onClick={verificarPagamento} disabled={checking || timeLeft === "Expirado"} className="h-11 w-full">
        {checking ? (
          <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verificando...</>
        ) : (
          <><RefreshCw className="mr-2 h-4 w-4" /> Já paguei — Verificar pagamento</>
        )}
      </Button>

      {timeLeft === "Expirado" && (
        <Button onClick={gerarPix} variant="outline" className="w-full" size="sm">
          <RefreshCw className="mr-2 h-4 w-4" /> Gerar novo QR Code
        </Button>
      )}
    </div>
  );
}
