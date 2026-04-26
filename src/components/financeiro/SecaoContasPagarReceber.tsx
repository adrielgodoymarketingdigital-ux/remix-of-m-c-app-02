import { useState, useMemo } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CardFinanceiroClicavel } from "./CardFinanceiroClicavel";
import { FiltroPeriodoAvancado, FiltrosPeriodo } from "./FiltroPeriodoAvancado";
import { TabelaContas } from "@/components/contas/TabelaContas";
import { DialogCadastroConta } from "@/components/contas/DialogCadastroConta";
import { ValorMonetario } from "@/components/ui/valor-monetario";
import { formatDate } from "@/lib/formatters";
import { Conta, FormularioConta } from "@/types/conta";
import {
  TrendingDown,
  TrendingUp,
  DollarSign,
  CheckCircle,
  AlertCircle,
  CreditCard,
  ChevronDown,
  ChevronRight,
  Plus,
  Tags,
} from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

type CardAtivo =
  | "a_pagar"
  | "a_receber"
  | "pago"
  | "recebido"
  | "contas_pagas"
  | "vencidas"
  | "cartoes"
  | null;

interface SecaoContasPagarReceberProps {
  contas: Conta[];
  onCriarConta: (dados: FormularioConta) => Promise<boolean>;
  onAtualizarConta: (id: string, dados: Partial<FormularioConta>) => Promise<boolean>;
  onExcluirConta: (id: string) => Promise<boolean>;
  onMarcarComoPaga: (id: string, tipo: "pagar" | "receber") => Promise<boolean>;
  categoriasExtras?: string[];
}

