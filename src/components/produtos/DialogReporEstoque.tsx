import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ItemEstoque } from '@/types/produto';
import { PackagePlus } from 'lucide-react';
import { useFornecedores } from '@/hooks/useFornecedores';
import { useFormasPagamentoCustomizadas } from '@/hooks/useFormasPagamentoCustomizadas';
import { useFuncionarioPermissoes } from '@/hooks/useFuncionarioPermissoes';
import type { DadosCompraEntrada } from '@/hooks/useProdutos';
import {
  MAX_OBSERVACAO,
  calcularPreviaEntrada,
  formatarReais,
  lerNumero,
  montarEntradaEstoque,
} from '@/lib/estoque/montarEntradaEstoque';

// Mesma lista da baixa de contas (DialogConfirmarBaixa): grava em contas.forma_pagamento.
const FORMAS_PADRAO = [
  { value: 'dinheiro', label: 'Dinheiro' },
  { value: 'pix', label: 'PIX' },
  { value: 'debito', label: 'Débito' },
  { value: 'credito', label: 'Crédito' },
  { value: 'credito_parcelado', label: 'Crédito Parcelado' },
];

interface DialogReporEstoqueProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: ItemEstoque | null;
  onConfirmar: (id: string, tipo: 'produto' | 'peca', quantidade: number, compra?: DadosCompraEntrada) => Promise<boolean>;
}

