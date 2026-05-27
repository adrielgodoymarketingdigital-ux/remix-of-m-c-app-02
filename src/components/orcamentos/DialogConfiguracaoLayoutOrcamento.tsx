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
import { LayoutOrcamentoConfig } from "@/types/configuracao-loja";

interface DialogConfiguracaoLayoutOrcamentoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave?: () => void;
}

const LAYOUT_PADRAO: LayoutOrcamentoConfig = {
  formato_papel: "a4",
  tamanho_fonte: "normal",
  mostrar_logo: true,
  mostrar_dados_loja: true,
  mostrar_dados_cliente: true,
  mostrar_dados_dispositivo: true,
  mostrar_itens: true,
  mostrar_subtotal: true,
  mostrar_desconto: true,
  mostrar_total: true,
  mostrar_validade: true,
  mostrar_observacoes: true,
  mostrar_termos: true,
  mostrar_assinaturas: true,
};

type BooleanLayoutKey = {
  [K in keyof LayoutOrcamentoConfig]: LayoutOrcamentoConfig[K] extends boolean | undefined ? K : never;
}[keyof LayoutOrcamentoConfig];

export function DialogConfiguracaoLayoutOrcamento({
  open,
  onOpenChange,
  onSave,
}: DialogConfiguracaoLayoutOrcamentoProps) {
  const { config, atualizarConfiguracao } = useConfiguracaoLoja();
  const [layout, setLayout] = useState<LayoutOrcamentoConfig>(LAYOUT_PADRAO);
  const [salvando, setSalvando] = useState(false);

  const is80mm = layout.formato_papel === "80mm";

  useEffect(() => {
    if (config?.layout_orcamento_config) {
      setLayout({
        ...LAYOUT_PADRAO,
        ...config.layout_orcamento_config,
      });
    }
  }, [config]);

  const handleSalvar = async () => {
    setSalvando(true);
    try {
      const sucesso = await atualizarConfiguracao({
        layout_orcamento_config: layout,
      });
      if (sucesso) {
        toast.success("Configurações de layout do orçamento salvas com sucesso!");
        onSave?.();
        onOpenChange(false);
      } else {
        toast.error("Erro ao salvar configurações de layout");
      }
    } catch {
      toast.error("Erro ao salvar configurações de layout");
    } finally {
      setSalvando(false);
    }
  };

  const handleToggle = (campo: BooleanLayoutKey) => {
    setLayout((prev) => ({
      ...prev,
      [campo]: !(prev[campo] ?? LAYOUT_PADRAO[campo]),
    }));
  };

  const secoesA4: { id: BooleanLayoutKey; label: string; desc: string }[] = [
    { id: "mostrar_logo", label: "Logo da loja", desc: "Exibe o logo no cabeçalho" },
    { id: "mostrar_dados_loja", label: "Dados da loja", desc: "Nome, CNPJ, telefone, endereço" },
    { id: "mostrar_dados_cliente", label: "Dados do cliente", desc: "Nome, telefone e e-mail do cliente" },
    { id: "mostrar_dados_dispositivo", label: "Dados do dispositivo", desc: "Tipo, marca, modelo, cor" },
    { id: "mostrar_itens", label: "Itens do orçamento", desc: "Tabela de itens, quantidades e valores" },
    { id: "mostrar_subtotal", label: "Subtotal", desc: "Exibe o subtotal antes do desconto" },
    { id: "mostrar_desconto", label: "Desconto", desc: "Exibe o valor de desconto" },
    { id: "mostrar_total", label: "Total", desc: "Valor total do orçamento em destaque" },
    { id: "mostrar_validade", label: "Validade", desc: "Data de validade do orçamento" },
    { id: "mostrar_observacoes", label: "Observações", desc: "Campo de observações livres" },
    { id: "mostrar_termos", label: "Termos e condições", desc: "Texto de termos do orçamento" },
    { id: "mostrar_assinaturas", label: "Assinaturas", desc: "Campos para assinatura do cliente e da loja" },
  ];

  const secoes80mm: { id: BooleanLayoutKey; label: string; desc: string }[] = [
    { id: "mostrar_logo", label: "Logo da loja", desc: "Exibe o logo no topo do cupom" },
    { id: "mostrar_dados_loja", label: "Dados da loja", desc: "Nome, CNPJ, telefone, endereço" },
    { id: "mostrar_dados_cliente", label: "Dados do cliente", desc: "Nome e telefone do cliente" },
    { id: "mostrar_dados_dispositivo", label: "Dados do dispositivo", desc: "Tipo, marca, modelo" },
    { id: "mostrar_itens", label: "Itens", desc: "Lista de itens e valores" },
    { id: "mostrar_subtotal", label: "Subtotal", desc: "Subtotal antes do desconto" },
    { id: "mostrar_desconto", label: "Desconto", desc: "Valor do desconto" },
    { id: "mostrar_total", label: "Total", desc: "Total do orçamento em destaque" },
    { id: "mostrar_validade", label: "Validade", desc: "Data de validade" },
    { id: "mostrar_observacoes", label: "Observações", desc: "Observações do orçamento (ocupa espaço)" },
    { id: "mostrar_termos", label: "Termos", desc: "Termos e condições (ocupa espaço)" },
    { id: "mostrar_assinaturas", label: "Assinaturas", desc: "Campos para assinatura" },
  ];

  const secoesAtivas = is80mm ? secoes80mm : secoesA4;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layout className="h-5 w-5" />
            Configurações de Layout do Orçamento
          </DialogTitle>
          <DialogDescription>
            Personalize quais informações aparecem na impressão do orçamento.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-6">
          {/* Formato do papel */}
          <div className="space-y-4">
            <div className="text-sm font-medium">Aparência</div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="formatoPapelOrc" className="text-sm">
                  Formato do papel
                </Label>
                <p className="text-xs text-muted-foreground">
                  A4 (padrão) ou 80mm (impressora térmica)
                </p>
              </div>
              <Select
                value={layout.formato_papel || "a4"}
                onValueChange={(value: "a4" | "80mm") =>
                  setLayout({ ...layout, formato_papel: value })
                }
              >
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="a4">A4 (Padrão)</SelectItem>
                  <SelectItem value="80mm">80mm (Térmica)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {!is80mm && (
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="tamanhoFonteOrc" className="text-sm">
                    Tamanho da fonte
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Ajusta o tamanho do texto na impressão A4
                  </p>
                </div>
                <Select
                  value={layout.tamanho_fonte || "normal"}
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

          {/* Seções */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Eye className="h-4 w-4" />
              Seções visíveis {is80mm ? "no cupom 80mm" : "na impressão A4"}
            </div>
            <p className="text-xs text-muted-foreground">
              {is80mm
                ? "Escolha o que aparece na impressão. Menos seções = cupom mais curto."
                : "Escolha quais seções aparecem na impressão A4 do orçamento."}
            </p>
            {secoesAtivas.map((secao) => (
              <div key={secao.id} className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor={`orc-${secao.id}`} className="text-sm">
                    {secao.label}
                  </Label>
                  <p className="text-xs text-muted-foreground">{secao.desc}</p>
                </div>
                <Switch
                  id={`orc-${secao.id}`}
                  checked={layout[secao.id] ?? (LAYOUT_PADRAO[secao.id] as boolean)}
                  onCheckedChange={() => handleToggle(secao.id)}
                />
              </div>
            ))}
          </div>
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
