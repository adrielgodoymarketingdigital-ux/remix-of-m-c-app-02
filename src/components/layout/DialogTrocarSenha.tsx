import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TurnstileWidget, type TurnstileWidgetHandle } from "@/components/TurnstileWidget";
import { useToast } from "@/hooks/use-toast";

interface DialogTrocarSenhaProps {
  email: string;
  aberto: boolean;
  onOpenChange: (aberto: boolean) => void;
}

/** Envia o link de redefinição para o e-mail da conta. O Auth exige captcha também aqui. */
export function DialogTrocarSenha({ email, aberto, onOpenChange }: DialogTrocarSenhaProps) {
  const { t } = useTranslation("menu");
  const { toast } = useToast();
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const turnstileRef = useRef<TurnstileWidgetHandle>(null);

  const alterarAberto = (novo: boolean) => {
    if (!novo) setCaptchaToken(null);
    onOpenChange(novo);
  };

  const enviar = async () => {
    if (!captchaToken) return;
    setEnviando(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: "https://www.appmec.in/reset-password",
      captchaToken,
    });
    setEnviando(false);

    if (!error) {
      toast({ title: t("conta.senhaEnviadaTitulo"), description: t("conta.senhaEnviadaDescricao", { email }) });
      alterarAberto(false);
      return;
    }

    // O token é de uso único: depois de uma tentativa, o widget precisa gerar outro.
    console.error("Erro ao enviar link de redefinição:", error);
    turnstileRef.current?.reset();
    setCaptchaToken(null);
    const limite = error.status === 429 || error.code === "over_email_send_rate_limit" || error.code === "over_request_rate_limit";
    toast({
      variant: "destructive",
      title: t("conta.senhaErroTitulo"),
      description: limite
        ? t("conta.senhaErroLimite")
        : error.code === "captcha_failed"
          ? t("conta.senhaErroCaptcha")
          : t("conta.senhaErroGeral"),
    });
  };

  return (
    <Dialog open={aberto} onOpenChange={alterarAberto}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("conta.trocarSenha")}</DialogTitle>
          <DialogDescription>{t("conta.senhaDescricao", { email })}</DialogDescription>
        </DialogHeader>
        {aberto && (
          <TurnstileWidget
            ref={turnstileRef}
            onVerify={setCaptchaToken}
            onExpire={() => setCaptchaToken(null)}
          />
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => alterarAberto(false)}>{t("conta.cancelar")}</Button>
          <Button onClick={enviar} disabled={!captchaToken || enviando}>
            {enviando ? t("conta.senhaEnviando") : t("conta.senhaEnviar")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
