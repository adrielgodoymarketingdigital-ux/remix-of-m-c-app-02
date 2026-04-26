import { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Printer, Search, ImageIcon, Package, Calendar as CalendarIcon, X, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/formatters";
import { format, startOfMonth, endOfMonth, subMonths, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { DialogReimprimirReciboVenda } from "./DialogReimprimirReciboVenda";
import { ValorMonetario } from "@/components/ui/valor-monetario";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface VendaDispositivo {
  id: string;
  dispositivo_id: string;
  cliente_id: string;
  quantidade: number;
  total: number;
  forma_pagamento: string;
  data: string;
  cliente_nome?: string;
  cliente_telefone?: string;
  cliente_cpf?: string;
  cliente_endereco?: string;
  dispositivo_marca?: string;
  dispositivo_modelo?: string;
  dispositivo_tipo?: string;
  dispositivo_imei?: string;
  dispositivo_numero_serie?: string;
  dispositivo_cor?: string;
  dispositivo_capacidade_gb?: number;
  dispositivo_condicao?: string;
  dispositivo_foto_url?: string;
  dispositivo_fotos?: string[];
  dispositivo_garantia?: boolean;
  dispositivo_tempo_garantia?: number;
  dispositivo_checklist?: any;
}

const FORMAS_PAGAMENTO_LABEL: Record<string, string> = {
  dinheiro: "Dinheiro",
  pix: "PIX",
  debito: "Débito",
  credito: "Crédito",
  credito_parcelado: "Crédito Parcelado",
  a_prazo: "A Prazo",
};

export function SecaoDispositivosVendidos() {
  const [vendas, setVendas] = useState<VendaDispositivo[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [vendaSelecionada, setVendaSelecionada] = useState<VendaDispositivo | null>(null);
  const [dialogReciboAberto, setDialogReciboAberto] = useState(false);
  const [modoImpressao, setModoImpressao] = useState<"recibo" | "garantia">("recibo");
  const [mesSelecionado, setMesSelecionado] = useState<string>("todos");
  const [dataInicio, setDataInicio] = useState<Date | undefined>();
  const [dataFim, setDataFim] = useState<Date | undefined>();

  // Gerar lista dos últimos 12 meses
  const mesesDisponiveis = useMemo(() => {
    const meses = [];
    const agora = new Date();
    for (let i = 0; i < 12; i++) {
      const data = subMonths(agora, i);
      meses.push({
        value: format(data, "yyyy-MM"),
        label: format(data, "MMMM yyyy", { locale: ptBR }),
      });
    }
    return meses;
  }, []);

  useEffect(() => {
    carregarVendas();
  }, []);

  const carregarVendas = async () => {
    try {
      setLoading(true);

      // Resolve user ID (owner for employees)
      const { data: lojaOwnerId } = await supabase.rpc('get_loja_owner_id');
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) { setLoading(false); return; }
      const userId = lojaOwnerId || user.id;
      
      // First fetch vendas filtered by user
      const { data: vendasData, error: vendasError } = await supabase
        .from("vendas")
        .select("id, dispositivo_id, cliente_id, quantidade, total, forma_pagamento, data, grupo_venda")
        .eq("user_id", userId)
        .eq("tipo", "dispositivo")
        .not("dispositivo_id", "is", null)
        .or("cancelada.eq.false,cancelada.is.null")
        .order("data", { ascending: false });

      if (vendasError) {
        console.error("Erro ao buscar vendas:", vendasError);
        throw vendasError;
      }

      if (!vendasData || vendasData.length === 0) {
        setVendas([]);
        return;
      }

      // Group parceled sales by grupo_venda - keep only the first entry per group
      const vendasAgrupadas: typeof vendasData = [];
      const gruposVistos = new Set<string>();
      
      for (const v of vendasData) {
        if (v.grupo_venda) {
          if (gruposVistos.has(v.grupo_venda)) continue;
          gruposVistos.add(v.grupo_venda);
        }
        vendasAgrupadas.push(v);
      }

      // Calculate total for grouped sales
      const totalPorGrupo = new Map<string, number>();
      for (const v of vendasData) {
        if (v.grupo_venda) {
          totalPorGrupo.set(v.grupo_venda, (totalPorGrupo.get(v.grupo_venda) || 0) + v.total);
        }
      }

      // Fetch dispositivos and clientes separately
      const dispositivoIds = [...new Set(vendasAgrupadas.map(v => v.dispositivo_id).filter(Boolean))];
      const clienteIds = [...new Set(vendasAgrupadas.map(v => v.cliente_id).filter(Boolean))];

      const [dispRes, cliRes] = await Promise.all([
        dispositivoIds.length > 0
          ? supabase.from("dispositivos").select("id, marca, modelo, tipo, imei, numero_serie, cor, capacidade_gb, condicao, foto_url, fotos, garantia, tempo_garantia, checklist").in("id", dispositivoIds)
          : { data: [], error: null },
        clienteIds.length > 0
          ? supabase.from("clientes").select("id, nome, telefone, cpf, endereco").in("id", clienteIds)
          : { data: [], error: null },
      ]);

      const dispMap = new Map((dispRes.data || []).map((d: any) => [d.id, d]));
      const cliMap = new Map((cliRes.data || []).map((c: any) => [c.id, c]));

      const vendasFormatadas: VendaDispositivo[] = vendasAgrupadas.map((v: any) => {
        const disp = dispMap.get(v.dispositivo_id);
        const cli = cliMap.get(v.cliente_id);
        const totalReal = v.grupo_venda ? (totalPorGrupo.get(v.grupo_venda) || v.total) : v.total;
        
        return {
          id: v.id,
          dispositivo_id: v.dispositivo_id,
          cliente_id: v.cliente_id,
          quantidade: v.quantidade,
          total: totalReal,
          forma_pagamento: v.forma_pagamento,
          data: v.data,
          cliente_nome: cli?.nome,
          cliente_telefone: cli?.telefone,
          cliente_cpf: cli?.cpf,
          cliente_endereco: cli?.endereco,
          dispositivo_marca: disp?.marca,
          dispositivo_modelo: disp?.modelo,
          dispositivo_tipo: disp?.tipo,
          dispositivo_imei: disp?.imei,
          dispositivo_numero_serie: disp?.numero_serie,
          dispositivo_cor: disp?.cor,
          dispositivo_capacidade_gb: disp?.capacidade_gb,
          dispositivo_condicao: disp?.condicao,
          dispositivo_foto_url: disp?.foto_url,
          dispositivo_fotos: disp?.fotos as string[] | undefined,
          dispositivo_garantia: disp?.garantia,
          dispositivo_tempo_garantia: disp?.tempo_garantia,
          dispositivo_checklist: disp?.checklist,
        };
      });

      setVendas(vendasFormatadas);
    } catch (error) {
      console.error("Erro ao carregar vendas de dispositivos:", error);
    } finally {
      setLoading(false);
    }
  };

  const vendasFiltradas = useMemo(() => {
    let resultado = vendas;

    // Filtro por mês
    if (mesSelecionado !== "todos") {
      const [ano, mes] = mesSelecionado.split("-").map(Number);
      const inicio = startOfMonth(new Date(ano, mes - 1));
      const fim = endOfMonth(new Date(ano, mes - 1));
      resultado = resultado.filter((v) => {
        const dataVenda = new Date(v.data);
        return isWithinInterval(dataVenda, { start: inicio, end: fim });
      });
    }

    // Filtro por período personalizado
    if (dataInicio) {
      resultado = resultado.filter((v) => new Date(v.data) >= startOfDay(dataInicio));
    }
    if (dataFim) {
      resultado = resultado.filter((v) => new Date(v.data) <= endOfDay(dataFim));
    }

    // Filtro por busca
    if (busca.trim()) {
      const termo = busca.toLowerCase().trim();
      resultado = resultado.filter(
        (v) =>
          v.dispositivo_marca?.toLowerCase().includes(termo) ||
          v.dispositivo_modelo?.toLowerCase().includes(termo) ||
          v.dispositivo_imei?.toLowerCase().includes(termo) ||
          v.cliente_nome?.toLowerCase().includes(termo)
      );
    }

    return resultado;
  }, [vendas, busca, mesSelecionado, dataInicio, dataFim]);

  // Resumo filtrado
  const resumoFiltrado = useMemo(() => ({
    total: vendasFiltradas.length,
    valor: vendasFiltradas.reduce((s, v) => s + v.total, 0),
  }), [vendasFiltradas]);

  const limparFiltrosDatas = () => {
    setMesSelecionado("todos");
    setDataInicio(undefined);
    setDataFim(undefined);
  };

  const handleSelecionarMes = (valor: string) => {
    setMesSelecionado(valor);
    setDataInicio(undefined);
    setDataFim(undefined);
  };

  const handleSelecionarDataInicio = (date: Date | undefined) => {
    setDataInicio(date);
    setMesSelecionado("todos");
  };

  const handleSelecionarDataFim = (date: Date | undefined) => {
    setDataFim(date);
    setMesSelecionado("todos");
  };

  const handleImprimir = (venda: VendaDispositivo) => {
    setVendaSelecionada(venda);
    setModoImpressao("recibo");
    setDialogReciboAberto(true);
  };

  const handleImprimirGarantia = (venda: VendaDispositivo) => {
    setVendaSelecionada(venda);
    setModoImpressao("garantia");
    setDialogReciboAberto(true);
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[300px] w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Resumo */}
      <Card>
        <CardContent className="p-4 flex items-center gap-4">
          <div className="p-3 rounded-full bg-primary/10">
            <Package className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Dispositivos vendidos</p>
            <p className="text-2xl font-bold">{resumoFiltrado.total}</p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-sm text-muted-foreground">Total em vendas</p>
            <p className="text-2xl font-bold">
              <ValorMonetario valor={resumoFiltrado.valor} />
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Filtros */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Busca */}
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por marca, modelo, IMEI ou cliente..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Filtro por mês */}
        <Select value={mesSelecionado} onValueChange={handleSelecionarMes}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Mês" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os meses</SelectItem>
            {mesesDisponiveis.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Data início */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("w-[140px] justify-start text-left font-normal", !dataInicio && "text-muted-foreground")}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dataInicio ? format(dataInicio, "dd/MM/yyyy") : "De"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 z-50" align="start">
            <Calendar mode="single" selected={dataInicio} onSelect={handleSelecionarDataInicio} initialFocus className={cn("p-3 pointer-events-auto")} />
          </PopoverContent>
        </Popover>

        {/* Data fim */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("w-[140px] justify-start text-left font-normal", !dataFim && "text-muted-foreground")}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dataFim ? format(dataFim, "dd/MM/yyyy") : "Até"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 z-50" align="start">
            <Calendar mode="single" selected={dataFim} onSelect={handleSelecionarDataFim} initialFocus className={cn("p-3 pointer-events-auto")} />
          </PopoverContent>
        </Popover>

        {/* Limpar filtros */}
        {(mesSelecionado !== "todos" || dataInicio || dataFim) && (
          <Button variant="ghost" size="sm" onClick={limparFiltrosDatas}>
            <X className="h-4 w-4 mr-1" />
            Limpar datas
          </Button>
        )}
      </div>

      <p className="text-sm text-muted-foreground">
        {vendasFiltradas.length} venda(s) encontrada(s)
      </p>

      {vendasFiltradas.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Package className="h-16 w-16 mx-auto mb-4 opacity-50" />
          <p className="text-lg">Nenhum dispositivo vendido encontrado</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {vendasFiltradas.map((venda) => (
            <Card key={venda.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              <div className="relative h-36 bg-muted flex items-center justify-center p-2">
                {(venda.dispositivo_fotos && venda.dispositivo_fotos.length > 0) || venda.dispositivo_foto_url ? (
                  <img
                    src={venda.dispositivo_fotos?.[0] || venda.dispositivo_foto_url || ""}
                    alt={`${venda.dispositivo_marca} ${venda.dispositivo_modelo}`}
                    className="max-w-full max-h-full object-contain"
                  />
                ) : (
                  <ImageIcon className="h-12 w-12 text-muted-foreground" />
                )}
                <Badge className="absolute top-2 left-2 bg-green-600 text-white">
                  Vendido
                </Badge>
              </div>

              <CardContent className="p-4 space-y-3">
                <div>
                  <h3 className="font-bold text-lg">
                    {venda.dispositivo_marca} {venda.dispositivo_modelo}
                  </h3>
                  {venda.dispositivo_tipo && (
                    <p className="text-sm text-muted-foreground">{venda.dispositivo_tipo}</p>
                  )}
                </div>

                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Cliente:</span>
                    <span className="font-medium truncate ml-2">{venda.cliente_nome || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Data:</span>
                      <span className="flex items-center gap-1">
                        <CalendarIcon className="h-3 w-3" />
                        {format(new Date(venda.data), "dd/MM/yyyy", { locale: ptBR })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Pagamento:</span>
                    <span>{FORMAS_PAGAMENTO_LABEL[venda.forma_pagamento] || venda.forma_pagamento}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Qtd:</span>
                    <span>{venda.quantidade}</span>
                  </div>
                  {venda.dispositivo_imei && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">IMEI:</span>
                      <span className="text-xs">{venda.dispositivo_imei}</span>
                    </div>
                  )}
                </div>

                <div className="border-t pt-3 flex justify-between items-center">
                  <div>
                    <p className="text-xs text-muted-foreground">Total</p>
                    <p className="text-lg font-bold">
                      <ValorMonetario valor={venda.total} tipo="preco" />
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => handleImprimirGarantia(venda)} title="Imprimir Garantia">
                      <ShieldCheck className="h-4 w-4 mr-1" />
                      Garantia
                    </Button>
                    <Button size="sm" onClick={() => handleImprimir(venda)}>
                      <Printer className="h-4 w-4 mr-1" />
                      Recibo
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <DialogReimprimirReciboVenda
        open={dialogReciboAberto}
        onOpenChange={setDialogReciboAberto}
        venda={vendaSelecionada}
        modo={modoImpressao}
      />
    </div>
  );
}
