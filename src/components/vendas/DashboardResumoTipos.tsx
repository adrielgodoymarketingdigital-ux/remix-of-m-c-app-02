import { Venda } from "@/types/venda";
import { Smartphone, Package, Wrench, Loader2, ShoppingBag, Tag, ChartNoAxesColumnIncreasing, type LucideIcon } from "lucide-react";
import { useFuncionarioPermissoes } from "@/hooks/useFuncionarioPermissoes";
import { ValorMonetario } from "@/components/ui/valor-monetario";
import { useMemo, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatters";
import { TextoAjustado } from "@/components/vendas/TextoAjustado";
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
    const filtradas = distribuidas.filter(v => {
      if (v.cancelada) return false;
      const isAReceber = v.forma_pagamento === 'a_receber' || v.forma_pagamento === 'a_prazo';
      if (isAReceber) {
        return v.recebido === true;
      }
      if (v.parcela_numero && Number(v.parcela_numero) > 1) return false;
      return true;
    });
    return filtradas;
  }, [vendas]);

  if (isFuncionario) return null;
  
  // Helper para calcular receita considerando parcelamento
  const calcularReceita = (v: Venda) => {
    const total = Number(v.total || 0) - Number(v.valor_desconto_manual || 0) - Number(v.valor_desconto_cupom || 0);
    const isAReceber = v.forma_pagamento === 'a_receber' || v.forma_pagamento === 'a_prazo';
    if (isAReceber) return total;
    if (v.total_parcelas && Number(v.total_parcelas) > 1 && Number(v.parcela_numero) === 1) {
      return total * Number(v.total_parcelas);
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

  const resumoAvulsas = vendasAtivas
    .filter(v => v.tipo === 'avulsa')
    .reduce((acc, v) => ({
      quantidade: acc.quantidade + 1,
      faturado: acc.faturado + Number(v.total || 0),
      lucro: acc.lucro + Number(v.total || 0),
    }), { quantidade: 0, faturado: 0, lucro: 0 });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Só apresentação: os números vêm dos resumos calculados acima, sem alteração
  const categorias: CategoriaResumo[] = [
    {
      nome: "Dispositivos",
      descricao: "Vendas de aparelhos e dispositivos",
      Icone: Smartphone,
      corIcone: "bg-primary/10 text-primary dark:bg-primary/15",
      resumo: resumoDispositivos,
      rotuloResultado: "Lucro",
    },
    {
      nome: "Produtos",
      descricao: "Vendas de produtos em geral",
      Icone: Package,
      corIcone: "bg-orange-100 text-orange-500 dark:bg-orange-500/15 dark:text-orange-400",
      resumo: resumoProdutos,
      rotuloResultado: "Lucro",
    },
    {
      nome: "Serviços",
      descricao: "Prestação de serviços",
      Icone: Wrench,
      corIcone: "bg-purple-100 text-purple-500 dark:bg-purple-500/15 dark:text-purple-400",
      resumo: resumoServicos,
      rotuloResultado: "Lucro",
    },
    // Venda Avulsa: só aparece quando existe (como antes) e o 3º indicador é "Receita"
    ...(resumoAvulsas.quantidade > 0
      ? [{
          nome: "Venda Avulsa",
          descricao: "Vendas registradas sem item cadastrado",
          Icone: ShoppingBag,
          corIcone: "bg-violet-100 text-violet-500 dark:bg-violet-500/15 dark:text-violet-400",
          resumo: resumoAvulsas,
          rotuloResultado: "Receita" as const,
        }]
      : []),
  ];
  const quantidadeImpar = categorias.length % 2 === 1;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {categorias.map((cat, i) => {
        const negativo = cat.rotuloResultado === "Lucro" && cat.resumo.lucro < 0;
        return (
          <article
            key={cat.nome}
            data-resumo-tipo
            aria-label={cat.nome}
            className={cn(
              "rounded-[18px] border border-border bg-card px-[9px] py-[13px] min-[376px]:px-3 min-[376px]:py-4",
              "shadow-[0_5px_17px_rgba(16,24,40,0.035)] dark:shadow-none",
              // Quantidade ímpar no desktop: o último ocupa a linha inteira
              quantidadeImpar && i === categorias.length - 1 && "md:col-span-2",
            )}
          >
            <div className="mb-4 flex items-center gap-[13px] px-1">
              <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl min-[376px]:h-[55px] min-[376px]:w-[55px]", cat.corIcone)}>
                <cat.Icone className="h-[26px] w-[26px]" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-bold leading-tight tracking-[-0.4px]">{cat.nome}</h3>
                <p className="mt-1.5 text-[11px] leading-normal text-muted-foreground">{cat.descricao}</p>
              </div>
            </div>

            <dl className="grid grid-cols-3 gap-[7px]">
              <Indicador
                rotulo="Quantidade"
                Icone={Package}
                corIcone="bg-orange-100 text-orange-500 dark:bg-orange-500/15 dark:text-orange-400"
                caracteres={String(cat.resumo.quantidade).length}
              >
                {cat.resumo.quantidade}
              </Indicador>
              <Indicador
                rotulo="Faturado"
                Icone={Tag}
                corIcone="bg-primary/10 text-primary dark:bg-primary/15"
                caracteres={formatCurrency(cat.resumo.faturado).length}
              >
                <ValorMonetario valor={cat.resumo.faturado} />
              </Indicador>
              <Indicador
                rotulo={cat.rotuloResultado}
                Icone={ChartNoAxesColumnIncreasing}
                corIcone={negativo
                  ? "bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400"
                  : "bg-green-100 text-green-600 dark:bg-green-500/15 dark:text-green-400"}
                caracteres={formatCurrency(cat.resumo.lucro).length}
                classeFundo={negativo ? "bg-red-50 dark:bg-red-500/10" : "bg-green-50 dark:bg-green-500/10"}
                classeValor={negativo ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}
              >
                <ValorMonetario valor={cat.resumo.lucro} />
              </Indicador>
            </dl>
          </article>
        );
      })}
    </div>
  );
};

interface CategoriaResumo {
  nome: string;
  descricao: string;
  Icone: LucideIcon;
  corIcone: string;
  resumo: { quantidade: number; faturado: number; lucro: number };
  rotuloResultado: "Lucro" | "Receita";
}

interface IndicadorProps {
  rotulo: string;
  Icone: LucideIcon;
  corIcone: string;
  caracteres: number;
  children: ReactNode;
  classeFundo?: string;
  classeValor?: string;
}

function Indicador({ rotulo, Icone, corIcone, caracteres, children, classeFundo, classeValor }: IndicadorProps) {
  return (
    <div
      className={cn(
        "flex min-h-[87px] min-w-0 flex-col justify-between gap-2 rounded-[13px] px-1.5 py-2.5 min-[376px]:px-[9px] min-[376px]:py-3",
        classeFundo ?? "bg-background dark:bg-muted/40",
      )}
    >
      <dt className="flex min-w-0 items-center gap-[5px]">
        <span className={cn("flex h-[25px] w-[25px] shrink-0 items-center justify-center rounded-lg", corIcone)}>
          <Icone className="h-[15px] w-[15px]" aria-hidden="true" />
        </span>
        <span className="truncate text-[9px] text-muted-foreground min-[376px]:text-[10px]">{rotulo}</span>
      </dt>
      <dd className={cn("font-extrabold tracking-[-0.5px]", classeValor)}>
        <TextoAjustado caracteres={caracteres} min={10} max={20} classeReserva="text-xs min-[376px]:text-sm">
          {children}
        </TextoAjustado>
      </dd>
    </div>
  );
}
