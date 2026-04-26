import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useConfiguracaoLoja } from "@/hooks/useConfiguracaoLoja";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2, RotateCcw } from "lucide-react";

interface TermoGarantiaDispositivoConfig {
  termo_com_garantia: string;
  termo_sem_garantia: string;
}

const TERMOS_PADRAO: TermoGarantiaDispositivoConfig = {
  termo_com_garantia: `TERMOS DE GARANTIA

1. GARANTIA LEGAL (Código de Defesa do Consumidor - Lei 8.078/90)
   • Este produto possui garantia legal de 90 (noventa) dias, conforme Art. 26, II do CDC.
   • A garantia legal é oferecida pelo fabricante e tem início na data da compra.
   • Cobre defeitos de fabricação ou vícios que comprometam o funcionamento do produto.

2. GARANTIA CONTRATUAL
   • Este produto possui garantia contratual adicional conforme especificado acima.
   • A garantia contratual é complementar à garantia legal, conforme Art. 50 do CDC.
   • Cobre defeitos de fabricação, excluindo danos causados por mau uso, quedas ou oxidação.

3. DIREITOS DO CONSUMIDOR
   • Em caso de vício do produto, o consumidor pode exigir: substituição, devolução do valor pago ou abatimento proporcional do preço (Art. 18 CDC).
   • O prazo de garantia é suspenso durante o período de reparo (Art. 26, §2º CDC).
   • Conserve este recibo como comprovante de compra.

4. EXCLUSÕES
   • Danos causados por quedas, impactos, contato com líquidos, uso inadequado ou modificações não autorizadas.
   • Violação de lacres ou tentativa de reparo por terceiros não autorizados.
   • Desgaste natural decorrente do uso normal do produto.

5. ATENDIMENTO
   Para exercer seus direitos de garantia, entre em contato através dos dados desta loja.`,
  termo_sem_garantia: `AVISO: Este produto é vendido sem garantia contratual adicional. A garantia legal de 90 dias prevista no CDC (Art. 26, II) se aplica conforme as condições estabelecidas na legislação. O cliente declara estar ciente das condições do equipamento.`,
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave?: () => void;
}

export function DialogConfiguracaoTermoGarantiaDispositivo({ open, onOpenChange, onSave }: Props) {
  const { config } = useConfiguracaoLoja();
  const [termos, setTermos] = useState<TermoGarantiaDispositivoConfig>(TERMOS_PADRAO);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (config?.termo_garantia_dispositivo_config) {
      setTermos({ ...TERMOS_PADRAO, ...(config.termo_garantia_dispositivo_config as any) });
    } else {
      setTermos(TERMOS_PADRAO);
    }
  }, [config, open]);

  const handleSalvar = async () => {
    try {
      setSalvando(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("configuracoes_loja")
        .update({ termo_garantia_dispositivo_config: termos as any })
        .eq("user_id", user.id);

      if (error) throw error;

      toast({ title: "Termos salvos", description: "Termos de garantia do dispositivo atualizados." });
      onSave?.();
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast({ title: "Erro ao salvar", description: "Não foi possível salvar os termos.", variant: "destructive" });
    } finally {
      setSalvando(false);
    }
  };

  const restaurarPadrao = () => {
    setTermos(TERMOS_PADRAO);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Termo de Garantia - Dispositivos Vendidos</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Termo COM garantia</Label>
            <p className="text-xs text-muted-foreground">
              Texto exibido no recibo quando o dispositivo possui garantia.
            </p>
            <Textarea
              value={termos.termo_com_garantia}
              onChange={(e) => setTermos((prev) => ({ ...prev, termo_com_garantia: e.target.value }))}
              rows={12}
              className="text-xs font-mono"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Termo SEM garantia</Label>
            <p className="text-xs text-muted-foreground">
              Texto exibido no recibo quando o dispositivo não possui garantia.
            </p>
            <Textarea
              value={termos.termo_sem_garantia}
              onChange={(e) => setTermos((prev) => ({ ...prev, termo_sem_garantia: e.target.value }))}
              rows={5}
              className="text-xs font-mono"
            />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="ghost" onClick={restaurarPadrao} className="gap-2">
            <RotateCcw className="h-4 w-4" />
            Restaurar padrão
          </Button>
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSalvar} disabled={salvando}>
              {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
