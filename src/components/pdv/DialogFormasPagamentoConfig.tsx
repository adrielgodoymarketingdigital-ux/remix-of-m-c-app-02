import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Loader2, CreditCard } from "lucide-react";
import { useFormasPagamentoCustomizadas } from "@/hooks/useFormasPagamentoCustomizadas";

interface DialogFormasPagamentoConfigProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  empresaId?: string | null;
}

export function DialogFormasPagamentoConfig({
  open,
  onOpenChange,
  empresaId,
}: DialogFormasPagamentoConfigProps) {
  const [novaForma, setNovaForma] = useState("");
  const [salvando, setSalvando] = useState(false);
  const { formas, loading, criar, excluir } = useFormasPagamentoCustomizadas(empresaId);

  const handleCriar = async () => {
    if (!novaForma.trim()) return;
    setSalvando(true);
    const ok = await criar(novaForma);
    if (ok) setNovaForma("");
    setSalvando(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Formas de Pagamento
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Explicação */}
          <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30 p-3">
            <p className="text-xs text-blue-600 dark:text-blue-300 leading-relaxed">
              Crie formas de pagamento personalizadas para o seu negócio. Elas aparecerão disponíveis no PDV junto com as opções padrão (Dinheiro, PIX, Débito, Crédito).
            </p>
          </div>

          {/* Formas padrão */}
          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Padrão do sistema</Label>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {["Dinheiro", "PIX", "Débito", "Crédito", "Crédito Parcelado", "A Receber"].map((f) => (
                <span key={f} className="text-xs px-2.5 py-1 rounded-full bg-muted text-muted-foreground border border-border/40">
                  {f}
                </span>
              ))}
            </div>
          </div>

          {/* Formas customizadas */}
          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Personalizadas</Label>
            <div className="mt-2 space-y-1.5">
              {loading ? (
                <p className="text-xs text-muted-foreground">Carregando...</p>
              ) : formas.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">Nenhuma forma personalizada criada ainda.</p>
              ) : (
                formas.map((forma) => (
                  <div key={forma.id} className="flex items-center justify-between rounded-lg border border-border/40 px-3 py-2">
                    <span className="text-sm font-medium">{forma.nome}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => excluir(forma.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Adicionar nova */}
          <div className="space-y-2">
            <Label>Nova forma de pagamento</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Ex: Transferência, Vale, Cheque..."
                value={novaForma}
                onChange={(e) => setNovaForma(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCriar()}
                className="flex-1"
              />
              <Button
                onClick={handleCriar}
                disabled={!novaForma.trim() || salvando}
                size="sm"
                className="gap-1.5"
              >
                {salvando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                Adicionar
              </Button>
            </div>
          </div>

          <div className="flex justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
