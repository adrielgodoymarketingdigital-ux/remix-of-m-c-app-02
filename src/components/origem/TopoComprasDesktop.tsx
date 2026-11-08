// Topo da tela Origem de Dispositivos no computador (>= 1024px): cabeçalho,
// indicadores, painel de filtros e a linha "N compras encontradas" + Exportar.
// Só visual: recebe o estado e os handlers da página (busca e filtros em memória,
// como sempre). Abaixo de 1024px a página não usa este componente.
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Calendar,
  CircleDollarSign,
  Download,
  Filter,
  Plus,
  Search,
  ShoppingCart,
  Smartphone,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ValorMonetario } from "@/components/ui/valor-monetario";
import { formatCurrency } from "@/lib/formatters";
import type { ResumoCompras } from "@/lib/origem/listaComprasDesktop";

interface TopoComprasDesktopProps {
  resumo: ResumoCompras;
  loading: boolean;
  onNovaCompra: () => void;
  opcoesPagamento: { value: string; label: string }[];
  busca: string;
  onBusca: (v: string) => void;
  formaPagamento: string;
  onFormaPagamento: (v: string) => void;
  dataInicial: string;
  onDataInicial: (v: string) => void;
  dataFinal: string;
  onDataFinal: (v: string) => void;
  valorMinimo: string;
  onValorMinimo: (v: string) => void;
  valorMaximo: string;
  onValorMaximo: (v: string) => void;
  /** Quantos limites de valor estão valendo (0, 1 ou 2): ponto no botão Filtros. */
  limitesValorAtivos: number;
  temFiltrosAtivos: boolean;
  onLimparFiltros: () => void;
  quantidadeEncontrada: number;
  quantidadeTotal: number;
  onExportar: () => void;
  /** Linhas marcadas na tabela que continuam visíveis: com alguma, o CSV leva só elas. */
  quantidadeSelecionada?: number;
  onLimparSelecao?: () => void;
}

interface Indicador {
  rotulo: string;
  valor: ReactNode;
  /** Texto do valor como aparece na tela: define a fonte que cabe sem cortar. */
  textoValor: string;
  legenda: string;
  Icone: LucideIcon;
  cor: string;
  corValor?: string;
}

// Largura média de um caractere do valor (Inter bold, números), em em. Mesma regra do
// CardFinanceiroClicavel: a fonte diminui com a largura do cartão (cqi) e o valor nunca é cortado.
const LARGURA_CARACTERE_EM = 0.64;
const fonteQueCabe = (texto: string) => ({
  fontSize: `min(1.5rem, calc(100cqi / ${(Math.max(texto.length, 1) * LARGURA_CARACTERE_EM).toFixed(2)}))`,
});

