import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  CreditCard,
  Loader2,
  ShieldCheck,
  XCircle,
  AlertCircle,
  CalendarClock,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const PAGARME_PUBLIC_KEY = "pk_p096KVAIDFNmGjNk";

interface GerenciarAssinaturaPagarmeProps {
  dataProximaCobranca?: string | null;
  onChanged?: () => void;
}

/** Resposta da edge function update-pagarme-card. */
interface RespostaTrocaCartao {
  success?: boolean;
  last_four_digits?: string;
  status_assinatura?: string;
  cobranca?:
    | "paga"
    | "recusada"
    | "pendente"
    | "nao_necessaria"
    | "erro"
    | "proxima_cobranca"
    | "assinatura_cancelada_reassinar"
    | "assinatura_inexistente"
    | "plano_desconhecido"
    | "assinatura_cancelada"; // nome antigo (função anterior à v13)
  mensagem?: string;
  /** false quando o plano pago não está valendo (Free, vencido, past_due): a função consultou a Pagar.me. */
  acesso_pago_valido?: boolean;
  proxima_cobranca_em?: string;
  /** Plano para o "Assinar novamente" (o local, ou o anterior a uma liberação temporária). */
  plano_sugerido?: string | null;
}

/** Aviso que fica no diálogo depois da troca, com o próximo passo para o cliente. */
interface AvisoPosTroca {
  mensagem: string;
  /** Mostra "Assinar novamente" (assinatura não existe mais na operadora). */
  reassinar: boolean;
  planoSugerido: string | null;
}

const dataBR = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
};

/**
 * Depois de uma cobrança paga, quem libera o acesso é o webhook (charge.paid).
 * Espera a assinatura ficar "active" no banco (até ~30s) antes de dizer que liberou.
 */
const aguardarAssinaturaAtiva = async (): Promise<boolean> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  for (let i = 0; i < 15; i++) {
    const { data } = await supabase.from("assinaturas").select("status").eq("user_id", user.id).maybeSingle();
    if (data?.status === "active") return true;
    await new Promise((r) => setTimeout(r, 2000));
  }
  return false;
};

const sanitizeDigits = (v: string) => v.replace(/\D/g, "");

const formatCardNumber = (v: string) =>
  sanitizeDigits(v).slice(0, 19).replace(/(\d{4})(?=\d)/g, "$1 ").trim();

const formatExpiry = (v: string) => {
  const d = sanitizeDigits(v).slice(0, 4);
  if (d.length <= 2) return d;
  return `${d.slice(0, 2)}/${d.slice(2)}`;
};

