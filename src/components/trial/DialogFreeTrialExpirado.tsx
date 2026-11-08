import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Crown, Frown, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface DialogFreeTrialExpiradoProps {
  open: boolean;
  onClose: () => void;
}

export function DialogFreeTrialExpirado({ open, onClose }: DialogFreeTrialExpiradoProps) {
  const navigate = useNavigate();
  const { t } = useTranslation("comum");
  const [salvando, setSalvando] = useState(false);

  const handleContinuarFree = async () => {
    setSalvando(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        onClose();
        return;
      }

      // Atualizar assinatura para plano free ativo e limpar trial
      const { error } = await supabase
        .from("assinaturas")
        .update({
          plano_tipo: "free" as any,
          status: "active" as any,
          trial_canceled: true,
          trial_canceled_at: new Date().toISOString(),
          free_trial_ends_at: null,
        })
        .eq("user_id", session.user.id);

      if (error) {
        console.error("Erro ao atualizar para plano free:", error);
        toast({
          title: t("testeGratis.expirado.erroTitulo"),
          description: t("testeGratis.expirado.erroDescricao"),
          variant: "destructive",
        });
      } else {
        console.log("✅ Assinatura atualizada para plano free");
        // Recarregar a página para que o hook de verificação re-avalie
        window.location.reload();
        return;
      }
    } catch (e) {
      console.error("Exceção ao atualizar plano:", e);
    } finally {
      setSalvando(false);
    }
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex justify-center mb-2">
            <div className="rounded-full bg-amber-100 dark:bg-amber-900/30 p-3">
              <Frown className="h-8 w-8 text-amber-500" />
            </div>
          </div>
          <DialogTitle className="text-center text-xl">{t("testeGratis.expirado.titulo")}</DialogTitle>
          <DialogDescription className="text-center">
            {t("testeGratis.expirado.descricao")}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex flex-col gap-2 sm:flex-col">
          <Button
            onClick={() => { onClose(); navigate("/plano"); }}
            className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-semibold shadow-lg"
          >
            <Crown className="h-4 w-4 mr-2" />
            {t("testeGratis.expirado.assinar")}
          </Button>
          <Button
            variant="ghost"
            onClick={handleContinuarFree}
            disabled={salvando}
            className="w-full text-muted-foreground"
          >
            {salvando ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t("testeGratis.expirado.atualizando")}
              </>
            ) : (
              t("testeGratis.expirado.continuarFree")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
