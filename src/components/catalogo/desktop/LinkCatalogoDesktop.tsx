// Cartão do link público no computador: a versão "controlada" do GerenciadorLinkCatalogo.
// O estado vem de useLinkCatalogo e a gravação é a do Salvar único no topo (sem botão próprio).
// O GerenciadorLinkCatalogo continua igual no celular e no tablet.
// Conteúdo e ordem iguais ao antigo; o visual novo deste passo chega na F4.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Copy, ExternalLink, Globe, Link2, Loader2, Lock, RefreshCw, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import type { LinkCatalogo } from "@/hooks/useLinkCatalogo";
import { TAMANHO_MINIMO_LINK } from "@/lib/catalogo/gravacaoCatalogoDesktop";
import { cn } from "@/lib/utils";

interface LinkCatalogoDesktopProps {
  link: LinkCatalogo;
}

export function LinkCatalogoDesktop({ link }: LinkCatalogoDesktopProps) {
  const { t } = useTranslation("catalogo", { keyPrefix: "telaDesktop.link" });
  const [copiado, setCopiado] = useState(false);
  const slugValido = link.slug.length >= TAMANHO_MINIMO_LINK;

  const alternarPublicacao = (valor: boolean) => {
    if (valor && !slugValido) {
      toast({ title: t("configureLinkTitulo"), description: t("configureLinkDescricao"), variant: "destructive" });
      return;
    }
    link.alterarAtivo(valor);
  };

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(link.linkCompleto);
      setCopiado(true);
      toast({ title: t("linkCopiado") });
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      toast({ title: t("erroCopiar"), variant: "destructive" });
    }
  };

  const compartilhar = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: t("compartilharTitulo"), text: t("compartilharTexto"), url: link.linkCompleto });
      } catch (erro) {
        if ((erro as Error).name !== "AbortError") void copiar();
      }
    } else {
      void copiar();
    }
  };

  if (!link.carregado) {
    return (
      <Card className="rounded-2xl">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Link2 className="h-5 w-5 text-primary" aria-hidden="true" />
          <CardTitle className="text-lg">{t("titulo")}</CardTitle>
        </div>
        <CardDescription>{t("descricao")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="slug-catalogo-desktop">{t("campo")}</Label>
            <Button variant="ghost" size="sm" onClick={() => void link.gerarAutomatico()} className="h-7 text-xs">
              <RefreshCw className="mr-1 h-3 w-3" aria-hidden="true" />
              {t("gerarAutomatico")}
            </Button>
          </div>
          <div className="flex items-center">
            <span className="rounded-l-md border border-r-0 bg-muted px-3 py-2 text-sm text-muted-foreground">
              {window.location.origin}/c/
            </span>
            <Input
              id="slug-catalogo-desktop"
              value={link.slug}
              onChange={(e) => link.alterarSlug(e.target.value)}
              placeholder="minha-loja"
              className="rounded-l-none"
            />
          </div>
          {slugValido && (link.conferindo || link.disponivel !== null) && (
            <div className="flex items-center gap-2 text-sm" role="status">
              {link.conferindo ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  <span className="text-muted-foreground">{t("conferindo")}</span>
                </>
              ) : link.disponivel ? (
                <>
                  <Check className="h-4 w-4 text-green-600 dark:text-green-400" aria-hidden="true" />
                  <span className="text-green-700 dark:text-green-400">{t("disponivel")}</span>
                </>
              ) : (
                <span className="text-destructive">{t("emUso")}</span>
              )}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <Label htmlFor="publicar-catalogo-desktop">{t("publicarRotulo")}</Label>
          <div
            className={cn(
              "flex items-center justify-between rounded-xl border-2 p-4 transition-colors",
              link.ativo ? "border-green-500/30 bg-green-500/10" : "border-transparent bg-muted/50",
            )}
          >
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "grid h-10 w-10 place-items-center rounded-full",
                  link.ativo ? "bg-green-500/20 text-green-600 dark:text-green-400" : "bg-muted text-muted-foreground",
                )}
              >
                {link.ativo ? <Globe className="h-5 w-5" aria-hidden="true" /> : <Lock className="h-5 w-5" aria-hidden="true" />}
              </div>
              <div>
                <p className={cn("font-medium", link.ativo && "text-green-700 dark:text-green-400")}>
                  {link.ativo ? t("publicado") : t("naoPublicado")}
                </p>
                <p className="text-sm text-muted-foreground">{link.ativo ? t("publicadoDescricao") : t("naoPublicadoDescricao")}</p>
              </div>
            </div>
            <Switch id="publicar-catalogo-desktop" checked={link.ativo} onCheckedChange={alternarPublicacao} />
          </div>
        </div>

        {slugValido && (
          <div className="space-y-3">
            <Label>{t("seuLink")}</Label>
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
              <p className="break-all text-sm font-medium text-primary">{link.linkCompleto}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => void copiar()} className="flex-1">
                {copiado ? <Check className="mr-2 h-4 w-4" aria-hidden="true" /> : <Copy className="mr-2 h-4 w-4" aria-hidden="true" />}
                {copiado ? t("copiado") : t("copiar")}
              </Button>
              <Button variant="outline" size="sm" onClick={() => window.open(link.linkCompleto, "_blank")} className="flex-1">
                <ExternalLink className="mr-2 h-4 w-4" aria-hidden="true" />
                {t("visualizar")}
              </Button>
              <Button variant="outline" size="sm" onClick={() => void compartilhar()} title={t("compartilhar")} aria-label={t("compartilhar")}>
                <Share2 className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
            {!link.ativo && (
              <p className="rounded-md bg-amber-50 p-2 text-center text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                {t("avisoNaoPublicado")}
              </p>
            )}
          </div>
        )}

        <p className="text-xs text-muted-foreground">{t("avisoSalvarNoTopo")}</p>
      </CardContent>
    </Card>
  );
}
