import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { formatCurrency } from "@/lib/formatters";
import { Separator } from "@/components/ui/separator";
import { DollarSign, CreditCard, Smartphone, Banknote, Wallet, Package, Calendar, CalendarIcon, Plus, Trash2, Truck, Gift, MoreHorizontal } from "lucide-react";
import { ProdutoUtilizado, CustoAdicional } from "@/types/ordem-servico";
import { SeletorBandeiraCartao } from "@/components/pdv/SeletorBandeiraCartao";
import { TaxaCartao } from "@/hooks/useTaxasCartao";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

interface Servico {
  id: string;
  nome: string;
  preco: number;
}

interface ResumoFinanceiroProps {
  servicos: Servico[];
  produtos?: ProdutoUtilizado[];
  custosAdicionais?: CustoAdicional[];
  onCustosAdicionaisChange?: (custos: CustoAdicional[]) => void;
  formaPagamento: string;
  onFormaPagamentoChange: (forma: string) => void;
  desconto: number;
  onDescontoChange: (desconto: number) => void;
  valorEntrada: number;
  onValorEntradaChange: (valor: number) => void;
  numeroParcelas?: number;
  onNumeroParcelasChange?: (parcelas: number) => void;
  mostrarEntrada: boolean;
  onMostrarEntradaChange: (mostrar: boolean) => void;
  dataVencimentoPrazo?: Date;
  onDataVencimentoPrazoChange?: (data: Date | undefined) => void;
  semDataDefinida?: boolean;
  onSemDataDefinidaChange?: (sem: boolean) => void;
  // Card fees
  taxasAtivas?: TaxaCartao[];
  bandeiraSelecionada?: string;
  onBandeiraChange?: (id: string) => void;
  taxaCalculada?: { percentual: number; valor: number };
}

const tiposCusto = [
  { value: 'frete', label: 'Frete', icon: Truck },
  { value: 'brinde', label: 'Produto de Brinde', icon: Gift },
  { value: 'outro', label: 'Outro', icon: MoreHorizontal },
];

