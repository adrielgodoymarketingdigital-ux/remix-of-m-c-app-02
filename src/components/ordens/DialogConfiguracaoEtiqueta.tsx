import { useState, useEffect } from "react";
import { Tag, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { useConfiguracaoLoja } from "@/hooks/useConfiguracaoLoja";
import { EtiquetaOSConfig } from "@/types/configuracao-loja";

interface DialogConfiguracaoEtiquetaProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave?: () => void;
}

const CONFIG_PADRAO: EtiquetaOSConfig = {
  largura_mm: 44,
  altura_mm: 55,
  mostrar_numero_os: true,
  mostrar_defeito: true,
  mostrar_cliente: true,
  mostrar_dispositivo: true,
  mostrar_data: true,
  mostrar_senha: false,
  mostrar_marca_modelo: true,
  mostrar_telefone: false,
  mostrar_logo: false,
  mostrar_valor: false,
  tamanho_fonte: "normal",
};

const CAMPOS: { id: keyof EtiquetaOSConfig; label: string; desc: string }[] = [
  { id: "mostrar_logo", label: "Logo da empresa", desc: "Exibe a logo da loja no topo" },
  { id: "mostrar_numero_os", label: "Número da OS", desc: "Ex: OS #00125" },
  { id: "mostrar_cliente", label: "Nome do cliente", desc: "Nome completo do cliente" },
  { id: "mostrar_telefone", label: "Telefone do cliente", desc: "Telefone para contato" },
  { id: "mostrar_dispositivo", label: "Tipo do dispositivo", desc: "Ex: Celular, Notebook" },
  { id: "mostrar_marca_modelo", label: "Marca e Modelo", desc: "Ex: Samsung Galaxy S21" },
  { id: "mostrar_defeito", label: "Defeito relatado", desc: "Descrição resumida do defeito" },
  { id: "mostrar_valor", label: "Valor do serviço", desc: "Valor total do serviço" },
  { id: "mostrar_data", label: "Data de entrada", desc: "Data de criação da OS" },
  { id: "mostrar_senha", label: "Senha de desbloqueio", desc: "Senha/padrão do dispositivo" },
];

