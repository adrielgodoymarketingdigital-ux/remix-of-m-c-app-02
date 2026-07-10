import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useFuncionarioPermissoes } from "@/hooks/useFuncionarioPermissoes";
import { Caixa } from "@/types/caixa";
import { formatCurrency } from "@/lib/formatters";
import { Users, ArrowDownCircle, ArrowUpCircle, Wallet } from "lucide-react";
import { agruparVendasPorFormaPagamento, CORES_BADGE_FORMA_PAGAMENTO, BreakdownFormaPagamento } from "@/lib/formaPagamento";

interface ResumoFechamento {
  total_dinheiro: number;
  total_pix: number;
  total_cartao: number;
  total_a_receber: number;
  total_vendas: number;
  total_vendido: number;
  saldo_final: number;
}

interface VendaFuncionario {
  funcionario_id: string | null;
  nome: string;
  total: number;
  quantidade: number;
}

interface DialogFechamentoCaixaProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caixa: Caixa;
  onCaixaFechado: () => void;
  fecharCaixa: (caixaId: string, observacoes?: string, saldoFinalContado?: number) => Promise<boolean>;
}

export function DialogFechamentoCaixa({ open, onOpenChange, caixa, onCaixaFechado, fecharCaixa }: DialogFechamentoCaixaProps) {
  const { toast } = useToast();
  const { lojaUserId } = useFuncionarioPermissoes();
  const [observacoes, setObservacoes] = useState("");
  const [fechando, setFechando] = useState(false);
  const [resumo, setResumo] = useState<ResumoFechamento | null>(null);
  const [carregandoResumo, setCarregandoResumo] = useState(false);
  const [saldoFinalContado, setSaldoFinalContado] = useState<number>(0);
  const [vendaFuncionarios, setVendaFuncionarios] = useState<VendaFuncionario[]>([]);
  const [totalSangrias, setTotalSangrias] = useState(0);
  const [totalSuprimentos, setTotalSuprimentos] = useState(0);
  const [vendasPorForma, setVendasPorForma] = useState<BreakdownFormaPagamento[]>([]);

  useEffect(() => {
    if (open && caixa) {
      calcularResumoPreview();
    }
  }, [open, caixa]);

  const calcularResumoPreview = async () => {
    setCarregandoResumo(true);
    try {
      // proprietario_id = dono da loja (vendas salvas com esse user_id)
      // lojaUserId = fallback para caixas antigos sem proprietario_id (funcionários)
      const userIdVendas = caixa.proprietario_id ?? lojaUserId ?? caixa.user_id;
      let query = supabase
        .from("vendas")
        .select("forma_pagamento, total, funcionario_id, observacoes, segunda_forma_pagamento, valor_segunda_forma")
        .eq("user_id", userIdVendas)
        .gte("data", caixa.data_abertura)
        .lte("data", new Date().toISOString())
        .or("cancelada.is.null,cancelada.eq.false");

      if (caixa.empresa_id) {
        query = query.eq("empresa_id", caixa.empresa_id);
      }

      const { data: vendas } = await query;

      const formasCartao = ["debito", "credito", "credito_parcelado"];

      // Usa o mesmo agrupador do fechamento real (useCaixa.ts), que rateia corretamente
      // vendas com 2 formas de pagamento e ignora o registro auxiliar do split
      const breakdown = agruparVendasPorFormaPagamento(vendas ?? []);
      let total_dinheiro = 0;
      let total_pix = 0;
      let total_cartao = 0;
      let total_a_receber = 0;

      for (const item of breakdown) {
        if (item.chave === "dinheiro") total_dinheiro += item.total;
        else if (item.chave === "pix") total_pix += item.total;
        else if (formasCartao.includes(item.chave)) total_cartao += item.total;
        else if (item.chave === "a_receber" || item.chave === "a_prazo") total_a_receber += item.total;
      }

      // Buscar vendas avulsas do período
      const { data: vendasAvulsasPreview } = await supabase
        .from("vendas_avulsas")
        .select("valor, forma_pagamento")
        .eq("user_id", userIdVendas)
        .gte("created_at", caixa.data_abertura)
        .lte("created_at", new Date().toISOString())
        .is("deleted_at", null);

      const formasCartaoPreview = ["debito", "credito", "credito_parcelado"];
      (vendasAvulsasPreview || []).forEach((v: any) => {
        const forma = v.forma_pagamento;
        const valor = Number(v.valor || 0);
        if (forma === "dinheiro") total_dinheiro += valor;
        else if (forma === "pix") total_pix += valor;
        else if (formasCartaoPreview.includes(forma)) total_cartao += valor;
        else if (forma === "a_receber") total_a_receber += valor;
      });

      // Breakdown consolidado (vendas + avulsas no mesmo agrupador) para a seção
      // "Vendas por Forma de Pagamento": inclui formas customizadas e vendas avulsas,
      // usado só para exibição no dialog — não altera o fechamento real (useCaixa.ts).
      const vendasAvulsasComoVenda = (vendasAvulsasPreview || []).map((v: any) => ({
        forma_pagamento: v.forma_pagamento,
        total: Number(v.valor || 0),
      }));
      const breakdownCompleto = agruparVendasPorFormaPagamento([...(vendas ?? []), ...vendasAvulsasComoVenda]);
      const total_vendido = breakdownCompleto.reduce((acc, item) => acc + item.total, 0);

      // Agregar por funcionário (ignora o registro auxiliar do split de pagamento,
      // que duplicaria o valor do mesmo vendedor)
      const mapaFunc: Record<string, { total: number; quantidade: number }> = {};

      for (const venda of vendas ?? []) {
        if (venda.observacoes === "pagamento_duplo_secundario") continue;
        const valor = Number(venda.total) || 0;

        const fid = venda.funcionario_id ?? "__sem_funcionario__";
        if (!mapaFunc[fid]) mapaFunc[fid] = { total: 0, quantidade: 0 };
        mapaFunc[fid].total += valor;
        mapaFunc[fid].quantidade += 1;
      }

      // Buscar nomes dos funcionários
      const funcionarioIds = Object.keys(mapaFunc).filter(id => id !== "__sem_funcionario__");
      const nomesMap: Record<string, string> = {};
      if (funcionarioIds.length > 0) {
        const { data: funcs } = await supabase
          .from("loja_funcionarios")
          .select("id, nome")
          .in("id", funcionarioIds);
        for (const f of funcs ?? []) {
          nomesMap[f.id] = f.nome;
        }
      }

      const breakdownFunc: VendaFuncionario[] = Object.entries(mapaFunc)
        .map(([fid, dados]) => ({
          funcionario_id: fid === "__sem_funcionario__" ? null : fid,
          nome: fid === "__sem_funcionario__" ? "Sem vendedor" : (nomesMap[fid] || "Desconhecido"),
          total: dados.total,
          quantidade: dados.quantidade,
        }))
        .sort((a, b) => b.total - a.total);

      setVendaFuncionarios(breakdownFunc);
      setVendasPorForma(breakdownCompleto);

      // Buscar movimentações do caixa
      const { data: movimentacoes } = await supabase
        .from("caixa_movimentacoes")
        .select("tipo, valor")
        .eq("caixa_id", caixa.id);

      const sangrias = (movimentacoes ?? [])
        .filter(m => m.tipo === "sangria")
        .reduce((acc, m) => acc + Number(m.valor), 0);

      const suprimentos = (movimentacoes ?? [])
        .filter(m => m.tipo === "suprimento")
        .reduce((acc, m) => acc + Number(m.valor), 0);

      setTotalSangrias(sangrias);
      setTotalSuprimentos(suprimentos);

      const total_vendas = total_dinheiro + total_pix + total_cartao + total_a_receber;
      const saldo_final = caixa.saldo_inicial + total_dinheiro + suprimentos - sangrias;

      setResumo({ total_dinheiro, total_pix, total_cartao, total_a_receber, total_vendas, total_vendido, saldo_final });
      setSaldoFinalContado(saldo_final);
    } finally {
      setCarregandoResumo(false);
    }
  };

  const handleFechar = async () => {
    setFechando(true);
    try {
      const ok = await fecharCaixa(caixa.id, observacoes || undefined, saldoFinalContado);
      if (!ok) throw new Error("Falha ao fechar caixa");
      toast({ title: "Caixa fechado com sucesso!" });
      onCaixaFechado();
      setObservacoes("");
      setResumo(null);
      setSaldoFinalContado(0);
    } catch (err: unknown) {
      toast({
        title: "Erro ao fechar caixa",
        description: err instanceof Error ? err.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setFechando(false);
    }
  };

  const linhasResumo = resumo
    ? [
        { label: "Saldo Inicial", valor: caixa.saldo_inicial },
        { label: "Total em Dinheiro", valor: resumo.total_dinheiro },
        { label: "Total em PIX", valor: resumo.total_pix },
        { label: "Total em Cartão", valor: resumo.total_cartao },
        { label: "Total A Receber", valor: resumo.total_a_receber },
      ]
    : [];

  const temMovimentacoes = totalSangrias > 0 || totalSuprimentos > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Fechar Caixa</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {carregandoResumo ? (
            <p className="text-sm text-muted-foreground text-center py-4">Calculando resumo...</p>
          ) : (
            <>
              <Card className="p-4 space-y-3">
                <div className="space-y-2">
                  {linhasResumo.map(({ label, valor }) => (
                    <div key={label} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-medium">{formatCurrency(valor)}</span>
                    </div>
                  ))}
                </div>

                {resumo && (
                  <div className="flex justify-between items-center pt-2 border-t">
                    <span className="text-sm font-semibold">Total Vendido</span>
                    <span className="text-base font-bold">{formatCurrency(resumo.total_vendido)}</span>
                  </div>
                )}

                {vendasPorForma.length > 0 && (
                  <div className="space-y-2 pt-2 border-t">
                    <div className="flex items-center gap-2 mb-1">
                      <Wallet className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-semibold">Vendas por Forma de Pagamento</span>
                    </div>
                    {vendasPorForma.map((vf) => (
                      <div key={vf.chave} className="flex justify-between items-center text-sm">
                        <span className={CORES_BADGE_FORMA_PAGAMENTO[vf.cor]}>
                          {vf.nome}
                          <span className="ml-1 text-xs text-muted-foreground">
                            ({vf.quantidade} venda{vf.quantidade !== 1 ? "s" : ""})
                          </span>
                        </span>
                        <span className={`font-medium ${CORES_BADGE_FORMA_PAGAMENTO[vf.cor]}`}>{formatCurrency(vf.total)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {temMovimentacoes && (
                <Card className="p-4 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Movimentações</p>
                  {totalSangrias > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-red-600 flex items-center gap-1">
                        <ArrowDownCircle className="h-3.5 w-3.5" /> Sangrias
                      </span>
                      <span className="text-red-600 font-medium">- {formatCurrency(totalSangrias)}</span>
                    </div>
                  )}
                  {totalSuprimentos > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-green-600 flex items-center gap-1">
                        <ArrowUpCircle className="h-3.5 w-3.5" /> Suprimentos
                      </span>
                      <span className="text-green-600 font-medium">+ {formatCurrency(totalSuprimentos)}</span>
                    </div>
                  )}
                </Card>
              )}

              {vendaFuncionarios.length > 0 && (
                <Card className="p-4 space-y-2">
                  <div className="flex items-center gap-2 mb-1">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-semibold">Vendas por Vendedor</span>
                  </div>
                  {vendaFuncionarios.map((vf) => (
                    <div key={vf.funcionario_id ?? "sem"} className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">
                        {vf.nome}
                        <span className="ml-1 text-xs">({vf.quantidade} venda{vf.quantidade !== 1 ? "s" : ""})</span>
                      </span>
                      <span className="font-medium">{formatCurrency(vf.total)}</span>
                    </div>
                  ))}
                </Card>
              )}
            </>
          )}

          <div className="space-y-1">
            <Label htmlFor="saldo-contado">Saldo Final Contado (R$)</Label>
            <Input
              id="saldo-contado"
              type="number"
              min={0}
              step={0.01}
              value={saldoFinalContado}
              onChange={(e) => setSaldoFinalContado(Number(e.target.value) || 0)}
              disabled={carregandoResumo}
            />
            <p className="text-xs text-muted-foreground">
              Informe o valor real que está no caixa físico agora
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="obs-fechamento">Observações de fechamento (opcional)</Label>
            <Input
              id="obs-fechamento"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Ex: Sangria de R$200 realizada"
            />
          </div>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)} disabled={fechando}>
              Cancelar
            </Button>
            <Button className="flex-1" onClick={handleFechar} disabled={fechando || carregandoResumo}>
              {fechando ? "Fechando..." : "Confirmar Fechamento"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
