import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MessageSquarePlus, Lightbulb, AlertCircle, TrendingUp, X } from 'lucide-react';
import { DialogCadastroFeedback } from '@/components/feedback/DialogCadastroFeedback';
import { TipoFeedback } from '@/types/feedback';
import { DialogDismissCard } from './DialogDismissCard';
import { isDismissed, dismissCard, DismissDuration } from '@/lib/card-dismiss';

const CARD_ID = 'feedback';

export const CardFeedback = () => {
  const [dialogAberto, setDialogAberto] = useState(false);
  const [tipoSelecionado, setTipoSelecionado] = useState<TipoFeedback | null>(null);
  const [dismissDialogOpen, setDismissDialogOpen] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    setHidden(isDismissed(CARD_ID));
  }, []);

  const handleAbrirDialog = (tipo: TipoFeedback) => {
    setTipoSelecionado(tipo);
    setDialogAberto(true);
  };

  const handleDismiss = (duration: DismissDuration) => {
    dismissCard(CARD_ID, duration);
    setHidden(true);
  };

  if (hidden) return null;

  return (
    <>
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent relative">
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-2 right-2 h-7 w-7 hover:bg-black/10 dark:hover:bg-white/10"
          onClick={() => setDismissDialogOpen(true)}
        >
          <X className="h-4 w-4" />
        </Button>
        <CardHeader className="pb-2 pt-3 px-3 sm:px-6 sm:pt-4 pr-10">
          <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
            <MessageSquarePlus className="h-4 w-4 text-primary" />
            Sua opinião importa!
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3 sm:px-6 sm:pb-4">
          <p className="text-xs text-muted-foreground mb-2 sm:mb-3 hidden sm:block">
            Ajude-nos a melhorar com suas sugestões ou ideias.
          </p>
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex flex-col h-auto py-2 gap-0.5 hover:bg-blue-500/10 hover:border-blue-500/50"
              onClick={() => handleAbrirDialog('sugestao')}
            >
              <Lightbulb className="h-4 w-4 text-blue-500" />
              <span className="text-[10px] sm:text-xs">Sugestão</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex flex-col h-auto py-2 gap-0.5 hover:bg-red-500/10 hover:border-red-500/50"
              onClick={() => handleAbrirDialog('reclamacao')}
            >
              <AlertCircle className="h-4 w-4 text-red-500" />
              <span className="text-[10px] sm:text-xs">Reclamação</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex flex-col h-auto py-2 gap-0.5 hover:bg-green-500/10 hover:border-green-500/50"
              onClick={() => handleAbrirDialog('melhoria')}
            >
              <TrendingUp className="h-4 w-4 text-green-500" />
              <span className="text-[10px] sm:text-xs">Melhoria</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      <DialogCadastroFeedback
        aberto={dialogAberto}
        onClose={() => {
          setDialogAberto(false);
          setTipoSelecionado(null);
        }}
        tipoInicial={tipoSelecionado}
      />

      <DialogDismissCard
        open={dismissDialogOpen}
        onOpenChange={setDismissDialogOpen}
        onDismiss={handleDismiss}
      />
    </>
  );
};
