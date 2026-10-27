import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNomesFormaPagamento } from "@/hooks/useNomesFormaPagamento";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Venda } from "@/types/venda";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useFormasPagamentoCustomizadas } from "@/hooks/useFormasPagamentoCustomizadas";
import { extrairNomeFormaCustomizada } from "@/lib/formaPagamento";

interface DialogEditarVendaProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  venda: Venda | null;
  onSalvar: (vendaId: string, dados: {
    forma_pagamento: string;
    data_prevista_recebimento?: string | null;
    parcela_numero?: number | null;
    total_parcelas?: number | null;
    total?: number;
  }) => Promise<boolean>;
  salvando?: boolean;
}

// Rótulos: comum.formaPagamento (longo; "A Receber (A Prazo)" é a variante desta tela).
const FORMAS_PAGAMENTO = ["dinheiro", "pix", "debito", "credito", "credito_parcelado", "a_receber"] as const;

// Valor sintético para representar, no Select, uma forma customizada já salva na venda
// (tanto vendas normais, gravadas como "outro" + nome no sufixo de observacoes, quanto
// vendas avulsas, que já guardam "custom_<id>" diretamente).
const VALOR_FORMA_ATUAL_CUSTOMIZADA = "__forma_atual_customizada__";

export const DialogEditarVenda = ({
  open,
  onOpenChange,
  venda,
  onSalvar,
  salvando = false,
}: DialogEditarVendaProps) => {
  const { empresaAtiva } = useEmpresa();
  const { formas: formasCustomizadas } = useFormasPagamentoCustomizadas(empresaAtiva);
  const { t } = useTranslation("vendas");
  const nomesForma = useNomesFormaPagamento();
  const rotuloForma = (forma: (typeof FORMAS_PAGAMENTO)[number]) => (forma === "a_receber" ? nomesForma.aReceberAPrazo : nomesForma.longo[forma]);
  const [formaPagamento, setFormaPagamento] = useState<string>("dinheiro");
  const [dataPrevista, setDataPrevista] = useState<string>("");
  const [parcelaNumero, setParcelaNumero] = useState<string>("");
  const [totalParcelas, setTotalParcelas] = useState<string>("");
  const [valorTotal, setValorTotal] = useState<string>("");

  const nomeFormaCustomizadaAtual = venda
    ? venda.forma_pagamento?.startsWith("custom_")
      ? formasCustomizadas.find((f) => `custom_${f.id}` === venda.forma_pagamento)?.nome
        ?? venda.forma_pagamento.replace("custom_", "")
      : venda.forma_pagamento === "outro"
        ? extrairNomeFormaCustomizada(venda.observacoes) ?? t("editar.personalizada")
        : null
    : null;

  useEffect(() => {
    if (venda && open) {
      const forma = venda.forma_pagamento || "dinheiro";
      const ehCustomizada = forma.startsWith("custom_") || forma === "outro";
      setFormaPagamento(ehCustomizada ? VALOR_FORMA_ATUAL_CUSTOMIZADA : forma);
      setDataPrevista(venda.data_prevista_recebimento || "");
      setParcelaNumero(venda.parcela_numero?.toString() || "");
      setTotalParcelas(venda.total_parcelas?.toString() || "");
      setValorTotal(venda.total.toFixed(2));
    }
  }, [venda, open]);

  const valorTotalNumero = parseFloat(valorTotal);
  const valorTotalValido = Number.isFinite(valorTotalNumero) && valorTotalNumero > 0;

  const isAPrazo = formaPagamento === "a_receber";

  const handleSalvar = async () => {
    if (!venda || !valorTotalValido) return;

    // Se o usuário deixou selecionada a forma customizada original da venda,
    // reenvia o valor cru (custom_<id> ou "outro") sem alteração.
    const formaParaSalvar =
      formaPagamento === VALOR_FORMA_ATUAL_CUSTOMIZADA
        ? (venda.forma_pagamento as string)
        : formaPagamento;

    const dados: any = {
      forma_pagamento: formaParaSalvar,
    };

    if (valorTotalNumero !== venda.total) {
      dados.total = valorTotalNumero;
    }

    if (isAPrazo) {
      dados.data_prevista_recebimento = dataPrevista || null;
      dados.parcela_numero = parcelaNumero ? parseInt(parcelaNumero) : null;
      dados.total_parcelas = totalParcelas ? parseInt(totalParcelas) : null;
    } else {
      // Se mudou de a_receber para outra forma, limpar os campos
      dados.data_prevista_recebimento = null;
      dados.parcela_numero = null;
      dados.total_parcelas = null;
    }

    const sucesso = await onSalvar(venda.id, dados);
    if (sucesso) {
      onOpenChange(false);
    }
  };

  if (!venda) return null;

  const itemNome =
    venda.tipo === "dispositivo" && venda.dispositivos
      ? `${venda.dispositivos.marca} ${venda.dispositivos.modelo}`
      : venda.produtos?.nome || venda.pecas?.nome || t("editar.itemPadrao");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("editar.titulo")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Info da venda */}
          <div className="rounded-lg border p-3 bg-muted/50 space-y-1">
            <p className="text-sm font-medium">{itemNome}</p>
            <p className="text-sm text-muted-foreground">
              {t("editar.cliente", { nome: venda.clientes?.nome || t("editar.naoInformado") })}
            </p>
          </div>

          {/* Valor da venda */}
          <div className="space-y-2">
            <Label htmlFor="valorTotal">{t("editar.valor")}</Label>
            <Input
              id="valorTotal"
              type="number"
              step="0.01"
              min="0.01"
              value={valorTotal}
              onChange={(e) => setValorTotal(e.target.value)}
            />
            {!valorTotalValido && (
              <p className="text-sm text-destructive">{t("editar.valorInvalido")}</p>
            )}
          </div>

          {/* Forma de pagamento */}
          <div className="space-y-2">
            <Label>{t("editar.forma")}</Label>
            <Select value={formaPagamento} onValueChange={setFormaPagamento}>
              <SelectTrigger>
                <SelectValue placeholder={t("editar.selecione")} />
              </SelectTrigger>
              <SelectContent>
                {FORMAS_PAGAMENTO.map((forma) => (
                  <SelectItem key={forma} value={forma}>
                    {rotuloForma(forma)}
                  </SelectItem>
                ))}
                {nomeFormaCustomizadaAtual && (
                  <SelectItem value={VALOR_FORMA_ATUAL_CUSTOMIZADA}>
                    {nomeFormaCustomizadaAtual}
                  </SelectItem>
                )}
                {formasCustomizadas.filter((f) => `custom_${f.id}` !== venda?.forma_pagamento).length > 0 && (
                  <>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-t mt-1 pt-2">
                      {t("editar.personalizadas")}
                    </div>
                    {formasCustomizadas
                      .filter((f) => `custom_${f.id}` !== venda?.forma_pagamento)
                      .map((f) => (
                        <SelectItem key={f.id} value={`custom_${f.id}`}>
                          {f.nome}
                        </SelectItem>
                      ))}
                  </>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Campos A Prazo / A Receber */}
          {isAPrazo && (
            <div className="space-y-4 rounded-lg border p-3 bg-muted/30">
              <p className="text-sm font-medium text-muted-foreground">
                {t("editar.aPrazoTitulo")}
              </p>

              <div className="space-y-2">
                <Label htmlFor="dataPrevista">{t("editar.dataPrevista")}</Label>
                <Input
                  id="dataPrevista"
                  type="date"
                  value={dataPrevista}
                  onChange={(e) => setDataPrevista(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="parcelaNumero">{t("editar.parcelaNumero")}</Label>
                  <Input
                    id="parcelaNumero"
                    type="number"
                    min="1"
                    placeholder={t("editar.parcelaNumeroExemplo")}
                    value={parcelaNumero}
                    onChange={(e) => setParcelaNumero(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="totalParcelas">{t("editar.totalParcelas")}</Label>
                  <Input
                    id="totalParcelas"
                    type="number"
                    min="1"
                    placeholder={t("editar.totalParcelasExemplo")}
                    value={totalParcelas}
                    onChange={(e) => setTotalParcelas(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>
            {t("editar.cancelar")}
          </Button>
          <Button onClick={handleSalvar} disabled={salvando || !valorTotalValido}>
            {salvando ? t("editar.salvando") : t("editar.salvar")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
