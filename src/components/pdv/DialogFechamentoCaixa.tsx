import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useCaixa } from "@/hooks/useCaixa";
import { useFuncionarioPermissoes } from "@/hooks/useFuncionarioPermissoes";
import { Caixa } from "@/types/caixa";
import { formatCurrency } from "@/lib/formatters";
import { Users } from "lucide-react";

interface ResumoFechamento {
  total_dinheiro: number;
  total_pix: number;
  total_cartao: number;
  total_a_receber: number;
  total_vendas: number;
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
}

export function DialogFechamentoCaixa({ open, onOpenChange, caixa, onCaixaFechado }: DialogFechamentoCaixaProps) {
  const { toast } = useToast();
  const { fecharCaixa } = useCaixa();
  const { lojaUserId } = useFuncionarioPermissoes();
  const [observacoes, setObservacoes] = useState("");
  const [fechando, setFechando] = useState(false);
  const [resumo, setResumo] = useState<ResumoFechamento | null>(null);
  const [carregandoResumo, setCarregandoResumo] = useState(false);
  const [saldoFinalContado, setSaldoFinalContado] = useState<number>(0);
  const [vendaFuncionarios, setVendaFuncionarios] = useState<VendaFuncionario[]>([]);

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
        .select("forma_pagamento, total, funcionario_id")
        .eq("user_id", userIdVendas)
        .gte("data", caixa.data_abertura)
        .lte("data", new Date().toISOString())
        .or("cancelada.is.null,cancelada.eq.false");

      if (caixa.empresa_id) {
        query = query.eq("empresa_id", caixa.empresa_id);
      }

      const { data: vendas } = await query;

      const formasCartao = ["debito", "credito", "credito_parcelado"];
      let total_dinheiro = 0;
      let total_pix = 0;
      let total_cartao = 0;
      let total_a_receber = 0;

      // Agregar por funcionário
      const mapaFunc: Record<string, { total: number; quantidade: number }> = {};

      for (const venda of vendas ?? []) {
        const valor = Number(venda.total) || 0;
        if (venda.forma_pagamento === "dinheiro") total_dinheiro += valor;
        else if (venda.forma_pagamento === "pix") total_pix += valor;
        else if (formasCartao.includes(venda.forma_pagamento ?? "")) total_cartao += valor;
        else if (venda.forma_pagamento === "a_receber") total_a_receber += valor;

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

      const total_vendas = total_dinheiro + total_pix + total_cartao + total_a_receber;
      const saldo_final = caixa.saldo_inicial + total_dinheiro;

      setResumo({ total_dinheiro, total_pix, total_cartao, total_a_receber, total_vendas, saldo_final });
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
        { label: "Total de Vendas", valor: resumo.total_vendas },
      ]
    : [];

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
              <Card className="p-4 space-y-2">
                {linhasResumo.map(({ label, valor }) => (
                  <div key={label} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-medium">{formatCurrency(valor)}</span>
                  </div>
                ))}
              </Card>

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
