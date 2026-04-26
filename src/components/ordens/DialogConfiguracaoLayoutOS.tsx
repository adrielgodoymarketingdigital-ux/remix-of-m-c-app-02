import { useState, useEffect } from "react";
import { Layout, Save, Image, Eye } from "lucide-react";
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
import { LayoutOSConfig, Layout80mmConfig } from "@/types/configuracao-loja";
import { Preview80mm } from "./Preview80mm";

interface DialogConfiguracaoLayoutOSProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave?: () => void;
}

const CONFIG_80MM_PADRAO: Layout80mmConfig = {
  mostrar_logo: true,
  mostrar_dados_loja: true,
  mostrar_dados_cliente: true,
  mostrar_dados_dispositivo: true,
  mostrar_defeito: true,
  mostrar_servicos: true,
  mostrar_valor: true,
  mostrar_checklist: false,
  mostrar_avarias: false,
  mostrar_senha: true,
  mostrar_assinaturas: true,
  mostrar_termos_condicoes: false,
  mostrar_forma_pagamento: true,
  mostrar_custos_adicionais: true,
};

const LAYOUT_PADRAO: LayoutOSConfig = {
  mostrar_logo_impressao: true,
  mostrar_logo_whatsapp: true,
  mostrar_checklist: true,
  mostrar_avarias: true,
  mostrar_senha: true,
  mostrar_assinaturas: true,
  mostrar_termos_condicoes: true,
  cor_primaria: "#000000",
  tamanho_fonte: "normal",
  formato_papel: "a4",
  config_80mm: CONFIG_80MM_PADRAO,
};

