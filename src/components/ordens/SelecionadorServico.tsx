import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Plus, X, Pencil, Check, User, AlertCircle, CheckCircle2, ChevronsUpDown, Package, ChevronDown, ChevronUp, Wrench } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { ValorMonetario } from "@/components/ui/valor-monetario";
import { DialogNovoServico, ServicoComFornecedor } from "./DialogNovoServico";
import { useServicos } from "@/hooks/useServicos";
import { useFuncionarioPermissoes } from "@/hooks/useFuncionarioPermissoes";
import { useFornecedores } from "@/hooks/useFornecedores";
import type { Servico } from "@/types/servico";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

export interface ServicoComPrecoEditado extends Servico {
  precoOriginal?: number;
  precoEditado?: number;
  fornecedor_id?: string;
  fornecedor_nome?: string;
  status_pagamento?: 'pago' | 'a_pagar';
  data_pagamento?: string;
  // Campos para rastreamento de fornecedor/pagamento da peça vinculada ao serviço
  peca_fornecedor_id?: string;
  peca_fornecedor_nome?: string;
  peca_status_pagamento?: 'pago' | 'a_pagar';
  peca_data_pagamento?: string;
  peca_valor?: number;
}

interface SelecionadorServicoProps {
  value: (Servico | ServicoComPrecoEditado)[];
  onChange: (servicos: ServicoComPrecoEditado[]) => void;
}

