import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CalendarClock, History, Info, Loader2 } from "lucide-react";
import { Venda } from "@/types/venda";
import { dataBrasiliaISO, instanteBrasiliaISO, partesDataHoraBrasilia } from "@/lib/dataBrasilia";
import { buscarHistoricoDataVenda, type AlteracaoDataVenda } from "@/lib/vendas/alterarDataVenda";

interface DialogAlterarDataVendaProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  venda: Venda | null;
  /** Nome exibido do item (ou resumo do grupo). */
  descricao: string;
  /** Quantos itens a venda tem (linhas do grupo exibidas na lista). */
  quantidadeItens: number;
  onSalvar: (vendaId: string, novaDataISO: string) => Promise<boolean>;
}

const formatarPartes = (data: string, hora: string) => `${data.split("-").reverse().join("/")} às ${hora}`;
const formatarInstante = (iso: string | null) => {
  if (!iso) return "—";
  const p = partesDataHoraBrasilia(iso);
  return formatarPartes(p.data, p.hora);
};

export function DialogAlterarDataVenda({
  open,
  onOpenChange,
  venda,
  descricao,
  quantidadeItens,
  onSalvar,
}: DialogAlterarDataVendaProps) {
  const [data, setData] = useState("");
  const [hora, setHora] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [historico, setHistorico] = useState<AlteracaoDataVenda[]>([]);

  const atual = venda?.data ? partesDataHoraBrasilia(venda.data) : null;

  useEffect(() => {
    if (open && venda?.data) {
      const partes = partesDataHoraBrasilia(venda.data);
      setData(partes.data);
      setHora(partes.hora);
    }
  }, [open, venda]);

  // Histórico da venda inteira (todas as linhas do grupo). Falha silenciosa:
  // sem histórico (ou tabela ainda não criada) a seção simplesmente não aparece.
  useEffect(() => {
    setHistorico([]);
    if (!open || !venda?.user_id) return;
    let cancelado = false;
    buscarHistoricoDataVenda({ vendaId: venda.id, grupoVenda: venda.grupo_venda ?? null, userId: venda.user_id })
      .then((lista) => { if (!cancelado) setHistorico(lista); })
      .catch((e) => console.error("Erro ao carregar histórico de datas da venda:", e));
    return () => { cancelado = true; };
  }, [open, venda]);

  if (!venda || !atual) return null;

  const hoje = dataBrasiliaISO();
  const novaISO = data && hora ? instanteBrasiliaISO(data, hora) : null;
  const noFuturo = novaISO ? new Date(novaISO).getTime() > Date.now() + 60_000 : false;
  const semMudanca = data === atual.data && hora === atual.hora;
  const podeSalvar = !!novaISO && !noFuturo && !semMudanca && !salvando;

  const handleSalvar = async () => {
    if (!novaISO || !podeSalvar) return;
    setSalvando(true);
    try {
      const ok = await onSalvar(venda.id, novaISO);
      if (ok) onOpenChange(false);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !salvando && onOpenChange(v)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5" />
            Alterar data da venda
          </DialogTitle>
          <DialogDescription>Corrija a data e o horário em que a venda aconteceu.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border p-3 bg-muted/50 space-y-1">
            <p className="text-sm font-medium">{descricao}</p>
            <p className="text-sm text-muted-foreground">Cliente: {venda.clientes?.nome || "Não informado"}</p>
            <p className="text-sm text-muted-foreground">Data atual: {formatarPartes(atual.data, atual.hora)}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="novaDataVenda">Nova data</Label>
              <Input
                id="novaDataVenda"
                type="date"
                value={data}
                max={hoje}
                onChange={(e) => setData(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="novaHoraVenda">Horário</Label>
              <Input id="novaHoraVenda" type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
            </div>
          </div>
          {noFuturo && <p className="text-sm text-destructive">A data da venda não pode ser no futuro.</p>}

          <div className="flex gap-2 rounded-lg border border-blue-500/30 bg-blue-500/5 p-3 text-xs text-muted-foreground">
            <Info className="h-4 w-4 shrink-0 text-blue-600 mt-0.5" />
            <div className="space-y-1">
              {quantidadeItens > 1 && (
                <p>
                  Esta venda tem <strong>{quantidadeItens} itens</strong> — todos serão movidos para a nova data.
                </p>
              )}
              <p>
                Se a data antiga ou a nova estiver em um caixa já fechado, os totais desse caixa são ajustados
                automaticamente. Horário de Brasília.
              </p>
            </div>
          </div>
          {historico.length > 0 && (
            <div className="space-y-2">
              <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <History className="h-3.5 w-3.5" />
                Histórico de alterações de data
              </p>
              <ul className="max-h-40 overflow-y-auto space-y-1.5 rounded-lg border p-2 text-xs">
                {historico.map((h) => (
                  <li key={h.id} className="space-y-0.5 border-b last:border-b-0 pb-1.5 last:pb-0">
                    <p>
                      <span className="text-muted-foreground line-through">{formatarInstante(h.valor_antes)}</span>
                      {" → "}
                      <span className="font-medium">{formatarInstante(h.valor_depois)}</span>
                    </p>
                    <p className="text-muted-foreground">
                      {h.alterado_por_nome ? `Por ${h.alterado_por_nome}` : "Alterado"} em {formatarInstante(h.created_at)}
                      {h.linhas_afetadas > 1 ? ` · ${h.linhas_afetadas} itens` : ""}
                      {h.caixas_ajustados > 0 ? ` · ${h.caixas_ajustados} caixa(s) ajustado(s)` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={handleSalvar} disabled={!podeSalvar}>
            {salvando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar nova data
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
