// Salvar único do Catálogo no computador: grava catalogo_config + link + publicação de uma vez.
// Sem mudança: botão desabilitado "Tudo salvo". Com mudança: selo "Alterações não salvas" + "Salvar".
// Só visual: quem decide "alterado" é a casca (alteracoesNaoSalvas.ts) e quem grava é useLinkCatalogo.
import { useTranslation } from "react-i18next";
import { CheckCircle2, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { estadoBotaoSalvar, podeSalvar } from "@/lib/catalogo/alteracoesNaoSalvas";
import { cn } from "@/lib/utils";

interface BarraSalvarCatalogoProps {
  alterado: boolean;
  salvando: boolean;
  onSalvar: () => void;
}

export function BarraSalvarCatalogo({ alterado, salvando, onSalvar }: BarraSalvarCatalogoProps) {
  const { t } = useTranslation("catalogo", { keyPrefix: "telaDesktop.salvar" });
  const estado = estadoBotaoSalvar(alterado, salvando);
  const habilitado = podeSalvar(alterado, salvando);

  return (
    <div className="flex items-center gap-3">
      {alterado && (
        <span
          role="status"
          className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300"
        >
          <span className="h-2 w-2 rounded-full bg-amber-500" aria-hidden="true" />
          {t("alteracoesNaoSalvas")}
        </span>
      )}
      {/* "Salvar" usa o degradê padrão do app (btn-primary-gradient, segue as cores da loja);
          "Tudo salvo" é neutro, porque o degradê do variant padrão não sai com bg-*. */}
      <Button
        onClick={onSalvar}
        disabled={!habilitado}
        variant={estado === "tudo_salvo" ? "outline" : "default"}
        className={cn(
          "h-11 min-w-[148px] rounded-xl px-5 font-semibold",
          estado === "tudo_salvo" && "bg-muted/60 text-muted-foreground disabled:opacity-100",
        )}
      >
        {estado === "salvando" ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
        ) : estado === "tudo_salvo" ? (
          <CheckCircle2 className="mr-2 h-4 w-4" aria-hidden="true" />
        ) : (
          <Save className="mr-2 h-4 w-4" aria-hidden="true" />
        )}
        {estado === "salvando" ? t("salvando") : estado === "tudo_salvo" ? t("tudoSalvo") : t("salvar")}
      </Button>
    </div>
  );
}
