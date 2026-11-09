import { useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SeletorBandeiraCartao } from "@/components/pdv/SeletorBandeiraCartao";
import { useTaxasCartao, type TaxaCartao } from "@/hooks/useTaxasCartao";
import { formatCurrency } from "@/lib/formatters";
import { mostraParcelas, OPCOES_PARCELAS, rotuloParcela, taxaDaSaida, type CalcularTaxa } from "@/lib/ordemServico/taxaCartaoSaida";

interface CartaoNaSaidaOSProps {
  /** Forma escolhida na entrega (débito, crédito ou crédito parcelado). */
  forma: string;
  /** Valor recebido agora (saldo se houve entrada; total se não). */
  base: number;
  saldoAPrazo: boolean;
  parcelas: number;
  onParcelasChange: (n: number) => void;
  bandeiraId: string;
  onBandeiraChange: (id: string) => void;
  /** Entrega ao diálogo as bandeiras da loja e a conta do hook, para a gravação. */
  onTaxas: (taxasAtivas: TaxaCartao[], calcularTaxa: CalcularTaxa<TaxaCartao>) => void;
}

/**
 * Bandeira, parcelas e taxa na entrega da OS. Só é montado com o diálogo aberto e
 * forma de cartão, para a tela de OS não ganhar a consulta de taxas_cartao.
 * Mesmo seletor de bandeira e mesma conta (calcularTaxa) da criação da OS.
 */
export function CartaoNaSaidaOS({
  forma,
  base,
  saldoAPrazo,
  parcelas,
  onParcelasChange,
  bandeiraId,
  onBandeiraChange,
  onTaxas,
}: CartaoNaSaidaOSProps) {
  const { taxasAtivas, calcularTaxa } = useTaxasCartao();

  useEffect(() => {
    onTaxas(taxasAtivas, calcularTaxa);
    // calcularTaxa é recriada a cada render, mas a conta só depende da taxa recebida.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taxasAtivas]);

  const { percentual, valor } = taxaDaSaida({
    forma, taxasAtivas, bandeiraId, parcelas, base, saldoAPrazo, calcularTaxa,
  });

  // Débito sem bandeira cadastrada: nada a mostrar (nem o espaçamento).
  if (!mostraParcelas(forma) && taxasAtivas.length === 0) return null;

  return (
    <div className="mt-3 space-y-3">
      {/* Crédito e crédito parcelado; no crédito a taxa continua a de crédito à vista. */}
      {mostraParcelas(forma) && (
        <div className="space-y-2">
          <Label htmlFor="parcelas-saida" className="text-sm">Número de Parcelas</Label>
          <Select value={String(parcelas)} onValueChange={(v) => onParcelasChange(Number(v))}>
            <SelectTrigger id="parcelas-saida" className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OPCOES_PARCELAS.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {rotuloParcela(n, base, formatCurrency)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <SeletorBandeiraCartao
        taxasAtivas={taxasAtivas}
        bandeiraSelecionada={bandeiraId}
        onBandeiraChange={onBandeiraChange}
        formaPagamento={forma}
        numeroParcelas={forma === "credito_parcelado" ? parcelas : undefined}
        valorTotal={base}
        taxaCalculada={{ percentual, valor }}
      />
    </div>
  );
}