export function DialogConfiguracaoEtiqueta({
  open,
  onOpenChange,
  onSave,
}: DialogConfiguracaoEtiquetaProps) {
  const { config, atualizarConfiguracao } = useConfiguracaoLoja();
  const [etiqueta, setEtiqueta] = useState<EtiquetaOSConfig>(CONFIG_PADRAO);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (config?.layout_os_config) {
      const saved = (config.layout_os_config as any).etiqueta_config;
      if (saved) {
        setEtiqueta({ ...CONFIG_PADRAO, ...saved });
      }
    }
  }, [config]);

  const handleSalvar = async () => {
    setSalvando(true);
    try {
      const layoutAtual = config?.layout_os_config || {};
      const sucesso = await atualizarConfiguracao({
        layout_os_config: {
          ...layoutAtual,
          etiqueta_config: etiqueta,
        },
      });
      if (sucesso) {
        toast.success("Configurações de etiqueta salvas!");
        onSave?.();
        onOpenChange(false);
      } else {
        toast.error("Erro ao salvar configurações");
      }
    } catch {
      toast.error("Erro ao salvar configurações");
    } finally {
      setSalvando(false);
    }
  };

  const handleToggle = (campo: keyof EtiquetaOSConfig) => {
    setEtiqueta((prev) => ({
      ...prev,
      [campo]: !prev[campo],
    }));
  };

  // Preview
  const fontSize = etiqueta.tamanho_fonte === "pequeno" ? "6px" : etiqueta.tamanho_fonte === "grande" ? "8px" : "7px";
  const previewScale = 3; // px per mm
  const previewW = (etiqueta.largura_mm || 55) * previewScale;
  const previewH = (etiqueta.altura_mm || 44) * previewScale;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            Configuração de Etiqueta
          </DialogTitle>
          <DialogDescription>
            Personalize os campos e o tamanho da etiqueta para colar nos aparelhos.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col md:flex-row gap-6">
          {/* Settings */}
          <div className="flex-1 space-y-4 py-2 min-w-0">
            {/* Tamanho */}
            <div className="space-y-3">
              <div className="text-sm font-medium">Tamanho da Etiqueta</div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <Label className="text-xs">Largura (mm)</Label>
                  <Input
                    type="number"
                    value={etiqueta.largura_mm || 55}
                    onChange={(e) => setEtiqueta({ ...etiqueta, largura_mm: Number(e.target.value) })}
                    min={20}
                    max={100}
                    className="h-8"
                  />
                </div>
                <div className="flex-1">
                  <Label className="text-xs">Altura (mm)</Label>
                  <Input
                    type="number"
                    value={etiqueta.altura_mm || 44}
                    onChange={(e) => setEtiqueta({ ...etiqueta, altura_mm: Number(e.target.value) })}
                    min={15}
                    max={100}
                    className="h-8"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm">Tamanho da fonte</Label>
                </div>
                <Select
                  value={etiqueta.tamanho_fonte || "normal"}
                  onValueChange={(v: "pequeno" | "normal" | "grande") =>
                    setEtiqueta({ ...etiqueta, tamanho_fonte: v })
                  }
                >
                  <SelectTrigger className="w-28 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pequeno">Pequeno</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="grande">Grande</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            {/* Campos */}
            <div className="space-y-3">
              <div className="text-sm font-medium">Campos visíveis</div>
              {CAMPOS.map((campo) => (
                <div key={campo.id} className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm">{campo.label}</Label>
                    <p className="text-xs text-muted-foreground">{campo.desc}</p>
                  </div>
                  <Switch
                    checked={etiqueta[campo.id] as boolean ?? true}
                    onCheckedChange={() => handleToggle(campo.id)}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="flex-shrink-0 pt-4 flex flex-col items-center gap-2">
            <div className="text-xs font-medium text-muted-foreground">Pré-visualização</div>
            <div
              className="border-2 border-dashed border-muted-foreground/30 rounded bg-white overflow-hidden flex flex-col"
              style={{ width: previewW, minHeight: previewH, padding: 4, fontSize }}
            >
              {etiqueta.mostrar_logo && (
                <div style={{ textAlign: "center", marginBottom: 2, fontSize: `calc(${fontSize} - 1px)`, fontStyle: "italic", color: "#666" }}>[LOGO]</div>
              )}
              {etiqueta.mostrar_numero_os && (
                <div style={{ fontWeight: 900, fontSize: `calc(${fontSize} + 2px)`, textAlign: "center", borderBottom: "1px solid #000", paddingBottom: 2, marginBottom: 2 }}>
                  OS #00125
                </div>
              )}
              {etiqueta.mostrar_cliente && (
                <div style={{ fontWeight: 600 }}>Cliente: João Silva</div>
              )}
              {etiqueta.mostrar_telefone && (
                <div>(11) 99999-9999</div>
              )}
              {etiqueta.mostrar_dispositivo && (
                <div>Tipo: Celular</div>
              )}
              {etiqueta.mostrar_marca_modelo && (
                <div>Samsung Galaxy S21</div>
              )}
              {etiqueta.mostrar_defeito && (
                <div style={{ fontWeight: 600 }}>Def: Tela quebrada</div>
              )}
              {etiqueta.mostrar_valor && (
                <div style={{ fontWeight: 700 }}>R$ 150,00</div>
              )}
              {etiqueta.mostrar_data && (
                <div style={{ fontSize: `calc(${fontSize} - 1px)` }}>Entrada: 09/04/2026</div>
              )}
              {etiqueta.mostrar_senha && (
                <div>Senha: 1234</div>
              )}
            </div>
            <span className="text-[10px] text-muted-foreground">
              {etiqueta.largura_mm}mm × {etiqueta.altura_mm}mm
            </span>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSalvar} disabled={salvando}>
            <Save className="h-4 w-4 mr-2" />
            {salvando ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
