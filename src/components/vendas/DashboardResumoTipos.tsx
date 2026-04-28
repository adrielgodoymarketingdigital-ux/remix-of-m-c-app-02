import { Card } from "@/components/ui/card";
import { Venda } from "@/types/venda";
import { Smartphone, Package, Wrench, Loader2 } from "lucide-react";
import { useFuncionarioPermissoes } from "@/hooks/useFuncionarioPermissoes";
import { ValorMonetario } from "@/components/ui/valor-monetario";
import { useMemo } from "react";
import { distribuirCustoParcelasGrupo } from "@/lib/vendasFinanceiras";

interface DashboardResumoTiposProps {
  vendas: Venda[];
  loading: boolean;
}

export const DashboardResumoTipos = ({ vendas, loading }: DashboardResumoTiposProps) => {
  const { isFuncionario } = useFuncionarioPermissoes();

  // Distribuir custo das parcelas e filtrar vendas ativas
  const vendasAtivas = useMemo(() => {
    const distribuidas = distribuirCustoParcelasGrupo(vendas as any[]) as unknown as Venda[];
    return distribuidas.filter(v => {
      if (v.cancelada) return false;
      const isAReceber = v.forma_pagamento === 'a_receber' || v.forma_pagamento === 'a_prazo';
      if (isAReceber) {
        return v.recebido === true;
      }
      if (v.parcela_numero && v.parcela_numero > 1) return false;
      return true;
    });
  }, [vendas]);

  if (isFuncionario) return null;
  
  // Helper para calcular receita considerando parcelamento
  const calcularReceita = (v: Venda) => {
    const total = Number(v.total || 0) - Number(v.valor_desconto_manual || 0) - Number(v.valor_desconto_cupom || 0);
    const isAReceber = v.forma_pagamento === 'a_receber' || v.forma_pagamento === 'a_prazo';
    if (isAReceber) return total;
    if (v.total_parcelas && v.total_parcelas > 1 && v.parcela_numero === 1) {
      return total * v.total_parcelas;
    }
    return total;
  };

  // Custo: já distribuído pela função distribuirCustoParcelasGrupo
  const calcularCusto = (v: Venda) => {
    return (v.custo_unitario || 0) * (v.quantidade || 1);
  };

  // Calcular totais por tipo
  const resumoDispositivos = vendasAtivas
    .filter(v => v.tipo === 'dispositivo')
    .reduce((acc, v) => ({
      quantidade: acc.quantidade + (v.quantidade || 1),
      faturado: acc.faturado + calcularReceita(v),
      lucro: acc.lucro + (calcularReceita(v) - calcularCusto(v))
    }), { quantidade: 0, faturado: 0, lucro: 0 });

  const resumoProdutos = vendasAtivas
    .filter(v => v.tipo === 'produto')
    .reduce((acc, v) => ({
      quantidade: acc.quantidade + (v.quantidade || 1),
      faturado: acc.faturado + calcularReceita(v),
      lucro: acc.lucro + (calcularReceita(v) - calcularCusto(v))
    }), { quantidade: 0, faturado: 0, lucro: 0 });

  const resumoServicos = vendasAtivas
    .filter(v => v.tipo === 'servico')
    .reduce((acc, v) => ({
      quantidade: acc.quantidade + (v.quantidade || 1),
      faturado: acc.faturado + calcularReceita(v),
      lucro: acc.lucro + (calcularReceita(v) - calcularCusto(v))
    }), { quantidade: 0, faturado: 0, lucro: 0 });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Card Dispositivos */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Smartphone className="h-5 w-5 text-primary" />
          </div>
          <h3 className="font-semibold text-lg">Dispositivos</h3>
        </div>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground text-sm">Quantidade</span>
            <span className="font-medium">{resumoDispositivos.quantidade}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground text-sm">Faturado</span>
            <span className="font-medium"><ValorMonetario valor={resumoDispositivos.faturado} /></span>
          </div>
          <div className="flex justify-between items-center pt-2 border-t">
            <span className="text-muted-foreground text-sm">Lucro</span>
            <span className={`font-semibold ${resumoDispositivos.lucro >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              <ValorMonetario valor={resumoDispositivos.lucro} />
            </span>
          </div>
        </div>
      </Card>

      {/* Card Produtos */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
            <Package className="h-5 w-5 text-orange-500" />
          </div>
          <h3 className="font-semibold text-lg">Produtos</h3>
        </div>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground text-sm">Quantidade</span>
            <span className="font-medium">{resumoProdutos.quantidade}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground text-sm">Faturado</span>
            <span className="font-medium"><ValorMonetario valor={resumoProdutos.faturado} /></span>
          </div>
          <div className="flex justify-between items-center pt-2 border-t">
            <span className="text-muted-foreground text-sm">Lucro</span>
            <span className={`font-semibold ${resumoProdutos.lucro >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              <ValorMonetario valor={resumoProdutos.lucro} />
            </span>
          </div>
        </div>
      </Card>

      {/* Card Serviços */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
            <Wrench className="h-5 w-5 text-purple-500" />
          </div>
          <h3 className="font-semibold text-lg">Serviços</h3>
        </div>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground text-sm">Quantidade</span>
            <span className="font-medium">{resumoServicos.quantidade}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground text-sm">Faturado</span>
            <span className="font-medium"><ValorMonetario valor={resumoServicos.faturado} /></span>
          </div>
          <div className="flex justify-between items-center pt-2 border-t">
            <span className="text-muted-foreground text-sm">Lucro</span>
            <span className={`font-semibold ${resumoServicos.lucro >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              <ValorMonetario valor={resumoServicos.lucro} />
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
};
