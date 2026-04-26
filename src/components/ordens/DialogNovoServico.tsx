import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { formatCurrency } from "@/lib/formatters";
import { useFornecedores } from "@/hooks/useFornecedores";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Calendar, Package, User, CreditCard, AlertCircle, CheckCircle2, Plus } from "lucide-react";
import { toast } from "sonner";
import { DialogCadastroFornecedor } from "@/components/fornecedores/DialogCadastroFornecedor";
import { FormularioFornecedor } from "@/types/fornecedor";

export interface ServicoComFornecedor {
  nome: string;
  custo: number;
  preco: number;
  fornecedor_id?: string;
  fornecedor_nome?: string;
  status_pagamento: 'pago' | 'a_pagar';
  data_pagamento?: string;
}

interface DialogNovoServicoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCriar: (servico: ServicoComFornecedor) => void;
}

export const DialogNovoServico = ({ open, onOpenChange, onCriar }: DialogNovoServicoProps) => {
  const [nome, setNome] = useState("");
  const [custo, setCusto] = useState("");
  const [preco, setPreco] = useState("");
  const [lucro, setLucro] = useState(0);
  const [fornecedorId, setFornecedorId] = useState<string>("");
  const [statusPagamento, setStatusPagamento] = useState<'pago' | 'a_pagar'>('pago');
  const [dataPagamento, setDataPagamento] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dialogFornecedorOpen, setDialogFornecedorOpen] = useState(false);

  const { fornecedores, loading: loadingFornecedores, criarFornecedor, refetch: refetchFornecedores } = useFornecedores();

  // Função para criar conta diretamente sem usar o hook
  const criarContaAPagar = async (dados: {
    nome: string;
    tipo: 'pagar' | 'receber';
    valor: number;
    data: string;
    status: 'pendente' | 'pago' | 'recebido';
    recorrente: boolean;
    categoria?: string;
    descricao?: string;
    fornecedor_id?: string;
  }) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

        const { error } = await supabase.from("contas").insert({
        ...dados,
        user_id: user.id,
      } as any);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error("Erro ao cadastrar conta:", error);
      return false;
    }
  };

  useEffect(() => {
    const custoNum = parseFloat(custo) || 0;
    const precoNum = parseFloat(preco) || 0;
    setLucro(precoNum - custoNum);
  }, [custo, preco]);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setNome("");
      setCusto("");
      setPreco("");
      setLucro(0);
      setFornecedorId("");
      setStatusPagamento('pago');
      setDataPagamento(format(new Date(), 'yyyy-MM-dd'));
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!nome || !custo || !preco) {
      return;
    }

    setIsSubmitting(true);

    try {
      const custoNum = parseFloat(custo);
      const fornecedorSelecionado = fornecedores.find(f => f.id === fornecedorId);

      // Se status é "a_pagar" e tem fornecedor, criar conta a pagar
      if (statusPagamento === 'a_pagar' && custoNum > 0) {
        const sucesso = await criarContaAPagar({
          nome: `Peça: ${nome}${fornecedorSelecionado ? ` - ${fornecedorSelecionado.nome}` : ''}`,
          tipo: 'pagar',
          valor: custoNum,
          data: dataPagamento,
          status: 'pendente',
          recorrente: false,
          categoria: 'Fornecedores',
          descricao: `Compra de peça para serviço: ${nome}`,
          fornecedor_id: fornecedorId || undefined,
        });

        if (sucesso) {
          toast.success("Conta a pagar criada automaticamente!");
        }
      }

      onCriar({
        nome,
        custo: custoNum,
        preco: parseFloat(preco),
        fornecedor_id: fornecedorId || undefined,
        fornecedor_nome: fornecedorSelecionado?.nome,
        status_pagamento: statusPagamento,
        data_pagamento: dataPagamento,
      });

      onOpenChange(false);
    } catch (error) {
      console.error("Erro ao criar serviço:", error);
      toast.error("Erro ao criar serviço");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCriarFornecedor = async (dados: FormularioFornecedor): Promise<boolean> => {
    try {
      const sucesso = await criarFornecedor(dados);
      if (!sucesso) return false;

      // Recarregar lista de fornecedores
      await refetchFornecedores();

      // Buscar o fornecedor recém-criado e selecioná-lo (sem quebrar caso haja mais de um com o mesmo nome)
      const { data, error } = await supabase
        .from("fornecedores")
        .select("id, nome")
        .eq("nome", dados.nome)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Erro ao buscar fornecedor recém-criado:", error);
        // Não quebrar o fluxo da OS por causa disso
        toast.success("Fornecedor cadastrado com sucesso!");
        return true;
      }

      if (data?.id) {
        setFornecedorId(data.id);
        toast.success(`Fornecedor "${dados.nome}" cadastrado e selecionado!`);
      } else {
        toast.success("Fornecedor cadastrado com sucesso!");
      }

      return true;
    } catch (error) {
      console.error("Erro no fluxo de cadastro de fornecedor:", error);
      toast.error("Não foi possível cadastrar o fornecedor.");
      return false;
    }
  };

  const fornecedoresAtivos = fornecedores.filter(f => f.ativo);

  return (
  <>
    <Dialog open={open} onOpenChange={onOpenChange} modal={!dialogFornecedorOpen}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Criar Novo Serviço
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-4">
          {/* Nome do Serviço */}
          <div className="space-y-2">
            <Label htmlFor="nome-servico">Nome do Serviço *</Label>
            <Input
              id="nome-servico"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Troca de Tela"
            />
          </div>

          {/* Custo e Preço */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="custo-servico">Custo da Peça *</Label>
              <Input
                id="custo-servico"
                type="number"
                step="0.01"
                value={custo}
                onChange={(e) => setCusto(e.target.value)}
                placeholder="0,00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="preco-servico">Preço do Serviço *</Label>
              <Input
                id="preco-servico"
                type="number"
                step="0.01"
                value={preco}
                onChange={(e) => setPreco(e.target.value)}
                placeholder="0,00"
              />
            </div>
          </div>

          {/* Lucro */}
          <div className={`p-3 rounded-md border ${lucro >= 0 ? 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800' : 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800'}`}>
            <p className={`text-sm font-medium ${lucro >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
              Lucro: {formatCurrency(lucro)}
            </p>
          </div>

          {/* Fornecedor */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Fornecedor da Peça
            </Label>
            <div className="flex gap-2">
              <Select value={fornecedorId || "none"} onValueChange={(value) => setFornecedorId(value === "none" ? "" : value)}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Selecione um fornecedor (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {loadingFornecedores ? (
                    <SelectItem value="loading" disabled>Carregando...</SelectItem>
                  ) : fornecedoresAtivos.length === 0 ? (
                    <SelectItem value="empty" disabled>Nenhum fornecedor cadastrado</SelectItem>
                  ) : (
                    fornecedoresAtivos.map((fornecedor) => (
                      <SelectItem key={fornecedor.id} value={fornecedor.id}>
                        {fornecedor.nome}
                        {fornecedor.nome_fantasia && ` (${fornecedor.nome_fantasia})`}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setDialogFornecedorOpen(true)}
                title="Cadastrar novo fornecedor"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Status de Pagamento */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Status do Pagamento da Peça
            </Label>
            <RadioGroup
              value={statusPagamento}
              onValueChange={(value) => setStatusPagamento(value as 'pago' | 'a_pagar')}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="pago" id="pago" />
                <Label 
                  htmlFor="pago" 
                  className="flex items-center gap-1.5 cursor-pointer text-green-700 dark:text-green-400"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Já Pago
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="a_pagar" id="a_pagar" />
                <Label 
                  htmlFor="a_pagar" 
                  className="flex items-center gap-1.5 cursor-pointer text-orange-700 dark:text-orange-400"
                >
                  <AlertCircle className="h-4 w-4" />
                  A Pagar
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Data do Pagamento */}
          <div className="space-y-2">
            <Label htmlFor="data-pagamento" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {statusPagamento === 'pago' ? 'Data do Pagamento' : 'Data de Vencimento'}
            </Label>
            <Input
              id="data-pagamento"
              type="date"
              value={dataPagamento}
              onChange={(e) => setDataPagamento(e.target.value)}
            />
          </div>

          {/* Aviso sobre conta a pagar */}
          {statusPagamento === 'a_pagar' && parseFloat(custo) > 0 && (
            <div className="bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-md p-3">
              <p className="text-sm text-orange-700 dark:text-orange-400 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>
                  Uma conta a pagar será criada automaticamente no valor de{' '}
                  <strong>{formatCurrency(parseFloat(custo) || 0)}</strong> com vencimento em{' '}
                  <strong>{format(new Date(dataPagamento + 'T12:00:00'), 'dd/MM/yyyy')}</strong>
                </span>
              </p>
            </div>
          )}

          {/* Botões */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={!nome || !custo || !preco || isSubmitting}
            >
              {isSubmitting ? "Criando..." : "Criar e Adicionar"}
            </Button>
          </div>
        </div>
      </DialogContent>

    </Dialog>

    {/* Dialog para cadastrar novo fornecedor - fora do Dialog principal para evitar conflito */}
    {dialogFornecedorOpen && (
      <DialogCadastroFornecedor
        open={dialogFornecedorOpen}
        onOpenChange={(value) => {
          setDialogFornecedorOpen(value);
        }}
        onSubmit={handleCriarFornecedor}
      />
    )}
  </>
  );
};