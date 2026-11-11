// Cartão "Link público" do Catálogo no computador (passo Compartilhar).
// O estado vem de useLinkCatalogo: o campo do link e a chave publicar são RASCUNHO da tela; quem grava
// é o Salvar único do cabeçalho (este cartão não tem botão de salvar). O selo mostra o que está no ar
// (o salvo), e copiar / abrir / compartilhar usam o link SALVO. O GerenciadorLinkCatalogo continua
// igual no celular e no tablet.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Check, Copy, ExternalLink, Globe, Info, Link2, Loader2, Lock, RefreshCw, Share2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import type { LinkCatalogo } from "@/hooks/useLinkCatalogo";
import { linkPendente, linkPublicoSalvo, publicarSemLink, seloDoLink, situacaoDoCampo } from "@/lib/catalogo/compartilharDesktop";
import { TAMANHO_MINIMO_LINK } from "@/lib/catalogo/gravacaoCatalogoDesktop";
import { cn } from "@/lib/utils";

interface LinkCatalogoDesktopProps {
  link: LinkCatalogo;
  /** O catalogo_slug também é o link da Landing Page: avisa só quem tem a LP. */
  temLandingPage: boolean;
  className?: string;
}

export function LinkCatalogoDesktop({ link, temLandingPage, className }: LinkCatalogoDesktopProps) {
  const { t } = useTranslation("catalogo", { keyPrefix: "telaDesktop.link" });
  const [copiado, setCopiado] = useState(false);
  const slugValido = link.slug.trim().length >= TAMANHO_MINIMO_LINK;
  const selo = seloDoLink(link);
  const situacao = situacaoDoCampo(link);
  const semLinkParaPublicar = publicarSemLink(link);
  const pendente = linkPendente(link);
  const linkSalvo = linkPublicoSalvo(window.location.origin, link.slugSalvo);

  const alternarPublicacao = (valor: boolean) => {
    if (valor && !slugValido) {
      toast({ title: t("configureLinkTitulo"), description: t("configureLinkDescricao"), variant: "destructive" });
      return;
    }
    link.alterarAtivo(valor);
  };

  // Copiar e compartilhar: o mesmo do GerenciadorLinkCatalogo (área de transferência; navigator.share
  // quando o navegador tem, senão copia). Só muda o link usado: o salvo.
  const copiar = async () => {
    if (!linkSalvo) return;
    try {
      await navigator.clipboard.writeText(linkSalvo);
      setCopiado(true);
      toast({ title: t("linkCopiado") });
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      toast({ title: t("erroCopiar"), variant: "destructive" });
    }
  };

  const compartilhar = async () => {
    if (!linkSalvo) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: t("compartilharTitulo"), text: t("compartilharTexto"), url: linkSalvo });
      } catch (erro) {
        if ((erro as Error).name !== "AbortError") void copiar();
      }
    } else {
      void copiar();
    }
  };

  if (!link.carregado) {
    return (
      <Card className={cn("rounded-2xl", className)}>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  const linhaSituacao = (() => {
    switch (situacao) {
      case "sem_link":
        return <span className="text-muted-foreground">{t("situacaoSemLink")}</span>;
      case "curto":
        return (
          <span className="flex items-center gap-1.5 text-amber-700 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
            {t("situacaoCurto")}
          </span>
        );
      case "salvo":
        return (
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
            {t("situacaoSalvo")}
          </span>
        );
      case "conferindo":
        return (
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
            {t("conferindo")}
          </span>
        );
      case "disponivel":
        return (
          <span className="flex items-center gap-1.5 text-green-700 dark:text-green-400">
            <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
            {t("disponivel")}
          </span>
        );
      case "em_uso":
        return (
          <span className="flex items-center gap-1.5 text-destructive">
            <X className="h-4 w-4 shrink-0" aria-hidden="true" />
            {t("emUso")}
          </span>
        );
    }
  })();

  return (
    <Card className={cn("rounded-2xl", className)}>
      <CardHeader className="pb-4">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
            <Link2 className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <CardTitle className="text-lg">{t("tituloPublico")}</CardTitle>
            <CardDescription>{t("descricaoPublico")}</CardDescription>
          </div>
          <span
            data-selo={selo}
            title={selo === "publicado" ? t("seloPublicadoDica") : t("seloRascunhoDica")}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
              selo === "publicado"
                ? "border-green-300 bg-green-50 text-green-700 dark:border-green-500/40 dark:bg-green-500/10 dark:text-green-400"
                : "border-border bg-muted text-muted-foreground",
            )}
          >
            <span className={cn("h-1.5 w-1.5 rounded-full", selo === "publicado" ? "bg-green-500" : "bg-muted-foreground/60")} aria-hidden="true" />
            {selo === "publicado" ? t("seloPublicado") : t("seloRascunho")}
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Endereço (rascunho até o Salvar) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="slug-catalogo-desktop">{t("endereco")}</Label>
            <Button variant="ghost" size="sm" onClick={() => void link.gerarAutomatico()} className="h-7 text-xs">
              <RefreshCw className="mr-1 h-3 w-3" aria-hidden="true" />
              {t("gerarAutomatico")}
            </Button>
          </div>
          <div
            className={cn(
              "flex items-center overflow-hidden rounded-xl border bg-background focus-within:ring-2 focus-within:ring-ring",
              situacao === "em_uso" && "border-destructive",
              situacao === "curto" && "border-amber-400",
            )}
          >
            <span className="shrink-0 border-r bg-muted px-3 py-2.5 text-sm text-muted-foreground">{window.location.host}/c/</span>
            <Input
              id="slug-catalogo-desktop"
              value={link.slug}
              onChange={(e) => link.alterarSlug(e.target.value)}
              placeholder="minha-loja"
              aria-invalid={situacao === "em_uso" || situacao === "curto"}
              className="h-10 rounded-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </div>
          <p className="min-h-5 text-sm" role="status" data-situacao={situacao}>
            {linhaSituacao}
          </p>
          {temLandingPage && (
            <p className="flex items-start gap-1.5 text-xs text-muted-foreground" data-aviso="landing-page">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {t("avisoLandingPage")}
            </p>
          )}
        </div>

        {/* Publicar (rascunho até o Salvar) */}
        <div
          className={cn(
            "flex items-center justify-between gap-3 rounded-xl border p-4 transition-colors",
            link.ativo ? "border-green-500/30 bg-green-500/10" : "bg-muted/40",
          )}
        >
          <div className="flex min-w-0 items-center gap-3">
            <div
              className={cn(
                "grid h-10 w-10 shrink-0 place-items-center rounded-full",
                link.ativo ? "bg-green-500/20 text-green-600 dark:text-green-400" : "bg-muted text-muted-foreground",
              )}
            >
              {link.ativo ? <Globe className="h-5 w-5" aria-hidden="true" /> : <Lock className="h-5 w-5" aria-hidden="true" />}
            </div>
            <div className="min-w-0">
              <Label htmlFor="publicar-catalogo-desktop" className={cn("font-medium", link.ativo && "text-green-700 dark:text-green-400")}>
                {link.ativo ? t("publicado") : t("naoPublicado")}
              </Label>
              <p className="text-sm text-muted-foreground">{link.ativo ? t("publicadoDescricao") : t("naoPublicadoDescricao")}</p>
            </div>
          </div>
          <Switch id="publicar-catalogo-desktop" checked={link.ativo} onCheckedChange={alternarPublicacao} aria-label={t("publicarRotulo")} />
        </div>
        {semLinkParaPublicar && (
          <p className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300" role="alert">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {t("publicarSemLink")}
          </p>
        )}

        {/* O link que existe de verdade (o salvo) */}
        <div className="space-y-2 rounded-xl border bg-muted/30 p-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {selo === "publicado" ? t("linkSalvo") : linkSalvo ? t("linkSalvoRascunho") : t("seuLink")}
          </p>
          {linkSalvo ? (
            <>
              <p className="break-all text-sm font-medium text-primary" data-link-salvo>
                {linkSalvo}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => void copiar()} className="flex-1">
                  {copiado ? <Check className="mr-2 h-4 w-4" aria-hidden="true" /> : <Copy className="mr-2 h-4 w-4" aria-hidden="true" />}
                  {copiado ? t("copiado") : t("copiar")}
                </Button>
                <Button variant="outline" size="sm" onClick={() => window.open(linkSalvo, "_blank")} className="flex-1">
                  <ExternalLink className="mr-2 h-4 w-4" aria-hidden="true" />
                  {t("abrir")}
                </Button>
                <Button variant="outline" size="sm" onClick={() => void compartilhar()} className="flex-1">
                  <Share2 className="mr-2 h-4 w-4" aria-hidden="true" />
                  {t("compartilhar")}
                </Button>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{t("semLinkSalvo")}</p>
          )}
        </div>

        {pendente ? (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300" data-aviso="pendente">
            {t("pendente")}
          </p>
        ) : (
          linkSalvo &&
          selo === "rascunho" && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">{t("avisoNaoPublicado")}</p>
          )
        )}
        <p className="text-xs text-muted-foreground">{t("avisoSalvarNoTopo")}</p>
      </CardContent>
    </Card>
  );
}
