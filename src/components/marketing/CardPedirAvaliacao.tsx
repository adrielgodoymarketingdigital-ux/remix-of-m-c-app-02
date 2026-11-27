import { useEffect, useMemo, useState, lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { subDays } from "date-fns";
import { Copy, Link2, Loader2, Search, Info } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useOrdensServico, type OrdemServico } from "@/hooks/useOrdensServico";
import { useFormatadores } from "@/hooks/useFormatadores";
import type { ConfiguracaoLoja } from "@/types/configuracao-loja";
import { lerConfigAvaliacaoGoogle, montarMensagemAvaliacao, selecionarOSEntreguesRecentes } from "@/lib/marketing/avaliacaoGoogle";

const DialogEnviarWhatsApp = lazy(() => import("@/components/ordens/DialogEnviarWhatsApp").then((m) => ({ default: m.DialogEnviarWhatsApp })));

interface CardPedirAvaliacaoProps {
  config: ConfiguracaoLoja | null;
}

// A lista usa a mesma consulta da tela de OS (useOrdensServico): as mesmas
// regras de loja/filial e de "ver todas as OS" do funcionário. O filtro do
// hook é por data de criação; 90 dias cobre as entregas dos últimos 30 dias
// de quase todas as OS, e o corte fino é pela data de saída.
const DIAS_CRIACAO = 90;

export function CardPedirAvaliacao({ config }: CardPedirAvaliacaoProps) {
  const { t } = useTranslation("marketing");
  const fmt = useFormatadores();
  const mostrarOsFiliais = !!config?.permissoes_multiempresa?.mostrar_os_filiais_na_matriz;
  const { ordens, loading, busca, setBusca, setStatusFiltro, setDataInicio, setDataFim } = useOrdensServico(mostrarOsFiliais);
  const [ordemDialogo, setOrdemDialogo] = useState<OrdemServico | null>(null);

  useEffect(() => {
    setStatusFiltro("entregue");
    setDataInicio(subDays(new Date(), DIAS_CRIACAO));
    setDataFim(undefined);
    // Só na montagem.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const avaliacao = useMemo(() => lerConfigAvaliacaoGoogle(config?.mensagens_whatsapp_os), [config]);
  const link = avaliacao.linkValido;
  const lista = useMemo(() => selecionarOSEntreguesRecentes(ordens, new Date()), [ordens]);

  const copiar = async (texto: string) => {
    try {
      await navigator.clipboard.writeText(texto);
      toast.success(t("avaliacao.copiado"));
    } catch {
      toast.error(t("avaliacao.erroCopiar"));
    }
  };

  const mensagemGenerica = link
    ? montarMensagemAvaliacao(avaliacao.mensagem, { cliente: "", loja: config?.nome_loja, link })
    : "";

  return (
    <Card className="overflow-hidden rounded-2xl">
      <CardHeader className="border-b p-4 sm:p-6">
        <div className="flex items-center gap-3 sm:gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#25D366]/15">
            <FaWhatsapp className="h-6 w-6 text-[#1DA851]" aria-hidden="true" />
          </span>
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-lg">{t("avaliacao.pedirTitulo")}</CardTitle>
            <CardDescription>{t("avaliacao.pedirDescricao")}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-4 pt-5 sm:p-6">
        {!link && (
          <p className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300">
            <Info className="h-4 w-4 mt-0.5 shrink-0" />
            {t("avaliacao.semLinkDica")}
          </p>
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder={t("avaliacao.buscar")}
              className="h-11 rounded-lg bg-muted/30 pl-9"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Button type="button" variant="outline" className="h-11 gap-2 rounded-lg" disabled={!link} onClick={() => link && copiar(link)}>
              <Link2 className="h-4 w-4" />
              {t("avaliacao.copiarLink")}
            </Button>
            <Button type="button" variant="outline" className="h-11 gap-2 rounded-lg" disabled={!link} onClick={() => copiar(mensagemGenerica)}>
              <Copy className="h-4 w-4" />
              {t("avaliacao.copiarMensagem")}
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-14 w-full rounded-xl" />
            <Skeleton className="h-14 w-full rounded-xl" />
            <Skeleton className="h-14 w-full rounded-xl" />
          </div>
        ) : lista.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {busca.trim() ? t("avaliacao.vazioBusca") : t("avaliacao.vazio")}
          </p>
        ) : (
          <ul className="divide-y overflow-hidden rounded-xl border">
            {lista.map((ordem) => (
              <li key={ordem.id} className="flex items-center gap-3 px-3 py-3 transition-colors hover:bg-muted/40 sm:px-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    <span className="text-muted-foreground">#{ordem.numero_os}</span>{" "}
                    {ordem.cliente?.nome || t("avaliacao.semCliente")}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[ordem.dispositivo_marca, ordem.dispositivo_modelo].filter(Boolean).join(" ")}
                    {ordem.data_saida ? ` · ${t("avaliacao.entregueEm", { data: fmt.data(ordem.data_saida) })}` : ""}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="shrink-0 gap-2 rounded-lg"
                  disabled={!link}
                  aria-label={t("avaliacao.botaoPedir")}
                  onClick={() => setOrdemDialogo(ordem)}
                >
                  <FaWhatsapp className="h-4 w-4 text-[#25D366]" />
                  <span className="hidden sm:inline">{t("avaliacao.botaoPedir")}</span>
                </Button>
              </li>
            ))}
          </ul>
        )}

        {ordemDialogo && (
          <Suspense fallback={<Loader2 className="h-4 w-4 animate-spin" />}>
            <DialogEnviarWhatsApp
              open={!!ordemDialogo}
              onOpenChange={(aberto) => { if (!aberto) setOrdemDialogo(null); }}
              ordem={ordemDialogo}
              loja={config ?? undefined}
              contexto="avaliacao"
            />
          </Suspense>
        )}
      </CardContent>
    </Card>
  );
}
