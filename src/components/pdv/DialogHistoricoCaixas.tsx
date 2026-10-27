import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Caixa } from "@/types/caixa";
import { useTranslation } from "react-i18next";
import { useFormatadores } from "@/hooks/useFormatadores";
import { useNomesFormaPagamento } from "@/hooks/useNomesFormaPagamento";
import { Badge } from "@/components/ui/badge";

interface DialogHistoricoCaixasProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DialogHistoricoCaixas({ open, onOpenChange }: DialogHistoricoCaixasProps) {
  const [caixas, setCaixas] = useState<Caixa[]>([]);
  // Textos: namespace "pdv"; moeda e datas: useFormatadores (conta).
  const { t } = useTranslation("pdv");
  const formatadores = useFormatadores();
  const formatCurrency = formatadores.moeda;
  const { curto } = useNomesFormaPagamento();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) carregar();
  }, [open]);

  const carregar = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("caixas")
        .select("*")
        .eq("user_id", user.id)
        .order("data_abertura", { ascending: false })
        .limit(30);

      setCaixas((data ?? []) as Caixa[]);
    } finally {
      setLoading(false);
    }
  };

  const fmt = (iso: string) => formatadores.dataHora(iso);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("caixa.historico.titulo")}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-8">{t("caixa.historico.carregando")}</p>
        ) : caixas.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">{t("caixa.historico.nenhum")}</p>
        ) : (
          <div className="space-y-3">
            {caixas.map((c) => (
              <div key={c.id} className="border rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{fmt(c.data_abertura)}</span>
                  <Badge variant={c.status === "aberto" ? "default" : "secondary"}>
                    {c.status === "aberto" ? t("caixa.historico.aberto") : t("caixa.historico.fechado")}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-muted-foreground">
                  <div>
                    <p>{t("caixa.historico.saldoInicial")}</p>
                    <p className="font-medium text-foreground">{formatCurrency(c.saldo_inicial)}</p>
                  </div>
                  <div>
                    <p>{t("caixa.historico.totalVendas")}</p>
                    <p className="font-medium text-foreground">{formatCurrency(c.total_vendas)}</p>
                  </div>
                  <div>
                    <p>{curto.dinheiro}</p>
                    <p className="font-medium text-foreground">{formatCurrency(c.total_dinheiro)}</p>
                  </div>
                  <div>
                    <p>{t("caixa.historico.saldoFinal")}</p>
                    <p className="font-medium text-foreground">
                      {c.saldo_final != null ? formatCurrency(c.saldo_final) : "—"}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-muted-foreground">
                  <div>
                    <p>{curto.pix}</p>
                    <p className="font-medium text-foreground">{formatCurrency(c.total_pix)}</p>
                  </div>
                  <div>
                    <p>{t("caixa.historico.cartao")}</p>
                    <p className="font-medium text-foreground">{formatCurrency(c.total_cartao)}</p>
                  </div>
                  <div>
                    <p>{t("caixa.historico.aReceber")}</p>
                    <p className="font-medium text-foreground">{formatCurrency(c.total_a_receber)}</p>
                  </div>
                  <div>
                    <p>{t("caixa.historico.servicos")}</p>
                    <p className="font-medium text-foreground">{formatCurrency(c.total_servicos ?? 0)}</p>
                  </div>
                </div>

                {Number(c.total_devolucoes_troca) > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {t("caixa.historico.devolucoes")}{" "}
                    <span className="font-medium text-red-600">{t("caixa.historico.menosValor", { valor: formatCurrency(Number(c.total_devolucoes_troca)) })}</span>
                  </p>
                )}
                {c.data_fechamento && (
                  <p className="text-xs text-muted-foreground">
                    {t("caixa.historico.fechadoEm", { data: fmt(c.data_fechamento) })}
                  </p>
                )}
                {c.observacoes && (
                  <p className="text-xs text-muted-foreground italic">"{c.observacoes}"</p>
                )}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
