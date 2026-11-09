// Topo da tela Serviços no computador (>= 1024px): cabeçalho, indicadores, filtros
// e a linha "N serviços encontrados". Só visual: recebe o estado e os handlers da
// página (busca e filtros em memória). Abaixo de 1024px a página não usa este componente.
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { CheckCircle2, CircleDollarSign, Filter, Link2, Package, Plus, Search, Tag, Wand2, Wrench, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { ValorMonetario } from "@/components/ui/valor-monetario";
import { useOcultarValores } from "@/contexts/OcultarValoresContext";
import { formatCurrency } from "@/lib/formatters";
import type { ResumoServicos } from "@/lib/servicos/listaServicosDesktop";

/** Valor do Select quando nenhum tipo está escolhido. */
export const TODOS_OS_TIPOS = "todos";

interface TopoServicosDesktopProps {
  /** Indicadores do catálogo inteiro (não seguem busca nem filtros). */
  resumo: ResumoServicos;
  loading: boolean;
  onNovoServico: () => void;
  onVincularTipos: () => void;
  busca: string;
  onBusca: (v: string) => void;
  soSemTipo: boolean;
  onSoSemTipo: (v: boolean) => void;
  quantidadeSemTipo: number;
  tipos: { id: string; nome: string }[];
  tipoId: string;
  onTipoId: (v: string) => void;
  precoMinimo: string;
  onPrecoMinimo: (v: string) => void;
  precoMaximo: string;
  onPrecoMaximo: (v: string) => void;
  /** Algum limite de preço valendo: ponto no botão Filtros. */
  filtroPrecoAtivo: boolean;
  temFiltrosAtivos: boolean;
  onLimparFiltros: () => void;
  quantidadeEncontrada: number;
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

// Mesma regra do CardFinanceiroClicavel / Origem de Dispositivos: a fonte diminui com a
// largura do cartão (cqi) e o valor nunca é cortado.
const LARGURA_CARACTERE_EM = 0.64;
const fonteQueCabe = (texto: string) => ({
  fontSize: `min(1.5rem, calc(100cqi / ${(Math.max(texto.length, 1) * LARGURA_CARACTERE_EM).toFixed(2)}))`,
});

export function TopoServicosDesktop(p: TopoServicosDesktopProps) {
  const { t } = useTranslation("servicos", { keyPrefix: "telaDesktop" });
  const { resumo } = p;
  const numero = (n: number) => ({ valor: n, textoValor: String(n) });
  const { valoresOcultos } = useOcultarValores();
  // Com o olho ligado o lucro fica em cor neutra: verde/vermelho entregaria se é positivo ou negativo.
  const corLucro = valoresOcultos
    ? undefined
    : resumo.lucroTotal < 0
      ? "text-red-600 dark:text-red-400"
      : "text-emerald-600 dark:text-emerald-400";

  const indicadores: Indicador[] = [
    {
      rotulo: t("indicadores.total"),
      ...numero(resumo.total),
      legenda: t("indicadores.totalLegenda"),
      Icone: Package,
      cor: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    },
    {
      rotulo: t("indicadores.comPeca"),
      ...numero(resumo.comPeca),
      legenda: t("indicadores.percentualDosServicos", { percentual: resumo.percentualComPeca }),
      Icone: CheckCircle2,
      cor: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    },
    {
      rotulo: t("indicadores.semPeca"),
      ...numero(resumo.semPeca),
      legenda: t("indicadores.percentualDosServicos", { percentual: resumo.percentualSemPeca }),
      Icone: Link2,
      cor: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    },
    {
      rotulo: t("indicadores.lucro"),
      // tipo="lucro": some com o olho de ocultar valores, como o lucro da tabela.
      valor: <ValorMonetario valor={resumo.lucroTotal} tipo="lucro" />,
      textoValor: formatCurrency(resumo.lucroTotal),
      legenda: t("indicadores.lucroLegenda"),
      Icone: CircleDollarSign,
      cor: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
      corValor: corLucro,
    },
  ];

  return (
    <div className="space-y-5">
      {/* pt-6: o olho flutuante do layout (fixed top-4 right-4) ficaria por cima dos botões. */}
      <div className="flex items-center justify-between gap-4 pt-6">
        <div className="flex min-w-0 items-center gap-4">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-500 text-white shadow-lg shadow-blue-500/20">
            <Wrench className="h-7 w-7" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h1 className="text-[28px] font-bold leading-9 tracking-tight">{t("titulo")}</h1>
            <p className="text-sm leading-5 text-muted-foreground">{t("subtitulo")}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <Button variant="outline" onClick={p.onVincularTipos} className="h-11 rounded-xl px-4">
            <Wand2 className="mr-2 h-4 w-4" aria-hidden="true" />
            {t("vincularTipos")}
          </Button>
          <Button onClick={p.onNovoServico} className="h-11 rounded-xl px-5">
            <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
            {t("novoServico")}
          </Button>
        </div>
      </div>

      {/* 4 cartões lado a lado só quando cabem rótulo e legenda numa linha (~363px cada);
          a regra olha a largura da área ao lado do menu, aberto ou recolhido, e não a da tela. */}
      <div className="[container-type:inline-size]">
        <div className="grid grid-cols-2 gap-4 [@container(min-width:1500px)]:grid-cols-4">
          {indicadores.map(({ rotulo, valor, textoValor, legenda, Icone, cor, corValor }) => (
            <Card key={rotulo} className="flex min-w-0 items-center gap-4 rounded-2xl p-5 shadow-sm">
              <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ${cor}`}>
                <Icone className="h-6 w-6" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1 [container-type:inline-size]">
                <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">{rotulo}</p>
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
                {p.loading ? (
                  <Skeleton className="h-3 w-24" />
                ) : (
                  <p className="text-xs text-muted-foreground [overflow-wrap:anywhere]">{legenda}</p>
                )}
              </div>
            </Card>
          ))}
        </div>
      </div>

      <Card className="rounded-2xl p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[240px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              placeholder={t("busca")}
              aria-label={t("buscaRotulo")}
              value={p.busca}
              onChange={(e) => p.onBusca(e.target.value)}
              className="h-11 pl-10"
            />
          </div>

          <div className="flex h-11 items-center gap-2 px-1">
            <Switch id="servicos-so-sem-tipo-desktop" checked={p.soSemTipo} onCheckedChange={p.onSoSemTipo} />
            <Label htmlFor="servicos-so-sem-tipo-desktop" className="cursor-pointer whitespace-nowrap text-sm font-normal text-muted-foreground">
              {t("soSemTipo", { quantidade: p.quantidadeSemTipo })}
            </Label>
          </div>

          <Select value={p.tipoId} onValueChange={p.onTipoId}>
            <SelectTrigger className="h-11 w-[220px]" aria-label={t("tipoRotulo")}>
              <div className="flex min-w-0 items-center gap-2">
                <Tag className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <SelectValue />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS_OS_TIPOS}>{t("todosTipos")}</SelectItem>
              {p.tipos.map((tipo) => (
                <SelectItem key={tipo.id} value={tipo.id}>
                  {tipo.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="relative h-11 gap-2 px-4">
                <Filter className="h-4 w-4" aria-hidden="true" />
                {t("filtros")}
                {p.filtroPrecoAtivo && (
                  <>
                    <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-primary" aria-hidden="true" />
                    <span className="sr-only">{t("filtroPrecoAtivo")}</span>
                  </>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 space-y-4">
              <p className="text-sm font-semibold">{t("precoTitulo")}</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="servicos-preco-minimo">{t("precoMinimo")}</Label>
                  <Input
                    id="servicos-preco-minimo"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={p.precoMinimo}
                    onChange={(e) => p.onPrecoMinimo(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="servicos-preco-maximo">{t("precoMaximo")}</Label>
                  <Input
                    id="servicos-preco-maximo"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={p.precoMaximo}
                    onChange={(e) => p.onPrecoMaximo(e.target.value)}
                  />
                </div>
              </div>
              <Button variant="ghost" onClick={p.onLimparFiltros} disabled={!p.temFiltrosAtivos} className="w-full gap-2">
                <X className="h-4 w-4" aria-hidden="true" />
                {t("limparFiltros")}
              </Button>
            </PopoverContent>
          </Popover>
        </div>
      </Card>

      {/* Com 0 o próprio cartão da tabela já diz "Nenhum serviço encontrado/cadastrado". */}
      {p.loading ? (
        <Skeleton className="h-5 w-40" />
      ) : p.quantidadeEncontrada > 0 ? (
        <p className="text-sm text-muted-foreground">{t("encontrados", { count: p.quantidadeEncontrada })}</p>
      ) : null}
    </div>
  );
}