export function SecaoContasPagarReceber({
  contas,
  onCriarConta,
  onAtualizarConta,
  onExcluirConta,
  onMarcarComoPaga,
  categoriasExtras = [],
}: SecaoContasPagarReceberProps) {
  const isMobile = useIsMobile();

  // Initialize with current month filter so cards don't show all-time data
  const getInitialMonthFilter = (): FiltrosPeriodo => {
    const hoje = new Date();
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    const format = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    };
    return { dataInicio: format(inicioMes), dataFim: format(fimMes) };
  };

  const [filtros, setFiltros] = useState<FiltrosPeriodo>(getInitialMonthFilter);
  const [cardAtivo, setCardAtivo] = useState<CardAtivo>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [tipoLancamento, setTipoLancamento] = useState<"pagar" | "receber">("pagar");
  const [contaEditando, setContaEditando] = useState<Conta | null>(null);
  const [contasSelecionadas, setContasSelecionadas] = useState<string[]>([]);

  const contasFiltradas = useMemo(() => {
    let resultado = [...contas];
    if (filtros.dataInicio || filtros.dataFim) {
      const inicio = filtros.dataInicio ? filtros.dataInicio.substring(0, 10) : null;
      const fim = filtros.dataFim ? filtros.dataFim.substring(0, 10) : null;
      resultado = resultado.filter((c) => {
        const dataBase = (c.data || "").substring(0, 10);
        const dataVenc = (c.data_vencimento || "").substring(0, 10);
        // Use data_vencimento if available, otherwise data
        const dataRef = dataVenc || dataBase;
        if (inicio && dataRef < inicio) return false;
        if (fim && dataRef > fim) return false;
        return true;
      });
    }
    return resultado;
  }, [contas, filtros]);

  const hoje = new Date();

  const totalAPagar = useMemo(
    () =>
      contasFiltradas
        .filter((c) => c.tipo === "pagar" && c.status === "pendente")
        .reduce((acc, c) => acc + Number(c.valor), 0),
    [contasFiltradas]
  );

  const totalAReceber = useMemo(
    () =>
      contasFiltradas
        .filter((c) => c.tipo === "receber" && c.status === "pendente")
        .reduce((acc, c) => acc + Number(c.valor), 0),
    [contasFiltradas]
  );

  const totalPago = useMemo(
    () =>
      contasFiltradas
        .filter((c) => c.tipo === "pagar" && c.status === "pago")
        .reduce((acc, c) => acc + Number(c.valor), 0),
    [contasFiltradas]
  );

  // Total recebido: apenas contas manuais e vendas a prazo/a receber (virtual vendas com prefixo venda_)
  // Exclui contas de OS e vendas diretas regulares
  const isContaRecebidaRelevante = (c: Conta) => {
    if (c.tipo !== "receber" || c.status !== "recebido") return false;
    // Vendas a prazo (contas virtuais)
    if (c.id.startsWith("venda_")) return true;
    // Contas manuais (sem vínculo com OS ou venda direta)
    const isOSLinked = Boolean((c as any).os_numero);
    const isVendaLinked = (c.descricao ?? "").startsWith("venda_id:");
    return !isOSLinked && !isVendaLinked;
  };

  const totalRecebido = useMemo(
    () =>
      contasFiltradas
        .filter(isContaRecebidaRelevante)
        .reduce((acc, c) => acc + Number(c.valor), 0),
    [contasFiltradas]
  );

  const contasPagas = useMemo(
    () => contasFiltradas.filter((c) => c.status === "pago" || c.status === "recebido"),
    [contasFiltradas]
  );

  const contasVencidas = useMemo(
    () =>
      contasFiltradas.filter(
        (c) => c.status === "pendente" && new Date(c.data) < hoje
      ),
    [contasFiltradas]
  );

  const despesasCartoes = useMemo(
    () =>
      contasFiltradas
        .filter((c) => c.categoria === "Taxa de Cartão")
        .reduce((acc, c) => acc + Number(c.valor), 0),
    [contasFiltradas]
  );

  const toggleCard = (card: CardAtivo) => {
    setCardAtivo((prev) => (prev === card ? null : card));
  };

  const getContasExpandidas = (): Conta[] => {
    switch (cardAtivo) {
      case "a_pagar":
        return contasFiltradas.filter((c) => c.tipo === "pagar" && c.status === "pendente");
      case "a_receber":
        return contasFiltradas.filter((c) => c.tipo === "receber" && c.status === "pendente");
      case "pago":
        return contasFiltradas.filter((c) => c.tipo === "pagar" && c.status === "pago");
      case "recebido":
        return contasFiltradas.filter(isContaRecebidaRelevante);
      case "contas_pagas":
        return contasPagas;
      case "vencidas":
        return contasVencidas;
      case "cartoes":
        return contasFiltradas.filter((c) => c.categoria === "Taxa de Cartão");
      default:
        return [];
    }
  };

  const getTituloExpandido = (): string => {
    switch (cardAtivo) {
      case "a_pagar": return "Contas a Pagar";
      case "a_receber": return "Contas a Receber";
      case "pago": return "Contas Pagas";
      case "recebido": return "Contas Recebidas";
      case "contas_pagas": return "Todas as Contas Pagas/Recebidas";
      case "vencidas": return "Contas Vencidas";
      case "cartoes": return "Despesas de Cartões";
      default: return "";
    }
  };

  // Separar contas a receber por tipo (Serviço, Produto, Dispositivo)
  const contasAReceberPorTipo = useMemo(() => {
    const aReceber = contasFiltradas.filter((c) => c.tipo === "receber" && c.status === "pendente");
    const servicos = aReceber.filter((c) => c.nome.toLowerCase().includes("serviço") || c.nome.toLowerCase().includes("servico") || c.nome.includes("OS "));
    const dispositivos = aReceber.filter((c) => !servicos.includes(c) && (c.nome.toLowerCase().includes("dispositivo") || c.descricao?.includes("venda_id:")));
    const outros = aReceber.filter((c) => !servicos.includes(c) && !dispositivos.includes(c));
    return { servicos, dispositivos, outros };
  }, [contasFiltradas]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Contas a Pagar e a Receber</h2>
          <p className="text-muted-foreground text-sm">
            Resumo de todas as contas do período
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setTipoLancamento("pagar");
              setContaEditando(null);
              setDialogOpen(true);
            }}
          >
            <TrendingDown className="h-4 w-4 mr-1" />
            Lançar Despesa
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setTipoLancamento("receber");
              setContaEditando(null);
              setDialogOpen(true);
            }}
          >
            <TrendingUp className="h-4 w-4 mr-1" />
            Lançar Receita
          </Button>
        </div>
      </div>

      <FiltroPeriodoAvancado onFiltrar={setFiltros} />

      <div className={`grid gap-3 ${isMobile ? "grid-cols-2" : "grid-cols-3 lg:grid-cols-4 xl:grid-cols-7"}`}>
        <CardFinanceiroClicavel
          titulo="Total a Pagar"
          valor={totalAPagar}
          subtitulo="Contas pendentes"
          icon={TrendingDown}
          iconColor="text-destructive"
          valorColor="text-destructive"
          ativo={cardAtivo === "a_pagar"}
          onClick={() => toggleCard("a_pagar")}
        />
        <CardFinanceiroClicavel
          titulo="Total a Receber"
          valor={totalAReceber}
          subtitulo="Contas pendentes"
          icon={TrendingUp}
          iconColor="text-primary"
          valorColor="text-primary"
          ativo={cardAtivo === "a_receber"}
          onClick={() => toggleCard("a_receber")}
        />
        <CardFinanceiroClicavel
          titulo="Total Pago"
          valor={totalPago}
          subtitulo="No período"
          icon={DollarSign}
          ativo={cardAtivo === "pago"}
          onClick={() => toggleCard("pago")}
        />
        <CardFinanceiroClicavel
          titulo="Total Recebido"
          valor={totalRecebido}
          subtitulo="No período"
          icon={DollarSign}
          ativo={cardAtivo === "recebido"}
          onClick={() => toggleCard("recebido")}
        />
        <CardFinanceiroClicavel
          titulo="Contas Pagas e Contas Recebidas"
          quantidade={contasPagas.length}
          subtitulo="Pagas/recebidas"
          icon={CheckCircle}
          iconColor="text-green-600"
          valorColor="text-green-600"
          tipo="quantidade"
          ativo={cardAtivo === "contas_pagas"}
          onClick={() => toggleCard("contas_pagas")}
        />
        <CardFinanceiroClicavel
          titulo="Contas Vencidas"
          quantidade={contasVencidas.length}
          subtitulo="Requer atenção"
          icon={AlertCircle}
          iconColor="text-destructive"
          valorColor="text-destructive"
          tipo="quantidade"
          ativo={cardAtivo === "vencidas"}
          onClick={() => toggleCard("vencidas")}
        />
        <CardFinanceiroClicavel
          titulo="Despesas Cartões"
          valor={despesasCartoes}
          subtitulo="Taxa de cartão"
          icon={CreditCard}
          iconColor="text-purple-600"
          valorColor="text-purple-600"
          ativo={cardAtivo === "cartoes"}
          onClick={() => toggleCard("cartoes")}
        />
      </div>

      {/* Listagem expandida */}
      {cardAtivo && (
        <Collapsible open={true}>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{getTituloExpandido()}</CardTitle>
                <Badge variant="secondary">
                  {getContasExpandidas().length} item(ns)
                </Badge>
              </div>
            </CardHeader>
            <CollapsibleContent>
              <CardContent>
                {cardAtivo === "a_receber" ? (
                  <div className="space-y-4">
                    {contasAReceberPorTipo.servicos.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold mb-2 text-muted-foreground">Serviços</h4>
                        <ListaContasSimples
                          contas={contasAReceberPorTipo.servicos}
                          onMarcarComoPaga={onMarcarComoPaga}
                        />
                      </div>
                    )}
                    {contasAReceberPorTipo.dispositivos.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold mb-2 text-muted-foreground">Produtos / Dispositivos</h4>
                        <ListaContasSimples
                          contas={contasAReceberPorTipo.dispositivos}
                          onMarcarComoPaga={onMarcarComoPaga}
                        />
                      </div>
                    )}
                    {contasAReceberPorTipo.outros.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold mb-2 text-muted-foreground">Outros</h4>
                        <ListaContasSimples
                          contas={contasAReceberPorTipo.outros}
                          onMarcarComoPaga={onMarcarComoPaga}
                        />
                      </div>
                    )}
                    {contasAReceberPorTipo.servicos.length === 0 &&
                      contasAReceberPorTipo.dispositivos.length === 0 &&
                      contasAReceberPorTipo.outros.length === 0 && (
                        <p className="text-center py-4 text-muted-foreground">
                          Nenhuma conta a receber no período
                        </p>
                      )}
                  </div>
                ) : (
                  <TabelaContas
                    contas={getContasExpandidas()}
                    onEditar={(conta) => {
                      setContaEditando(conta);
                      setDialogOpen(true);
                    }}
                    onExcluir={onExcluirConta}
                    onMarcarComoPaga={onMarcarComoPaga}
                    contasSelecionadas={contasSelecionadas}
                    onToggleSelecao={(id) => {
                      setContasSelecionadas((prev) =>
                        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
                      );
                    }}
                    onToggleTodas={() => {
                      const pendentes = getContasExpandidas().filter(
                        (c) => c.status === "pendente"
                      );
                      const todasSelecionadas = pendentes.every((c) =>
                        contasSelecionadas.includes(c.id)
                      );
                      if (todasSelecionadas) {
                        setContasSelecionadas([]);
                      } else {
                        setContasSelecionadas(pendentes.map((c) => c.id));
                      }
                    }}
                  />
                )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      <DialogCadastroConta
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setContaEditando(null);
        }}
        onSubmit={async (dados: FormularioConta) => {
          if (contaEditando) {
            return await onAtualizarConta(contaEditando.id, dados);
          }
          const dadosComTipo = { ...dados, tipo: dados.tipo || tipoLancamento };
          return await onCriarConta(dadosComTipo);
        }}
        conta={
          contaEditando
            ? contaEditando
            : ({
                id: "",
                nome: "",
                tipo: tipoLancamento,
                valor: 0,
                data: new Date().toISOString().split("T")[0],
                status: "pendente",
                recorrente: false,
                created_at: "",
              } as Conta)
        }
        categoriasExtras={categoriasExtras}
      />
    </div>
  );
}

// Componente de lista simples para exibir contas separadas por tipo
function ListaContasSimples({
  contas,
  onMarcarComoPaga,
}: {
  contas: Conta[];
  onMarcarComoPaga: (id: string, tipo: "pagar" | "receber") => Promise<boolean>;
}) {
  return (
    <div className="space-y-2">
      {contas.map((conta) => (
        <div
          key={conta.id}
          className="flex items-center justify-between p-3 rounded-lg border bg-card"
        >
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{conta.nome}</p>
            <p className="text-xs text-muted-foreground">
              Venc: {formatDate(conta.data)}
              {conta.recorrente && " • 🔄 Recorrente"}
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="font-semibold">
              <ValorMonetario valor={conta.valor} tipo="preco" />
            </span>
            {conta.status === "pendente" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onMarcarComoPaga(conta.id, conta.tipo)}
                className="text-green-600 border-green-600 hover:bg-green-50"
              >
                <CheckCircle className="h-4 w-4 mr-1" />
                Receber
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
