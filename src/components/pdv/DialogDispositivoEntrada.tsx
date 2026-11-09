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
import { montarEntradaTroca } from "@/lib/vendas/entradaTrocaForm";
import { LeitorCodigoBarras } from "@/components/scanner/LeitorCodigoBarras";

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
  const [imei2, setImei2] = useState("");
  const [versaoLeitores, setVersaoLeitores] = useState(0);
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
    setImei2("");
    // Remonta os leitores: um leitor aberto fecha e solta a câmera.
    setVersaoLeitores((v) => v + 1);
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
    // Validação e montagem: lógica pura em lib/vendas/entradaTrocaForm.ts.
    const resultado = montarEntradaTroca({
      vendedorNome,
      vendedorCpf,
      vendedorTelefone,
      marca,
      modelo,
      imei,
      imei2,
      numeroSerie,
      cor,
      capacidadeGb,
      condicao,
      checklistEntrada: checklist.entrada,
      valorCusto,
      valorVenda,
      observacoes,
    });
    if (!resultado.ok) {
      toast.error(t(`entradaTroca.toast.${resultado.erro}`));
      return;
    }

    onConfirmar(resultado.dados);
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
              {/* IMEI 1 e 2: cada um com o seu leitor (câmera); leitor USB digita direto no campo. */}
              <div className="space-y-1">
                <Label htmlFor="imei">{t("entradaTroca.imei")}</Label>
                <div className="flex gap-2">
                  <Input
                    id="imei"
                    placeholder={t("entradaTroca.imeiPlaceholder")}
                    value={imei}
                    onChange={(e) => setImei(e.target.value)}
                    className="flex-1"
                  />
                  <LeitorCodigoBarras
                    key={`imei-${versaoLeitores}`}
                    mostrarInput={false}
                    scannerId="scanner-troca-imei"
                    titulo={t("entradaTroca.lerImei")}
                    rotuloBotao={t("entradaTroca.lerImei")}
                    onCodigoLido={setImei}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="imei2">{t("entradaTroca.imei2")}</Label>
                <div className="flex gap-2">
                  <Input
                    id="imei2"
                    placeholder={t("entradaTroca.imei2Placeholder")}
                    value={imei2}
                    onChange={(e) => setImei2(e.target.value)}
                    className="flex-1"
                  />
                  <LeitorCodigoBarras
                    key={`imei2-${versaoLeitores}`}
                    mostrarInput={false}
                    scannerId="scanner-troca-imei2"
                    titulo={t("entradaTroca.lerImei2")}
                    rotuloBotao={t("entradaTroca.lerImei2")}
                    onCodigoLido={setImei2}
                  />
                </div>
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
              <div className="space-y-1">
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
