import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Package, RotateCcw } from "lucide-react";
import { Venda } from "@/types/venda";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { ValorMonetario } from "@/components/ui/valor-monetario";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useEffect, useState } from "react";
import {
  AcaoAparelhoTroca,
  MENSAGEM_APARELHO_TROCA_VENDIDO,
  MENSAGEM_VENDA_COM_TROCA_INTEIRA,
  avisoDevolucaoNoCancelamento,
  decidirCancelamentoTroca,
  podeConfirmarCancelamento,
} from "@/lib/vendas/trocaPDV";
import { TrocaDaVenda, carregarTrocaDaVenda } from "@/lib/vendas/cancelamentoTroca";

interface DialogCancelarVendaProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  venda: Venda | null;
  onConfirmar: (estornarEstoque: boolean, motivo: string, acaoAparelhoTroca: AcaoAparelhoTroca | null) => Promise<void>;
  cancelando: boolean;
}

const tipoLabels: Record<string, string> = {
  dispositivo: "Dispositivo",
  produto: "Produto",
  servico: "Serviço",
};

export const DialogCancelarVenda = ({
  open,
  onOpenChange,
  venda,
  onConfirmar,
  cancelando,
}: DialogCancelarVendaProps) => {
  const [estornarEstoque, setEstornarEstoque] = useState(true);
  const [motivo, setMotivo] = useState("");
  // Troca da venda (aparelho recebido do cliente): carregada ao abrir.
  const [troca, setTroca] = useState<TrocaDaVenda | null>(null);
  const [carregandoTroca, setCarregandoTroca] = useState(false);
  const [acaoAparelho, setAcaoAparelho] = useState<AcaoAparelhoTroca>("manter");
  const [erroTroca, setErroTroca] = useState(false);
  // "Estou ciente" da devolução já entregue ao cliente (obrigatório quando houve devolução).
  const [cienteDevolucao, setCienteDevolucao] = useState(false);

  useEffect(() => {
    if (!open || !venda) return;
    let ativo = true;
    setTroca(null);
    setAcaoAparelho("manter");
    setErroTroca(false);
    setCienteDevolucao(false);
    setCarregandoTroca(true);
    carregarTrocaDaVenda(venda)
      .then((t) => { if (ativo) setTroca(t); })
      .catch((erro) => {
        console.error("[cancelamento] etapa=carregar troca", erro);
        if (ativo) setErroTroca(true);
      })
      .finally(() => { if (ativo) setCarregandoTroca(false); });
    return () => { ativo = false; };
  }, [open, venda]);

  const decisaoTroca = troca ? decidirCancelamentoTroca(troca, acaoAparelho) : null;
  const avisoDevolucao = troca?.trocaAtiva ? avisoDevolucaoNoCancelamento(troca) : null;
  const vendaInteira = !!decisaoTroca?.cancelarVendaInteira;
  const itensDaVenda = troca?.linhasParaCancelar.filter((l) => l.estornar).length ?? 0;
  const podeConfirmar = podeConfirmarCancelamento({
    carregando: carregandoTroca,
    erroLeitura: erroTroca,
    bloqueio: decisaoTroca?.bloqueio ?? null,
    exigeCiente: !!avisoDevolucao,
    ciente: cienteDevolucao,
  });

  const handleConfirmar = async () => {
    await onConfirmar(estornarEstoque, motivo, decisaoTroca?.perguntar ? acaoAparelho : null);
    setEstornarEstoque(true);
    setMotivo("");
  };

  const handleClose = () => {
    if (!cancelando) {
      onOpenChange(false);
      setEstornarEstoque(true);
      setMotivo("");
    }
  };

  if (!venda) return null;

  const nomeItem =
    venda.tipo === "dispositivo" && venda.dispositivos
      ? `${venda.dispositivos.marca} ${venda.dispositivos.modelo}`
      : venda.tipo === "servico" && venda.ordens_servico
      ? `OS ${venda.ordens_servico.numero_os}`
      : venda.produtos?.nome || "Item";

  // Serviços não têm estoque para estornar
  const podeEstornar = venda.tipo !== "servico";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Cancelar Venda
          </DialogTitle>
          <DialogDescription>
            Esta ação não pode ser desfeita. A venda será marcada como cancelada.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Detalhes da venda */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Item:</span>
              <span className="font-medium text-sm">{nomeItem}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Tipo:</span>
              <Badge variant="outline">{tipoLabels[venda.tipo]}</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Valor:</span>
              <ValorMonetario valor={venda.total} tipo="preco" className="font-semibold text-destructive" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Data:</span>
              <span className="text-sm">{formatDate(venda.data)}</span>
            </div>
            {venda.clientes?.nome && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Cliente:</span>
                <span className="text-sm">{venda.clientes.nome}</span>
              </div>
            )}
          </div>

          {/* Opção de estorno de estoque */}
          {podeEstornar && (
            <div className="flex items-start gap-3 p-3 border rounded-lg bg-background">
              <Checkbox
                id="estornar"
                checked={estornarEstoque}
                onCheckedChange={(checked) => setEstornarEstoque(checked === true)}
              />
              <div className="grid gap-1.5 leading-none">
                <Label
                  htmlFor="estornar"
                  className="flex items-center gap-2 font-medium cursor-pointer"
                >
                  <RotateCcw className="h-4 w-4" />
                  Estornar para estoque
                </Label>
                <p className="text-xs text-muted-foreground">
                  {vendaInteira
                    ? "Devolver ao estoque os itens desta venda"
                    : <>Devolver a quantidade vendida ({venda.quantidade}{" "}
                      {venda.quantidade === 1 ? "unidade" : "unidades"}) ao estoque</>}
                </p>
              </div>
            </div>
          )}

          {erroTroca && (
            <p className="text-sm text-destructive">
              Não foi possível verificar se esta venda tem troca de aparelho. Feche e tente de novo.
            </p>
          )}

          {/* Aparelho recebido na troca */}
          {troca?.trocaAtiva && (
            <div className="space-y-2 p-3 border rounded-lg bg-background">
              <p className="text-sm font-medium flex items-center gap-2">
                <Package className="h-4 w-4" />
                Aparelho recebido na troca{troca.nomeAparelho ? `: ${troca.nomeAparelho}` : ""} ({formatCurrency(troca.valorEntrada)})
              </p>
              {vendaInteira && (
                <p className="text-xs font-medium text-amber-700">
                  {MENSAGEM_VENDA_COM_TROCA_INTEIRA}: {itensDaVenda > 1 ? `os ${itensDaVenda} itens desta venda serão cancelados juntos` : "a venda toda será cancelada"} e a troca será desfeita.
                </p>
              )}
              {decisaoTroca?.perguntar ? (
                <RadioGroup value={acaoAparelho} onValueChange={(v) => setAcaoAparelho(v as AcaoAparelhoTroca)} className="gap-2">
                  <div className="flex items-start gap-2">
                    <RadioGroupItem value="manter" id="troca-manter" className="mt-0.5" />
                    <Label htmlFor="troca-manter" className="font-normal cursor-pointer leading-snug">
                      Manter no estoque (o cliente não levou o aparelho de volta)
                    </Label>
                  </div>
                  <div className="flex items-start gap-2">
                    <RadioGroupItem value="remover" id="troca-remover" className="mt-0.5" disabled={!decisaoTroca.podeRemover} />
                    <Label htmlFor="troca-remover" className={`font-normal leading-snug ${decisaoTroca.podeRemover ? "cursor-pointer" : "text-muted-foreground"}`}>
                      Tirar do estoque (o cliente levou o aparelho de volta) — vai para a lixeira de dispositivos
                    </Label>
                  </div>
                  {!decisaoTroca.podeRemover && (
                    <p className="text-xs text-amber-600">{MENSAGEM_APARELHO_TROCA_VENDIDO}</p>
                  )}
                </RadioGroup>
              ) : (
                <p className="text-xs text-muted-foreground">O aparelho já não está no estoque; a troca será marcada como cancelada.</p>
              )}
            </div>
          )}

          {/* Devolução da diferença já entregue ao cliente */}
          {avisoDevolucao && (
            <div className="space-y-2 p-3 border border-amber-500 rounded-lg bg-amber-50 dark:bg-amber-950/30">
              <p className="text-sm text-amber-800 dark:text-amber-200 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                {avisoDevolucao}
              </p>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="ciente-devolucao"
                  checked={cienteDevolucao}
                  onCheckedChange={(checked) => setCienteDevolucao(checked === true)}
                />
                <Label htmlFor="ciente-devolucao" className="font-medium cursor-pointer">
                  Estou ciente
                </Label>
              </div>
            </div>
          )}

          {/* Motivo do cancelamento */}
          <div className="space-y-2">
            <Label htmlFor="motivo">Motivo do cancelamento (opcional)</Label>
            <Textarea
              id="motivo"
              placeholder="Informe o motivo do cancelamento..."
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className="resize-none"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose} disabled={cancelando}>
            Voltar
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirmar}
            disabled={cancelando || !podeConfirmar}
          >
            {cancelando ? (
              "Cancelando..."
            ) : (
              <>
                <AlertTriangle className="h-4 w-4 mr-2" />
                Confirmar Cancelamento
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