export function DialogConfiguracaoLayoutOS({
  open,
  onOpenChange,
  onSave,
}: DialogConfiguracaoLayoutOSProps) {
  const { config, atualizarConfiguracao } = useConfiguracaoLoja();
  const [layout, setLayout] = useState<LayoutOSConfig>(LAYOUT_PADRAO);
  const [salvando, setSalvando] = useState(false);

  const config80mm: Layout80mmConfig = layout.config_80mm || CONFIG_80MM_PADRAO;
  const is80mm = layout.formato_papel === "80mm";

  useEffect(() => {
    if (config?.layout_os_config) {
      setLayout({
        mostrar_logo_impressao: config.layout_os_config.mostrar_logo_impressao ?? true,
        mostrar_logo_whatsapp: config.layout_os_config.mostrar_logo_whatsapp ?? true,
        mostrar_checklist: config.layout_os_config.mostrar_checklist ?? true,
        mostrar_avarias: config.layout_os_config.mostrar_avarias ?? true,
        mostrar_senha: config.layout_os_config.mostrar_senha ?? true,
        mostrar_assinaturas: config.layout_os_config.mostrar_assinaturas ?? true,
        mostrar_termos_condicoes: config.layout_os_config.mostrar_termos_condicoes ?? true,
        cor_primaria: config.layout_os_config.cor_primaria || "#000000",
        tamanho_fonte: config.layout_os_config.tamanho_fonte || "normal",
        formato_papel: config.layout_os_config.formato_papel || "a4",
        config_80mm: {
          ...CONFIG_80MM_PADRAO,
          ...(config.layout_os_config as any).config_80mm,
        },
      });
    }
  }, [config]);

  const handleSalvar = async () => {
    setSalvando(true);
    try {
      const sucesso = await atualizarConfiguracao({
        layout_os_config: layout,
      });
      if (sucesso) {
        toast.success("Configurações de layout salvas com sucesso!");
        onSave?.();
        onOpenChange(false);
      } else {
        toast.error("Erro ao salvar configurações de layout");
      }
    } catch (error) {
      toast.error("Erro ao salvar configurações de layout");
    } finally {
      setSalvando(false);
    }
  };

  const handleToggle = (campo: keyof LayoutOSConfig) => {
    setLayout((prev) => ({
      ...prev,
      [campo]: !prev[campo],
    }));
  };

  const handleToggle80mm = (campo: keyof Layout80mmConfig) => {
    setLayout((prev) => ({
      ...prev,
      config_80mm: {
        ...CONFIG_80MM_PADRAO,
        ...prev.config_80mm,
        [campo]: !(prev.config_80mm?.[campo] ?? CONFIG_80MM_PADRAO[campo]),
      },
    }));
  };

  const secoes80mm: { id: keyof Layout80mmConfig; label: string; desc: string }[] = [
    { id: "mostrar_logo", label: "Logo da loja", desc: "Exibe o logo no topo do cupom" },
    { id: "mostrar_dados_loja", label: "Dados da loja", desc: "Nome, CNPJ, telefone, endereço" },
    { id: "mostrar_dados_cliente", label: "Dados do cliente", desc: "Nome e telefone do cliente" },
    { id: "mostrar_dados_dispositivo", label: "Dados do dispositivo", desc: "Marca, modelo, IMEI" },
    { id: "mostrar_defeito", label: "Defeito relatado", desc: "Descrição do problema" },
    { id: "mostrar_servicos", label: "Serviços realizados", desc: "Lista de serviços e valores" },
    { id: "mostrar_checklist", label: "Checklist de entrada", desc: "Lista de verificação (ocupa espaço)" },
    { id: "mostrar_avarias", label: "Avarias visuais", desc: "Silhueta com marcações (ocupa espaço)" },
    { id: "mostrar_senha", label: "Senha de desbloqueio", desc: "Senha/padrão do dispositivo" },
    { id: "mostrar_custos_adicionais", label: "Custos adicionais", desc: "Frete, brindes e outros custos" },
    { id: "mostrar_forma_pagamento", label: "Forma de pagamento", desc: "PIX, cartão, dinheiro, etc." },
    { id: "mostrar_valor", label: "Valor total", desc: "Valor total do serviço em destaque" },
    { id: "mostrar_termos_condicoes", label: "Termo de garantia", desc: "Texto de garantia (ocupa espaço)" },
    { id: "mostrar_assinaturas", label: "Assinaturas", desc: "Campos para assinatura cliente/loja" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layout className="h-5 w-5" />
            Configurações de Layout da OS
          </DialogTitle>
          <DialogDescription>
            Personalize quais informações aparecem na impressão e no PDF enviado via WhatsApp.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col md:flex-row gap-6">
          {/* Left side - Settings */}
          <div className="flex-1 space-y-6 py-4 min-w-0">
            {/* Aparência - Formato do papel */}
            <div className="space-y-4">
              <div className="text-sm font-medium">Aparência</div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="formatoPapel" className="text-sm">
                    Formato do papel
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    A4 (padrão) ou 80mm (cupom/NFe)
                  </p>
                </div>
                <Select
                  value={layout.formato_papel || "a4"}
                  onValueChange={(value: "a4" | "80mm") =>
                    setLayout({ ...layout, formato_papel: value })
                  }
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="a4">A4 (Padrão)</SelectItem>
                    <SelectItem value="80mm">80mm (Cupom/NFe)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {!is80mm && (
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="tamanhoFonte" className="text-sm">
                      Tamanho da fonte
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Ajusta o tamanho do texto na impressão
                    </p>
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
              )}
            </div>

            <Separator />

            {/* Conditional sections based on format */}
            {is80mm ? (
              /* 80mm specific toggles */
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Eye className="h-4 w-4" />
                  Seções visíveis no cupom 80mm
                </div>
                <p className="text-xs text-muted-foreground">
                  Escolha o que aparece na impressão. Menos seções = cupom mais curto.
                </p>

                {secoes80mm.map((secao) => (
                  <div key={secao.id} className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor={`80mm-${secao.id}`} className="text-sm">
                        {secao.label}
                      </Label>
                      <p className="text-xs text-muted-foreground">{secao.desc}</p>
                    </div>
                    <Switch
                      id={`80mm-${secao.id}`}
                      checked={config80mm[secao.id] ?? true}
                      onCheckedChange={() => handleToggle80mm(secao.id)}
                    />
                  </div>
                ))}
              </div>
            ) : (
              /* A4 settings */
              <>
                {/* Logo */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Image className="h-4 w-4" />
                    Logo da Loja
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="logoImpressao" className="text-sm">
                        Mostrar logo na impressão
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Exibe o logo da loja no cabeçalho da OS impressa
                      </p>
                    </div>
                    <Switch
                      id="logoImpressao"
                      checked={layout.mostrar_logo_impressao}
                      onCheckedChange={() => handleToggle("mostrar_logo_impressao")}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="logoWhatsapp" className="text-sm">
                        Mostrar logo no PDF (WhatsApp)
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Inclui o logo da loja no PDF enviado via WhatsApp
                      </p>
                    </div>
                    <Switch
                      id="logoWhatsapp"
                      checked={layout.mostrar_logo_whatsapp}
                      onCheckedChange={() => handleToggle("mostrar_logo_whatsapp")}
                    />
                  </div>
                </div>

                <Separator />

                {/* Seções */}
                <div className="space-y-4">
                  <div className="text-sm font-medium">Seções da OS</div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="checklist" className="text-sm">Checklist de entrada</Label>
                      <p className="text-xs text-muted-foreground">Lista de verificação do dispositivo na entrada</p>
                    </div>
                    <Switch id="checklist" checked={layout.mostrar_checklist} onCheckedChange={() => handleToggle("mostrar_checklist")} />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="avarias" className="text-sm">Avarias visuais</Label>
                      <p className="text-xs text-muted-foreground">Mapa visual de avarias no dispositivo</p>
                    </div>
                    <Switch id="avarias" checked={layout.mostrar_avarias} onCheckedChange={() => handleToggle("mostrar_avarias")} />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="senha" className="text-sm">Senha de desbloqueio</Label>
                      <p className="text-xs text-muted-foreground">Exibe a senha/padrão de desbloqueio</p>
                    </div>
                    <Switch id="senha" checked={layout.mostrar_senha} onCheckedChange={() => handleToggle("mostrar_senha")} />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="assinaturas" className="text-sm">Assinaturas</Label>
                      <p className="text-xs text-muted-foreground">Área para assinaturas de entrada e saída</p>
                    </div>
                    <Switch id="assinaturas" checked={layout.mostrar_assinaturas} onCheckedChange={() => handleToggle("mostrar_assinaturas")} />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="termos" className="text-sm">Termo de garantia</Label>
                      <p className="text-xs text-muted-foreground">Exibe o termo de garantia do serviço</p>
                    </div>
                    <Switch id="termos" checked={layout.mostrar_termos_condicoes} onCheckedChange={() => handleToggle("mostrar_termos_condicoes")} />
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Right side - Preview (only for 80mm) */}
          {is80mm && (
            <div className="flex-shrink-0 pt-4 flex justify-center md:justify-start">
              <Preview80mm
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
