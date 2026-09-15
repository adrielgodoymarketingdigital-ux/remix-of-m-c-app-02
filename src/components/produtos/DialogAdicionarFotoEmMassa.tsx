import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ImagePlus, Package, Wrench, Info } from 'lucide-react';
import { ItemEstoque } from '@/types/produto';
import { UploadFotosProduto } from './UploadFotosProduto';

interface DialogAdicionarFotoEmMassaProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itensSelecionados: ItemEstoque[];
  onConfirmar: (
    itens: { id: string; tipo: 'produto' | 'peca' }[],
    urlFoto: string
  ) => Promise<{ atualizados: number; pulados: number }>;
}

export const DialogAdicionarFotoEmMassa = ({
  open,
  onOpenChange,
  itensSelecionados,
  onConfirmar,
}: DialogAdicionarFotoEmMassaProps) => {
  // Sempre uma imagem nova avulsa — não carrega fotos existentes de nenhum
  // item, é só o "upload temporário" até confirmar.
  const [fotoNova, setFotoNova] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!open) setFotoNova([]);
  }, [open]);

  const handleConfirmar = async () => {
    const urlFoto = fotoNova[0];
    if (!urlFoto) return;

    setSalvando(true);
    const itens = itensSelecionados.map((i) => ({ id: i.id, tipo: i.tipo }));
    const resultado = await onConfirmar(itens, urlFoto);
    setSalvando(false);
    if (resultado.atualizados > 0 || resultado.pulados > 0) onOpenChange(false);
  };

  const totalAfetados = itensSelecionados.length;
  const pluralAfetados = totalAfetados === 1 ? 'item' : 'itens';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImagePlus className="w-5 h-5" />
            Adicionar Imagem em Massa
          </DialogTitle>
          <DialogDescription>
            A imagem será enviada uma única vez e adicionada às fotos de cada item selecionado.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Resumo dos itens afetados */}
          <div className="rounded-lg border bg-muted/40 p-3 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Info className="w-4 h-4 text-muted-foreground" />
              <span>{totalAfetados} {pluralAfetados} serão atualizados</span>
            </div>
            <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
              {itensSelecionados.map((item) => (
                <div key={item.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                  {item.tipo === 'produto'
                    ? <Package className="w-3 h-3" />
                    : <Wrench className="w-3 h-3" />}
                  <span className="flex-1 truncate">{item.nome}</span>
                  <span className="shrink-0">{(item.fotos?.length ?? 0)}/5 fotos</span>
                </div>
              ))}
            </div>
          </div>

          {/* Upload da imagem única */}
          <UploadFotosProduto
            fotos={fotoNova}
            onFotosChange={setFotoNova}
            maxFotos={1}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={handleConfirmar} disabled={salvando || fotoNova.length === 0}>
            {salvando
              ? 'Enviando...'
              : `Adicionar a ${totalAfetados} ${pluralAfetados}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
