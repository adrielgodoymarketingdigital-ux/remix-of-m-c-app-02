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
import { useTranslation } from "react-i18next";
import { ComNegrito } from "@/components/i18n/ComNegrito";
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
  // Textos: namespace "pdv" (validação é síncrona: o t da renderização serve).
  const { t } = useTranslation("pdv");
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
      toast.error(t("entradaTroca.toast.informeVendedor"));
      return;
    }
    if (!marca.trim() || !modelo.trim()) {
      toast.error(t("entradaTroca.toast.informeMarcaModelo"));
      return;
    }
    const custo = parseFloat(valorCusto.replace(",", "."));
    if (isNaN(custo) || custo <= 0) {
      toast.error(t("entradaTroca.toast.custoInvalido"));
      return;
    }
    const venda = parseFloat(valorVenda.replace(",", "."));
    if (isNaN(venda) || venda <= 0) {
      toast.error(t("entradaTroca.toast.vendaInvalido"));
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
          <DialogTitle>{t("entradaTroca.titulo")}</DialogTitle>
        </DialogHeader>

        <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30 p-3 space-y-1.5">
          <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">{t("entradaTroca.comoFunciona")}</p>
          <p className="text-xs text-blue-600 dark:text-blue-300 leading-relaxed">
            {t("entradaTroca.explicacao")}
          </p>
          <p className="text-xs text-blue-600 dark:text-blue-300 leading-relaxed">
            <ComNegrito texto={t("entradaTroca.financeiro")} />
          </p>
        </div>

        <div className="space-y-6 py-2">
          {/* Vendedor */}
          <div className="space-y-3">
            <div>
              <h3 className="font-semibold text-sm">{t("entradaTroca.vendedor")}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t("entradaTroca.vendedorDescricao")}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="sm:col-span-3 space-y-1">
                <Label htmlFor="vendedor-nome">{t("entradaTroca.nome")}</Label>
                <Input
                  id="vendedor-nome"
                  placeholder={t("entradaTroca.nomePlaceholder")}
                  value={vendedorNome}
                  onChange={(e) => setVendedorNome(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="vendedor-cpf">{t("entradaTroca.documento")}</Label>
                <Input
                  id="vendedor-cpf"
                  placeholder={t("entradaTroca.documentoPlaceholder")}
                  value={vendedorCpf}
                  onChange={(e) => setVendedorCpf(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="vendedor-telefone">{t("entradaTroca.telefone")}</Label>
                <Input
                  id="vendedor-telefone"
                  placeholder={t("entradaTroca.telefonePlaceholder")}
                  value={vendedorTelefone}
                  onChange={(e) => setVendedorTelefone(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Dispositivo */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              {t("entradaTroca.dispositivo")}
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="marca">{t("entradaTroca.marca")}</Label>
                <Input
                  id="marca"
                  placeholder={t("entradaTroca.marcaPlaceholder")}
                  value={marca}
                  onChange={(e) => setMarca(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="modelo">{t("entradaTroca.modelo")}</Label>
                <Input
                  id="modelo"
                  placeholder={t("entradaTroca.modeloPlaceholder")}
                  value={modelo}
                  onChange={(e) => setModelo(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="imei">{t("entradaTroca.imei")}</Label>
                <Input
                  id="imei"
                  placeholder={t("entradaTroca.imeiPlaceholder")}
                  value={imei}
                  onChange={(e) => setImei(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="numero-serie">{t("entradaTroca.numeroSerie")}</Label>
                <Input
                  id="numero-serie"
                  placeholder={t("entradaTroca.numeroSeriePlaceholder")}
                  value={numeroSerie}
                  onChange={(e) => setNumeroSerie(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="cor">{t("entradaTroca.cor")}</Label>
                <Input
                  id="cor"
                  placeholder={t("entradaTroca.corPlaceholder")}
                  value={cor}
                  onChange={(e) => setCor(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="capacidade">{t("entradaTroca.capacidade")}</Label>
                <Input
                  id="capacidade"
                  type="number"
                  placeholder={t("entradaTroca.capacidadePlaceholder")}
                  value={capacidadeGb}
                  onChange={(e) => setCapacidadeGb(e.target.value)}
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="condicao">{t("entradaTroca.condicao")}</Label>
                <Select value={condicao} onValueChange={setCondicao}>
                  <SelectTrigger id="condicao">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="novo">{t("entradaTroca.condicoes.novo")}</SelectItem>
                    <SelectItem value="semi_novo">{t("entradaTroca.condicoes.semi_novo")}</SelectItem>
                    <SelectItem value="usado">{t("entradaTroca.condicoes.usado")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Checklist */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              {t("entradaTroca.checklist")}
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
              {t("entradaTroca.valores")}
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="valor-custo">{t("entradaTroca.valorCusto")}</Label>
                <Input
                  id="valor-custo"
                  type="number"
                  placeholder={t("entradaTroca.valorPlaceholder")}
                  value={valorCusto}
                  onChange={(e) => setValorCusto(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="valor-venda">{t("entradaTroca.valorVenda")}</Label>
                <Input
                  id="valor-venda"
                  type="number"
                  placeholder={t("entradaTroca.valorPlaceholder")}
                  value={valorVenda}
                  onChange={(e) => setValorVenda(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Observações */}
          <div className="space-y-1">
            <Label htmlFor="observacoes">{t("entradaTroca.observacoes")}</Label>
            <Textarea
              id="observacoes"
              placeholder={t("entradaTroca.observacoesPlaceholder")}
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
            {t("entradaTroca.cancelar")}
          </Button>
          <Button onClick={handleConfirmar}>{t("entradaTroca.usar")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
