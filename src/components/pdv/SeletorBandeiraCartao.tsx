import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { CreditCard } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";
import { useFormatadores } from "@/hooks/useFormatadores";
import { TaxaCartao } from "@/hooks/useTaxasCartao";

interface SeletorBandeiraCartaoProps {
  taxasAtivas: TaxaCartao[];
  bandeiraSelecionada: string;
  onBandeiraChange: (id: string) => void;
  formaPagamento: string;
  numeroParcelas?: number;
  valorTotal: number;
  taxaCalculada: { percentual: number; valor: number };
}

export function SeletorBandeiraCartao({
  taxasAtivas,
  bandeiraSelecionada,
  onBandeiraChange,
  formaPagamento,
  numeroParcelas,
  valorTotal,
  taxaCalculada,
}: SeletorBandeiraCartaoProps) {
  // Textos: namespace "pdv"; moeda: useFormatadores (conta). Hooks antes dos returns.
  const { t } = useTranslation("pdv");
  const fmt = useFormatadores();
  if (taxasAtivas.length === 0) return null;

  const isCartao = ["debito", "credito", "credito_parcelado"].includes(formaPagamento);
  if (!isCartao) return null;

  return (
    <div className="space-y-2">
      <Label className="text-sm flex items-center gap-2">
        <CreditCard className="w-4 h-4" />
        {t("bandeira.titulo")}
      </Label>
      <Select value={bandeiraSelecionada} onValueChange={onBandeiraChange}>
        <SelectTrigger className="h-8">
          <SelectValue placeholder={t("bandeira.selecione")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="nenhuma">{t("bandeira.nenhuma")}</SelectItem>
          {taxasAtivas.map((taxa) => (
            <SelectItem key={taxa.id} value={taxa.id}>
              {taxa.bandeira}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {bandeiraSelecionada && bandeiraSelecionada !== "nenhuma" && taxaCalculada.percentual > 0 && (
        <div className="flex items-center justify-between text-sm bg-muted/50 rounded-md px-3 py-2">
          <span className="text-muted-foreground">
            {t("bandeira.taxa", { percentual: taxaCalculada.percentual })}
          </span>
          <Badge variant="outline" className="text-destructive border-destructive/30">
            {t("bandeira.valorTaxa", { valor: fmt.moeda(taxaCalculada.valor) })}
          </Badge>
        </div>
      )}
    </div>
  );
}
