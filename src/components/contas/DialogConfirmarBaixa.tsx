import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ValorMonetario } from "@/components/ui/valor-monetario";
import { Conta, PagamentoConta } from "@/types/conta";
import { useFormasPagamentoCustomizadas } from "@/hooks/useFormasPagamentoCustomizadas";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { DialogReciboRecebimento } from "./DialogReciboRecebimento";
import { Undo2, Receipt } from "lucide-react";

const FORMAS_PADRAO = [
  { value: "dinheiro", label: "Dinheiro" },
  { value: "pix", label: "PIX" },
  { value: "debito", label: "Débito" },
  { value: "credito", label: "Crédito" },
  { value: "credito_parcelado", label: "Crédito Parcelado" },
];

interface DialogConfirmarBaixaProps {
  conta: Conta | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmar: (id: string, tipo: "pagar" | "receber", formaPagamento: string) => Promise<boolean>;
  // Modelo novo (usa_historico_pagamentos) — opcionais; quando ausentes, cai no fluxo antigo.
  onRegistrarPagamento?: (
    contaId: string,
    dados: { valor: number; forma?: string; data: string; observacao?: string },
  ) => Promise<{ ok: boolean; quitou: boolean }>;
  onEstornarPagamento?: (pagamentoId: string, motivo: string) => Promise<boolean>;
  listarPagamentos?: (contaId: string) => Promise<PagamentoConta[]>;
}

export function DialogConfirmarBaixa(props: DialogConfirmarBaixaProps) {
  const { conta } = props;
  if (!conta) return null;
  if (conta.usa_historico_pagamentos && props.onRegistrarPagamento && props.listarPagamentos) {
    return <BaixaComHistorico {...props} conta={conta} />;
  }
  return <BaixaSimples {...props} conta={conta} />;
}

