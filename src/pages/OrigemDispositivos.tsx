import { useState, useMemo, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Search, Plus, X, Calendar, SlidersHorizontal, Smartphone, Package, Users } from "lucide-react";
import { useComprasDispositivos } from "@/hooks/useComprasDispositivos";
import { useOrigemPessoas } from "@/hooks/useOrigemPessoas";
import { useDispositivos } from "@/hooks/useDispositivos";
import { useConfiguracaoLoja } from "@/hooks/useConfiguracaoLoja";
import { useIsMobile } from "@/hooks/use-mobile";
import { DialogCadastroCompra } from "@/components/origem/DialogCadastroCompra";
import { DialogEditarCompra } from "@/components/origem/DialogEditarCompra";
import { TabelaCompras } from "@/components/origem/TabelaCompras";
import { ListaComprasMobile } from "@/components/origem/ListaComprasMobile";
import { DialogVisualizacaoCompra } from "@/components/origem/DialogVisualizacaoCompra";
import { DialogCadastroDispositivo } from "@/components/dispositivos/DialogCadastroDispositivo";
import { CompraDispositivo, FormularioCompraDispositivo } from "@/types/origem";
import { gerarReciboLegalPDF, salvarReciboStorage } from "@/lib/gerarReciboLegalPDF";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, isToday, isSameMonth } from "date-fns";
import { AppLayout } from "@/components/layout/AppLayout";

// Precisa bater com FormaPagamentoCompra (src/types/origem.ts) — o filtro
// antigo tinha "debito"/"credito"/"credito_parcelado", que não existem no
// banco (lá é "cartao_debito"/"cartao_credito", sem parcelado), então
// selecionar essas opções nunca filtrava nada. Também faltavam
// Transferência e Boleto, que o banco já suporta.
const OPCOES_PAGAMENTO: { value: string; label: string }[] = [
  { value: "todos", label: "Todos os pagamentos" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "pix", label: "PIX" },
  { value: "cartao_debito", label: "Débito" },
  { value: "cartao_credito", label: "Crédito" },
  { value: "transferencia", label: "Transferência" },
  { value: "boleto", label: "Boleto" },
];

