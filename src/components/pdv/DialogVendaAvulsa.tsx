import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useFuncionarioPermissoes } from "@/hooks/useFuncionarioPermissoes";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useFormasPagamentoCustomizadas } from "@/hooks/useFormasPagamentoCustomizadas";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import i18n from "@/lib/i18n/instancia";
import { useFormatadores } from "@/hooks/useFormatadores";
import { useNomesFormaPagamento } from "@/hooks/useNomesFormaPagamento";

interface VendaAvulsa {
  id: string;
  descricao: string;
  valor: number;
  forma_pagamento: string;
  observacao: string | null;
  created_at: string;
}

// Formas desta tela; os nomes vêm de comum.formaPagamento (variantes "Pix" e "Transferência").
const FORMAS_PAGAMENTO = ["dinheiro", "pix", "credito", "debito", "transferencia"] as const;
// Toasts lidos na hora (podem sair depois de um await; ver convencoes.md, item 10).
const tAgora = (chave: string) => i18n.t(chave, { ns: "pdv" });

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVendaSalva?: () => void;
}

export function DialogVendaAvulsa({ open, onOpenChange, onVendaSalva }: Props) {
  const { lojaUserId } = useFuncionarioPermissoes();
  const { empresaAtiva } = useEmpresa();
  const { formas: formasCustomizadas } = useFormasPagamentoCustomizadas(empresaAtiva);
  const { t } = useTranslation("pdv");
  const fmt = useFormatadores();
  const nomesForma = useNomesFormaPagamento();
  const nomeForma: Record<(typeof FORMAS_PAGAMENTO)[number], string> = {
    dinheiro: nomesForma.curto.dinheiro,
    pix: nomesForma.pixAvulsa,
    credito: nomesForma.longo.credito,
    debito: nomesForma.longo.debito,
    transferencia: nomesForma.transferencia,
  };
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [formaPagamento, setFormaPagamento] = useState("");
  const [observacao, setObservacao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [vendasHoje, setVendasHoje] = useState<VendaAvulsa[]>([]);
  const [carregandoVendas, setCarregandoVendas] = useState(false);

  async function carregarVendasHoje() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const userId = lojaUserId ?? user.id;
    const agora = new Date();
    const inicioDia = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 0, 0, 0, 0).toISOString();
    const fimDia = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 23, 59, 59, 999).toISOString();

    setCarregandoVendas(true);
    const { data } = await supabase
      .from("vendas_avulsas")
      .select("id, descricao, valor, forma_pagamento, observacao, created_at")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .gte("created_at", inicioDia)
      .lte("created_at", fimDia)
      .order("created_at", { ascending: false });

    setVendasHoje(data ?? []);
    setCarregandoVendas(false);
  }

  async function handleOpenChange(nextOpen: boolean) {
    onOpenChange(nextOpen);
    if (nextOpen) {
      limparFormulario();
      await carregarVendasHoje();
    }
  }

  function limparFormulario() {
    setDescricao("");
    setValor("");
    setFormaPagamento("");
    setObservacao("");
  }

  async function salvarVendaAvulsa() {
    if (!descricao.trim()) {
      toast.error(tAgora("vendaAvulsa.toast.informeDescricao"));
      return;
    }
    if (!valor || parseFloat(valor.replace(",", ".")) <= 0) {
      toast.error(tAgora("vendaAvulsa.toast.valorInvalido"));
      return;
    }
    if (!formaPagamento) {
      toast.error(tAgora("vendaAvulsa.toast.selecioneForma"));
      return;
    }

    setSalvando(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSalvando(false); return; }

    const userId = lojaUserId ?? user.id;

    const { error } = await supabase
      .from("vendas_avulsas")
      .insert({
        user_id: userId,
        descricao: descricao.trim(),
        valor: parseFloat(valor.replace(",", ".")),
        forma_pagamento: formaPagamento,
        observacao: observacao.trim() || null,
      });

    if (error) {
      toast.error(tAgora("vendaAvulsa.toast.erroRegistrar"));
      console.error(error);
    } else {
      toast.success(tAgora("vendaAvulsa.toast.registrada"));
      limparFormulario();
      await carregarVendasHoje();
      onVendaSalva?.();
    }

    setSalvando(false);
  }

  async function excluirVendaAvulsa(id: string) {
    const { error } = await supabase
      .from("vendas_avulsas")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      toast.error(tAgora("vendaAvulsa.toast.erroCancelar"));
      return;
    }
    toast.success(tAgora("vendaAvulsa.toast.cancelada"));
    await carregarVendasHoje();
    onVendaSalva?.();
  }

  const totalHoje = vendasHoje.reduce((acc, v) => acc + Number(v.valor), 0);

  function getLabelFormaPagamento(forma: string): string {
    if ((FORMAS_PAGAMENTO as readonly string[]).includes(forma)) return nomeForma[forma as (typeof FORMAS_PAGAMENTO)[number]];
    if (forma.startsWith("custom_")) {
      const id = forma.replace("custom_", "");
      return formasCustomizadas.find((f) => f.id === id)?.nome || forma;
    }
    return forma;
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg sm:max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("vendaAvulsa.titulo")}</DialogTitle>
          <DialogDescription>
            {t("vendaAvulsa.descricao")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>{t("vendaAvulsa.descricaoCampo")}</Label>
            <Input
              placeholder={t("vendaAvulsa.descricaoPlaceholder")}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") salvarVendaAvulsa(); }}
            />
          </div>

          <div>
            <Label>{t("vendaAvulsa.valor")}</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder={t("vendaAvulsa.valorPlaceholder")}
              value={valor}
              onChange={(e) => setValor(e.target.value)}
            />
          </div>

          <div>
            <Label>{t("vendaAvulsa.forma")}</Label>
            <Select value={formaPagamento} onValueChange={setFormaPagamento}>
              <SelectTrigger>
                <SelectValue placeholder={t("vendaAvulsa.selecionar")} />
              </SelectTrigger>
              <SelectContent>
                {FORMAS_PAGAMENTO.map((forma) => (
                  <SelectItem key={forma} value={forma}>{nomeForma[forma]}</SelectItem>
                ))}
                {formasCustomizadas.length > 0 && (
                  <>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-t mt-1 pt-2">
                      {t("vendaAvulsa.personalizadas")}
                    </div>
                    {formasCustomizadas.map((f) => (
                      <SelectItem key={f.id} value={`custom_${f.id}`}>
                        {f.nome}
                      </SelectItem>
                    ))}
                  </>
                )}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>{t("vendaAvulsa.observacao")}</Label>
            <Textarea
              placeholder={t("vendaAvulsa.observacaoPlaceholder")}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("vendaAvulsa.cancelar")}
          </Button>
          <Button onClick={salvarVendaAvulsa} disabled={salvando}>
            {salvando ? t("vendaAvulsa.salvando") : t("vendaAvulsa.registrar")}
          </Button>
        </DialogFooter>

        {/* Histórico do dia */}
        <div className="mt-2 border-t pt-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-muted-foreground">{t("vendaAvulsa.hoje")}</p>
            {vendasHoje.length > 0 && (
              <span className="text-sm font-semibold text-green-600">{fmt.moeda(totalHoje)}</span>
            )}
          </div>

          {carregandoVendas ? (
            <p className="text-xs text-muted-foreground text-center py-3">{t("vendaAvulsa.carregando")}</p>
          ) : vendasHoje.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-3">{t("vendaAvulsa.nenhumaHoje")}</p>
          ) : (
            <div className="space-y-2">
              {vendasHoje.map((v) => (
                <div
                  key={v.id}
                  className="flex items-center justify-between gap-2 rounded-lg border p-2.5 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{v.descricao}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("vendaAvulsa.formaHora", { forma: getLabelFormaPagamento(v.forma_pagamento), hora: fmt.hora(v.created_at) })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-semibold font-mono">{fmt.moeda(Number(v.valor))}</span>
                    <button
                      onClick={() => excluirVendaAvulsa(v.id)}
                      className="p-1 rounded text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors"
                      title={t("vendaAvulsa.cancelarVenda")}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
