import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { MessageCircle, X } from 'lucide-react';
import { JanelaChat } from './JanelaChat';

export const ChatSuporte = () => {
  const [aberto, setAberto] = useState(false);

  return (
    <>
      {/* Botão flutuante */}
      <Button
        onClick={() => setAberto(!aberto)}
        className="fixed bottom-[80px] right-6 h-14 w-14 rounded-full shadow-lg z-50 lg:bottom-6"
        size="icon"
      >
        {aberto ? (
          <X className="h-6 w-6" />
        ) : (
          <MessageCircle className="h-6 w-6" />
        )}
      </Button>

      {/* Janela de chat */}
      {aberto && (
        <div className="fixed bottom-[148px] right-6 w-[380px] h-[500px] bg-background border rounded-lg shadow-2xl z-50 flex flex-col overflow-hidden lg:bottom-[80px]">
          <JanelaChat onClose={() => setAberto(false)} />
        </div>
      )}
    </>
  );
};
