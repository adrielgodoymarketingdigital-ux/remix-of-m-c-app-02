import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { clearSessionMeta } from "@/lib/sessionStorage";

/** Sair da conta: a mesma ação na barra lateral, no menu do celular e no avatar da topbar. */
export function useLogout() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { i18n } = useTranslation("menu");

  return useCallback(async (aoSair?: () => void) => {
    clearSessionMeta();
    // Textos lidos antes do signOut: a troca de usuário volta o idioma ao pt-BR.
    const titulo = i18n.t("logout.titulo", { ns: "menu" });
    const descricao = i18n.t("logout.descricao", { ns: "menu" });
    await supabase.auth.signOut();
    toast({
      title: titulo,
      description: descricao,
    });
    aoSair?.();
    navigate("/auth");
  }, [i18n, navigate, toast]);
}
