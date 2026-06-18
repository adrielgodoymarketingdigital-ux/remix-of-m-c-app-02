import { useState } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ItemEstoque } from '@/types/produto';
import { NovaTrocaGarantia } from '@/hooks/useTrocasGarantia';
import { RefreshCw } from 'lucide-react';

interface DialogNovaTrocaGarantiaProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  produtos: ItemEstoque[];
  onConfirmar: (dados: NovaTrocaGarantia) => Promise<boolean>;
}

const ESTADO_INICIAL = {
  clienteNome: '',
  produtoDefeituosoNome: '',
  motivoDefeito: '',
  produtoNovoId: '',
  observacao: '',
};

export const DialogNovaTrocaGarantia = ({ open, onOpenChange, produtos, onConfirmar }: DialogNovaTrocaGarantiaProps) => {
  const [form, setForm] = useState(ESTADO_INICIAL);
  const [salvando, setSalvando] = useState(false);

  const produtosDisponiveis = produtos.filter((p) => p.tipo === 'produto');
  const produtoSelecionado = produtosDisponiveis.find((p) => p.id === form.produtoNovoId);

  const podeConfirmar =
    form.produtoDefeituosoNome.trim().length > 0 &&
    form.produtoNovoId.length > 0 &&
    !!produtoSelecionado &&
    produtoSelecionado.quantidade > 0;

  const handleOpenChange = (open: boolean) => {
    if (!open) setForm(ESTADO_INICIAL);
    onOpenChange(open);
  };

  const handleConfirmar = async () => {
    if (!podeConfirmar || !produtoSelecionado) return;
    setSalvando(true);
    const ok = await onConfirmar({
      cliente_nome: form.clienteNome.trim() || null,
      produto_defeituoso_nome: form.produtoDefeituosoNome.trim(),
      motivo_defeito: form.motivoDefeito.trim() || null,
      produto_novo_id: produtoSelecionado.id,
      produto_novo_nome: produtoSelecionado.nome,
      observacao: form.observacao.trim() || null,
    });
    setSalvando(false);
    if (ok) handleOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5" />
            Nova Troca em Garantia
          </DialogTitle>
          <DialogDescription>
            Registre a devolução de um item com defeito e o produto novo entregue em substituição. O estoque do produto novo será reduzido em 1 unidade.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="cliente-nome">Cliente (opcional)</Label>
            <Input
              id="cliente-nome"
              placeholder="Nome do cliente"
              value={form.clienteNome}
              onChange={(e) => setForm((f) => ({ ...f, clienteNome: e.target.value }))}
            />
          </div>

          <div>
            <Label htmlFor="produto-defeituoso">Produto devolvido com defeito</Label>
            <Input
              id="produto-defeituoso"
              placeholder="Ex: Carregador 20W"
              value={form.produtoDefeituosoNome}
              onChange={(e) => setForm((f) => ({ ...f, produtoDefeituosoNome: e.target.value }))}
              autoFocus
            />
          </div>

          <div>
            <Label htmlFor="motivo-defeito">Motivo do defeito (opcional)</Label>
            <Input
              id="motivo-defeito"
              placeholder="Ex: não carrega"
              value={form.motivoDefeito}
              onChange={(e) => setForm((f) => ({ ...f, motivoDefeito: e.target.value }))}
            />
          </div>

          <div>
            <Label htmlFor="produto-novo">Produto novo a entregar</Label>
            <Select value={form.produtoNovoId} onValueChange={(v) => setForm((f) => ({ ...f, produtoNovoId: v }))}>
              <SelectTrigger id="produto-novo">
                <SelectValue placeholder="Selecione o produto" />
              </SelectTrigger>
              <SelectContent>
                {produtosDisponiveis.map((p) => (
                  <SelectItem key={p.id} value={p.id} disabled={p.quantidade <= 0}>
                    {p.nome} ({p.quantidade} em estoque)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="observacao">Observação (opcional)</Label>
            <Textarea
              id="observacao"
              placeholder="Detalhes adicionais sobre a troca"
              value={form.observacao}
              onChange={(e) => setForm((f) => ({ ...f, observacao: e.target.value }))}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={handleConfirmar} disabled={salvando || !podeConfirmar}>
            {salvando ? 'Salvando...' : 'Registrar Troca'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
