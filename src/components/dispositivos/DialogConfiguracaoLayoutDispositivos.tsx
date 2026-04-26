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
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useConfiguracaoLoja } from "@/hooks/useConfiguracaoLoja";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export interface LayoutDispositivosConfig {
  formato_papel?: "a4" | "80mm" | "58mm" | "personalizado";
  largura_mm?: number;
  altura_mm?: number;
  mostrar_logo?: boolean;
  mostrar_dados_loja?: boolean;
  mostrar_dados_cliente?: boolean;
  mostrar_dados_dispositivo?: boolean;
  mostrar_checklist?: boolean;
  mostrar_garantia?: boolean;
  mostrar_assinaturas?: boolean;
  mostrar_valor?: boolean;
  mostrar_forma_pagamento?: boolean;
}

const LAYOUT_PADRAO: LayoutDispositivosConfig = {
  formato_papel: "a4",
  mostrar_logo: true,
  mostrar_dados_loja: true,
  mostrar_dados_cliente: true,
  mostrar_dados_dispositivo: true,
  mostrar_checklist: true,
  mostrar_garantia: true,
  mostrar_assinaturas: true,
  mostrar_valor: true,
  mostrar_forma_pagamento: true,
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave?: () => void;
}

export function DialogConfiguracaoLayoutDispositivos({ open, onOpenChange, onSave }: Props) {
  const { config } = useConfiguracaoLoja();
  const [layout, setLayout] = useState<LayoutDispositivosConfig>(LAYOUT_PADRAO);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (config?.layout_dispositivos_config) {
      setLayout({ ...LAYOUT_PADRAO, ...(config.layout_dispositivos_config as any) });
    } else {
      setLayout(LAYOUT_PADRAO);
    }
  }, [config, open]);

  const handleSalvar = async () => {
    try {
      setSalvando(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("configuracoes_loja")
        .update({ layout_dispositivos_config: layout as any })
        .eq("user_id", user.id);

      if (error) throw error;

      toast({ title: "Layout salvo", description: "Configurações de layout do recibo atualizadas." });
      onSave?.();
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast({ title: "Erro ao salvar", description: "Não foi possível salvar o layout.", variant: "destructive" });
    } finally {
      setSalvando(false);
    }
  };

  const toggleField = (field: keyof LayoutDispositivosConfig) => {
    setLayout((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const campos = [
    { key: "mostrar_logo" as const, label: "Logo da loja" },
    { key: "mostrar_dados_loja" as const, label: "Dados da loja" },
    { key: "mostrar_dados_cliente" as const, label: "Dados do cliente" },
    { key: "mostrar_dados_dispositivo" as const, label: "Dados do dispositivo" },
    { key: "mostrar_checklist" as const, label: "Checklist do dispositivo" },
    { key: "mostrar_valor" as const, label: "Valor da venda" },
    { key: "mostrar_forma_pagamento" as const, label: "Forma de pagamento" },
    { key: "mostrar_garantia" as const, label: "Termos de garantia" },
    { key: "mostrar_assinaturas" as const, label: "Área de assinaturas" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Layout do Recibo de Venda</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Formato do papel</Label>
            <Select
              value={layout.formato_papel || "a4"}
              onValueChange={(v) => setLayout((prev) => ({ ...prev, formato_papel: v as any }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="a4">A4</SelectItem>
                <SelectItem value="80mm">Bobina 80mm</SelectItem>
                <SelectItem value="58mm">Bobina 58mm (Térmica pequena)</SelectItem>
                <SelectItem value="personalizado">Personalizado (mm)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {layout.formato_papel === "personalizado" && (
            <div className="flex gap-3">
              <div className="flex-1 space-y-1">
                <Label className="text-xs">Largura (mm)</Label>
                <Input
                  type="number"
                  value={layout.largura_mm || 80}
                  onChange={(e) => setLayout({ ...layout, largura_mm: Number(e.target.value) })}
                  min={30}
                  max={210}
                  className="h-8"
                />
              </div>
              <div className="flex-1 space-y-1">
                <Label className="text-xs">Altura (mm) - 0 = auto</Label>
                <Input
                  type="number"
                  value={layout.altura_mm || 0}
                  onChange={(e) => setLayout({ ...layout, altura_mm: Number(e.target.value) })}
                  min={0}
                  max={500}
                  className="h-8"
                />
              </div>
            </div>
          )}

          <div className="space-y-3">
            <Label className="text-sm font-medium">Seções visíveis no recibo</Label>
            {campos.map((campo) => (
              <div key={campo.key} className="flex items-center justify-between">
                <span className="text-sm">{campo.label}</span>
                <Switch
                  checked={layout[campo.key] !== false}
                  onCheckedChange={() => toggleField(campo.key)}
                />
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSalvar} disabled={salvando}>
            {salvando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}