export const ResumoFinanceiro = ({
  servicos,
  produtos = [],
  custosAdicionais = [],
  onCustosAdicionaisChange,
  formaPagamento,
  onFormaPagamentoChange,
  desconto,
  onDescontoChange,
  valorEntrada,
  onValorEntradaChange,
  numeroParcelas,
  onNumeroParcelasChange,
  mostrarEntrada,
  onMostrarEntradaChange,
  dataVencimentoPrazo,
  onDataVencimentoPrazoChange,
  semDataDefinida = false,
  onSemDataDefinidaChange,
  taxasAtivas = [],
  bandeiraSelecionada = "",
  onBandeiraChange,
  taxaCalculada = { percentual: 0, valor: 0 },
}: ResumoFinanceiroProps) => {
  const totalServicos = servicos.reduce((sum, servico) => sum + servico.preco, 0);
  const totalProdutos = produtos.reduce((sum, produto) => sum + produto.preco_total, 0);
  // Custos repassados ao cliente somam no total
  const totalCustosRepassados = custosAdicionais
    .filter(c => c.repassar_cliente)
    .reduce((sum, c) => sum + c.valor, 0);
  // Custos assumidos pela loja (não somam no total, apenas informativo)
  const totalCustosAssumidos = custosAdicionais
    .filter(c => !c.repassar_cliente)
    .reduce((sum, c) => sum + c.valor, 0);
  const subtotal = totalServicos + totalProdutos + totalCustosRepassados;
  const total = Math.max(0, subtotal - desconto);
  const saldo = Math.max(0, total - valorEntrada);

  const formasPagamento = [
    { value: 'dinheiro', label: 'Dinheiro', icon: Banknote },
    { value: 'pix', label: 'PIX', icon: Smartphone },
    { value: 'debito', label: 'Cartão de Débito', icon: CreditCard },
    { value: 'credito', label: 'Cartão de Crédito', icon: CreditCard },
    { value: 'credito_parcelado', label: 'Crédito Parcelado', icon: Wallet },
    { value: 'a_prazo', label: 'A Prazo', icon: Calendar }
  ];

  const FormaPagamentoIcon = formasPagamento.find(f => f.value === formaPagamento)?.icon || DollarSign;

  const adicionarCusto = () => {
    const novoCusto: CustoAdicional = {
      id: crypto.randomUUID(),
      descricao: '',
      tipo: 'frete',
      valor: 0,
      repassar_cliente: false,
    };
    onCustosAdicionaisChange?.([...custosAdicionais, novoCusto]);
  };

  const atualizarCusto = (id: string, campo: Partial<CustoAdicional>) => {
    const atualizados = custosAdicionais.map(c => c.id === id ? { ...c, ...campo } : c);
    onCustosAdicionaisChange?.(atualizados);
  };

  const removerCusto = (id: string) => {
    onCustosAdicionaisChange?.(custosAdicionais.filter(c => c.id !== id));
  };

  return (
    <Card className="p-2">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <DollarSign className="w-4 h-4" />
          Resumo Financeiro
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {/* Lista de Serviços */}
        {servicos.length > 0 && (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Serviços Selecionados:</Label>
            <div className="space-y-1">
              {servicos.map((servico) => (
                <div key={servico.id} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">• {servico.nome}</span>
                  <span className="font-medium">{formatCurrency(servico.preco)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Lista de Produtos */}
        {produtos.length > 0 && (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <Package className="w-3 h-3" />
              Produtos/Peças Utilizados:
            </Label>
            <div className="space-y-1">
              {produtos.map((produto) => (
                <div key={produto.id} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">• {produto.quantidade}x {produto.nome}</span>
                  <span className="font-medium">{formatCurrency(produto.preco_total)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Custos Adicionais */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground flex items-center gap-1">
              <Truck className="w-3 h-3" />
              Custos Adicionais
            </Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={adicionarCusto}
            >
              <Plus className="w-3 h-3" />
              Adicionar
            </Button>
          </div>

          {custosAdicionais.map((custo) => {
            const TipoIcon = tiposCusto.find(t => t.value === custo.tipo)?.icon || MoreHorizontal;
            return (
              <div key={custo.id} className="border rounded-lg p-3 space-y-2 bg-muted/30">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Select
                    value={custo.tipo}
                    onValueChange={(v) => atualizarCusto(custo.id, { tipo: v as CustoAdicional['tipo'] })}
                  >
                    <SelectTrigger className="h-8 w-full sm:w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {tiposCusto.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          <div className="flex items-center gap-2">
                            <t.icon className="w-3 h-3" />
                            {t.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="Descrição"
                    value={custo.descricao}
                    onChange={(e) => atualizarCusto(custo.id, { descricao: e.target.value })}
                    className="h-8 text-sm flex-1"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 self-end sm:self-auto text-destructive hover:text-destructive"
                    onClick={() => removerCusto(custo.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Label className="text-xs whitespace-nowrap">Valor:</Label>
                    <Input
                      type="number"
                      value={custo.valor}
                      onChange={(e) => atualizarCusto(custo.id, { valor: Math.max(0, Number(e.target.value)) })}
                      className="h-8 text-sm"
                      placeholder="0,00"
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Switch
                      checked={custo.repassar_cliente}
                      onCheckedChange={(checked) => atualizarCusto(custo.id, { repassar_cliente: checked })}
                    />
                    <Label className="text-xs whitespace-nowrap">
                      {custo.repassar_cliente ? (
                        <Badge variant="outline" className="text-xs font-normal border-orange-300 text-orange-600">Cliente paga</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs font-normal border-green-300 text-green-600">Loja assume</Badge>
                      )}
                    </Label>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <Separator />

        {/* Subtotal e Desconto */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal (serviços + produtos):</span>
            <span className="font-medium">{formatCurrency(totalServicos + totalProdutos)}</span>
          </div>
          {totalCustosRepassados > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Custos repassados ao cliente:</span>
              <span className="font-medium text-orange-600">+{formatCurrency(totalCustosRepassados)}</span>
            </div>
          )}
          {totalCustosAssumidos > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Custos assumidos pela loja:</span>
              <span className="font-medium text-green-600">{formatCurrency(totalCustosAssumidos)}</span>
            </div>
          )}
          
          <div className="flex items-center gap-2">
            <Label htmlFor="desconto" className="text-xs whitespace-nowrap">Desconto:</Label>
            <Input
              id="desconto"
              type="number"
              value={desconto}
              onChange={(e) => onDescontoChange(Math.min(subtotal, Math.max(0, Number(e.target.value))))}
              className="h-8 text-sm"
              placeholder="0,00"
              min="0"
              max={subtotal}
              step="0.01"
            />
          </div>
        </div>

        <Separator />

        {/* Total */}
        <div className="flex justify-between text-base font-bold">
          <span>TOTAL:</span>
          <span className="text-primary">{formatCurrency(total)}</span>
        </div>

        <Separator />

        {/* Forma de Pagamento */}
        <div className="space-y-2">
          <Label htmlFor="forma-pagamento" className="text-sm flex items-center gap-2">
            <FormaPagamentoIcon className="w-4 h-4" />
            Forma de Pagamento
          </Label>
          <Select value={formaPagamento} onValueChange={onFormaPagamentoChange}>
            <SelectTrigger id="forma-pagamento" className="h-8">
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {formasPagamento.map((forma) => (
                <SelectItem key={forma.value} value={forma.value}>
                  <div className="flex items-center gap-2">
                    <forma.icon className="w-4 h-4" />
                    {forma.label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Parcelas */}
        {formaPagamento === 'credito_parcelado' && (
          <div className="space-y-2">
            <Label htmlFor="parcelas" className="text-sm">Número de Parcelas</Label>
            <Select 
              value={numeroParcelas?.toString() || '2'} 
              onValueChange={(value) => onNumeroParcelasChange?.(Number(value))}
            >
              <SelectTrigger id="parcelas" className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((num) => (
                  <SelectItem key={num} value={num.toString()}>
                    {num}x de {formatCurrency(total / num)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Seletor de Bandeira de Cartão */}
        {onBandeiraChange && (
          <SeletorBandeiraCartao
            taxasAtivas={taxasAtivas}
            bandeiraSelecionada={bandeiraSelecionada}
            onBandeiraChange={onBandeiraChange}
            formaPagamento={formaPagamento}
            numeroParcelas={numeroParcelas}
            valorTotal={total}
            taxaCalculada={taxaCalculada}
          />
        )}

        {/* Data de Vencimento - A Prazo */}
        {formaPagamento === 'a_prazo' && (
          <div className="space-y-2">
            <Label className="text-sm flex items-center gap-2">
              <CalendarIcon className="w-4 h-4" />
              Data de Vencimento
            </Label>
            
            <div className="flex items-center gap-2">
              <Checkbox
                id="sem-data-definida"
                checked={semDataDefinida}
                onCheckedChange={(checked) => {
                  onSemDataDefinidaChange?.(checked === true);
                  if (checked) onDataVencimentoPrazoChange?.(undefined);
                }}
              />
              <Label htmlFor="sem-data-definida" className="text-sm cursor-pointer">
                Sem data definida
              </Label>
            </div>

            {!semDataDefinida && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full h-8 justify-start text-left font-normal text-sm",
                      !dataVencimentoPrazo && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dataVencimentoPrazo ? format(dataVencimentoPrazo, "dd/MM/yyyy", { locale: ptBR }) : "Selecione a data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={dataVencimentoPrazo}
                    onSelect={onDataVencimentoPrazoChange}
                    disabled={(date) => date < new Date()}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            )}
          </div>
        )}

        {/* Entrada */}
        {total > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id="mostrar-entrada"
                checked={mostrarEntrada}
                onCheckedChange={(checked) => onMostrarEntradaChange(checked === true)}
              />
              <Label htmlFor="mostrar-entrada" className="text-sm cursor-pointer">
                Pagamento com entrada
              </Label>
            </div>

            {mostrarEntrada && (
              <div className="space-y-2 pl-0 sm:pl-6">
                <div className="flex items-center gap-2">
                  <Label htmlFor="valor-entrada" className="text-xs whitespace-nowrap">Entrada:</Label>
                  <Input
                    id="valor-entrada"
                    type="number"
                    value={valorEntrada}
                    onChange={(e) => onValorEntradaChange(Math.min(total, Math.max(0, Number(e.target.value))))}
                    className="h-8 text-sm"
                    placeholder="0,00"
                    min="0"
                    max={total}
                    step="0.01"
                  />
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Saldo a pagar:</span>
                  <span className="font-medium text-primary">{formatCurrency(saldo)}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};