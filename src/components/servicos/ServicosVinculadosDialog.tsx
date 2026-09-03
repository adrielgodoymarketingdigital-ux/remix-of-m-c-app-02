import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { ValorMonetario } from "@/components/ui/valor-monetario";

interface ServicoVinculado {
  id: string;
  nome: string;
  codigo: string | null;
  preco: number | null;
}

interface ServicosVinculadosDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tipoId: string | null;
  tipoNome: string;
}

export function ServicosVinculadosDialog({ open, onOpenChange, tipoId, tipoNome }: ServicosVinculadosDialogProps) {
  const [servicos, setServicos] = useState<ServicoVinculado[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !tipoId) return;
    let cancelado = false;
    setLoading(true);
    supabase
      .from("servicos")
      .select("id, nome, codigo, preco")
      .eq("tipo_servico_id", tipoId)
      .order("nome")
      .then(({ data }) => {
        if (cancelado) return;
        setServicos((data || []) as ServicoVinculado[]);
        setLoading(false);
      });
    return () => { cancelado = true; };
  }, [open, tipoId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Serviços vinculados</DialogTitle>
          <DialogDescription>
            Serviços do catálogo com o Tipo "{tipoNome}".
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : servicos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum serviço vinculado a este tipo.</p>
        ) : (
          <div className="max-h-[50vh] overflow-y-auto divide-y rounded-md border">
            {servicos.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium truncate">{s.nome}</p>
                  {s.codigo && <p className="text-xs text-muted-foreground">{s.codigo}</p>}
                </div>
                <span className="text-muted-foreground shrink-0">
                  <ValorMonetario valor={s.preco || 0} tipo="preco" />
                </span>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
