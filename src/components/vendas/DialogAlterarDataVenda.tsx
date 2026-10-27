import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ComNegrito } from "@/components/i18n/ComNegrito";
import type { TFunction } from "i18next";
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
import { useFormatadores, type Formatadores } from "@/hooks/useFormatadores";

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

// Data e hora sempre lidas em Brasília (regra da tela); só o texto segue o idioma.
const formatarPartes = (data: string, hora: string, t: TFunction, fmt: Formatadores) =>
  t("comum:dataHora", { data: fmt.data(data), hora });
const formatarInstante = (iso: string | null, t: TFunction, fmt: Formatadores) => {
  if (!iso) return "—";
  const p = partesDataHoraBrasilia(iso);
  return formatarPartes(p.data, p.hora, t, fmt);
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
  const { t } = useTranslation("vendas");
  const fmt = useFormatadores();

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
            {t("alterarData.titulo")}
          </DialogTitle>
          <DialogDescription>{t("alterarData.descricao")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border p-3 bg-muted/50 space-y-1">
            <p className="text-sm font-medium">{descricao}</p>
            <p className="text-sm text-muted-foreground">{t("alterarData.cliente", { nome: venda.clientes?.nome || t("alterarData.naoInformado") })}</p>
            <p className="text-sm text-muted-foreground">{t("alterarData.dataAtual", { data: formatarPartes(atual.data, atual.hora, t, fmt) })}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="novaDataVenda">{t("alterarData.novaData")}</Label>
              <Input
                id="novaDataVenda"
                type="date"
                value={data}
                max={hoje}
                onChange={(e) => setData(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="novaHoraVenda">{t("alterarData.horario")}</Label>
              <Input id="novaHoraVenda" type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
            </div>
          </div>
          {noFuturo && <p className="text-sm text-destructive">{t("alterarData.noFuturo")}</p>}

          <div className="flex gap-2 rounded-lg border border-blue-500/30 bg-blue-500/5 p-3 text-xs text-muted-foreground">
            <Info className="h-4 w-4 shrink-0 text-blue-600 mt-0.5" />
            <div className="space-y-1">
              {quantidadeItens > 1 && (
                <p>
                  <ComNegrito texto={t("alterarData.itensGrupo", { count: quantidadeItens })} />
                </p>
              )}
              <p>{t("alterarData.aviso")}</p>
            </div>
          </div>
          {historico.length > 0 && (
            <div className="space-y-2">
              <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <History className="h-3.5 w-3.5" />
                {t("alterarData.historico")}
              </p>
              <ul className="max-h-40 overflow-y-auto space-y-1.5 rounded-lg border p-2 text-xs">
                {historico.map((h) => (
                  <li key={h.id} className="space-y-0.5 border-b last:border-b-0 pb-1.5 last:pb-0">
                    <p>
                      <span className="text-muted-foreground line-through">{formatarInstante(h.valor_antes, t, fmt)}</span>
                      {" → "}
                      <span className="font-medium">{formatarInstante(h.valor_depois, t, fmt)}</span>
                    </p>
                    <p className="text-muted-foreground">
                      {h.alterado_por_nome
                        ? t("alterarData.porEm", { nome: h.alterado_por_nome, quando: formatarInstante(h.created_at, t, fmt) })
                        : t("alterarData.alteradoEm", { quando: formatarInstante(h.created_at, t, fmt) })}
                      {h.linhas_afetadas > 1 ? t("alterarData.historicoItens", { count: h.linhas_afetadas }) : ""}
                      {h.caixas_ajustados > 0 ? t("alterarData.historicoCaixas", { count: h.caixas_ajustados }) : ""}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>
            {t("alterarData.cancelar")}
          </Button>
          <Button onClick={handleSalvar} disabled={!podeSalvar}>
            {salvando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {t("alterarData.salvar")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
