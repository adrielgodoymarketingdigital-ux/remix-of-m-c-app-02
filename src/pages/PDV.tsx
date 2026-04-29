import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
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
import { useToast } from "@/hooks/use-toast";
import { useClientes } from "@/hooks/useClientes";
import { useFuncionarioPermissoes } from "@/hooks/useFuncionarioPermissoes";
import { ShoppingCart, Plus, Layout, Settings, CreditCard, DollarSign, History, XCircle, Info } from "lucide-react";
import { DialogSelecionarItem, ItemVenda } from "@/components/pdv/DialogSelecionarItem";
import { DialogConfiguracaoLayoutPDV } from "@/components/pdv/DialogConfiguracaoLayoutPDV";
import { DialogAberturaCaixa } from "@/components/pdv/DialogAberturaCaixa";
import { DialogFechamentoCaixa } from "@/components/pdv/DialogFechamentoCaixa";
import { DialogHistoricoCaixas } from "@/components/pdv/DialogHistoricoCaixas";
import { DialogStatusCaixa } from "@/components/pdv/DialogStatusCaixa";
import { PagamentoDuplo } from "@/components/pdv/PagamentoDuplo";
import { useCaixa } from "@/hooks/useCaixa";
import { Caixa } from "@/types/caixa";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ItemCarrinho } from "@/components/pdv/ItemCarrinho";
import { SelecionadorCliente } from "@/components/pdv/SelecionadorCliente";
import { formatCurrency } from "@/lib/formatters";
import { z } from "zod";
import { useEventDispatcher } from "@/hooks/useEventDispatcher";
import { Dispositivo } from "@/types/dispositivo";
import { Cliente } from "@/types/cliente";
import { toast as sonnerToast } from "sonner";
import { DialogReciboPDV, DadosReciboPDV } from "@/components/pdv/DialogReciboPDV";
import { ConfiguracaoTaxasCartao } from "@/components/configuracoes/ConfiguracaoTaxasCartao";
import { SeletorBandeiraCartao } from "@/components/pdv/SeletorBandeiraCartao";
import { useTaxasCartao } from "@/hooks/useTaxasCartao";
import { Dialog, DialogContent } from "@/components/ui/dialog";

const clienteSchema = z.object({
  nome: z.string().trim().min(1, "Nome é obrigatório").max(100),
  telefone: z.string().trim().max(20).optional(),
  cpf: z.string().trim().max(14).optional(),
  endereco: z.string().trim().max(200).optional(),
});

