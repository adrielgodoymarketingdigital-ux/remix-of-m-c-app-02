import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Caixa } from "@/types/caixa";
import { formatCurrency } from "@/lib/formatters";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";

interface DialogHistoricoCaixasProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DialogHistoricoCaixas({ open, onOpenChange }: DialogHistoricoCaixasProps) {
  const [caixas, setCaixas] = useState<Caixa[]>([]);
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

  const fmt = (iso: string) =>
    format(new Date(iso), "dd/MM/yyyy HH:mm", { locale: ptBR });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Histórico de Caixas</DialogTitle>
        </DialogHeader>

        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>
        ) : caixas.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhum caixa registrado.</p>
        ) : (
          <div className="space-y-3">
            {caixas.map((c) => (
              <div key={c.id} className="border rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{fmt(c.data_abertura)}</span>
                  <Badge variant={c.status === "aberto" ? "default" : "secondary"}>
                    {c.status === "aberto" ? "Aberto" : "Fechado"}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-muted-foreground">
                  <div>
                    <p>Saldo inicial</p>
                    <p className="font-medium text-foreground">{formatCurrency(c.saldo_inicial)}</p>
                  </div>
                  <div>
                    <p>Total vendas</p>
                    <p className="font-medium text-foreground">{formatCurrency(c.total_vendas)}</p>
                  </div>
                  <div>
                    <p>Dinheiro</p>
                    <p className="font-medium text-foreground">{formatCurrency(c.total_dinheiro)}</p>
                  </div>
                  <div>
                    <p>Saldo final</p>
                    <p className="font-medium text-foreground">
                      {c.saldo_final != null ? formatCurrency(c.saldo_final) : "—"}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                  <div>
                    <p>PIX</p>
                    <p className="font-medium text-foreground">{formatCurrency(c.total_pix)}</p>
                  </div>
                  <div>
                    <p>Cartão</p>
                    <p className="font-medium text-foreground">{formatCurrency(c.total_cartao)}</p>
                  </div>
                  <div>
                    <p>A receber</p>
                    <p className="font-medium text-foreground">{formatCurrency(c.total_a_receber)}</p>
                  </div>
                </div>

                {c.data_fechamento && (
                  <p className="text-xs text-muted-foreground">
                    Fechado em: {fmt(c.data_fechamento)}
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