export function GerenciarAssinaturaPagarme({
  dataProximaCobranca,
  onChanged,
}: GerenciarAssinaturaPagarmeProps) {
  const { toast } = useToast();
  const [cancelando, setCancelando] = useState(false);
  const [motivoCancelamento, setMotivoCancelamento] = useState("");
  const [motivoCustom, setMotivoCustom] = useState("");

  const MOTIVOS_CANCELAMENTO = [
    "Preço muito alto",
    "Não uso o suficiente",
    "Encontrei outra solução",
    "Dificuldade de uso",
    "Falta de funcionalidades",
    "Problemas técnicos",
    "Negócio encerrado",
    "Outro motivo",
  ];

  // Dialog de troca de cartão
  const [trocaOpen, setTrocaOpen] = useState(false);
  const [trocando, setTrocando] = useState(false);
  const [cardNumber, setCardNumber] = useState("");
  const [holderName, setHolderName] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<AvisoPosTroca | null>(null);
  // Recarregar a assinatura (onChanged) desmonta este componente no Plano e some com
  // a mensagem do diálogo; quando há mensagem para o cliente ler, recarrega ao fechar.
  const recarregarAoFechar = useRef(false);
  const navigate = useNavigate();

  // Checkout do plano (cartão ou PIX). Sem plano conhecido, vai para a lista de planos.
  const irParaCheckout = (pix: boolean) => {
    const plano = aviso?.planoSugerido;
    setTrocaOpen(false);
    navigate(plano ? `/cadastro-plano?plan=${plano}${pix ? "&pagamento=pix" : ""}` : "/plano");
  };

  const cardDigits = sanitizeDigits(cardNumber);
  const expiryDigits = sanitizeDigits(expiry);

  const podeTrocar =
    cardDigits.length >= 13 &&
    cardDigits.length <= 19 &&
    holderName.trim().length >= 3 &&
    expiryDigits.length === 4 &&
    cvv.length >= 3 &&
    cvv.length <= 4 &&
    !trocando;

  const resetForm = () => {
    setCardNumber("");
    setHolderName("");
    setExpiry("");
    setCvv("");
    setErro(null);
    setAviso(null);
  };

  const tokenizarCartao = async (): Promise<string> => {
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

  const handleTrocarCartao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!podeTrocar) return;
    setTrocando(true);
    setErro(null);
    setAviso(null);
    try {
      const card_token = await tokenizarCartao();
      const { data, error } = await supabase.functions.invoke(
        "update-pagarme-card",
        { body: { card_token } }
      );
      if (error) {
        // O context do erro do supabase-js é a Response: a mensagem clara está no corpo.
        const corpo = await (error as { context?: Response }).context?.json?.().catch(() => null);
        throw new Error(corpo?.error || error.message || "Falha ao trocar cartão.");
      }
      const resposta = (data ?? {}) as RespostaTrocaCartao;
      const final = resposta.last_four_digits ? ` final ${resposta.last_four_digits}` : "";

      switch (resposta.cobranca) {
        case "assinatura_cancelada":
        case "assinatura_cancelada_reassinar":
        case "assinatura_inexistente": {
          // Nada foi trocado: não há assinatura viva na Pagar.me para usar o cartão.
          const msg = resposta.mensagem || "Sua assinatura foi cancelada. Assine novamente para voltar a ter acesso.";
          resetForm();
          setAviso({ mensagem: msg, reassinar: true, planoSugerido: resposta.plano_sugerido ?? null });
          toast({ title: "Assine novamente para voltar", description: msg, variant: "destructive" });
          recarregarAoFechar.current = true;
          return;
        }
        case "plano_desconhecido": {
          // Sem plano pago conhecido: a função não trocou nem cobrou nada.
          const msg = resposta.mensagem || "Não conseguimos identificar o seu plano. Nada foi cobrado. Fale com o suporte.";
          resetForm();
          setErro(msg);
          toast({ title: "Nada foi cobrado", description: msg, variant: "destructive" });
          recarregarAoFechar.current = true;
          return;
        }
        case "proxima_cobranca": {
          // Assinatura viva, sem fatura em atraso: nada foi cobrado agora.
          const quando = resposta.proxima_cobranca_em ? ` em ${dataBR(resposta.proxima_cobranca_em)}` : "";
          const msg = `Novo cartão${final} salvo. Não há cobrança em atraso agora: a próxima cobrança será${quando}, já neste cartão. Para voltar a usar antes disso, você pode pagar agora com PIX.`;
          resetForm();
          setAviso({ mensagem: msg, reassinar: false, planoSugerido: resposta.plano_sugerido ?? null });
          toast({ title: "Cartão salvo para a próxima cobrança", description: msg });
          recarregarAoFechar.current = true;
          return;
        }
        case "recusada": {
          resetForm();
          setErro(`Seu novo cartão${final} foi salvo, mas o pagamento foi recusado: ${resposta.mensagem}. O pagamento continua pendente; tente outro cartão.`);
          toast({ title: "Pagamento recusado", description: resposta.mensagem, variant: "destructive" });
          recarregarAoFechar.current = true;
          return;
        }
        case "erro": {
          resetForm();
          setErro(`Seu novo cartão${final} foi salvo, mas não conseguimos cobrar a fatura em aberto agora (${resposta.mensagem}). O pagamento continua pendente; tente novamente em instantes ou fale com o suporte.`);
          toast({ title: "Pagamento não realizado", description: resposta.mensagem, variant: "destructive" });
          recarregarAoFechar.current = true;
          return;
        }
        case "pendente": {
          toast({
            title: "Pagamento em processamento",
            description: `Novo cartão${final} salvo. O pagamento está sendo processado; o acesso é liberado assim que a operadora confirmar.`,
          });
          setTrocaOpen(false);
          resetForm();
          onChanged?.();
          return;
        }
        case "paga": {
          toast({ title: "Pagamento aprovado!", description: `Novo cartão${final} salvo. Liberando seu acesso...` });
          setTrocaOpen(false);
          resetForm();
          if (await aguardarAssinaturaAtiva()) {
            toast({ title: "Acesso liberado!", description: "Sua assinatura está ativa novamente." });
            // Refaz a verificação de acesso (ProtectedAppRoute só verifica ao montar)
            try { sessionStorage.removeItem("mec_verificacao_cache"); } catch { /* sem sessionStorage */ }
            window.location.reload();
          } else {
            toast({
              title: "Pagamento aprovado",
              description: "Seu acesso será liberado em instantes, assim que a confirmação da operadora chegar.",
            });
            onChanged?.();
          }
          return;
        }
        default: {
          // nao_necessaria (ou resposta antiga sem o campo)
          if (resposta.acesso_pago_valido === false) {
            // Plano não está valendo e nada foi cobrado: não é "Cartão atualizado!".
            const msg = `Novo cartão${final} salvo, mas nenhuma cobrança foi feita agora e o acesso continua bloqueado. Assine novamente ou pague com PIX para voltar a usar.`;
            resetForm();
            setAviso({ mensagem: msg, reassinar: true, planoSugerido: resposta.plano_sugerido ?? null });
            toast({ title: "Nenhuma cobrança foi feita", description: msg, variant: "destructive" });
            recarregarAoFechar.current = true;
            return;
          }
          const emAberto = resposta.status_assinatura === "past_due" || resposta.status_assinatura === "unpaid";
          toast({
            title: "Cartão atualizado!",
            description: emAberto
              ? `Novo cartão${final} salvo. Não há cobrança em aberto na operadora agora; se o acesso continuar bloqueado, fale com o suporte.`
              : resposta.last_four_digits
                ? `Novo cartão final ${resposta.last_four_digits} salvo com sucesso.`
                : "Próximas cobranças usarão o novo cartão.",
          });
          setTrocaOpen(false);
          resetForm();
          onChanged?.();
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro inesperado.";
      setErro(msg);
      toast({
        title: "Não foi possível trocar o cartão",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setTrocando(false);
    }
  };

  const handleCancelar = async () => {
    setCancelando(true);
    try {
      const { error } = await supabase.functions.invoke(
        "cancel-pagarme-subscription",
        { body: {} }
      );
      if (error) {
        const corpo = await (error as { context?: Response }).context?.json?.().catch(() => null);
        throw new Error(corpo?.error || error.message || "Falha ao cancelar.");
      }

      const motivo = motivoCancelamento === "Outro motivo" ? motivoCustom : motivoCancelamento;
      if (motivo) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase
            .from("assinaturas")
            .update({
              motivo_cancelamento: motivo,
              cancelado_em: new Date().toISOString(),
            })
            .eq("user_id", user.id);
        }
      }

      toast({
        title: "Assinatura cancelada",
        description:
          "Você manterá o acesso até o fim do período já pago. Após isso, voltará ao plano gratuito.",
      });
      onChanged?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro inesperado.";
      toast({
        title: "Não foi possível cancelar",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setCancelando(false);
    }
  };

  const proximaCobrancaLabel = dataProximaCobranca
    ? new Date(dataProximaCobranca).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <div className="mt-4 flex flex-col gap-3">
      {proximaCobrancaLabel && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CalendarClock className="h-4 w-4" />
          <span>
            Próxima cobrança em <strong>{proximaCobrancaLabel}</strong>
          </span>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={() => setTrocaOpen(true)}
          disabled={trocando}
        >
          <CreditCard className="mr-2 h-4 w-4" />
          Trocar cartão
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" disabled={cancelando}>
              {cancelando ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Cancelando...
                </>
              ) : (
                <>
                  <XCircle className="mr-2 h-4 w-4" />
                  Cancelar assinatura
                </>
              )}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancelar assinatura recorrente?</AlertDialogTitle>
              <AlertDialogDescription className="space-y-2">
                <span className="block">
                  Sua assinatura será cancelada e nenhuma nova cobrança será
                  feita no seu cartão.
                </span>
                {proximaCobrancaLabel && (
                  <span className="block">
                    Você continuará com acesso ao plano até{" "}
                    <strong>{proximaCobrancaLabel}</strong>.
                  </span>
                )}
                <span className="block font-semibold text-destructive">
                  Após esta data, sua conta voltará ao plano gratuito.
                </span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="mt-4 space-y-2">
              <label className="text-sm font-medium">
                Nos ajude a melhorar: por que está cancelando?
              </label>
              <select
                value={motivoCancelamento}
                onChange={(e) => {
                  setMotivoCancelamento(e.target.value);
                  setMotivoCustom("");
                }}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Selecione um motivo (opcional)</option>
                {MOTIVOS_CANCELAMENTO.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              {motivoCancelamento === "Outro motivo" && (
                <textarea
                  placeholder="Descreva o motivo..."
                  value={motivoCustom}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
                  rows={3}
                  onChange={(e) => setMotivoCustom(e.target.value)}
                />
              )}
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Voltar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleCancelar}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Confirmar cancelamento
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <Dialog
        open={trocaOpen}
        onOpenChange={(v) => {
          if (trocando) return;
          setTrocaOpen(v);
          if (!v) {
            setTimeout(resetForm, 300);
            if (recarregarAoFechar.current) {
              recarregarAoFechar.current = false;
              onChanged?.();
            }
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Trocar cartão da assinatura
            </DialogTitle>
            <DialogDescription>
              As próximas cobranças recorrentes serão feitas no novo cartão.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleTrocarCartao} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pgm-card-number">Número do cartão</Label>
              <Input
                id="pgm-card-number"
                inputMode="numeric"
                placeholder="0000 0000 0000 0000"
                value={cardNumber}
                onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                disabled={trocando}
                autoComplete="cc-number"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pgm-holder">Nome impresso no cartão</Label>
              <Input
                id="pgm-holder"
                placeholder="Como aparece no cartão"
                value={holderName}
                onChange={(e) => setHolderName(e.target.value.toUpperCase())}
                disabled={trocando}
                autoComplete="cc-name"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="pgm-expiry">Validade (MM/AA)</Label>
                <Input
                  id="pgm-expiry"
                  inputMode="numeric"
                  placeholder="MM/AA"
                  value={expiry}
                  onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                  disabled={trocando}
                  autoComplete="cc-exp"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pgm-cvv">CVV</Label>
                <Input
                  id="pgm-cvv"
                  inputMode="numeric"
                  placeholder="123"
                  value={cvv}
                  onChange={(e) =>
                    setCvv(sanitizeDigits(e.target.value).slice(0, 4))
                  }
                  disabled={trocando}
                  autoComplete="cc-csc"
                />
              </div>
            </div>

            {erro && (
              <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{erro}</span>
              </div>
            )}

            {aviso && (
              <div className="space-y-3 text-sm bg-amber-50 text-amber-900 border border-amber-200 p-3 rounded-md dark:bg-amber-950/40 dark:text-amber-100 dark:border-amber-900">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{aviso.mensagem}</span>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  {aviso.reassinar && (
                    <Button type="button" size="sm" className="flex-1" onClick={() => irParaCheckout(false)}>
                      Assinar novamente
                    </Button>
                  )}
                  <Button type="button" size="sm" variant="outline" className="flex-1" onClick={() => irParaCheckout(true)}>
                    Pagar com PIX
                  </Button>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="w-3.5 h-3.5" />
              Seus dados são enviados criptografados diretamente para a Pagar.me.
            </div>

            <DialogFooter>
              <Button
                type="submit"
                className={cn("w-full", trocando && "opacity-80")}
                disabled={!podeTrocar}
              >
                {trocando ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Atualizando cartão...
                  </>
                ) : (
                  "Salvar novo cartão"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}