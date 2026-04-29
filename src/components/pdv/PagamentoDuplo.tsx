import { useState, useEffect } from "react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/formatters";

const LABELS_FORMA: Record<string, string> = {
  dinheiro: "Dinheiro",
  pix: "PIX",
  debito: "Débito",
  credito: "Crédito",
  credito_parcelado: "Crédito Parcelado",
  a_receber: "A Receber",
};

const FORMAS_DISPONIVEIS = ["dinheiro", "pix", "debito", "credito", "credito_parcelado", "a_receber"];

interface PagamentoDuploProps {
  valorTotal: number;
  formaPagamento: string;
  numeroParcelas: number;
  onPagamentoDuploChange: (dados: {
    ativo: boolean;
    valorPrimeira: number;
    segundaForma: string;
    valorSegunda: number;
    dataPrevistaSegunda?: string;
    tipoRecebimentoSegunda?: "a_vista" | "parcelado";
    numParcelasSegunda?: number;
    datasParcelasSegunda?: string[];
  }) => void;
}

export function PagamentoDuplo({
  valorTotal,
  formaPagamento,
  numeroParcelas,
  onPagamentoDuploChange,
}: PagamentoDuploProps) {
  const [ativo, setAtivo] = useState(false);
  const [valorPrimeiraStr, setValorPrimeiraStr] = useState<string>("");
  const [segundaForma, setSegundaForma] = useState("");
  const [dataPrevistaSegunda, setDataPrevistaSegunda] = useState("");
  const [tipoRecebimentoSegunda, setTipoRecebimentoSegunda] = useState<"a_vista" | "parcelado">("a_vista");
  const [numParcelasSegunda, setNumParcelasSegunda] = useState(2);
  const [datasParcelasSegunda, setDatasParcelasSegunda] = useState<string[]>([]);

  const hoje = new Date().toISOString().split("T")[0];

  const valorPrimeiraNum = parseFloat(valorPrimeiraStr) || 0;
  const valorSegundaCalculado = Math.max(0, valorTotal - valorPrimeiraNum);

  const emitirMudanca = (overrides: Partial<{
    ativoLocal: boolean;
    valorPrimeira: number;
    segundaFormaLocal: string;
    valorSegunda: number;
    dataPrevista: string;
    tipoReceb: "a_vista" | "parcelado";
    numParc: number;
    datasParc: string[];
  }> = {}) => {
    const a = overrides.ativoLocal ?? ativo;
    const vp = overrides.valorPrimeira ?? valorPrimeiraNum;
    const sf = overrides.segundaFormaLocal ?? segundaForma;
    const vs = overrides.valorSegunda ?? valorSegundaCalculado;
    const dp = overrides.dataPrevista ?? dataPrevistaSegunda;
    const tr = overrides.tipoReceb ?? tipoRecebimentoSegunda;
    const np = overrides.numParc ?? numParcelasSegunda;
    const dps = overrides.datasParc ?? datasParcelasSegunda;

    onPagamentoDuploChange({
      ativo: a,
      valorPrimeira: vp,
      segundaForma: sf,
      valorSegunda: vs,
      dataPrevistaSegunda: dp,
      tipoRecebimentoSegunda: tr,
      numParcelasSegunda: np,
      datasParcelasSegunda: dps,
    });
  };

  useEffect(() => {
    if (ativo) {
      setValorPrimeiraStr(valorTotal.toFixed(2));
    }
  }, [ativo, valorTotal]);

  useEffect(() => {
    if (!ativo) {
      setValorPrimeiraStr("");
      setSegundaForma("");
      setDataPrevistaSegunda("");
      setTipoRecebimentoSegunda("a_vista");
      setNumParcelasSegunda(2);
      setDatasParcelasSegunda([]);
      onPagamentoDuploChange({
        ativo: false,
        valorPrimeira: valorTotal,
        segundaForma: "",
        valorSegunda: 0,
        dataPrevistaSegunda: "",
        tipoRecebimentoSegunda: "a_vista",
        numParcelasSegunda: 2,
        datasParcelasSegunda: [],
      });
    }
  }, [ativo]);

  const formasDisponiveis = FORMAS_DISPONIVEIS.filter((f) => f !== formaPagamento);

  return (
    <div className="space-y-3 pt-2 border-t">
      <div className="flex items-center justify-between">
        <Label htmlFor="pagamento-duplo" className="text-sm font-medium">
          Dividir em 2 formas de pagamento
        </Label>
        <Switch
          id="pagamento-duplo"
          checked={ativo}
          onCheckedChange={setAtivo}
        />
      </div>

      {ativo && (
        <div className="space-y-3 pl-1">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">
              1ª forma: <span className="font-medium text-foreground">{LABELS_FORMA[formaPagamento] ?? formaPagamento}</span>
              {formaPagamento === "credito_parcelado" && numeroParcelas > 1 && ` (${numeroParcelas}x)`}
            </p>
            <div className="flex items-center gap-2">
              <Label htmlFor="valor-primeira" className="text-xs text-muted-foreground whitespace-nowrap">
                Valor na 1ª forma
              </Label>
              <Input
                id="valor-primeira"
                type="number"
                min="0.01"
                max={valorTotal}
                step="0.01"
                value={valorPrimeiraStr}
                onChange={(e) => {
                  setValorPrimeiraStr(e.target.value);
                  const num = parseFloat(e.target.value);
                  if (!isNaN(num) && num > 0 && num < valorTotal) {
                    const segunda = valorTotal - num;
                    emitirMudanca({ valorPrimeira: num, valorSegunda: segunda });
                  }
                }}
                onBlur={(e) => {
                  const num = parseFloat(e.target.value);
                  if (isNaN(num) || num <= 0) {
                    setValorPrimeiraStr("0.01");
                  } else if (num >= valorTotal) {
                    setValorPrimeiraStr((valorTotal - 0.01).toFixed(2));
                  }
                }}
                className="w-32 h-8 text-right"
              />
            </div>
            <p className="text-xs text-muted-foreground text-right">
              Restante: <span className="font-medium text-foreground">{formatCurrency(valorSegundaCalculado)}</span>
            </p>
          </div>

          <div className="space-y-1">
            <Label htmlFor="segunda-forma" className="text-xs text-muted-foreground">
              2ª forma de pagamento
            </Label>
            <Select
              value={segundaForma}
              onValueChange={(v) => {
                setSegundaForma(v);
                setDataPrevistaSegunda("");
                setTipoRecebimentoSegunda("a_vista");
                setNumParcelasSegunda(2);
                setDatasParcelasSegunda([]);
                emitirMudanca({
                  segundaFormaLocal: v,
                  dataPrevista: "",
                  tipoReceb: "a_vista",
                  numParc: 2,
                  datasParc: [],
                });
              }}
            >
              <SelectTrigger id="segunda-forma" className="h-8">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {formasDisponiveis.map((f) => (
                  <SelectItem key={f} value={f}>
                    {LABELS_FORMA[f]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {segundaForma === "a_receber" && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Tipo de Recebimento</Label>
              <Select
                value={tipoRecebimentoSegunda}
                onValueChange={(v) => {
                  const tipo = v as "a_vista" | "parcelado";
                  setTipoRecebimentoSegunda(tipo);
                  if (tipo === "a_vista") {
                    setDatasParcelasSegunda([]);
                    emitirMudanca({ tipoReceb: tipo, datasParc: [] });
                  } else {
                    const datas = Array.from({ length: numParcelasSegunda }, () => "");
                    setDatasParcelasSegunda(datas);
                    emitirMudanca({ tipoReceb: tipo, datasParc: datas });
                  }
                }}
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="a_vista">1x (À Vista)</SelectItem>
                  <SelectItem value="parcelado">Parcelado</SelectItem>
                </SelectContent>
              </Select>

              {tipoRecebimentoSegunda === "a_vista" && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">
                    Data Prevista de Recebimento *
                  </Label>
                  <Input
                    type="date"
                    value={dataPrevistaSegunda}
                    onChange={(e) => {
                      setDataPrevistaSegunda(e.target.value);
                      emitirMudanca({ dataPrevista: e.target.value });
                    }}
                    min={hoje}
                    className="h-8"
                  />
                </div>
              )}

              {tipoRecebimentoSegunda === "parcelado" && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Número de Parcelas</Label>
                  <Select
                    value={String(numParcelasSegunda)}
                    onValueChange={(v) => {
                      const num = Number(v);
                      setNumParcelasSegunda(num);
                      const datas = Array.from({ length: num }, (_, i) => datasParcelasSegunda[i] || "");
                      setDatasParcelasSegunda(datas);
                      emitirMudanca({ numParc: num, datasParc: datas });
                    }}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n}x de {formatCurrency(valorSegundaCalculado / n)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {Array.from({ length: numParcelasSegunda }).map((_, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-16 shrink-0">
                          {idx + 1}ª parcela
                        </span>
                        <Input
                          type="date"
                          min={hoje}
                          value={datasParcelasSegunda[idx] || ""}
                          onChange={(e) => {
                            const novasDatas = [...datasParcelasSegunda];
                            novasDatas[idx] = e.target.value;
                            setDatasParcelasSegunda(novasDatas);
                            emitirMudanca({ datasParc: novasDatas });
                          }}
                          className="h-8 flex-1"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {segundaForma && (
            <p className="text-xs text-center bg-muted rounded px-2 py-1.5">
              <span className="font-medium">{formatCurrency(valorPrimeiraNum)}</span>
              {" em "}{LABELS_FORMA[formaPagamento] ?? formaPagamento}
              {" + "}
              <span className="font-medium">{formatCurrency(valorSegundaCalculado)}</span>
              {" em "}{LABELS_FORMA[segundaForma]}
              {" = "}
              <span className="font-semibold">{formatCurrency(valorTotal)}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
