import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Send, ArrowLeft, Plus, MessageCircle } from 'lucide-react';
import { useChatSuporte } from '@/hooks/useChatSuporte';
import { ConversaSuporte } from '@/types/chat-suporte';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface JanelaChatProps {
  onClose: () => void;
}

export const JanelaChat = ({ onClose }: JanelaChatProps) => {
  const [novaMensagem, setNovaMensagem] = useState('');
  const [novoAssunto, setNovoAssunto] = useState('');
  const [criandoConversa, setCriandoConversa] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const {
    conversas,
    mensagens,
    conversaAtiva,
    setConversaAtiva,
    carregarMensagens,
    criarConversa,
    enviarMensagem,
  } = useChatSuporte(false);

  useEffect(() => {
    if (conversaAtiva) {
      carregarMensagens(conversaAtiva.id);
    }
  }, [conversaAtiva, carregarMensagens]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [mensagens]);

  const handleEnviarMensagem = async () => {
    if (!novaMensagem.trim() || !conversaAtiva) return;
    await enviarMensagem(conversaAtiva.id, novaMensagem);
    setNovaMensagem('');
  };

  const handleCriarConversa = async () => {
    if (!novoAssunto.trim()) return;
    const conversa = await criarConversa(novoAssunto);
    if (conversa) {
      setConversaAtiva(conversa);
      setNovoAssunto('');
      setCriandoConversa(false);
    }
  };

  const handleSelecionarConversa = (conversa: ConversaSuporte) => {
    setConversaAtiva(conversa);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'outline'; label: string }> = {
      aberta: { variant: 'default', label: 'Aberta' },
      em_atendimento: { variant: 'secondary', label: 'Em Atendimento' },
      resolvida: { variant: 'outline', label: 'Resolvida' },
      fechada: { variant: 'outline', label: 'Fechada' },
    };
    const info = variants[status] || variants.aberta;
    return <Badge variant={info.variant}>{info.label}</Badge>;
  };

  // Tela de conversa ativa
  if (conversaAtiva) {
    return (
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="p-3 border-b bg-muted/50 flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setConversaAtiva(null)}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <p className="font-medium text-sm truncate">{conversaAtiva.assunto}</p>
            {getStatusBadge(conversaAtiva.status)}
          </div>
        </div>

        {/* Mensagens */}
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          <div className="space-y-3">
            {mensagens.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.is_admin ? 'justify-start' : 'justify-end'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                    msg.is_admin
                      ? 'bg-muted'
                      : 'bg-primary text-primary-foreground'
                  }`}
                >
                  <p>{msg.mensagem}</p>
                  <p className={`text-xs mt-1 ${msg.is_admin ? 'text-muted-foreground' : 'text-primary-foreground/70'}`}>
                    {formatDistanceToNow(new Date(msg.created_at), {
                      addSuffix: true,
                      locale: ptBR,
                    })}
                  </p>
                </div>
              </div>
            ))}
            {mensagens.length === 0 && (
              <p className="text-center text-sm text-muted-foreground">
                Envie uma mensagem para iniciar a conversa
              </p>
            )}
          </div>
        </ScrollArea>

        {/* Input */}
        {conversaAtiva.status !== 'fechada' && (
          <div className="p-3 border-t flex gap-2">
            <Input
              placeholder="Digite sua mensagem..."
              value={novaMensagem}
              onChange={(e) => setNovaMensagem(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleEnviarMensagem()}
            />
            <Button size="icon" onClick={handleEnviarMensagem}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    );
  }

  // Tela de criar nova conversa
  if (criandoConversa) {
    return (
      <div className="flex flex-col h-full">
        <div className="p-3 border-b bg-muted/50 flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCriandoConversa(false)}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <p className="font-medium">Nova Conversa</p>
        </div>
        <div className="flex-1 p-4">
          <p className="text-sm text-muted-foreground mb-4">
            Informe o assunto da sua solicitação de suporte
          </p>
          <Input
            placeholder="Ex: Dúvida sobre pagamento"
            value={novoAssunto}
            onChange={(e) => setNovoAssunto(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCriarConversa()}
          />
        </div>
        <div className="p-3 border-t">
          <Button className="w-full" onClick={handleCriarConversa}>
            Iniciar Conversa
          </Button>
        </div>
      </div>
    );
  }

  // Lista de conversas
  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b bg-muted/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5 text-primary" />
          <p className="font-medium">Suporte</p>
        </div>
        <Button size="sm" onClick={() => setCriandoConversa(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Nova
        </Button>
      </div>

      <ScrollArea className="flex-1">
        {conversas.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            <p>Nenhuma conversa ainda.</p>
            <p className="mt-2">Clique em "Nova" para iniciar!</p>
          </div>
        ) : (
          <div className="divide-y">
            {conversas.map((conversa) => (
              <button
                key={conversa.id}
                onClick={() => handleSelecionarConversa(conversa)}
                className="w-full p-3 text-left hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center justify-between mb-1">
                  <p className="font-medium text-sm truncate flex-1">
                    {conversa.assunto}
                  </p>
                  {getStatusBadge(conversa.status)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(conversa.updated_at), {
                    addSuffix: true,
                    locale: ptBR,
                  })}
                </p>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
};
