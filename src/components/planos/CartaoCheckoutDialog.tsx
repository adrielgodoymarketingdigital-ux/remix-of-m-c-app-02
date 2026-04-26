import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Loader2,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Lock,
  RefreshCw,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

// Public Key da Pagar.me (segura para o frontend — usada apenas para tokenizar cartões)
const PAGARME_PUBLIC_KEY = "pk_p096KVAIDFNmGjNk";

interface CartaoCheckoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planoKey: string;
  planoNome: string;
  planoPreco: number;
  onSuccess?: () => void;
}

const sanitizeDigits = (v: string) => v.replace(/\D/g, "");

const formatCardNumber = (v: string) =>
  sanitizeDigits(v).slice(0, 19).replace(/(\d{4})(?=\d)/g, "$1 ").trim();

const formatExpiry = (v: string) => {
  const d = sanitizeDigits(v).slice(0, 4);
  if (d.length <= 2) return d;
  return `${d.slice(0, 2)}/${d.slice(2)}`;
};

const formatCpf = (v: string) => {
  const d = sanitizeDigits(v).slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
};

const isValidCPF = (cpf: string) => {
  const d = sanitizeDigits(cpf);
  if (!/^\d{11}$/.test(d) || /^(\d)\1{10}$/.test(d)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(d[i]) * (10 - i);
  let dig = (sum * 10) % 11;
  if (dig === 10) dig = 0;
  if (dig !== Number(d[9])) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += Number(d[i]) * (11 - i);
  dig = (sum * 10) % 11;
  if (dig === 10) dig = 0;
  return dig === Number(d[10]);
};

export function CartaoCheckoutDialog({
  open,
  onOpenChange,
  planoKey,
  planoNome,
  planoPreco,
  onSuccess,
}: CartaoCheckoutDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [cardNumber, setCardNumber] = useState("");
  const [holderName, setHolderName] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [cpf, setCpf] = useState("");

  const cardDigits = sanitizeDigits(cardNumber);
  const expiryDigits = sanitizeDigits(expiry);
  const cpfDigits = sanitizeDigits(cpf);

  const canSubmit =
    cardDigits.length >= 13 &&
    cardDigits.length <= 19 &&
    holderName.trim().length >= 3 &&
    expiryDigits.length === 4 &&
    cvv.length >= 3 &&
    cvv.length <= 4 &&
    isValidCPF(cpfDigits) &&
    !loading;

  const resetForm = () => {
    setCardNumber("");
    setHolderName("");
    setExpiry("");
    setCvv("");
    setCpf("");
    setError(null);
    setSuccess(false);
  };

  const handleClose = () => {
    if (loading) return;
    onOpenChange(false);
    setTimeout(resetForm, 300);
  };

  const tokenizeCard = async (): Promise<string> => {
    const expMonth = expiryDigits.slice(0, 2);
    const expYear = expiryDigits.slice(2, 4);

    const res = await fetch(
      `https://api.pagar.me/core/v5/tokens?appId=${PAGARME_PUBLIC_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "card",
          card: {
            number: cardDigits,
            holder_name: holderName.trim(),
            exp_month: Number(expMonth),
            exp_year: Number(expYear),
            cvv,
          },
        }),
      }
    );

    const data = await res.json();
    if (!res.ok || !data?.id) {
      const msg =
        data?.errors?.[0]?.message ||
        data?.message ||
        "Não foi possível validar os dados do cartão.";
      throw new Error(msg);
    }
    return data.id as string;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    setError(null);

    try {
      // 1. Tokeniza no navegador (cartão NÃO passa pelo nosso servidor)
      const cardToken = await tokenizeCard();

      // 2. Cria assinatura recorrente
      const { data, error: fnError } = await supabase.functions.invoke(
        "create-pagarme-subscription",
        {
          body: {
            plan_code: planoKey,
            card_token: cardToken,
            holder_name: holderName.trim(),
            cpf: cpfDigits,
          },
        }
      );

      if (fnError) {
        const ctx = (fnError as { context?: { error?: string } }).context;
        throw new Error(ctx?.error || fnError.message || "Falha no pagamento.");
      }

      if (!data?.approved) {
        throw new Error("Pagamento não aprovado pela operadora.");
      }

      setSuccess(true);
      toast({
        title: "Assinatura ativada!",
        description: `Seu plano ${planoNome} já está ativo.`,
      });

      setTimeout(() => {
        onOpenChange(false);
        onSuccess?.();
        resetForm();
      }, 1800);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro inesperado.";
      setError(msg);
      toast({
        title: "Pagamento não concluído",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(v) : handleClose())}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden gap-0 max-h-[92vh] overflow-y-auto">
        {/* Header em gradiente */}
        <div className="relative bg-gradient-to-br from-primary via-primary to-primary/80 p-6 text-primary-foreground">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.15),transparent_60%)]" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15 backdrop-blur-sm">
                <CreditCard className="h-5 w-5" />
              </div>
              <Badge className="bg-white/20 hover:bg-white/20 text-primary-foreground border-0 backdrop-blur-sm">
                <Lock className="h-3 w-3 mr-1" />
                Pagamento Seguro
              </Badge>
            </div>
            <DialogHeader className="space-y-1.5 text-left">
              <DialogTitle className="text-2xl font-bold text-primary-foreground">
                Assinar com cartão
              </DialogTitle>
              <DialogDescription className="text-primary-foreground/85 text-sm">
                {planoNome} · cobrança recorrente automática
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4 flex items-baseline gap-1.5">
              <span className="text-3xl font-bold">{formatCurrency(planoPreco)}</span>
              <span className="text-sm text-primary-foreground/80">por mês</span>
            </div>
          </div>
        </div>

        {success ? (
          <div className="py-12 px-6 flex flex-col items-center text-center gap-3 bg-background">
            <div className="p-3 rounded-full bg-emerald-100 dark:bg-emerald-950">
              <CheckCircle2 className="w-12 h-12 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h3 className="text-xl font-bold">Pagamento aprovado!</h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              Sua assinatura {planoNome} já está ativa. Bem-vindo!
            </p>
          </div>
        ) : (
          <>
            <form onSubmit={handleSubmit} className="p-6 space-y-5 bg-background">
              {/* Seção: Dados do cartão */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="h-px flex-1 bg-border" />
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-bold">
                    Dados do cartão
                  </p>
                  <div className="h-px flex-1 bg-border" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="card-number" className="text-xs font-semibold">
                    Número do cartão
                  </Label>
                  <div className="relative">
                    <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="card-number"
                      inputMode="numeric"
                      placeholder="0000 0000 0000 0000"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                      disabled={loading}
                      autoComplete="cc-number"
                      className="pl-9 h-11 font-mono tracking-wide"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="holder" className="text-xs font-semibold">
                    Nome impresso no cartão
                  </Label>
                  <Input
                    id="holder"
                    placeholder="COMO APARECE NO CARTÃO"
                    value={holderName}
                    onChange={(e) => setHolderName(e.target.value.toUpperCase())}
                    disabled={loading}
                    autoComplete="cc-name"
                    className="h-11 uppercase tracking-wider"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="expiry" className="text-xs font-semibold">
                      Validade
                    </Label>
                    <Input
                      id="expiry"
                      inputMode="numeric"
                      placeholder="MM/AA"
                      value={expiry}
                      onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                      disabled={loading}
                      autoComplete="cc-exp"
                      className="h-11 font-mono"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cvv" className="text-xs font-semibold flex items-center gap-1">
                      CVV
                      <Lock className="h-3 w-3 text-muted-foreground" />
                    </Label>
                    <Input
                      id="cvv"
                      inputMode="numeric"
                      placeholder="123"
                      value={cvv}
                      onChange={(e) => setCvv(sanitizeDigits(e.target.value).slice(0, 4))}
                      disabled={loading}
                      autoComplete="cc-csc"
                      className="h-11 font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Seção: Titular */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="h-px flex-1 bg-border" />
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-bold">
                    Identificação do titular
                  </p>
                  <div className="h-px flex-1 bg-border" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cpf" className="text-xs font-semibold">
                    CPF do titular
                  </Label>
                  <Input
                    id="cpf"
                    inputMode="numeric"
                    placeholder="000.000.000-00"
                    value={cpf}
                    onChange={(e) => setCpf(formatCpf(e.target.value))}
                    disabled={loading}
                    className="h-11 font-mono"
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 p-3 rounded-lg">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <Button
                type="submit"
                size="lg"
                className={cn(
                  "w-full h-12 text-base font-semibold shadow-lg shadow-primary/20",
                  loading && "opacity-80"
                )}
                disabled={!canSubmit}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Processando pagamento...
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4 mr-2" />
                    Assinar por {formatCurrency(planoPreco)}
                  </>
                )}
              </Button>
            </form>

            {/* Footer de segurança */}
            <div className="border-t bg-muted/40 px-6 py-4 space-y-2.5">
              <div className="flex items-center justify-center gap-4 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5 text-emerald-600" />
                  <span className="font-medium">SSL 256-bits</span>
                </span>
                <span className="text-border">•</span>
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                  <span className="font-medium">PCI DSS</span>
                </span>
                <span className="text-border">•</span>
                <span className="flex items-center gap-1.5">
                  <RefreshCw className="h-3.5 w-3.5 text-emerald-600" />
                  <span className="font-medium">Cancele quando quiser</span>
                </span>
              </div>
              <p className="text-center text-[11px] text-muted-foreground leading-relaxed">
                Dados criptografados e enviados diretamente para a{" "}
                <strong className="text-foreground">Pagar.me</strong> (grupo Stone).
                Não armazenamos seu cartão em nossos servidores.
              </p>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}