const PDV = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { clientes, refetch: carregarClientes, criarCliente } = useClientes({ modoSilencioso: true });
  const { lojaUserId, funcionarioId } = useFuncionarioPermissoes();
  const { dispatchEvent } = useEventDispatcher();
  const [loading, setLoading] = useState(true);
  const [finalizando, setFinalizando] = useState(false);
  const [dialogItemAberto, setDialogItemAberto] = useState(false);
  const [dialogReciboAberto, setDialogReciboAberto] = useState(false);
  const [dialogLayoutAberto, setDialogLayoutAberto] = useState(false);
  const [dialogTaxasCartaoAberto, setDialogTaxasCartaoAberto] = useState(false);
  const [dialogAberturaCaixaAberto, setDialogAberturaCaixaAberto] = useState(false);
  const [dialogFechamentoCaixaAberto, setDialogFechamentoCaixaAberto] = useState(false);
  const [dialogHistoricoCaixasAberto, setDialogHistoricoCaixasAberto] = useState(false);
  const [dialogStatusCaixaAberto, setDialogStatusCaixaAberto] = useState(false);
  const { caixaAtual, caixaEstaAberto, carregarCaixaAtual } = useCaixa();
  const [pagamentoDuploAtivo, setPagamentoDuploAtivo] = useState(false);
  const [valorPrimeiraPagamento, setValorPrimeiraPagamento] = useState(0);
  const [segundaFormaPagamento, setSegundaFormaPagamento] = useState("");
  const [valorSegundaPagamento, setValorSegundaPagamento] = useState(0);
  const [dataPrevistaSegundaForma, setDataPrevistaSegundaForma] = useState("");
  const [tipoRecebimentoSegunda, setTipoRecebimentoSegunda] = useState<"a_vista" | "parcelado">("a_vista");
  const [numParcelasSegunda, setNumParcelasSegunda] = useState(2);
  const [datasParcelasSegunda, setDatasParcelasSegunda] = useState<string[]>([]);
  const [dadosRecibo, setDadosRecibo] = useState<DadosReciboPDV | null>(null);
  const [bandeiraSelecionada, setBandeiraSelecionada] = useState("");
  const { taxasAtivas, calcularTaxa } = useTaxasCartao();

  // Dados do cliente
  const [clienteSelecionado, setClienteSelecionado] = useState<Cliente | null>(null);

  // Carrinho
  const [itensCarrinho, setItensCarrinho] = useState<ItemVenda[]>([]);
  const [descontoValor, setDescontoValor] = useState(0);
  const [tipoDesconto, setTipoDesconto] = useState<"valor" | "porcentagem">("valor");
  const [formaPagamento, setFormaPagamento] = useState("");
  const [numeroParcelas, setNumeroParcelas] = useState(2);
  const [dataPrevistaRecebimento, setDataPrevistaRecebimento] = useState("");
  const [tipoRecebimento, setTipoRecebimento] = useState<"a_vista" | "parcelado">("a_vista");
  const [numParcelasReceber, setNumParcelasReceber] = useState(2);
  const [datasParcelasReceber, setDatasParcelasReceber] = useState<string[]>([]);

  useEffect(() => {
    checkAuth();
    carregarClientes();

    // Verificar se há dispositivo selecionado
    const state = location.state as { dispositivoSelecionado?: Dispositivo };
    if (state?.dispositivoSelecionado) {
      const dispositivo = state.dispositivoSelecionado;
      
      // Adicionar dispositivo ao carrinho
      const itemVenda: ItemVenda = {
        id: dispositivo.id,
        tipo: 'dispositivo',
        nome: `${dispositivo.marca} ${dispositivo.modelo}`,
        preco: dispositivo.preco || 0,
        custo: dispositivo.custo || 0,
        quantidade: 1,
        estoque: dispositivo.quantidade,
        dispositivo_id: dispositivo.id,
      };
      
      setItensCarrinho([itemVenda]);
      sonnerToast.success("Dispositivo adicionado ao carrinho!");
      
      // Limpar state
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, []);

  const checkAuth = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
    }
    setLoading(false);
  };

  const adicionarItem = (item: ItemVenda) => {
    const itemExistente = itensCarrinho.find((i) => i.id === item.id);
    if (itemExistente) {
      const novaQuantidade = itemExistente.quantidade + item.quantidade;
      // Validar estoque para dispositivos e produtos
      if (item.estoque !== undefined && novaQuantidade > item.estoque) {
        toast({
          title: "Quantidade insuficiente",
          description: `Estoque disponível: ${item.estoque}`,
          variant: "destructive",
        });
        return;
      }
      setItensCarrinho((prev) =>
        prev.map((i) =>
          i.id === item.id
            ? { ...i, quantidade: novaQuantidade }
            : i
        )
      );
    } else {
      setItensCarrinho((prev) => [...prev, item]);
    }
  };

  const removerItem = (id: string) => {
    setItensCarrinho((prev) => prev.filter((item) => item.id !== id));
  };

  const atualizarQuantidade = (id: string, quantidade: number) => {
    setItensCarrinho((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const maxQtd = item.estoque !== undefined ? Math.min(quantidade, item.estoque) : quantidade;
          return { ...item, quantidade: Math.max(1, maxQtd) };
        }
        return item;
      })
    );
  };

  const calcularSubtotal = () => {
    return itensCarrinho.reduce(
      (acc, item) => acc + item.preco * item.quantidade,
      0
    );
  };

  // Calcula o valor real do desconto (em R$) baseado no tipo selecionado
  const calcularDescontoReal = () => {
    const sub = calcularSubtotal();
    if (tipoDesconto === "porcentagem") {
      return Math.min(sub, (sub * descontoValor) / 100);
    }
    return Math.min(sub, descontoValor);
  };

  const calcularTotal = () => {
    const descontoManual = calcularDescontoReal();
    return calcularSubtotal() - descontoManual;
  };

  const validarVenda = () => {
    if (itensCarrinho.length === 0) {
      toast({
        title: "Erro",
        description: "Adicione pelo menos um item à venda",
        variant: "destructive",
      });
      return false;
    }

    if (!formaPagamento) {
      toast({
        title: "Erro",
        description: "Selecione a forma de pagamento",
        variant: "destructive",
      });
      return false;
    }

    if (pagamentoDuploAtivo && segundaFormaPagamento === "a_receber") {
      if (tipoRecebimentoSegunda === "a_vista" && !dataPrevistaSegundaForma) {
        toast({
          title: "Erro",
          description: "Informe a data de recebimento da 2ª forma",
          variant: "destructive",
        });
        return false;
      }
      if (tipoRecebimentoSegunda === "parcelado") {
        if (datasParcelasSegunda.some(d => !d) || datasParcelasSegunda.length < numParcelasSegunda) {
          toast({
            title: "Erro",
            description: "Informe todas as datas das parcelas da 2ª forma",
            variant: "destructive",
          });
          return false;
        }
      }
    }

    if (formaPagamento === "a_receber") {
      if (tipoRecebimento === "a_vista" && !dataPrevistaRecebimento) {
        toast({
          title: "Erro",
          description: "Informe a data prevista de recebimento",
          variant: "destructive",
        });
        return false;
      }
      if (tipoRecebimento === "parcelado") {
        const datasVazias = datasParcelasReceber.some(d => !d);
        if (datasVazias || datasParcelasReceber.length < numParcelasReceber) {
          toast({
            title: "Erro",
            description: "Informe todas as datas de recebimento das parcelas",
            variant: "destructive",
          });
          return false;
        }
      }
    }

    return true;
  };

  const finalizarVenda = async () => {
    if (!validarVenda()) return;

    setFinalizando(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // User ID para registrar: dono da loja (se funcionário) ou próprio ID
      const userIdParaVenda = lojaUserId || user.id;

      // Usar cliente selecionado
      const clienteId = clienteSelecionado?.id || null;

      // Gerar ID de grupo para vincular todas as vendas desta transação
      const grupoVendaId = crypto.randomUUID();

      // Calcular desconto proporcional por item
      const valorDescontoManualPorItem = calcularDescontoReal() / itensCarrinho.length;

      const vendasRegistradas = [];

      for (const item of itensCarrinho) {
        // Peças são tratadas como produtos no banco (tipo_produto só aceita 'produto' ou 'dispositivo')
        const tipoParaBanco = item.tipo === "dispositivo" ? "dispositivo" : "produto";
        
        // IDs para o banco
        // - Dispositivo: usa dispositivo_id
        // - Produto: usa produto_id
        // - Peça: usa peca_id (NÃO usa produto_id, pois produto_id tem FK para produtos)
        const dispositivoId = item.tipo === "dispositivo" ? (item.dispositivo_id || item.id) : null;

        let produtoId: string | null = null;
        let pecaId: string | null = null;

        if (item.tipo === "produto") {
          produtoId = item.produto_id || item.id;
        }

        if (item.tipo === "peca") {
          pecaId = item.peca_id || item.id;
        }

        console.log(
          `[PDV] Item: ${item.nome}, Tipo: ${item.tipo}, ID: ${item.id}, produto_id: ${item.produto_id}, peca_id: ${item.peca_id}, Final produtoId: ${produtoId}, Final pecaId: ${pecaId}`
        );
        
        // Determinar parcelas para "a_receber"
        const isParceladoReceber = formaPagamento === "a_receber" && tipoRecebimento === "parcelado";
        const totalParcelas = isParceladoReceber ? numParcelasReceber : 1;
        const valorPorParcela = (item.preco * item.quantidade) / totalParcelas;
        const descontoPorParcela = valorDescontoManualPorItem / totalParcelas;

        for (let parcIdx = 0; parcIdx < totalParcelas; parcIdx++) {
          let dataPrevisao: string | null = null;
          if (formaPagamento === "a_receber") {
            if (isParceladoReceber) {
              dataPrevisao = datasParcelasReceber[parcIdx] || null;
            } else {
              dataPrevisao = dataPrevistaRecebimento || null;
            }
          }

          const vendaData = {
            tipo: tipoParaBanco as "produto" | "dispositivo",
            cliente_id: clienteId,
            dispositivo_id: dispositivoId,
            produto_id: produtoId,
            peca_id: pecaId,
            quantidade: totalParcelas === 1 ? item.quantidade : item.quantidade,
            total: valorPorParcela,
            custo_unitario: isParceladoReceber ? (item.custo || 0) / totalParcelas : item.custo,
            forma_pagamento: formaPagamento as "dinheiro" | "pix" | "debito" | "credito" | "credito_parcelado" | "a_receber",
            user_id: userIdParaVenda,
            data_prevista_recebimento: dataPrevisao,
            recebido: formaPagamento !== "a_receber",
            grupo_venda: grupoVendaId,
            valor_desconto_manual: descontoPorParcela,
            funcionario_id: funcionarioId || null,
            parcela_numero: isParceladoReceber ? parcIdx + 1 : null,
            total_parcelas: isParceladoReceber ? totalParcelas : null,
          };

          const { data: venda, error: vendaError } = await supabase
            .from("vendas")
            .insert([vendaData])
            .select()
            .single();

          if (vendaError) throw vendaError;

          if (venda) {
            vendasRegistradas.push(venda);

            // Criar lançamento em Contas a Receber para vendas a prazo
            if (formaPagamento === "a_receber") {
              const nomeItem = item.nome || "Item";
              const nomeCliente = clienteSelecionado?.nome || "Cliente avulso";
              const sufixoParcela = isParceladoReceber ? ` (${parcIdx + 1}/${totalParcelas})` : "";
              
              await supabase.from("contas").insert({
                nome: `Venda - ${nomeItem} - ${nomeCliente}${sufixoParcela}`,
                tipo: "receber",
                valor: vendaData.total,
                data: dataPrevisao || new Date().toISOString().split('T')[0],
                data_vencimento: dataPrevisao || null,
                status: "pendente",
                recorrente: false,
                categoria: "Vendas",
                descricao: `venda_id:${venda.id}`,
                user_id: userIdParaVenda,
              });
            }
          }
        }

        // Atualizar estoque na tabela correta
        if (item.tipo === "dispositivo") {
          const dispositivoIdParaEstoque = item.dispositivo_id || item.id;
          
          // Buscar quantidade atual do banco para evitar estoque desatualizado
          const { data: dispAtual, error: fetchError } = await supabase
            .from("dispositivos")
            .select("quantidade")
            .eq("id", dispositivoIdParaEstoque)
            .single();
          
          if (fetchError) throw fetchError;
          
          const estoqueAtual = dispAtual?.quantidade ?? item.estoque;
          const novaQuantidade = Math.max(0, estoqueAtual - item.quantidade);
          
          const { error: estoqueError } = await supabase
            .from("dispositivos")
            .update({
              quantidade: novaQuantidade,
              vendido: novaQuantidade === 0,
            })
            .eq("id", dispositivoIdParaEstoque);

          if (estoqueError) throw estoqueError;
        } else if (item.tipo === "produto") {
          const { error: estoqueError } = await supabase
            .from("produtos")
            .update({
              quantidade: item.estoque - item.quantidade,
            })
            .eq("id", item.id);

          if (estoqueError) throw estoqueError;
        } else if (item.tipo === "peca") {
          const { error: estoqueError } = await supabase
            .from("pecas")
            .update({
              quantidade: item.estoque - item.quantidade,
            })
            .eq("id", item.id);

          if (estoqueError) throw estoqueError;
        }
      }

      // === REGISTRAR SEGUNDA FORMA DE PAGAMENTO ===
      if (pagamentoDuploAtivo && segundaFormaPagamento && valorSegundaPagamento > 0) {
        const proporcaoSegunda = valorSegundaPagamento / calcularTotal();
        const isParceladoSegunda = segundaFormaPagamento === "a_receber" && tipoRecebimentoSegunda === "parcelado";
        const totalParcelasSegunda = isParceladoSegunda ? numParcelasSegunda : 1;

        for (const item of itensCarrinho) {
          const tipoParaBanco = item.tipo === "dispositivo" ? "dispositivo" : "produto";
          const dispositivoId = item.tipo === "dispositivo" ? (item.dispositivo_id || item.id) : null;
          let produtoId: string | null = null;
          let pecaId: string | null = null;
          if (item.tipo === "produto") produtoId = item.produto_id || item.id;
          if (item.tipo === "peca") pecaId = item.peca_id || item.id;

          for (let parcIdx = 0; parcIdx < totalParcelasSegunda; parcIdx++) {
            const valorItemSegundaParcela = (item.preco * item.quantidade * proporcaoSegunda) / totalParcelasSegunda;

            let dataPrevisaoSegunda: string | null = null;
            if (segundaFormaPagamento === "a_receber") {
              if (isParceladoSegunda) {
                dataPrevisaoSegunda = datasParcelasSegunda[parcIdx] || null;
              } else {
                dataPrevisaoSegunda = dataPrevistaSegundaForma || null;
              }
            }

            const vendaSegundaForma = {
              tipo: tipoParaBanco as "produto" | "dispositivo",
              cliente_id: clienteId,
              dispositivo_id: dispositivoId,
              produto_id: produtoId,
              peca_id: pecaId,
              quantidade: item.quantidade,
              total: valorItemSegundaParcela,
              custo_unitario: 0,
              forma_pagamento: segundaFormaPagamento as "dinheiro" | "pix" | "debito" | "credito" | "credito_parcelado" | "a_receber",
              user_id: userIdParaVenda,
              data_prevista_recebimento: dataPrevisaoSegunda,
              recebido: segundaFormaPagamento !== "a_receber",
              grupo_venda: grupoVendaId,
              valor_desconto_manual: 0,
              funcionario_id: funcionarioId || null,
              parcela_numero: isParceladoSegunda ? parcIdx + 1 : null,
              total_parcelas: isParceladoSegunda ? totalParcelasSegunda : null,
            };

            const { data: vendaSegunda, error: errSegunda } = await supabase
              .from("vendas")
              .insert([vendaSegundaForma])
              .select()
              .single();

            if (errSegunda) {
              console.error("[PDV] Erro ao registrar segunda forma:", errSegunda);
            }

            if (vendaSegunda && segundaFormaPagamento === "a_receber") {
              const sufixoParcela = isParceladoSegunda ? ` (${parcIdx + 1}/${totalParcelasSegunda})` : "";
              await supabase.from("contas").insert({
                nome: `Venda - ${item.nome} - ${clienteSelecionado?.nome || "Cliente avulso"}${sufixoParcela} (2ª forma)`,
                tipo: "receber",
                valor: valorItemSegundaParcela,
                data: dataPrevisaoSegunda || new Date().toISOString().split("T")[0],
                data_vencimento: dataPrevisaoSegunda || null,
                status: "pendente",
                recorrente: false,
                categoria: "Vendas",
                descricao: `venda_id:${vendaSegunda.id}`,
                user_id: userIdParaVenda,
              });
            }
          }
        }
      }

      // === REGISTRAR TAXA DE CARTÃO NO FINANCEIRO ===
      if (bandeiraSelecionada && bandeiraSelecionada !== "nenhuma") {
        const taxaSel = taxasAtivas.find(t => t.id === bandeiraSelecionada);
        console.log("[PDV] Taxa cartão - bandeira:", bandeiraSelecionada, "taxaSel:", taxaSel, "formaPagamento:", formaPagamento);
        if (taxaSel) {
          const totalVenda = calcularTotal();
          const { percentual, valor: valorTaxa } = calcularTaxa(taxaSel, formaPagamento, numeroParcelas, totalVenda);
          console.log("[PDV] Taxa cartão - percentual:", percentual, "valorTaxa:", valorTaxa, "totalVenda:", totalVenda);
          if (valorTaxa > 0) {
            const { error: taxaError } = await supabase.from("contas").insert({
              nome: `Taxa Cartão ${taxaSel.bandeira} - Venda PDV`,
              tipo: "pagar" as const,
              valor: valorTaxa,
              data: new Date().toISOString().split('T')[0],
              status: "pago" as const,
              recorrente: false,
              categoria: "Taxa de Cartão",
              descricao: `Taxa ${percentual}% da bandeira ${taxaSel.bandeira} sobre venda de ${formatCurrency(totalVenda)}`,
              user_id: userIdParaVenda,
            });
            if (taxaError) {
              console.error("[PDV] Erro ao registrar taxa de cartão:", taxaError);
            } else {
              console.log("[PDV] Taxa de cartão registrada com sucesso:", valorTaxa);
            }
          }
        }
      }

      toast({
        title: "Venda finalizada com sucesso!",
        description: `Total: ${formatCurrency(calcularTotal())}`,
      });

      // Disparar evento de notificação automática
      dispatchEvent("SALE_CREATED", {
        total: calcularTotal().toFixed(2),
        clienteNome: clienteSelecionado?.nome || "Cliente avulso",
        grupoVendaId,
      });

      // Preparar dados completos para o recibo com TODOS os itens
      if (vendasRegistradas.length > 0) {
        const dadosParaRecibo: DadosReciboPDV = {
          itens: [...itensCarrinho], // Clonar para preservar estado
          cliente: clienteSelecionado,
          subtotal: calcularSubtotal(),
          descontoManual: calcularDescontoReal(),
          descontoCupom: 0,
          total: calcularTotal(),
          formaPagamento: formaPagamento,
          numeroParcelas: formaPagamento === "credito_parcelado" ? numeroParcelas : undefined,
          data: new Date().toISOString(),
          grupoVendaId: grupoVendaId,
          pagamentoDuplo: pagamentoDuploAtivo && segundaFormaPagamento ? {
            valorPrimeira: valorPrimeiraPagamento,
            segundaForma: segundaFormaPagamento,
            valorSegunda: valorSegundaPagamento,
          } : undefined,
        };

        setDadosRecibo(dadosParaRecibo);
        setDialogReciboAberto(true);
      }

      // Limpar formulário
      setItensCarrinho([]);
      setClienteSelecionado(null);
      setDescontoValor(0);
      setTipoDesconto("valor");
      setFormaPagamento("");
      setNumeroParcelas(2);
      setDataPrevistaRecebimento("");
      setTipoRecebimento("a_vista");
      setNumParcelasReceber(2);
      setDatasParcelasReceber([]);
      setBandeiraSelecionada("");
      setPagamentoDuploAtivo(false);
      setValorPrimeiraPagamento(0);
      setSegundaFormaPagamento("");
      setValorSegundaPagamento(0);
      setDataPrevistaSegundaForma("");
      setTipoRecebimentoSegunda("a_vista");
      setNumParcelasSegunda(2);
      setDatasParcelasSegunda([]);
    } catch (error: any) {
      console.error("Erro ao finalizar venda:", error);
      toast({
        title: "Erro ao finalizar venda",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setFinalizando(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Carregando...
      </div>
    );
  }

  const subtotal = calcularSubtotal();
  const total = calcularTotal();

  return (
    <AppLayout>
      <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-auto">
        <div className="mb-6 sm:mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold mb-1">PDV - Frente de Caixa</h1>
            <p className="text-muted-foreground text-sm sm:text-base">Sistema de ponto de venda</p>
          </div>
          <div className="flex items-center gap-2">
            {!caixaEstaAberto ? (
              <Button
                variant="outline"
                size="sm"
                className="gap-2 border-green-500 text-green-600 hover:bg-green-50"
                onClick={() => setDialogAberturaCaixaAberto(true)}
              >
                <DollarSign className="h-4 w-4" />
                <span className="hidden sm:inline">Abrir Caixa</span>
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="gap-2 border-red-500 text-red-600 hover:bg-red-50"
                onClick={() => setDialogFechamentoCaixaAberto(true)}
              >
                <XCircle className="h-4 w-4" />
                <span className="hidden sm:inline">Fechar Caixa</span>
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setDialogStatusCaixaAberto(true)}
            >
              <Info className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => setDialogHistoricoCaixasAberto(true)}
            >
              <History className="h-4 w-4" />
              <span className="hidden sm:inline">Histórico</span>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Settings className="h-4 w-4" />
                  <span className="hidden sm:inline">Configurações</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setDialogLayoutAberto(true)}>
                  <Layout className="h-4 w-4 mr-2" />
                  Layout de Impressão
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setDialogTaxasCartaoAberto(true)}>
                  <CreditCard className="h-4 w-4 mr-2" />
                  Taxas de Cartão
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Formulário de venda */}
          <div className="lg:col-span-2 space-y-4 sm:space-y-6">
            <Card className="p-4 sm:p-6">
              <h2 className="text-lg sm:text-xl font-semibold mb-4">Dados do Cliente</h2>
              <SelecionadorCliente
                clientes={clientes}
                clienteSelecionado={clienteSelecionado}
                onClienteChange={setClienteSelecionado}
                onCriarCliente={async (dados) => {
                  const cliente = await criarCliente({
                    nome: dados.nome,
                    telefone: dados.telefone || undefined,
                    cpf: dados.cpf || undefined,
                    endereco: dados.endereco || undefined,
                  });
                  return cliente;
                }}
              />
            </Card>

            <Card className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                <h2 className="text-lg sm:text-xl font-semibold">Itens da Venda</h2>
                <Button size="sm" onClick={() => setDialogItemAberto(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  <span className="hidden xs:inline">Adicionar</span> Item
                </Button>
              </div>

              {itensCarrinho.length === 0 ? (
                <div className="text-center text-muted-foreground py-8 sm:py-12">
                  <ShoppingCart className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-sm sm:text-base">Nenhum item adicionado ainda</p>
                  <p className="text-xs sm:text-sm mt-1">
                    Clique em "Adicionar Item" para começar
                  </p>
                </div>
              ) : (
                <div className="space-y-2 sm:space-y-3">
                  {itensCarrinho.map((item) => (
                    <ItemCarrinho
                      key={item.id}
                      item={item}
                      onRemover={removerItem}
                      onAtualizarQuantidade={atualizarQuantidade}
                    />
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Resumo da venda */}
          <div className="space-y-4 sm:space-y-6">
            <Card className="p-4 sm:p-6 lg:sticky lg:top-6">
              <h2 className="text-lg sm:text-xl font-semibold mb-4">Resumo</h2>

              <div className="space-y-3 mb-4 sm:mb-6">
                <div className="flex justify-between text-sm items-center">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium">{formatCurrency(subtotal)}</span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm items-center">
                    <span className="text-muted-foreground whitespace-nowrap">Desconto</span>
                    <div className="flex items-center gap-1">
                      <Select value={tipoDesconto} onValueChange={(v) => setTipoDesconto(v as "valor" | "porcentagem")}>
                        <SelectTrigger className="w-16 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="valor">R$</SelectItem>
                          <SelectItem value="porcentagem">%</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        min="0"
                        max={tipoDesconto === "porcentagem" ? 100 : subtotal}
                        value={descontoValor}
                        onChange={(e) => {
                          const val = Number(e.target.value) || 0;
                          const maxVal = tipoDesconto === "porcentagem" ? 100 : subtotal;
                          setDescontoValor(Math.min(maxVal, Math.max(0, val)));
                        }}
                        className="w-20 h-8 text-right"
                      />
                    </div>
                  </div>
                  {calcularDescontoReal() > 0 && (
                    <div className="text-xs text-muted-foreground text-right">
                      Desconto: -{formatCurrency(calcularDescontoReal())}
                    </div>
                  )}
                </div>

                <div className="border-t pt-3 flex justify-between items-center">
                  <span className="font-semibold">Total</span>
                  <span className="text-xl sm:text-2xl font-bold">
                    {formatCurrency(total)}
                  </span>
                </div>
              </div>

              <div className="space-y-4 mb-6">
                <div className="space-y-2">
                  <Label>Forma de Pagamento *</Label>
                  <Select value={formaPagamento} onValueChange={(value) => {
                    setFormaPagamento(value);
                    setBandeiraSelecionada("");
                    if (value !== "a_receber") {
                      setDataPrevistaRecebimento("");
                      setTipoRecebimento("a_vista");
                      setNumParcelasReceber(2);
                      setDatasParcelasReceber([]);
                    }
                    if (value !== "credito_parcelado") {
                      setNumeroParcelas(2);
                    }
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dinheiro">Dinheiro</SelectItem>
                      <SelectItem value="pix">PIX</SelectItem>
                      <SelectItem value="debito">Débito</SelectItem>
                      <SelectItem value="credito">Crédito</SelectItem>
                      <SelectItem value="credito_parcelado">
                        Crédito Parcelado
                      </SelectItem>
                      <SelectItem value="a_receber">A Receber</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {formaPagamento === "credito_parcelado" && (
                  <div className="space-y-2">
                    <Label>Número de Parcelas *</Label>
                    <Select value={String(numeroParcelas)} onValueChange={(v) => setNumeroParcelas(Number(v))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                          <SelectItem key={n} value={String(n)}>
                            {n}x de {formatCurrency(calcularTotal() / n)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Seletor de Bandeira de Cartão */}
                {(() => {
                  const taxaSel = taxasAtivas.find(t => t.id === bandeiraSelecionada);
                  const taxaCalc = taxaSel ? calcularTaxa(taxaSel, formaPagamento, numeroParcelas, total) : { percentual: 0, valor: 0 };
                  return (
                    <SeletorBandeiraCartao
                      taxasAtivas={taxasAtivas}
                      bandeiraSelecionada={bandeiraSelecionada}
                      onBandeiraChange={setBandeiraSelecionada}
                      formaPagamento={formaPagamento}
                      numeroParcelas={numeroParcelas}
                      valorTotal={total}
                      taxaCalculada={taxaCalc}
                    />
                  );
                })()}
                
                {formaPagamento && formaPagamento !== "credito_parcelado" && (
                  <PagamentoDuplo
                    valorTotal={total}
                    formaPagamento={formaPagamento}
                    numeroParcelas={numeroParcelas}
                    onPagamentoDuploChange={(dados) => {
                      setPagamentoDuploAtivo(dados.ativo);
                      setValorPrimeiraPagamento(dados.valorPrimeira);
                      setSegundaFormaPagamento(dados.segundaForma);
                      setValorSegundaPagamento(dados.valorSegunda);
                      setDataPrevistaSegundaForma(dados.dataPrevistaSegunda || "");
                      setTipoRecebimentoSegunda(dados.tipoRecebimentoSegunda || "a_vista");
                      setNumParcelasSegunda(dados.numParcelasSegunda || 2);
                      setDatasParcelasSegunda(dados.datasParcelasSegunda || []);
                    }}
                  />
                )}

                {formaPagamento === "a_receber" && (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label>Tipo de Recebimento *</Label>
                      <Select value={tipoRecebimento} onValueChange={(v) => {
                        setTipoRecebimento(v as "a_vista" | "parcelado");
                        if (v === "a_vista") {
                          setDatasParcelasReceber([]);
                        } else {
                          // Inicializar datas das parcelas
                          const datas = Array.from({ length: numParcelasReceber }, () => "");
                          setDatasParcelasReceber(datas);
                        }
                      }}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="a_vista">1x (À Vista)</SelectItem>
                          <SelectItem value="parcelado">Parcelado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {tipoRecebimento === "a_vista" && (
                      <div className="space-y-2">
                        <Label>Data Prevista de Recebimento *</Label>
                        <Input
                          type="date"
                          value={dataPrevistaRecebimento}
                          onChange={(e) => setDataPrevistaRecebimento(e.target.value)}
                          min={new Date().toISOString().split("T")[0]}
                        />
                      </div>
                    )}

                    {tipoRecebimento === "parcelado" && (
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <Label>Número de Parcelas *</Label>
                          <Select value={String(numParcelasReceber)} onValueChange={(v) => {
                            const num = Number(v);
                            setNumParcelasReceber(num);
                            const datas = Array.from({ length: num }, (_, i) => datasParcelasReceber[i] || "");
                            setDatasParcelasReceber(datas);
                          }}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                                <SelectItem key={n} value={String(n)}>
                                  {n}x de {formatCurrency(calcularTotal() / n)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label>Datas de Recebimento *</Label>
                          <div className="space-y-2 max-h-48 overflow-y-auto">
                            {Array.from({ length: numParcelasReceber }).map((_, idx) => (
                              <div key={idx} className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground w-16 shrink-0">
                                  {idx + 1}ª parcela
                                </span>
                                <Input
                                  type="date"
                                  value={datasParcelasReceber[idx] || ""}
                                  onChange={(e) => {
                                    const novasDatas = [...datasParcelasReceber];
                                    novasDatas[idx] = e.target.value;
                                    setDatasParcelasReceber(novasDatas);
                                  }}
                                  min={new Date().toISOString().split("T")[0]}
                                  className="flex-1"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {!caixaEstaAberto && (
                <p className="text-xs text-center text-muted-foreground mb-2">
                  Abra o caixa para finalizar vendas
                </p>
              )}
              <Button
                className="w-full"
                size="lg"
                onClick={finalizarVenda}
                disabled={finalizando || itensCarrinho.length === 0 || !caixaEstaAberto}
              >
                {finalizando ? "Finalizando..." : "Finalizar Venda"}
              </Button>
            </Card>
          </div>
        </div>
      </main>

      <DialogSelecionarItem
        open={dialogItemAberto}
        onOpenChange={setDialogItemAberto}
        onAdicionarItem={adicionarItem}
      />

      <DialogReciboPDV
        open={dialogReciboAberto}
        onOpenChange={setDialogReciboAberto}
        dados={dadosRecibo}
      />

      <DialogConfiguracaoLayoutPDV
        open={dialogLayoutAberto}
        onOpenChange={setDialogLayoutAberto}
      />

      <Dialog open={dialogTaxasCartaoAberto} onOpenChange={setDialogTaxasCartaoAberto}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <ConfiguracaoTaxasCartao />
        </DialogContent>
      </Dialog>

      <DialogAberturaCaixa
        open={dialogAberturaCaixaAberto}
        onOpenChange={setDialogAberturaCaixaAberto}
        onCaixaAberto={(_caixa: Caixa) => { setDialogAberturaCaixaAberto(false); carregarCaixaAtual(); }}
      />

      {caixaAtual && (
        <DialogFechamentoCaixa
          open={dialogFechamentoCaixaAberto}
          onOpenChange={setDialogFechamentoCaixaAberto}
          caixa={caixaAtual}
          onCaixaFechado={() => { setDialogFechamentoCaixaAberto(false); carregarCaixaAtual(); }}
        />
      )}

      <DialogHistoricoCaixas
        open={dialogHistoricoCaixasAberto}
        onOpenChange={setDialogHistoricoCaixasAberto}
      />

      <DialogStatusCaixa
        open={dialogStatusCaixaAberto}
        onOpenChange={setDialogStatusCaixaAberto}
        caixaAtual={caixaAtual}
        caixaEstaAberto={caixaEstaAberto}
        onAbrirCaixa={() => {
          setDialogStatusCaixaAberto(false);
          setDialogAberturaCaixaAberto(true);
        }}
        onFecharCaixa={() => {
          setDialogStatusCaixaAberto(false);
          setDialogFechamentoCaixaAberto(true);
        }}
      />
    </AppLayout>
  );
};

export default PDV;