export const DialogReporEstoque = ({ open, onOpenChange, item, onConfirmar }: DialogReporEstoqueProps) => {
  const { fornecedores } = useFornecedores();
  const { formas: formasCustomizadas } = useFormasPagamentoCustomizadas();
  const { podeVerCustos, podeVerContasPagarReceber } = useFuncionarioPermissoes();
  // Lançar a conta exige custo: sem ver_custos não há como informar o valor.
  const podeLancarConta = podeVerCustos && podeVerContasPagarReceber;

  const [quantidade, setQuantidade] = useState('');
  const [custo, setCusto] = useState('');
  const [fornecedorId, setFornecedorId] = useState('nenhum');
  const [atualizarMedia, setAtualizarMedia] = useState(true);
  const [gerarConta, setGerarConta] = useState(false);
  const [situacaoPagamento, setSituacaoPagamento] = useState<'a_pagar' | 'pago'>('a_pagar');
  const [formaPagamento, setFormaPagamento] = useState('dinheiro');
  const [observacao, setObservacao] = useState('');
  const [salvando, setSalvando] = useState(false);

  // Reabre limpo, com o fornecedor do item pré-selecionado.
  useEffect(() => {
    if (!open) return;
    setQuantidade('');
    setCusto('');
    setFornecedorId(item?.fornecedor_id || 'nenhum');
    setAtualizarMedia(true);
    setGerarConta(false);
    setSituacaoPagamento('a_pagar');
    setFormaPagamento('dinheiro');
    setObservacao('');
  }, [open, item?.id, item?.fornecedor_id]);

  const qtdNumero = lerNumero(quantidade);
  const qtdValida = qtdNumero !== null && Number.isInteger(qtdNumero) && qtdNumero > 0;
  const custoNumero = podeVerCustos ? lerNumero(custo) : null;
  const temCusto = custoNumero !== null && Number.isFinite(custoNumero) && custoNumero >= 0;
  const custoPositivo = temCusto && custoNumero > 0;

  // O que de fato vai para a RPC (opções sem efeito ficam desligadas).
  const compra: DadosCompraEntrada = {
    custoUnitario: temCusto ? custoNumero : null,
    fornecedorId: podeVerCustos ? fornecedorId : null,
    atualizarCustoMedio: temCusto && atualizarMedia,
    gerarConta: podeLancarConta && custoPositivo && gerarConta,
    pago: podeLancarConta && custoPositivo && gerarConta && situacaoPagamento === 'pago',
    formaPagamento,
    observacao,
  };

  const validacao = item
    ? montarEntradaEstoque({ tipo: item.tipo, itemId: item.id, quantidade, ...compra })
    : null;
  // Custo digitado inválido (ex.: negativo) aparece mesmo antes da quantidade.
  const erroCusto = podeVerCustos && custo.trim() && !temCusto
    ? (custoNumero !== null && custoNumero < 0 ? 'O custo unitário não pode ser negativo.' : 'Custo unitário inválido.')
    : null;

  const previa = useMemo(() => {
    if (!item || !qtdValida) return null;
    return calcularPreviaEntrada({
      quantidadeAtual: item.quantidade,
      custoAtual: item.custo,
      quantidade: qtdNumero as number,
      custoUnitario: temCusto ? custoNumero : null,
      atualizarCustoMedio: temCusto && atualizarMedia,
    });
  }, [item, qtdValida, qtdNumero, temCusto, custoNumero, atualizarMedia]);

  const handleConfirmar = async () => {
    if (!item || !validacao?.ok || erroCusto) return;
    setSalvando(true);
    const ok = await onConfirmar(item.id, item.tipo, qtdNumero as number, compra);
    setSalvando(false);
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackagePlus className="w-5 h-5" />
            Repor Estoque
          </DialogTitle>
          <DialogDescription>
            Adicione unidades ao estoque do item selecionado.
          </DialogDescription>
        </DialogHeader>

        {item && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-muted-foreground">Item</Label>
                <p className="font-medium">{item.nome}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Estoque atual</Label>
                <p className="font-medium">{item.quantidade} unidades</p>
              </div>
            </div>

            <div>
              <Label htmlFor="qtd-repor">Quantidade a adicionar *</Label>
              <Input
                id="qtd-repor"
                type="number"
                min="1"
                step="1"
                placeholder="Ex: 10"
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
                autoFocus
              />
            </div>

            {podeVerCustos && (
              <>
                <div>
                  <Label htmlFor="custo-repor">Custo unitário desta compra (opcional)</Label>
                  <Input
                    id="custo-repor"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0,00"
                    value={custo}
                    onChange={(e) => setCusto(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Custo atual do item: {formatarReais(Number(item.custo || 0))}
                  </p>
                  {erroCusto && <p className="text-xs text-destructive mt-1">{erroCusto}</p>}
                </div>

                <div>
                  <Label>Fornecedor (opcional)</Label>
                  <Select value={fornecedorId} onValueChange={setFornecedorId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um fornecedor" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nenhum">Nenhum</SelectItem>
                      {fornecedores.map((f) => (
                        <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-start gap-2">
                  <Checkbox
                    id="atualizar-media"
                    checked={temCusto && atualizarMedia}
                    disabled={!temCusto}
                    onCheckedChange={(v) => setAtualizarMedia(v === true)}
                  />
                  <Label htmlFor="atualizar-media" className={`leading-snug ${!temCusto ? 'text-muted-foreground' : ''}`}>
                    Atualizar o custo do produto pela média ponderada
                  </Label>
                </div>
              </>
            )}

            {podeLancarConta && (
              <div className="rounded-lg border p-3 space-y-3">
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="gerar-conta"
                    checked={custoPositivo && gerarConta}
                    disabled={!custoPositivo}
                    onCheckedChange={(v) => setGerarConta(v === true)}
                  />
                  <div>
                    <Label htmlFor="gerar-conta" className={!custoPositivo ? 'text-muted-foreground' : ''}>
                      Lançar em Contas a Pagar
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {custoPositivo
                        ? 'Sai do caixa, mas não abate o lucro: o custo entra quando a mercadoria for vendida.'
                        : 'Informe o custo unitário para lançar a compra.'}
                    </p>
                  </div>
                </div>

                {custoPositivo && gerarConta && (
                  <div className="space-y-3 pl-6">
                    <RadioGroup
                      value={situacaoPagamento}
                      onValueChange={(v) => setSituacaoPagamento(v as 'a_pagar' | 'pago')}
                      className="flex gap-4"
                    >
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="a_pagar" id="sit-a-pagar" />
                        <Label htmlFor="sit-a-pagar">A pagar</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="pago" id="sit-pago" />
                        <Label htmlFor="sit-pago">Já paguei</Label>
                      </div>
                    </RadioGroup>

                    {situacaoPagamento === 'pago' && (
                      <div>
                        <Label>Forma de pagamento</Label>
                        <Select value={formaPagamento} onValueChange={setFormaPagamento}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            {FORMAS_PADRAO.map((f) => (
                              <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                            ))}
                            {formasCustomizadas.map((f) => (
                              <SelectItem key={f.id} value={f.nome}>{f.nome}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div>
              <Label htmlFor="obs-repor">Observação (opcional)</Label>
              <Textarea
                id="obs-repor"
                rows={2}
                maxLength={MAX_OBSERVACAO}
                className="resize-none"
                placeholder="Ex: nota fiscal 1234"
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
              />
            </div>

            {previa && (
              <div className="rounded-md bg-muted/50 px-3 py-2 text-sm space-y-1">
                <p className="text-muted-foreground">
                  Novo estoque: <span className="font-semibold text-foreground">{previa.quantidadeFinal}</span> unidades
                </p>
                {podeVerCustos && previa.totalCompra !== null && (
                  <p className="text-muted-foreground">
                    Total da compra: <span className="font-semibold text-foreground">{formatarReais(previa.totalCompra)}</span>
                  </p>
                )}
                {podeVerCustos && compra.atualizarCustoMedio && (
                  <p className="text-muted-foreground">
                    Custo atual {formatarReais(previa.custoAtual)} → novo custo{' '}
                    <span className="font-semibold text-foreground">{formatarReais(previa.custoNovo)}</span>
                  </p>
                )}
              </div>
            )}

            {quantidade.trim() && validacao && !validacao.ok && !erroCusto && (
              <p className="text-xs text-destructive">{validacao.erro}</p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={handleConfirmar} disabled={salvando || !validacao?.ok || !!erroCusto}>
            {salvando ? 'Salvando...' : 'Confirmar Reposição'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