// ============ FLUXO ANTIGO — inalterado ============
function BaixaSimples({
  conta,
  open,
  onOpenChange,
  onConfirmar,
}: DialogConfirmarBaixaProps & { conta: Conta }) {
  const [formaPagamento, setFormaPagamento] = useState("dinheiro");
  const [loading, setLoading] = useState(false);
  const { formas: formasCustomizadas } = useFormasPagamentoCustomizadas();

  const handleConfirmar = async () => {
    setLoading(true);
    await onConfirmar(conta.id, conta.tipo, formaPagamento);
    setLoading(false);
    onOpenChange(false);
    setFormaPagamento("dinheiro");
  };

  const handleOpenChange = (o: boolean) => {
    if (!o) setFormaPagamento("dinheiro");
    onOpenChange(o);
  };

  const tituloBotao = conta.tipo === "pagar" ? "Marcar como Pago" : "Marcar como Recebido";
  const tituloDialog = conta.tipo === "pagar" ? "Confirmar Pagamento" : "Confirmar Recebimento";
  const temEntradaRegistrada = !!conta.valor_pago && conta.valor_pago > 0;
  const saldoRestante = Math.max(Number(conta.valor) - Number(conta.valor_pago || 0), 0);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{tituloDialog}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-lg border p-3 space-y-1">
            <p className="text-sm font-medium">{conta.nome}</p>
            <p className="text-lg font-bold">
              <ValorMonetario valor={conta.valor} tipo="preco" />
            </p>
          </div>

          {temEntradaRegistrada && (
            <div className="rounded-lg border p-3 space-y-1.5 bg-muted/50">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Entrada já registrada:</span>
                <span className="font-medium">
                  <ValorMonetario valor={conta.valor_pago || 0} tipo="preco" />
                </span>
              </div>
              {conta.forma_pagamento_entrada && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Forma da entrada:</span>
                  <span className="font-medium">{conta.forma_pagamento_entrada}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-sm pt-1 border-t">
                <span className="text-muted-foreground">Saldo restante:</span>
                <span className="font-semibold">
                  <ValorMonetario valor={saldoRestante} tipo="preco" />
                </span>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="forma-pagamento">Forma de pagamento</Label>
            <Select value={formaPagamento} onValueChange={setFormaPagamento}>
              <SelectTrigger id="forma-pagamento">
                <SelectValue placeholder="Selecione a forma de pagamento" />
              </SelectTrigger>
              <SelectContent>
                {FORMAS_PADRAO.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
                {formasCustomizadas.map((f) => (
                  <SelectItem key={f.id} value={f.nome}>
                    {f.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleConfirmar} disabled={loading || !formaPagamento}>
            {tituloBotao}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============ FLUXO NOVO — recebimento parcial + histórico + recibo ============
function BaixaComHistorico({
  conta,
  open,
  onOpenChange,
  onRegistrarPagamento,
  onEstornarPagamento,
  listarPagamentos,
}: DialogConfirmarBaixaProps & { conta: Conta }) {
  const { formas: formasCustomizadas } = useFormasPagamentoCustomizadas();
  const [pagamentos, setPagamentos] = useState<PagamentoConta[]>([]);
  const [valor, setValor] = useState("");
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));
  const [forma, setForma] = useState("dinheiro");
  const [loading, setLoading] = useState(false);
  const [reciboDe, setReciboDe] = useState<PagamentoConta | null>(null);

  const ativos = pagamentos.filter((p) => !p.estornado);
  const totalPago = ativos.reduce((s, p) => s + Number(p.valor), 0);
  const saldo = Math.max(Number(conta.valor) - totalPago, 0);
  const valorNum = parseFloat(valor.replace(",", ".")) || 0;
  const novoSaldo = Math.max(saldo - valorNum, 0);
  const quitaAgora = valorNum > 0 && valorNum >= saldo - 0.005;

  const recarregar = async () => {
    if (!listarPagamentos) return;
    setPagamentos(await listarPagamentos(conta.id));
  };

  useEffect(() => {
    if (open) {
      recarregar();
      setValor("");
      setData(new Date().toISOString().slice(0, 10));
      setForma("dinheiro");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, conta.id]);

  // Ao abrir, pré-preenche com o saldo (recebimento total como default).
  useEffect(() => {
    if (open && saldo > 0 && valor === "") setValor(saldo.toFixed(2));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, saldo]);

  const tituloDialog = conta.tipo === "pagar" ? "Registrar Pagamento" : "Registrar Recebimento";
  const rotuloAcao = conta.tipo === "pagar" ? "pagamento" : "recebimento";

  const handleRegistrar = async () => {
    if (!onRegistrarPagamento || valorNum <= 0) return;
    const valorAjustado = Math.min(valorNum, saldo); // nunca acima do saldo
    setLoading(true);
    const res = await onRegistrarPagamento(conta.id, {
      valor: valorAjustado,
      forma,
      data,
      observacao: valorAjustado >= saldo - 0.005 ? "Quitação" : undefined,
    });
    setLoading(false);
    if (res.ok) {
      const lista = listarPagamentos ? await listarPagamentos(conta.id) : [];
      setPagamentos(lista);
      // abre o recibo do pagamento recém-criado (o mais recente não estornado)
      const novos = lista.filter((p) => !p.estornado);
      const ultimo = novos[novos.length - 1] || null;
      if (ultimo && conta.tipo === "receber") setReciboDe(ultimo);
      setValor("");
    }
  };

  const handleEstornar = async (p: PagamentoConta) => {
    if (!onEstornarPagamento) return;
    const motivo = window.prompt("Motivo do estorno (registrado no histórico):") ?? "";
    if (motivo === null) return;
    setLoading(true);
    await onEstornarPagamento(p.id, motivo);
    setLoading(false);
    await recarregar();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{tituloDialog}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <div className="rounded-lg border p-3 text-sm space-y-1.5">
              <p className="font-medium">{conta.nome}</p>
              {conta.cliente_nome && (
                <p className="text-xs text-muted-foreground">Cliente: {conta.cliente_nome}</p>
              )}
              <div className="flex justify-between pt-1 border-t">
                <span className="text-muted-foreground">Valor total</span>
                <span className="font-medium"><ValorMonetario valor={Number(conta.valor)} tipo="preco" /></span>
              </div>
              <div className="flex justify-between">
                <span className="text-green-600">Já recebido</span>
                <span className="font-medium text-green-600"><ValorMonetario valor={totalPago} tipo="preco" /></span>
              </div>
              <div className="flex justify-between">
                <span className="text-orange-600 font-medium">Saldo</span>
                <span className="font-bold text-orange-600"><ValorMonetario valor={saldo} tipo="preco" /></span>
              </div>
            </div>

            {saldo > 0.005 ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="valor-parcial">Valor do {rotuloAcao} (R$)</Label>
                    <Input
                      id="valor-parcial"
                      type="number"
                      step="0.01"
                      min="0"
                      max={saldo}
                      value={valor}
                      onChange={(e) => setValor(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="data-parcial">Data</Label>
                    <Input id="data-parcial" type="date" value={data} onChange={(e) => setData(e.target.value)} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="forma-parcial">Forma de pagamento</Label>
                  <Select value={forma} onValueChange={setForma}>
                    <SelectTrigger id="forma-parcial">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FORMAS_PADRAO.map((f) => (
                        <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                      ))}
                      {formasCustomizadas.map((f) => (
                        <SelectItem key={f.id} value={f.nome}>{f.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="rounded-md bg-muted/50 p-2.5 text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Saldo atual</span>
                    <span>{formatCurrency(saldo)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Registrando</span>
                    <span>{formatCurrency(Math.min(valorNum, saldo))}</span>
                  </div>
                  <div className="flex justify-between font-semibold border-t pt-1">
                    <span>Novo saldo</span>
                    <span className={quitaAgora ? "text-green-600" : ""}>
                      {quitaAgora ? "Quitada ✓" : formatCurrency(novoSaldo)}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setValor(saldo.toFixed(2))}>
                    {conta.tipo === "pagar" ? "Pagar total" : "Receber total"}
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-sm text-green-600 font-medium">Conta quitada.</p>
            )}

            {ativos.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">Histórico de {conta.tipo === "pagar" ? "pagamentos" : "recebimentos"}</p>
                <div className="rounded-lg border divide-y">
                  {pagamentos.map((p) => (
                    <div key={p.id} className={`flex items-center justify-between gap-2 p-2 text-sm ${p.estornado ? "opacity-50" : ""}`}>
                      <div className="min-w-0">
                        <p className="font-medium">
                          {formatCurrency(Number(p.valor))}
                          {p.estornado && <span className="ml-2 text-xs text-red-600">estornado</span>}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {formatDate(p.data_pagamento)} · {p.forma_pagamento || "—"}
                          {p.observacao ? ` · ${p.observacao}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {conta.tipo === "receber" && !p.estornado && (
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Reimprimir recibo" onClick={() => setReciboDe(p)}>
                            <Receipt className="h-4 w-4" />
                          </Button>
                        )}
                        {!p.estornado && onEstornarPagamento && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600" title="Estornar" disabled={loading} onClick={() => handleEstornar(p)}>
                            <Undo2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Fechar
            </Button>
            {saldo > 0.005 && (
              <Button onClick={handleRegistrar} disabled={loading || valorNum <= 0}>
                {quitaAgora ? "Registrar e quitar" : `Registrar ${rotuloAcao}`}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DialogReciboRecebimento
        open={reciboDe !== null}
        onOpenChange={(o) => { if (!o) setReciboDe(null); }}
        conta={conta}
        pagamento={reciboDe}
        pagamentos={ativos}
      />
    </>
  );
}
