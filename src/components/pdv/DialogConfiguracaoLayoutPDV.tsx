import { useState, useEffect } from "react";
import { Layout, Save, Eye } from "lucide-react";
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
import { LayoutPDVConfig, Layout80mmPDVConfig } from "@/types/configuracao-loja";
import { Preview80mmPDV } from "./Preview80mmPDV";

interface DialogConfiguracaoLayoutPDVProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CONFIG_80MM_PADRAO: Layout80mmPDVConfig = {
  mostrar_logo: true,
  mostrar_dados_loja: true,
  mostrar_dados_cliente: true,
  mostrar_itens: true,
  mostrar_subtotal: true,
  mostrar_descontos: true,
  mostrar_total: true,
  mostrar_forma_pagamento: true,
  mostrar_assinaturas: true,
};

const LAYOUT_PADRAO: LayoutPDVConfig = {
  formato_papel: "a4",
  tamanho_fonte: "normal",
  config_80mm: CONFIG_80MM_PADRAO,
};

export function DialogConfiguracaoLayoutPDV({
  open,
  onOpenChange,
}: DialogConfiguracaoLayoutPDVProps) {
  const { config, atualizarConfiguracao } = useConfiguracaoLoja();
  const [layout, setLayout] = useState<LayoutPDVConfig>(LAYOUT_PADRAO);
  const [salvando, setSalvando] = useState(false);

  const config80mm: Layout80mmPDVConfig = layout.config_80mm || CONFIG_80MM_PADRAO;
  const isThermal = layout.formato_papel === "80mm" || layout.formato_papel === "58mm" || layout.formato_papel === "personalizado";

  useEffect(() => {
    if (config?.layout_pdv_config) {
      const saved = config.layout_pdv_config as LayoutPDVConfig;
      setLayout({
        formato_papel: saved.formato_papel || "a4",
        largura_mm: saved.largura_mm,
        altura_mm: saved.altura_mm,
        tamanho_fonte: saved.tamanho_fonte || "normal",
        config_80mm: {
          ...CONFIG_80MM_PADRAO,
          ...saved.config_80mm,
        },
      });
    }
  }, [config]);

  const handleSalvar = async () => {
    setSalvando(true);
    try {
      const sucesso = await atualizarConfiguracao({
        layout_pdv_config: layout as any,
      });
      if (sucesso) {
        toast.success("Configurações de layout do PDV salvas!");
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

  const handleToggle80mm = (campo: keyof Layout80mmPDVConfig) => {
    setLayout((prev) => ({
      ...prev,
      config_80mm: {
        ...CONFIG_80MM_PADRAO,
        ...prev.config_80mm,
        [campo]: !(prev.config_80mm?.[campo] ?? CONFIG_80MM_PADRAO[campo]),
      },
    }));
  };

  const secoes80mm: { id: keyof Layout80mmPDVConfig; label: string; desc: string }[] = [
    { id: "mostrar_logo", label: "Logo da loja", desc: "Exibe o logo no topo do cupom" },
    { id: "mostrar_dados_loja", label: "Dados da loja", desc: "Nome, CNPJ, telefone, endereço" },
    { id: "mostrar_dados_cliente", label: "Dados do cliente", desc: "Nome, CPF, telefone" },
    { id: "mostrar_itens", label: "Itens da venda", desc: "Lista de produtos/dispositivos vendidos" },
    { id: "mostrar_subtotal", label: "Subtotal", desc: "Valor antes dos descontos" },
    { id: "mostrar_descontos", label: "Descontos", desc: "Desconto manual e cupom aplicados" },
    { id: "mostrar_total", label: "Valor total", desc: "Valor final da venda em destaque" },
    { id: "mostrar_forma_pagamento", label: "Forma de pagamento", desc: "PIX, cartão, dinheiro, etc." },
    { id: "mostrar_assinaturas", label: "Assinaturas", desc: "Campos para assinatura vendedor/comprador" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layout className="h-5 w-5" />
            Configurações de Layout - PDV
          </DialogTitle>
          <DialogDescription>
            Personalize o layout de impressão do recibo do ponto de venda.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-6">
          <div className="flex-1 space-y-6 py-4 min-w-0">
            {/* Formato do papel */}
            <div className="space-y-4">
              <div className="text-sm font-medium">Aparência</div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm">Formato do papel</Label>
                  <p className="text-xs text-muted-foreground">Escolha o tamanho da impressão</p>
                </div>
                <Select
                  value={layout.formato_papel || "a4"}
                  onValueChange={(value: "a4" | "80mm" | "58mm" | "personalizado") =>
                    setLayout({ ...layout, formato_papel: value })
                  }
                >
                  <SelectTrigger className="w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="a4">A4 (Padrão)</SelectItem>
                    <SelectItem value="80mm">80mm (Cupom)</SelectItem>
                    <SelectItem value="58mm">58mm (Térmica pequena)</SelectItem>
                    <SelectItem value="personalizado">Personalizado (mm)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {layout.formato_papel === "personalizado" && (
                <div className="flex gap-3">
                  <div className="flex-1">
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
                  <div className="flex-1">
                    <Label className="text-xs">Altura (mm) - 0 = automático</Label>
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

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm">Tamanho da fonte</Label>
                  <p className="text-xs text-muted-foreground">Ajusta o tamanho do texto</p>
                </div>
                <Select
                  value={layout.tamanho_fonte}
                  onValueChange={(value: "pequeno" | "normal" | "grande") =>
                    setLayout({ ...layout, tamanho_fonte: value })
                  }
                >
                  <SelectTrigger className="w-32">
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

            {/* Seções visíveis - always show for thermal formats */}
            {isThermal ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Eye className="h-4 w-4" />
                  Seções visíveis no cupom
                </div>
                <p className="text-xs text-muted-foreground">
                  Escolha o que aparece na impressão do recibo de venda.
                </p>
                {secoes80mm.map((secao) => (
                  <div key={secao.id} className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-sm">{secao.label}</Label>
                      <p className="text-xs text-muted-foreground">{secao.desc}</p>
                    </div>
                    <Switch
                      checked={config80mm[secao.id] ?? true}
                      onCheckedChange={() => handleToggle80mm(secao.id)}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-sm font-medium">Seções do Recibo</div>
                <p className="text-xs text-muted-foreground">
                  No formato A4, todas as seções do recibo são exibidas por padrão.
                </p>
              </div>
            )}
          </div>

          {/* Preview 80mm */}
          {isThermal && (
            <div className="flex-shrink-0 pt-4">
              <Preview80mmPDV
                config={config80mm}
                nomeLoja={config?.nome_loja || "Minha Loja"}
              />
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSalvar} disabled={salvando}>
            <Save className="h-4 w-4 mr-2" />
            {salvando ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}