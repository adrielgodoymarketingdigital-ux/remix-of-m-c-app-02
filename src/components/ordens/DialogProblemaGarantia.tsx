import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface DialogProblemaGarantiaProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ordemId: string | null;
  onConfirmar: (problemaRelatado: string) => Promise<void>;
}

export const DialogProblemaGarantia = ({
  open,
  onOpenChange,
  ordemId,
  onConfirmar,
}: DialogProblemaGarantiaProps) => {
  const { toast } = useToast();
  const [problemaRelatado, setProblemaRelatado] = useState("");
  const [loading, setLoading] = useState(false);

  const handleConfirmar = async () => {
    if (!ordemId) return;
    if (!problemaRelatado.trim()) {
      toast({
        title: "Descrição obrigatória",
        description: "Descreva o problema relatado pelo cliente.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      await onConfirmar(problemaRelatado.trim());

      const { data: { user: authUser } } = await supabase.auth.getUser();
      const { data: ownerId } = await supabase.rpc("get_loja_owner_id");

      await supabase.from("os_audit_log").insert({
        os_id: ordemId,
        acao: "STATUS_GARANTIA",
        user_id: ownerId || authUser?.id,
        dados_depois: { status: "em_garantia", problema_relatado: problemaRelatado.trim() },
      } as any);

      setProblemaRelatado("");
      onOpenChange(false);
    } catch (error) {
      console.error("Erro ao registrar problema de garantia:", error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível registrar o problema relatado.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!loading) { onOpenChange(o); if (!o) setProblemaRelatado(""); } }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Enviar para Garantia</DialogTitle>
          <DialogDescription>
            Descreva o problema relatado pelo cliente.
          </DialogDescription>
        </DialogHeader>

        <Textarea
          value={problemaRelatado}
          onChange={(e) => setProblemaRelatado(e.target.value)}
          placeholder="Ex: Aparelho voltou a apresentar o mesmo defeito após alguns dias..."
          rows={4}
          autoFocus
        />

        <DialogFooter className="gap-2 mt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleConfirmar} disabled={loading || !problemaRelatado.trim()}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              "Confirmar"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
