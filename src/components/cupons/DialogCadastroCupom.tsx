import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Cupom } from "@/types/cupom";
import { useCupons } from "@/hooks/useCupons";

interface DialogCadastroCupomProps {
  aberto: boolean;
  onFechar: () => void;
  cupomInicial?: Cupom | null;
}

export const DialogCadastroCupom = ({
  aberto,
  onFechar,
  cupomInicial,
}: DialogCadastroCupomProps) => {
  const { criarCupom, atualizarCupom } = useCupons();
  const [salvando, setSalvando] = useState(false);

  const [formData, setFormData] = useState({
    codigo: "",
    descricao: "",
    tipo_desconto: "percentual" as "percentual" | "valor_fixo",
    valor: "",
    valor_minimo_compra: "0",
    quantidade_maxima_uso: "",
    data_inicio: new Date().toISOString().split("T")[0],
    data_validade: "",
    status: "ativo" as "ativo" | "inativo" | "expirado",
  });

  useEffect(() => {
    if (cupomInicial) {
      setFormData({
        codigo: cupomInicial.codigo,
        descricao: cupomInicial.descricao || "",
        tipo_desconto: cupomInicial.tipo_desconto,
        valor: cupomInicial.valor.toString(),
        valor_minimo_compra: (cupomInicial.valor_minimo_compra ?? 0).toString(),
        quantidade_maxima_uso: cupomInicial.quantidade_maxima_uso?.toString() || "",
        data_inicio: cupomInicial.data_inicio.split("T")[0],
        data_validade: cupomInicial.data_validade?.split("T")[0] || "",
        status: cupomInicial.status,
      });
    } else {
      setFormData({
        codigo: "",
        descricao: "",
        tipo_desconto: "percentual",
        valor: "",
        valor_minimo_compra: "0",
        quantidade_maxima_uso: "",
        data_inicio: new Date().toISOString().split("T")[0],
        data_validade: "",
        status: "ativo",
      });
    }
  }, [cupomInicial, aberto]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvando(true);

    const dadosCupom = {
      codigo: formData.codigo.toUpperCase().trim(),
      descricao: formData.descricao.trim() || undefined,
      tipo_desconto: formData.tipo_desconto,
      valor: parseFloat(formData.valor),
      valor_minimo_compra: parseFloat(formData.valor_minimo_compra),
      quantidade_maxima_uso: formData.quantidade_maxima_uso 
        ? parseInt(formData.quantidade_maxima_uso) 
        : undefined,
      data_inicio: new Date(formData.data_inicio).toISOString(),
      data_validade: formData.data_validade 
        ? new Date(formData.data_validade).toISOString() 
        : undefined,
      status: formData.status,
    };

    let sucesso = false;
    if (cupomInicial) {
      sucesso = await atualizarCupom(cupomInicial.id, dadosCupom);
    } else {
      sucesso = await criarCupom(dadosCupom);
    }

    setSalvando(false);
    if (sucesso) {
      onFechar();
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={onFechar}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {cupomInicial ? "Editar Cupom" : "Novo Cupom"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="codigo">Código *</Label>
              <Input
                id="codigo"
                value={formData.codigo}
                onChange={(e) =>
                  setFormData({ ...formData, codigo: e.target.value.toUpperCase() })
                }
                placeholder="EX: DESCONTO10"
                required
                className="uppercase"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value: any) =>
                  setFormData({ ...formData, status: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                  <SelectItem value="expirado">Expirado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea
              id="descricao"
              value={formData.descricao}
              onChange={(e) =>
                setFormData({ ...formData, descricao: e.target.value })
              }
              placeholder="Descrição opcional do cupom"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tipo_desconto">Tipo de Desconto *</Label>
              <Select
                value={formData.tipo_desconto}
                onValueChange={(value: any) =>
                  setFormData({ ...formData, tipo_desconto: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentual">Percentual (%)</SelectItem>
                  <SelectItem value="valor_fixo">Valor Fixo (R$)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="valor">
                {formData.tipo_desconto === "percentual" ? "Percentual (%)" : "Valor (R$)"} *
              </Label>
              <Input
                id="valor"
                type="number"
                step="0.01"
                min="0"
                value={formData.valor}
                onChange={(e) =>
                  setFormData({ ...formData, valor: e.target.value })
                }
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="valor_minimo_compra">Valor Mínimo de Compra (R$)</Label>
              <Input
                id="valor_minimo_compra"
                type="number"
                step="0.01"
                min="0"
                value={formData.valor_minimo_compra}
                onChange={(e) =>
                  setFormData({ ...formData, valor_minimo_compra: e.target.value })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="quantidade_maxima_uso">Limite de Uso</Label>
              <Input
                id="quantidade_maxima_uso"
                type="number"
                min="1"
                value={formData.quantidade_maxima_uso}
                onChange={(e) =>
                  setFormData({ ...formData, quantidade_maxima_uso: e.target.value })
                }
                placeholder="Deixe vazio para ilimitado"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="data_inicio">Data de Início *</Label>
              <Input
                id="data_inicio"
                type="date"
                value={formData.data_inicio}
                onChange={(e) =>
                  setFormData({ ...formData, data_inicio: e.target.value })
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="data_validade">Data de Validade</Label>
              <Input
                id="data_validade"
                type="date"
                value={formData.data_validade}
                onChange={(e) =>
                  setFormData({ ...formData, data_validade: e.target.value })
                }
                placeholder="Deixe vazio para sem limite"
              />
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onFechar} className="w-full sm:w-auto">
              Cancelar
            </Button>
            <Button type="submit" disabled={salvando} className="w-full sm:w-auto">
              {salvando ? "Salvando..." : cupomInicial ? "Atualizar" : "Criar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
