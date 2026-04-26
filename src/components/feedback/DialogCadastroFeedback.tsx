import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Lightbulb, AlertCircle, TrendingUp } from 'lucide-react';
import { useFeedbacks } from '@/hooks/useFeedbacks';
import { TipoFeedback } from '@/types/feedback';

interface DialogCadastroFeedbackProps {
  aberto: boolean;
  onClose: () => void;
  tipoInicial?: TipoFeedback | null;
}

export const DialogCadastroFeedback = ({
  aberto,
  onClose,
  tipoInicial,
}: DialogCadastroFeedbackProps) => {
  const [tipo, setTipo] = useState<TipoFeedback>('sugestao');
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const { loading, criarFeedback } = useFeedbacks();

  useEffect(() => {
    if (tipoInicial) {
      setTipo(tipoInicial);
    }
  }, [tipoInicial]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const sucesso = await criarFeedback({ tipo, titulo, descricao });
    if (sucesso) {
      setTitulo('');
      setDescricao('');
      setTipo('sugestao');
      onClose();
    }
  };

  const getTipoInfo = (tipo: TipoFeedback) => {
    switch (tipo) {
      case 'sugestao':
        return { icon: Lightbulb, color: 'text-blue-500', label: 'Sugestão' };
      case 'reclamacao':
        return { icon: AlertCircle, color: 'text-red-500', label: 'Reclamação' };
      case 'melhoria':
        return { icon: TrendingUp, color: 'text-green-500', label: 'Melhoria' };
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {(() => {
              const info = getTipoInfo(tipo);
              const Icon = info.icon;
              return <Icon className={`h-5 w-5 ${info.color}`} />;
            })()}
            Enviar Feedback
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tipo">Tipo</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as TipoFeedback)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sugestao">
                  <div className="flex items-center gap-2">
                    <Lightbulb className="h-4 w-4 text-blue-500" />
                    Sugestão
                  </div>
                </SelectItem>
                <SelectItem value="reclamacao">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-red-500" />
                    Reclamação
                  </div>
                </SelectItem>
                <SelectItem value="melhoria">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-green-500" />
                    Melhoria
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="titulo">Título *</Label>
            <Input
              id="titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Resumo do seu feedback"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição *</Label>
            <Textarea
              id="descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Descreva em detalhes sua sugestão, reclamação ou melhoria..."
              rows={5}
              required
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enviar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
