/**
 * Por onde se abre "Personalizar recibo de venda": item nos menus do PDV e de
 * Vendas e atalho na aba Prévia de Configurações. Tudo atrás da mesma regra do
 * recibo novo (useReciboVendaNovoVisivel): quem não vê o recibo novo não vê
 * nenhum item e não baixa o diálogo (chunk carregado só ao abrir).
 */
import { lazy, Suspense, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ReceiptText } from "lucide-react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useReciboVendaNovoVisivel } from "@/hooks/useReciboVendaNovoVisivel";

const DialogPersonalizarReciboVenda = lazy(() => import("./DialogPersonalizarReciboVenda"));

/** Item de menu (dentro de um DropdownMenuContent). */
export function ItemMenuPersonalizarReciboVenda({ onAbrir }: { onAbrir: () => void }) {
  const visivel = useReciboVendaNovoVisivel();
  const { t } = useTranslation("configuracoes");
  if (!visivel) return null;
  return (
    <DropdownMenuItem onClick={onAbrir}>
      <ReceiptText className="h-4 w-4 mr-2" aria-hidden="true" />
      {t("reciboVenda.abrir")}
    </DropdownMenuItem>
  );
}

/** O diálogo, montado só depois da primeira abertura (e mantido para a animação e o foco ao fechar). */
export function DialogPersonalizarReciboVendaSobDemanda({ open, onOpenChange }: { open: boolean; onOpenChange: (aberto: boolean) => void }) {
  const visivel = useReciboVendaNovoVisivel();
  const [montado, setMontado] = useState(false);
  useEffect(() => {
    if (open) setMontado(true);
  }, [open]);
  if (!visivel || !(open || montado)) return null;
  return (
    <Suspense fallback={null}>
      <DialogPersonalizarReciboVenda open={open} onOpenChange={onOpenChange} />
    </Suspense>
  );
}

/** Atalho na aba Prévia de Configurações. */
export function AtalhoPersonalizarReciboVenda() {
  const visivel = useReciboVendaNovoVisivel();
  const { t } = useTranslation("configuracoes");
  const [aberto, setAberto] = useState(false);
  if (!visivel) return null;
  return (
    <div className="flex flex-col gap-3 rounded-2xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary" aria-hidden="true">
          <ReceiptText className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h3 className="text-[15px] font-bold leading-tight">{t("reciboVenda.atalho.titulo")}</h3>
          <p className="mt-1 text-[13px] text-muted-foreground">{t("reciboVenda.atalho.descricao")}</p>
        </div>
      </div>
      <Button type="button" variant="outline" className="shrink-0" onClick={() => setAberto(true)}>
        {t("reciboVenda.abrir")}
      </Button>
      <DialogPersonalizarReciboVendaSobDemanda open={aberto} onOpenChange={setAberto} />
    </div>
  );
}
