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
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { formatPhone } from '@/lib/formatters';

interface DialogWhatsAppSuporteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nome: string;
  celular: string;
  /** Trecho da saudação: "Aqui é do suporte do Méc, sobre {sobre}." — ex: 'a sua conversa "X"'. */
  sobre: string;
}

/**
 * Número no formato do wa.me: só dígitos, com DDI 55. profiles.celular é
 * salvo sem DDI (ex: "11987654321"), mas aceita também quem já digitou o 55.
 * Retorna null se não parecer um celular/telefone brasileiro válido.
 */
export function numeroWhatsApp(celular: string | null | undefined): string | null {
  const digitos = (celular ?? '').replace(/\D/g, '');
  if (digitos.length === 10 || digitos.length === 11) return `55${digitos}`;
  if ((digitos.length === 12 || digitos.length === 13) && digitos.startsWith('55')) return digitos;
  return null;
}

const mensagemPadrao = (nome: string, sobre: string) => {
  const primeiroNome = nome.trim().split(/\s+/)[0] || '';
  return `Olá${primeiroNome ? `, ${primeiroNome}` : ''}! Aqui é do suporte do Méc, sobre ${sobre}.\n\n`;
};

export const DialogWhatsAppSuporte = ({ open, onOpenChange, nome, celular, sobre }: DialogWhatsAppSuporteProps) => {
  const [mensagem, setMensagem] = useState('');

  useEffect(() => {
    if (open) setMensagem(mensagemPadrao(nome, sobre));
  }, [open, nome, sobre]);

  const numero = numeroWhatsApp(celular);

  const handleAbrir = () => {
    if (!numero) return;
    const texto = mensagem.trim();
    const url = `https://wa.me/${numero}${texto ? `?text=${encodeURIComponent(texto)}` : ''}`;
    // window.open síncrono no clique — senão o navegador bloqueia o popup.
    // Sem 'noopener' nas features: com ele o window.open sempre retorna null e não
    // daria para detectar bloqueio — o opener é desligado logo abaixo.
    const janela = window.open(url, '_blank');
    if (janela) janela.opener = null;
    if (!janela) {
      navigator.clipboard?.writeText(texto).catch(() => undefined);
      toast.error('Pop-up bloqueado', { description: 'Mensagem copiada. Permita pop-ups para abrir o WhatsApp.' });
      return;
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-green-600" />
            Enviar WhatsApp
          </DialogTitle>
          <DialogDescription>
            Para <strong>{nome || 'Usuário'}</strong> · {formatPhone(celular)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="msg-whatsapp-suporte">Mensagem</Label>
          <Textarea
            id="msg-whatsapp-suporte"
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            rows={6}
            autoFocus
          />
          <p className="text-xs text-muted-foreground">
            O WhatsApp abre com o número e o texto preenchidos — confira e toque em enviar por lá.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleAbrir} disabled={!numero} className="!bg-none !bg-green-600 hover:!bg-green-700 text-white">
            <MessageCircle className="h-4 w-4 mr-2" />
            Abrir WhatsApp
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