export function TopoComprasDesktop(p: TopoComprasDesktopProps) {
  const numero = (n: number) => ({ valor: n, textoValor: String(n) });
  const indicadores: Indicador[] = [
    { rotulo: "Total de Compras", ...numero(p.resumo.totalCompras), legenda: "no período", Icone: ShoppingCart, cor: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
    {
      rotulo: "Valor Total",
      // tipo="preco": aparece sempre, como o Valor Pago da tabela (decisão do dono).
      valor: <ValorMonetario valor={p.resumo.valorTotal} tipo="preco" />,
      textoValor: formatCurrency(p.resumo.valorTotal),
      legenda: "em compras",
      Icone: CircleDollarSign,
      cor: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
      corValor: "text-emerald-600 dark:text-emerald-400",
    },
    { rotulo: "Dispositivos", ...numero(p.resumo.dispositivos), legenda: "unidades", Icone: Smartphone, cor: "bg-sky-500/10 text-sky-600 dark:text-sky-400" },
    { rotulo: "Fornecedores", ...numero(p.resumo.fornecedores), legenda: "cadastrados", Icone: Users, cor: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-500 text-white shadow-lg shadow-blue-500/20">
            <Smartphone className="h-7 w-7" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h1 className="text-[28px] font-bold leading-9 tracking-tight">Origem de Dispositivos</h1>
            <p className="text-sm leading-5 text-muted-foreground">
              Gerencie compras de dispositivos e acompanhe suas origens
            </p>
          </div>
        </div>
        <Button onClick={p.onNovaCompra} className="h-11 shrink-0 rounded-xl px-5">
          <Plus className="mr-2 h-4 w-4" />
          Nova Compra
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {indicadores.map(({ rotulo, valor, textoValor, legenda, Icone, cor, corValor }) => (
          <Card key={rotulo} className="flex min-w-0 items-center gap-4 rounded-2xl p-5 shadow-sm">
            <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ${cor}`}>
              <Icone className="h-6 w-6" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1 [container-type:inline-size]">
              <p className="truncate text-sm text-muted-foreground">{rotulo}</p>
              {p.loading ? (
                <Skeleton className="my-1 h-7 w-16" />
              ) : (
                <p
                  className={`font-bold leading-8 tabular-nums [overflow-wrap:anywhere] ${corValor ?? ""}`}
                  style={fonteQueCabe(textoValor)}
                >
                  {valor}
                </p>
              )}
              <p className="text-xs text-muted-foreground">{legenda}</p>
            </div>
          </Card>
        ))}
      </div>

      <Card className="rounded-2xl p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          {/* Abaixo de 1440px a busca ocupa a linha toda e os filtros vão para a de baixo. */}
          <div className="relative basis-full min-[1440px]:min-w-[220px] min-[1440px]:flex-1 min-[1440px]:basis-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              placeholder="Buscar por pessoa, CPF/CNPJ, modelo, IMEI..."
              aria-label="Buscar compras"
              value={p.busca}
              onChange={(e) => p.onBusca(e.target.value)}
              className="h-11 pl-10"
            />
          </div>

          <Select value={p.formaPagamento} onValueChange={p.onFormaPagamento}>
            <SelectTrigger className="h-11 w-[200px]" aria-label="Forma de pagamento">
              <SelectValue placeholder="Forma de pagamento" />
            </SelectTrigger>
            <SelectContent>
              {p.opcoesPagamento.map((opcao) => (
                <SelectItem key={opcao.value} value={opcao.value}>
                  {opcao.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {([
            ["Data inicial", p.dataInicial, p.onDataInicial],
            ["Data final", p.dataFinal, p.onDataFinal],
          ] as const).map(([rotulo, valor, mudar]) => (
            <div key={rotulo} className="relative w-[170px]">
              <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                type="date"
                aria-label={rotulo}
                title={rotulo}
                value={valor}
                onChange={(e) => mudar(e.target.value)}
                className="h-11 pl-9"
              />
            </div>
          ))}

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="relative ml-auto h-11 gap-2 px-4">
                <Filter className="h-4 w-4" aria-hidden="true" />
                Filtros
                {p.limitesValorAtivos > 0 && (
                  <>
                    <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-primary" aria-hidden="true" />
                    <span className="sr-only">(filtro de valor ativo)</span>
                  </>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 space-y-4">
              <p className="text-sm font-semibold">Valor pago</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="origem-valor-minimo">Mínimo</Label>
                  <Input
                    id="origem-valor-minimo"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={p.valorMinimo}
                    onChange={(e) => p.onValorMinimo(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="origem-valor-maximo">Máximo</Label>
                  <Input
                    id="origem-valor-maximo"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={p.valorMaximo}
                    onChange={(e) => p.onValorMaximo(e.target.value)}
                  />
                </div>
              </div>
              <Button variant="ghost" onClick={p.onLimparFiltros} disabled={!p.temFiltrosAtivos} className="w-full gap-2">
                <X className="h-4 w-4" aria-hidden="true" />
                Limpar filtros
              </Button>
            </PopoverContent>
          </Popover>
        </div>
      </Card>

      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <p>
            {p.quantidadeEncontrada} {p.quantidadeEncontrada === 1 ? "compra encontrada" : "compras encontradas"}
            {p.temFiltrosAtivos && ` (de ${p.quantidadeTotal} total)`}
          </p>
          {!!p.quantidadeSelecionada && (
            <>
              <p className="font-medium text-foreground">
                {p.quantidadeSelecionada} {p.quantidadeSelecionada === 1 ? "selecionada" : "selecionadas"}
                <span className="font-normal text-muted-foreground"> · o CSV leva só as selecionadas</span>
              </p>
              {p.onLimparSelecao && (
                <Button variant="link" onClick={p.onLimparSelecao} className="h-auto p-0 text-sm">
                  Limpar seleção
                </Button>
              )}
            </>
          )}
        </div>
        <Button variant="outline" onClick={p.onExportar} disabled={p.loading || p.quantidadeEncontrada === 0} className="h-10 gap-2">
          <Download className="h-4 w-4" aria-hidden="true" />
          Exportar CSV
        </Button>
      </div>
    </div>
  );
}