export default function OrigemDispositivos() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [busca, setBusca] = useState("");
  const [dialogAberto, setDialogAberto] = useState(false);
  const [dialogEditarAberto, setDialogEditarAberto] = useState(false);
  const [dialogDetalhesAberto, setDialogDetalhesAberto] = useState(false);
  const [compraSelecionada, setCompraSelecionada] = useState<CompraDispositivo | null>(null);
  const [dialogDispositivoAberto, setDialogDispositivoAberto] = useState(false);
  const [dispositivoEditandoId, setDispositivoEditandoId] = useState<string | null>(null);
  const [filtroFormaPagamento, setFiltroFormaPagamento] = useState<string>("todos");
  const [filtroDataInicial, setFiltroDataInicial] = useState("");
  const [filtroDataFinal, setFiltroDataFinal] = useState("");
  const [dispositivoIdParam, setDispositivoIdParam] = useState<string | undefined>(undefined);

  const { compras, loading, criarCompra, atualizarCompra, excluirCompra, carregarCompras } = useComprasDispositivos();
  const { pessoas } = useOrigemPessoas();
  const { dispositivos, excluirDispositivo, atualizarDispositivo } = useDispositivos();
  const { config } = useConfiguracaoLoja();

  useEffect(() => {
    const novaCompra = searchParams.get('novo');
    const dispositivoId = searchParams.get('dispositivo');

    if (novaCompra === 'true' && dispositivoId) {
      setDispositivoIdParam(dispositivoId);
      setDialogAberto(true);
      navigate('/origem-dispositivos', { replace: true });
    }
  }, [searchParams, navigate]);

  const comprasFiltradas = useMemo(() => {
    let resultado = compras;

    if (busca.trim()) {
      const termo = busca.toLowerCase();
      resultado = resultado.filter(compra => {
        const dataFormatada = format(new Date(compra.data_compra), "dd/MM/yyyy");
        const dispositivoModelo = compra.dispositivos?.modelo || '';
        const dispositivoImei = compra.dispositivos?.imei || '';
        const dispositivoSerie = (compra.dispositivos as any)?.numero_serie || '';

        return (
          compra.origem_pessoas?.nome.toLowerCase().includes(termo) ||
          compra.origem_pessoas?.cpf_cnpj?.toLowerCase().includes(termo) ||
          dispositivoModelo.toLowerCase().includes(termo) ||
          dispositivoImei.toLowerCase().includes(termo) ||
          dispositivoSerie.toLowerCase().includes(termo) ||
          dataFormatada.includes(termo)
        );
      });
    }

    if (filtroFormaPagamento !== "todos") {
      resultado = resultado.filter(compra => compra.forma_pagamento === filtroFormaPagamento);
    }

    if (filtroDataInicial) {
      const dataInicial = new Date(filtroDataInicial);
      resultado = resultado.filter(compra => new Date(compra.data_compra) >= dataInicial);
    }

    if (filtroDataFinal) {
      const dataFinal = new Date(filtroDataFinal);
      dataFinal.setHours(23, 59, 59, 999);
      resultado = resultado.filter(compra => new Date(compra.data_compra) <= dataFinal);
    }

    return resultado;
  }, [compras, busca, filtroFormaPagamento, filtroDataInicial, filtroDataFinal]);

  const temFiltrosAtivos = busca.trim() || filtroFormaPagamento !== "todos" || filtroDataInicial || filtroDataFinal;

  const limparFiltros = () => {
    setBusca("");
    setFiltroFormaPagamento("todos");
    setFiltroDataInicial("");
    setFiltroDataFinal("");
  };

  // Só usado no layout mobile (ver render abaixo) — os 3 cards de métrica não
  // existiam antes no desktop, então não afetam o layout desktop de forma
  // nenhuma. "Total de origens" = pessoas cadastradas em Origem (useOrigemPessoas),
  // não contagem de compras.
  const metricas = useMemo(() => {
    const hoje = compras.filter((c) => isToday(new Date(c.data_compra))).length;
    const esteMes = compras.filter((c) => isSameMonth(new Date(c.data_compra), new Date())).length;
    return { hoje, esteMes, totalOrigens: pessoas.length };
  }, [compras, pessoas]);

  const handleSubmitCompra = async (dados: FormularioCompraDispositivo, gerarPDF: boolean) => {
    try {
      const compra = await criarCompra(dados);
      if (compra && gerarPDF && dados.pessoa_id) {
        const pessoa = pessoas.find(p => p.id === dados.pessoa_id);
        const dispositivo = dispositivos.find(d => d.id === dados.dispositivo_id);
        if (pessoa && dispositivo && config) {
          toast.loading("Gerando recibo de compra...");

          const dadosRecibo = {
            loja: {
              nome_loja: config.nome_loja,
              cnpj: config.cnpj,
              endereco: config.endereco,
              telefone: config.telefone,
              logradouro: config.logradouro,
              numero: config.numero,
              complemento: config.complemento,
              bairro: config.bairro,
              cidade: config.cidade,
              estado: config.estado,
              cep: config.cep,
            },
            vendedor: pessoa,
            dispositivo: {
              tipo: dispositivo.tipo,
              marca: dispositivo.marca,
              modelo: dispositivo.modelo,
              cor: dispositivo.cor,
              imei: dispositivo.imei,
              numero_serie: dispositivo.numero_serie,
              capacidade_gb: dispositivo.capacidade_gb,
              condicao: dispositivo.condicao,
            },
            compra: {
              ...compra,
              fotos: dados.fotos,
              documento_vendedor_frente: dados.documento_vendedor_frente,
              documento_vendedor_verso: dados.documento_vendedor_verso,
              assinatura_vendedor: dados.assinatura_vendedor,
              assinatura_vendedor_ip: dados.assinatura_vendedor_ip,
              assinatura_vendedor_data: dados.assinatura_vendedor ? new Date().toISOString() : undefined,
              assinatura_cliente: dados.assinatura_cliente,
              assinatura_cliente_ip: dados.assinatura_cliente_ip,
              assinatura_cliente_data: dados.assinatura_cliente ? new Date().toISOString() : undefined,
            },
          };

          const pdf = await gerarReciboLegalPDF(dadosRecibo);
          const pdfUrl = await salvarReciboStorage(pdf, compra.id);
          await supabase.from('compras_dispositivos').update({ termo_pdf_url: pdfUrl }).eq('id', compra.id);

          pdf.save(`recibo-compra-${compra.id}.pdf`);

          toast.dismiss();
          toast.success("Compra registrada e recibo gerado com sucesso!");
        }
      } else if (compra) {
        toast.success("Compra registrada com sucesso!");
      }
      await carregarCompras();
      setDialogAberto(false);
    } catch (error) {
      console.error("Erro:", error);
      toast.dismiss();
      toast.error("Erro ao processar compra");
    }
  };

  const handleEditarDispositivo = async (dispositivoId: string) => {
    setDispositivoEditandoId(dispositivoId);
    setDialogDispositivoAberto(true);
  };

  const handleExcluirDispositivo = async (dispositivoId: string) => {
    const compraComDispositivo = compras.find(c => c.dispositivo_id === dispositivoId);

    if (compraComDispositivo) {
      toast.error(
        "Não é possível excluir este dispositivo pois ele está vinculado a uma compra. Exclua a compra primeiro.",
        { duration: 5000 }
      );
      return;
    }

    await excluirDispositivo(dispositivoId);
    await carregarCompras();
  };

  return (
    <AppLayout>
      <main className="flex-1 p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          {isMobile ? (
            <div className="space-y-4">
              <div>
                <h1 className="text-2xl font-bold">Origem de Dispositivos</h1>
                <p className="text-muted-foreground mt-1 text-sm">Gerencie compras de dispositivos</p>
              </div>

              <Button onClick={() => setDialogAberto(true)} className="w-full h-12 gap-2">
                <Plus className="w-4 h-4" />
                Nova Compra
              </Button>

              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    placeholder="Buscar por pessoa, CPF/CNPJ, modelo, IMEI..."
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    className="pl-10 h-11"
                  />
                </div>

                <Sheet>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="icon" className="h-11 w-11 shrink-0 relative">
                      <SlidersHorizontal className="h-4 w-4" />
                      {(filtroFormaPagamento !== "todos" || filtroDataInicial || filtroDataFinal) && (
                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-primary" />
                      )}
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="bottom" className="rounded-t-2xl">
                    <SheetHeader>
                      <SheetTitle>Filtros</SheetTitle>
                    </SheetHeader>
                    <div className="space-y-4 mt-4 pb-4">
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">Forma de pagamento</label>
                        <Select value={filtroFormaPagamento} onValueChange={setFiltroFormaPagamento}>
                          <SelectTrigger className="h-11">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {OPCOES_PAGAMENTO.map((opcao) => (
                              <SelectItem key={opcao.value} value={opcao.value}>
                                {opcao.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-sm font-medium mb-1.5 block">De</label>
                          <Input
                            type="date"
                            value={filtroDataInicial}
                            onChange={(e) => setFiltroDataInicial(e.target.value)}
                            className="h-11"
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium mb-1.5 block">Até</label>
                          <Input
                            type="date"
                            value={filtroDataFinal}
                            onChange={(e) => setFiltroDataFinal(e.target.value)}
                            className="h-11"
                          />
                        </div>
                      </div>

                      {temFiltrosAtivos && (
                        <Button variant="ghost" onClick={limparFiltros} className="w-full gap-2">
                          <X className="h-4 w-4" />
                          Limpar filtros
                        </Button>
                      )}
                    </div>
                  </SheetContent>
                </Sheet>
              </div>

              {temFiltrosAtivos && (
                <div className="flex flex-wrap gap-2">
                  {busca.trim() && (
                    <Badge variant="secondary" className="gap-1">
                      Busca: {busca}
                      <X className="h-3 w-3 cursor-pointer" onClick={() => setBusca("")} />
                    </Badge>
                  )}
                  {filtroFormaPagamento !== "todos" && (
                    <Badge variant="secondary" className="gap-1">
                      Pagamento: {OPCOES_PAGAMENTO.find((o) => o.value === filtroFormaPagamento)?.label}
                      <X className="h-3 w-3 cursor-pointer" onClick={() => setFiltroFormaPagamento("todos")} />
                    </Badge>
                  )}
                  {filtroDataInicial && (
                    <Badge variant="secondary" className="gap-1">
                      De: {format(new Date(filtroDataInicial), "dd/MM/yyyy")}
                      <X className="h-3 w-3 cursor-pointer" onClick={() => setFiltroDataInicial("")} />
                    </Badge>
                  )}
                  {filtroDataFinal && (
                    <Badge variant="secondary" className="gap-1">
                      Até: {format(new Date(filtroDataFinal), "dd/MM/yyyy")}
                      <X className="h-3 w-3 cursor-pointer" onClick={() => setFiltroDataFinal("")} />
                    </Badge>
                  )}
                </div>
              )}

              <div className="grid grid-cols-3 gap-2">
                <div className="bg-card border rounded-2xl p-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 grid place-items-center mb-2">
                    <Smartphone className="h-4 w-4 text-primary" />
                  </div>
                  <div className="text-xl font-bold leading-none mb-1">{metricas.hoje}</div>
                  <div className="text-[11px] text-muted-foreground leading-tight">Compra hoje</div>
                </div>
                <div className="bg-card border rounded-2xl p-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 grid place-items-center mb-2">
                    <Package className="h-4 w-4 text-primary" />
                  </div>
                  <div className="text-xl font-bold leading-none mb-1">{metricas.esteMes}</div>
                  <div className="text-[11px] text-muted-foreground leading-tight">Este mês</div>
                </div>
                <div className="bg-card border rounded-2xl p-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 grid place-items-center mb-2">
                    <Users className="h-4 w-4 text-primary" />
                  </div>
                  <div className="text-xl font-bold leading-none mb-1">{metricas.totalOrigens}</div>
                  <div className="text-[11px] text-muted-foreground leading-tight">Total de origens</div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">Compras encontradas</h2>
                <span className="text-xs text-muted-foreground">
                  {comprasFiltradas.length} {comprasFiltradas.length === 1 ? "compra" : "compras"}
                  {temFiltrosAtivos && ` de ${compras.length}`}
                </span>
              </div>

              <ListaComprasMobile
                compras={comprasFiltradas}
                loading={loading}
                onVerDetalhes={(c) => { setCompraSelecionada(c); setDialogDetalhesAberto(true); }}
                onEditar={(c) => { setCompraSelecionada(c); setDialogEditarAberto(true); }}
                onExcluir={excluirCompra}
                onEditarDispositivo={handleEditarDispositivo}
                onExcluirDispositivo={handleExcluirDispositivo}
              />
            </div>
          ) : (
            <div className="space-y-4 sm:space-y-6">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold">Origem de Dispositivos</h1>
                  <p className="text-muted-foreground mt-1 text-sm sm:text-base">Gerencie compras de dispositivos</p>
                </div>
                <Button onClick={() => setDialogAberto(true)} className="w-full sm:w-auto">
                  <Plus className="w-4 h-4 mr-2" />Nova Compra
                </Button>
              </div>

              <div className="flex flex-col gap-3 sm:gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    placeholder="Buscar por pessoa, CPF/CNPJ, modelo, IMEI..."
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    className="pl-10 h-11"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <Select value={filtroFormaPagamento} onValueChange={setFiltroFormaPagamento}>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Forma de pagamento" />
                    </SelectTrigger>
                    <SelectContent>
                      {OPCOES_PAGAMENTO.map((opcao) => (
                        <SelectItem key={opcao.value} value={opcao.value}>
                          {opcao.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground hidden sm:block" />
                    <Input
                      type="date"
                      placeholder="Data inicial"
                      value={filtroDataInicial}
                      onChange={(e) => setFiltroDataInicial(e.target.value)}
                      className="h-11 flex-1"
                    />
                  </div>

                  <Input
                    type="date"
                    placeholder="Data final"
                    value={filtroDataFinal}
                    onChange={(e) => setFiltroDataFinal(e.target.value)}
                    className="h-11"
                  />

                  {temFiltrosAtivos && (
                    <Button variant="ghost" onClick={limparFiltros} className="h-11 gap-2">
                      <X className="h-4 w-4" />
                      Limpar
                    </Button>
                  )}
                </div>

                {temFiltrosAtivos && (
                  <div className="flex flex-wrap gap-2">
                    {busca.trim() && (
                      <Badge variant="secondary" className="gap-1">
                        Busca: {busca}
                        <X className="h-3 w-3 cursor-pointer" onClick={() => setBusca("")} />
                      </Badge>
                    )}
                    {filtroFormaPagamento !== "todos" && (
                      <Badge variant="secondary" className="gap-1">
                        Pagamento: {OPCOES_PAGAMENTO.find((o) => o.value === filtroFormaPagamento)?.label}
                        <X className="h-3 w-3 cursor-pointer" onClick={() => setFiltroFormaPagamento("todos")} />
                      </Badge>
                    )}
                    {filtroDataInicial && (
                      <Badge variant="secondary" className="gap-1">
                        De: {format(new Date(filtroDataInicial), "dd/MM/yyyy")}
                        <X className="h-3 w-3 cursor-pointer" onClick={() => setFiltroDataInicial("")} />
                      </Badge>
                    )}
                    {filtroDataFinal && (
                      <Badge variant="secondary" className="gap-1">
                        Até: {format(new Date(filtroDataFinal), "dd/MM/yyyy")}
                        <X className="h-3 w-3 cursor-pointer" onClick={() => setFiltroDataFinal("")} />
                      </Badge>
                    )}
                  </div>
                )}

                <p className="text-sm text-muted-foreground">
                  {comprasFiltradas.length} {comprasFiltradas.length === 1 ? 'compra encontrada' : 'compras encontradas'}
                  {temFiltrosAtivos && ` (de ${compras.length} total)`}
                </p>
              </div>

              <TabelaCompras
                compras={comprasFiltradas}
                loading={loading}
                onVerDetalhes={(c) => { setCompraSelecionada(c); setDialogDetalhesAberto(true); }}
                onEditar={(c) => { setCompraSelecionada(c); setDialogEditarAberto(true); }}
                onExcluir={excluirCompra}
                onEditarDispositivo={handleEditarDispositivo}
                onExcluirDispositivo={handleExcluirDispositivo}
              />
            </div>
          )}

          <DialogCadastroCompra
            open={dialogAberto}
            onOpenChange={(open) => {
              setDialogAberto(open);
              if (!open) setDispositivoIdParam(undefined);
            }}
            onSubmit={handleSubmitCompra}
            dispositivoId={dispositivoIdParam}
          />
          <DialogEditarCompra
            open={dialogEditarAberto}
            onOpenChange={setDialogEditarAberto}
            compra={compraSelecionada}
            onSubmit={async (id, dados) => {
              await atualizarCompra(id, dados);
              await carregarCompras();
            }}
          />
          <DialogVisualizacaoCompra
            open={dialogDetalhesAberto}
            onOpenChange={(open) => {
              setDialogDetalhesAberto(open);
              if (!open) setCompraSelecionada(null);
            }}
            compra={compraSelecionada}
          />

          <DialogCadastroDispositivo
            open={dialogDispositivoAberto}
            onOpenChange={(open) => {
              setDialogDispositivoAberto(open);
              if (!open) setDispositivoEditandoId(null);
            }}
            onSubmit={async (dados) => {
              if (dispositivoEditandoId) {
                await atualizarDispositivo(dispositivoEditandoId, dados);
                setDialogDispositivoAberto(false);
                setDispositivoEditandoId(null);
                await carregarCompras();
              }
            }}
            dispositivoParaEditar={dispositivos.find(d => d.id === dispositivoEditandoId) || null}
          />
        </div>
      </main>
    </AppLayout>
  );
}