export const SelecionadorServico = ({ value, onChange }: SelecionadorServicoProps) => {
  const { servicos, criarServico } = useServicos();
  const { isFuncionario, isDonoLoja, permissoes } = useFuncionarioPermissoes();
  const podeCriarServico = isDonoLoja || (isFuncionario && (permissoes?.recursos?.criar_servico_os ?? false));
  const { fornecedores } = useFornecedores();
  const fornecedoresAtivos = fornecedores.filter(f => f.ativo);
  const [open, setOpen] = useState(false);
  const [dialogNovoOpen, setDialogNovoOpen] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [precoEditando, setPrecoEditando] = useState("");
  const [pecaExpandidaId, setPecaExpandidaId] = useState<string | null>(null);
  const [mostrarManual, setMostrarManual] = useState(false);
  const [manualNome, setManualNome] = useState("");
  const [manualCusto, setManualCusto] = useState("");
  const [manualPreco, setManualPreco] = useState("");

  // Garantir que value é tratado como array de ServicoComPrecoEditado
  const servicosValue: ServicoComPrecoEditado[] = value.map(s => ({
    ...s,
    precoOriginal: (s as ServicoComPrecoEditado).precoOriginal ?? s.preco,
    precoEditado: (s as ServicoComPrecoEditado).precoEditado,
  }));

  const handleAdicionarServico = (servicoId: string) => {
    const servico = servicos.find(s => s.id === servicoId);
    if (servico && !servicosValue.find(s => s.id === servico.id)) {
      onChange([...servicosValue, { ...servico, precoOriginal: servico.preco }]);
      setOpen(false);
      // Auto-expandir seção de peça se o serviço tem peça vinculada
      if (servico.peca_id && servico.peca_nome) {
        setPecaExpandidaId(servico.id);
      }
    }
  };

  const handleRemoverServico = (id: string) => {
    onChange(servicosValue.filter(s => s.id !== id));
  };

  const handleIniciarEdicao = (servico: ServicoComPrecoEditado) => {
    setEditandoId(servico.id);
    setPrecoEditando(servico.preco.toString());
  };

  const handleConfirmarEdicao = (id: string) => {
    const novoPreco = parseFloat(precoEditando);
    if (!isNaN(novoPreco) && novoPreco >= 0) {
      onChange(servicosValue.map(s => 
        s.id === id 
          ? { ...s, preco: novoPreco, precoEditado: novoPreco }
          : s
      ));
    }
    setEditandoId(null);
    setPrecoEditando("");
  };

  const handleCancelarEdicao = () => {
    setEditandoId(null);
    setPrecoEditando("");
  };

  const handleCriarServico = async (dados: ServicoComFornecedor) => {
    const dadosServico = {
      nome: dados.nome,
      custo: dados.custo,
      preco: dados.preco,
      quantidade: 0,
    };
    const novoServico = await criarServico(dadosServico as any);
    if (novoServico) {
      onChange([
        ...servicosValue, 
        { 
          ...novoServico, 
          precoOriginal: novoServico.preco,
          fornecedor_id: dados.fornecedor_id,
          fornecedor_nome: dados.fornecedor_nome,
          status_pagamento: dados.status_pagamento,
          data_pagamento: dados.data_pagamento,
        }
      ]);
    }
    setDialogNovoOpen(false);
  };

  const handleAdicionarManual = () => {
    if (!manualNome.trim() || !manualPreco) return;
    const custo = parseFloat(manualCusto) || 0;
    const preco = parseFloat(manualPreco) || 0;
    const lucro = preco - custo;
    const id = `manual_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const servicoManual: ServicoComPrecoEditado = {
      id,
      nome: manualNome.trim(),
      custo,
      preco,
      lucro,
      quantidade: 1,
      created_at: new Date().toISOString(),
      precoOriginal: preco,
    };
    onChange([...servicosValue, servicoManual]);
    setManualNome("");
    setManualCusto("");
    setManualPreco("");
    setMostrarManual(false);
  };

  const total = servicosValue.reduce((sum, s) => sum + s.preco, 0);

  // Filtrar serviços já adicionados
  const servicosDisponiveis = servicos.filter(s => !servicosValue.find(sv => sv.id === s.id));

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <Label htmlFor="servico">Selecionar Serviço</Label>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={open}
                className="w-full justify-between font-normal"
              >
                Digite para buscar serviço...
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)] p-0" align="start">
              <Command>
                <CommandInput placeholder="Buscar serviço..." />
                <CommandList>
                  <CommandEmpty>Nenhum serviço encontrado.</CommandEmpty>
                  <CommandGroup>
                    {servicosDisponiveis.map((servico) => (
                      <CommandItem
                        key={servico.id}
                        value={servico.nome}
                        onSelect={() => handleAdicionarServico(servico.id)}
                      >
                        <Check className="mr-2 h-4 w-4 opacity-0" />
                        <span>{servico.nome}</span>
                        <span className="text-muted-foreground ml-auto">
                           <ValorMonetario valor={servico.preco} tipo="preco" />
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
        {podeCriarServico && (
          <div className="flex gap-2 sm:items-end">
            <Button 
              type="button" 
              variant="outline"
              onClick={() => setDialogNovoOpen(true)}
              className="flex-1 sm:flex-none"
            >
              <Plus className="w-4 h-4 mr-2" />
              Novo
            </Button>
          </div>
        )}
        <Button
          type="button"
          variant="outline"
          onClick={() => setMostrarManual(!mostrarManual)}
          className="flex-1 sm:flex-none"
        >
          <Wrench className="w-4 h-4 mr-2" />
          Avulso
        </Button>
      </div>

      {/* Formulário de serviço manual/avulso */}
      {mostrarManual && (
        <Card className="p-4 border-dashed">
          <Label className="mb-3 block text-sm font-medium">Serviço Manual / Avulso</Label>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Nome do Serviço *</Label>
              <Input
                placeholder="Ex: Troca de tela"
                value={manualNome}
                onChange={(e) => setManualNome(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Custo (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  value={manualCusto}
                  onChange={(e) => setManualCusto(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs">Valor de Venda (R$) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  value={manualPreco}
                  onChange={(e) => setManualPreco(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs">Lucro (R$)</Label>
                <div className="h-10 flex items-center px-3 rounded-md border bg-muted text-sm">
                  {formatCurrency((parseFloat(manualPreco) || 0) - (parseFloat(manualCusto) || 0))}
                </div>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="ghost" size="sm" onClick={() => { setMostrarManual(false); setManualNome(""); setManualCusto(""); setManualPreco(""); }}>
                Cancelar
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={!manualNome.trim() || !manualPreco}
                onClick={handleAdicionarManual}
              >
                <Plus className="w-4 h-4 mr-2" />
                Adicionar
              </Button>
            </div>
          </div>
        </Card>
      )}

      {servicosValue.length > 0 && (
        <Card className="p-4">
          <Label className="mb-3 block">Serviços Selecionados</Label>
          <div className="space-y-2">
            {servicosValue.map((servico) => (
              <div key={servico.id} className="p-3 bg-muted rounded-lg space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">{servico.nome}</p>
                      {servico.id.startsWith('manual_') && (
                        <Badge variant="outline" className="text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-purple-300">
                          Avulso
                        </Badge>
                      )}
                    </div>
                    
                    {/* Fornecedor e Status de Pagamento do Serviço */}
                    {(servico.fornecedor_nome || servico.status_pagamento) && (
                      <div className="flex flex-wrap items-center gap-2">
                        {servico.fornecedor_nome && (
                          <Badge variant="outline" className="text-xs flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {servico.fornecedor_nome}
                          </Badge>
                        )}
                        {servico.status_pagamento && (
                          <Badge 
                            variant={servico.status_pagamento === 'pago' ? 'default' : 'secondary'}
                            className={`text-xs flex items-center gap-1 ${
                              servico.status_pagamento === 'pago' 
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                                : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                            }`}
                          >
                            {servico.status_pagamento === 'pago' ? (
                              <>
                                <CheckCircle2 className="h-3 w-3" />
                                Pago
                              </>
                            ) : (
                              <>
                                <AlertCircle className="h-3 w-3" />
                                A Pagar
                              </>
                            )}
                          </Badge>
                        )}
                      </div>
                    )}

                    {/* Peça/Fornecedor - Badge clicável para expandir */}
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge 
                        variant="outline" 
                        className="text-xs flex items-center gap-1 cursor-pointer hover:bg-accent"
                        onClick={() => setPecaExpandidaId(pecaExpandidaId === servico.id ? null : servico.id)}
                      >
                        <Package className="h-3 w-3" />
                        {servico.peca_fornecedor_nome 
                          ? `Fornecedor: ${servico.peca_fornecedor_nome}` 
                          : 'Vincular Fornecedor/Peça'}
                        {pecaExpandidaId === servico.id ? (
                          <ChevronUp className="h-3 w-3 ml-1" />
                        ) : (
                          <ChevronDown className="h-3 w-3 ml-1" />
                        )}
                      </Badge>
                      {servico.peca_status_pagamento && (
                        <Badge 
                          variant={servico.peca_status_pagamento === 'pago' ? 'default' : 'secondary'}
                          className={`text-xs flex items-center gap-1 ${
                            servico.peca_status_pagamento === 'pago' 
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                              : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                          }`}
                        >
                          {servico.peca_status_pagamento === 'pago' ? (
                            <>
                              <CheckCircle2 className="h-3 w-3" />
                              Peça Paga
                            </>
                          ) : (
                            <>
                              <AlertCircle className="h-3 w-3" />
                              Peça A Pagar
                            </>
                          )}
                        </Badge>
                      )}
                    </div>

                    {editandoId === servico.id ? (
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-sm text-muted-foreground">R$</span>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={precoEditando}
                          onChange={(e) => setPrecoEditando(e.target.value)}
                          className="h-8 w-24"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleConfirmarEdicao(servico.id);
                            } else if (e.key === 'Escape') {
                              handleCancelarEdicao();
                            }
                          }}
                        />
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-100"
                          onClick={() => handleConfirmarEdicao(servico.id)}
                        >
                          <Check className="w-4 h-4" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-muted-foreground hover:text-foreground"
                          onClick={handleCancelarEdicao}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-muted-foreground"><ValorMonetario valor={servico.preco} tipo="preco" /></p>
                        {servico.precoEditado !== undefined && servico.precoOriginal !== servico.preco && (
                          <span className="text-xs text-muted-foreground line-through">
                            <ValorMonetario valor={servico.precoOriginal || 0} tipo="preco" />
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  {editandoId !== servico.id && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleIniciarEdicao(servico)}
                        className="text-muted-foreground hover:text-foreground p-1"
                        title="Editar valor"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoverServico(servico.id)}
                        className="text-destructive hover:text-destructive/80 p-1"
                        title="Remover serviço"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Seção expandida para configurar fornecedor/pagamento da peça */}
                {pecaExpandidaId === servico.id && (
                  <div className="mt-2 p-3 bg-background rounded-md border space-y-3">
                    <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                      <Package className="h-3 w-3" />
                      Fornecedor e Pagamento da Peça
                    </p>

                    {/* Fornecedor da Peça */}
                    <div className="space-y-1">
                      <Label className="text-xs">Fornecedor da Peça</Label>
                      <Select 
                        value={servico.peca_fornecedor_id || "none"} 
                        onValueChange={(value) => {
                          const forn = fornecedoresAtivos.find(f => f.id === value);
                          onChange(servicosValue.map(s => 
                            s.id === servico.id 
                              ? { ...s, peca_fornecedor_id: value === "none" ? undefined : value, peca_fornecedor_nome: forn?.nome }
                              : s
                          ));
                        }}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Selecione um fornecedor" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Nenhum</SelectItem>
                          {fornecedoresAtivos.map((f) => (
                            <SelectItem key={f.id} value={f.id}>
                              {f.nome}{f.nome_fantasia ? ` (${f.nome_fantasia})` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Valor da Peça */}
                    <div className="space-y-1">
                      <Label className="text-xs">Valor da Peça (custo)</Label>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">R$</span>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0,00"
                          className="h-8 text-xs w-32"
                          value={servico.peca_valor ?? servico.custo ?? ''}
                          onChange={(e) => {
                            const val = e.target.value === '' ? undefined : parseFloat(e.target.value);
                            onChange(servicosValue.map(s => 
                              s.id === servico.id 
                                ? { ...s, peca_valor: val }
                                : s
                            ));
                          }}
                        />
                      </div>
                    </div>

                    {/* Status de Pagamento da Peça */}
                    <div className="space-y-1">
                      <Label className="text-xs">Status do Pagamento da Peça</Label>
                      <RadioGroup
                        value={servico.peca_status_pagamento || 'pago'}
                        onValueChange={(value) => {
                          onChange(servicosValue.map(s => 
                            s.id === servico.id 
                              ? { 
                                  ...s, 
                                  peca_status_pagamento: value as 'pago' | 'a_pagar',
                                  peca_data_pagamento: s.peca_data_pagamento || format(new Date(), 'yyyy-MM-dd'),
                                }
                              : s
                          ));
                        }}
                        className="flex gap-4"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="pago" id={`peca-pago-${servico.id}`} />
                          <Label 
                            htmlFor={`peca-pago-${servico.id}`} 
                            className="flex items-center gap-1 cursor-pointer text-xs text-green-700 dark:text-green-400"
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            Já Pago
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="a_pagar" id={`peca-a_pagar-${servico.id}`} />
                          <Label 
                            htmlFor={`peca-a_pagar-${servico.id}`} 
                            className="flex items-center gap-1 cursor-pointer text-xs text-orange-700 dark:text-orange-400"
                          >
                            <AlertCircle className="h-3 w-3" />
                            A Pagar
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>

                    {/* Data do Pagamento/Vencimento da Peça */}
                    <div className="space-y-1">
                      <Label className="text-xs">
                        {(servico.peca_status_pagamento || 'pago') === 'pago' ? 'Data do Pagamento' : 'Data de Vencimento'}
                      </Label>
                      <Input
                        type="date"
                        className="h-8 text-xs"
                        value={servico.peca_data_pagamento || format(new Date(), 'yyyy-MM-dd')}
                        onChange={(e) => {
                          onChange(servicosValue.map(s => 
                            s.id === servico.id 
                              ? { ...s, peca_data_pagamento: e.target.value }
                              : s
                          ));
                        }}
                      />
                    </div>

                    {/* Aviso sobre conta a pagar */}
                    {(servico.peca_status_pagamento === 'a_pagar') && (servico.peca_valor ?? servico.custo ?? 0) > 0 && (
                      <div className="bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-md p-2">
                        <p className="text-xs text-orange-700 dark:text-orange-400 flex items-start gap-1">
                          <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                          <span>
                            Uma conta a pagar será criada no valor de{' '}
                            <strong><ValorMonetario valor={servico.peca_valor ?? servico.custo ?? 0} /></strong>
                          </span>
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t">
            <div className="flex justify-between items-center">
              <span className="font-semibold">Total:</span>
              <span className="text-lg font-bold"><ValorMonetario valor={total} tipo="preco" /></span>
            </div>
          </div>
        </Card>
      )}

      <DialogNovoServico
        open={dialogNovoOpen}
        onOpenChange={setDialogNovoOpen}
        onCriar={handleCriarServico}
      />
    </div>
  );
};