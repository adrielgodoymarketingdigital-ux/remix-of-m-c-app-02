import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ChecklistDispositivo } from "@/components/ordens/ChecklistDispositivo";
import { Checklist } from "@/types/ordem-servico";
import type { DadosEntradaTroca } from "@/lib/vendas/trocaPDV";

interface DialogDispositivoEntradaProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Recebe os dados da entrada; nada é gravado aqui — o PDV grava ao finalizar a venda. */
  onConfirmar: (dados: DadosEntradaTroca) => void;
}

const estadoInicialChecklist: Checklist = { entrada: {}, saida: {} };

export function DialogDispositivoEntrada({
  open,
  onOpenChange,
  onConfirmar,
}: DialogDispositivoEntradaProps) {
  const [vendedorNome, setVendedorNome] = useState("");
  const [vendedorCpf, setVendedorCpf] = useState("");
  const [vendedorTelefone, setVendedorTelefone] = useState("");

  const [marca, setMarca] = useState("");
  const [modelo, setModelo] = useState("");
  const [imei, setImei] = useState("");
  const [numeroSerie, setNumeroSerie] = useState("");
  const [cor, setCor] = useState("");
  const [capacidadeGb, setCapacidadeGb] = useState("");
  const [condicao, setCondicao] = useState("usado");

  const [checklist, setChecklist] = useState<Checklist>(estadoInicialChecklist);

  const [valorCusto, setValorCusto] = useState("");
  const [valorVenda, setValorVenda] = useState("");
  const [observacoes, setObservacoes] = useState("");

  const resetForm = () => {
    setVendedorNome("");
    setVendedorCpf("");
    setVendedorTelefone("");
    setMarca("");
    setModelo("");
    setImei("");
    setNumeroSerie("");
    setCor("");
    setCapacidadeGb("");
    setCondicao("usado");
    setChecklist(estadoInicialChecklist);
    setValorCusto("");
    setValorVenda("");
    setObservacoes("");
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) resetForm();
    onOpenChange(open);
  };

  const handleConfirmar = () => {
    if (!vendedorNome.trim()) {
      toast.error("Informe o nome do vendedor.");
      return;
    }
    if (!marca.trim() || !modelo.trim()) {
      toast.error("Informe a marca e o modelo do dispositivo.");
      return;
    }
    const custo = parseFloat(valorCusto.replace(",", "."));
    if (isNaN(custo) || custo <= 0) {
      toast.error("Informe um valor de custo válido.");
      return;
    }
    const venda = parseFloat(valorVenda.replace(",", "."));
    if (isNaN(venda) || venda <= 0) {
      toast.error("Informe um valor de venda válido.");
      return;
    }

    const capacidade = capacidadeGb ? parseInt(capacidadeGb) : NaN;
    const checklistEntrada =
      checklist.entrada && Object.keys(checklist.entrada).length > 0
        ? checklist.entrada
        : null;

    onConfirmar({
      vendedor: {
        nome: vendedorNome.trim(),
        cpf: vendedorCpf.trim() || null,
        telefone: vendedorTelefone.trim() || null,
      },
      aparelho: {
        marca: marca.trim(),
        modelo: modelo.trim(),
        imei: imei.trim() || null,
        numeroSerie: numeroSerie.trim() || null,
        cor: cor.trim() || null,
        capacidadeGb: Number.isFinite(capacidade) ? capacidade : null,
        condicao,
        checklistEntrada,
      },
      // Centavos: o mesmo valor vai para vendas.valor_troca, compra e vendas_trocas (numeric(12,2)).
      valorEntrada: Math.round(custo * 100) / 100,
      valorVenda: Math.round(venda * 100) / 100,
      observacoes: observacoes.trim() || null,
    });
    resetForm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Dispositivo de Entrada (Troca)</DialogTitle>
        </DialogHeader>

        <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30 p-3 space-y-1.5">
          <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">Como funciona o Dispositivo de Entrada?</p>
          <p className="text-xs text-blue-600 dark:text-blue-300 leading-relaxed">
            Quando o cliente entrega um dispositivo como parte do pagamento (troca), preencha os dados abaixo. Ao finalizar a venda, o aparelho entra no seu estoque e é registrado em Origem de Dispositivos (se a venda não for finalizada, nada é gravado).
          </p>
          <p className="text-xs text-blue-600 dark:text-blue-300 leading-relaxed">
            <strong>Financeiro:</strong> O <strong>valor de custo</strong> informado será descontado do total da venda — é o valor que você está "pagando" pelo aparelho ao aceitar na troca. O <strong>valor de venda</strong> é o preço que você pretende cobrar quando revender esse dispositivo.
          </p>
        </div>

        <div className="space-y-6 py-2">
          {/* Vendedor */}
          <div className="space-y-3">
            <div>
              <h3 className="font-semibold text-sm">Vendedor do Dispositivo</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Quem está entregando o dispositivo como parte do pagamento (seu cliente).
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="sm:col-span-3 space-y-1">
                <Label htmlFor="vendedor-nome">Nome *</Label>
                <Input
                  id="vendedor-nome"
                  placeholder="Nome completo"
                  value={vendedorNome}
                  onChange={(e) => setVendedorNome(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="vendedor-cpf">CPF / CNPJ</Label>
                <Input
                  id="vendedor-cpf"
                  placeholder="000.000.000-00"
                  value={vendedorCpf}
                  onChange={(e) => setVendedorCpf(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="vendedor-telefone">Telefone</Label>
                <Input
                  id="vendedor-telefone"
                  placeholder="(00) 00000-0000"
                  value={vendedorTelefone}
                  onChange={(e) => setVendedorTelefone(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Dispositivo */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Dispositivo
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="marca">Marca *</Label>
                <Input
                  id="marca"
                  placeholder="Ex: Apple, Samsung"
                  value={marca}
                  onChange={(e) => setMarca(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="modelo">Modelo *</Label>
                <Input
                  id="modelo"
                  placeholder="Ex: iPhone 13, Galaxy S21"
                  value={modelo}
                  onChange={(e) => setModelo(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="imei">IMEI</Label>
                <Input
                  id="imei"
                  placeholder="15 dígitos"
                  value={imei}
                  onChange={(e) => setImei(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="numero-serie">Número de Série</Label>
                <Input
                  id="numero-serie"
                  placeholder="S/N"
                  value={numeroSerie}
                  onChange={(e) => setNumeroSerie(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="cor">Cor</Label>
                <Input
                  id="cor"
                  placeholder="Ex: Preto, Branco"
                  value={cor}
                  onChange={(e) => setCor(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="capacidade">Capacidade (GB)</Label>
                <Input
                  id="capacidade"
                  type="number"
                  placeholder="Ex: 128"
                  value={capacidadeGb}
                  onChange={(e) => setCapacidadeGb(e.target.value)}
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="condicao">Condição</Label>
                <Select value={condicao} onValueChange={setCondicao}>
                  <SelectTrigger id="condicao">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="novo">Novo</SelectItem>
                    <SelectItem value="semi_novo">Semi-novo</SelectItem>
                    <SelectItem value="usado">Usado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Checklist */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Checklist
            </h3>
            <ChecklistDispositivo
              tipoDispositivo="celular"
              value={checklist}
              onChange={setChecklist}
              apenasEntrada
            />
          </div>

          {/* Valores */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Valores
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="valor-custo">Valor de Custo (Entrada) *</Label>
                <Input
                  id="valor-custo"
                  type="number"
                  placeholder="0,00"
                  value={valorCusto}
                  onChange={(e) => setValorCusto(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="valor-venda">Valor de Venda *</Label>
                <Input
                  id="valor-venda"
                  type="number"
                  placeholder="0,00"
                  value={valorVenda}
                  onChange={(e) => setValorVenda(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Observações */}
          <div className="space-y-1">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              placeholder="Detalhes adicionais sobre o dispositivo ou a negociação..."
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button onClick={handleConfirmar}>Usar na venda</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
