import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X, Info, AlertTriangle, CheckCircle, Gift, ExternalLink } from 'lucide-react';
import { useAvisosSistema } from '@/hooks/useAvisosSistema';
import { cn } from '@/lib/utils';
import { DialogDismissCard } from './DialogDismissCard';
import { isDismissed, dismissCard, DismissDuration } from '@/lib/card-dismiss';

interface AvisoDisplay {
  id: string;
  titulo: string;
  mensagem: string;
  tipo: string;
  icone?: string | null;
  link_url?: string | null;
  link_texto?: string | null;
  cor_fundo?: string | null;
  cor_texto?: string | null;
  cor_icone?: string | null;
  cor_botao?: string | null;
  imagem_url?: string | null;
  imagem_posicao?: string | null;
}

function getIconComponent(tipo: string, icone?: string | null) {
  switch (tipo) {
    case 'warning':
      return AlertTriangle;
    case 'success':
      return CheckCircle;
    case 'promo':
      return Gift;
    default:
      return Info;
  }
}

function getDefaultStyles(tipo: string) {
  switch (tipo) {
    case 'warning':
      return { 
        bg: '#FEF9C3', 
        bgDark: 'rgba(234, 179, 8, 0.15)',
        text: '#854D0E', 
        textDark: '#FCD34D',
        icon: '#CA8A04', 
        iconDark: '#FBBF24',
        button: '#CA8A04',
        border: '#EAB308',
      };
    case 'success':
      return { 
        bg: '#DCFCE7', 
        bgDark: 'rgba(34, 197, 94, 0.15)',
        text: '#166534', 
        textDark: '#86EFAC',
        icon: '#16A34A', 
        iconDark: '#4ADE80',
        button: '#16A34A',
        border: '#22C55E',
      };
    case 'promo':
      return { 
        bg: '#F3E8FF', 
        bgDark: 'rgba(168, 85, 247, 0.15)',
        text: '#6B21A8', 
        textDark: '#D8B4FE',
        icon: '#9333EA', 
        iconDark: '#C084FC',
        button: '#9333EA',
        border: '#A855F7',
      };
    default: // info
      return { 
        bg: '#DBEAFE', 
        bgDark: 'rgba(59, 130, 246, 0.15)',
        text: '#1E40AF', 
        textDark: '#93C5FD',
        icon: '#2563EB', 
        iconDark: '#60A5FA',
        button: '#2563EB',
        border: '#3B82F6',
      };
  }
}

export function CardAvisosSistema() {
  const { avisos, loading } = useAvisosSistema();
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [dismissDialogOpen, setDismissDialogOpen] = useState(false);
  const [avisoParaFechar, setAvisoParaFechar] = useState<string | null>(null);

  useEffect(() => {
    // Verificar quais avisos estão dismissados
    const dismissed = avisos
      .filter(a => isDismissed(`aviso_${a.id}`))
      .map(a => a.id);
    setDismissedIds(dismissed);
  }, [avisos]);

  const handleOpenDismissDialog = (id: string) => {
    setAvisoParaFechar(id);
    setDismissDialogOpen(true);
  };

  const handleDismiss = (duration: DismissDuration) => {
    if (!avisoParaFechar) return;
    dismissCard(`aviso_${avisoParaFechar}`, duration);
    setDismissedIds(prev => [...prev, avisoParaFechar]);
    setAvisoParaFechar(null);
  };

  if (loading) return null;

  const avisosVisiveis = avisos.filter(a => !dismissedIds.includes(a.id));

  if (avisosVisiveis.length === 0) return null;

  return (
    <>
      <div className="space-y-4 mb-6">
        {avisosVisiveis.map((aviso) => (
          <AvisoCard 
            key={aviso.id} 
            aviso={aviso as AvisoDisplay} 
            onDismiss={() => handleOpenDismissDialog(aviso.id)} 
          />
        ))}
      </div>
      <DialogDismissCard
        open={dismissDialogOpen}
        onOpenChange={setDismissDialogOpen}
        onDismiss={handleDismiss}
      />
    </>
  );
}

function AvisoCard({ aviso, onDismiss }: { aviso: AvisoDisplay; onDismiss: () => void }) {
  const Icon = getIconComponent(aviso.tipo, aviso.icone);
  const defaults = getDefaultStyles(aviso.tipo);
  
  // Aplicar cores personalizadas ou usar defaults
  const bgColor = aviso.cor_fundo || defaults.bg;
  const textColor = aviso.cor_texto || defaults.text;
  const iconColor = aviso.cor_icone || defaults.icon;
  const buttonColor = aviso.cor_botao || defaults.button;
  const borderColor = aviso.cor_icone || defaults.border;

  const hasTopImage = aviso.imagem_url && aviso.imagem_posicao === 'topo';
  const hasBottomImage = aviso.imagem_url && aviso.imagem_posicao === 'fundo';
  const hasSideImage = aviso.imagem_url && (aviso.imagem_posicao === 'direita' || aviso.imagem_posicao === 'esquerda');
  const isLeftImage = aviso.imagem_posicao === 'esquerda';

  return (
    <Card 
      className="overflow-hidden border-2 relative transition-all hover:shadow-md"
      style={{ 
        backgroundColor: bgColor,
        borderColor: borderColor,
      }}
    >
      {/* Imagem no Topo (Banner) */}
      {hasTopImage && (
        <div className="w-full h-16 sm:h-24 lg:h-32 overflow-hidden">
          <img 
            src={aviso.imagem_url!} 
            alt="" 
            className="w-full h-full object-cover"
          />
        </div>
      )}

      <div className={cn(
        "p-3 sm:p-4",
        hasSideImage ? "flex flex-col sm:flex-row gap-3" : "flex gap-3",
        hasSideImage && isLeftImage && "sm:flex-row-reverse"
      )}>
        {/* Imagem Lateral - No mobile fica em cima do conteúdo */}
        {hasSideImage && (
          <div className="flex-shrink-0 w-full h-24 sm:w-20 sm:h-20 lg:w-24 lg:h-24 rounded-lg overflow-hidden">
            <img 
              src={aviso.imagem_url!} 
              alt="" 
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Conteúdo Principal */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2 sm:gap-3">
            <div 
              className="flex-shrink-0 h-7 w-7 sm:h-8 sm:w-8 rounded-full flex items-center justify-center"
              style={{ 
                backgroundColor: `${iconColor}20`,
                color: iconColor,
              }}
            >
              <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </div>

            <div className="flex-1 min-w-0 pr-5">
              <h3 
                className="font-semibold text-xs sm:text-sm lg:text-base mb-0.5 break-words"
                style={{ color: textColor }}
              >
                {aviso.titulo}
              </h3>
              <p 
                className="text-[11px] sm:text-xs lg:text-sm leading-relaxed break-words whitespace-pre-wrap line-clamp-2 sm:line-clamp-none"
                style={{ color: textColor, opacity: 0.9 }}
              >
                {aviso.mensagem}
              </p>

              {aviso.link_url && aviso.link_texto && (
                <a
                  href={aviso.link_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-2"
                >
                  <Button 
                    size="sm" 
                    style={{ backgroundColor: buttonColor }}
                    className="text-white hover:opacity-90 text-[10px] sm:text-xs h-7 px-2.5"
                  >
                    {aviso.link_texto}
                    <ExternalLink className="ml-1.5 h-3 w-3" />
                  </Button>
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Botão de Fechar */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 h-8 w-8 hover:bg-black/10 dark:hover:bg-white/10"
        onClick={() => onDismiss()}
        style={{ color: textColor }}
      >
        <X className="h-4 w-4" />
      </Button>

      {/* Imagem no Fundo (Banner) */}
      {hasBottomImage && (
        <div className="w-full h-16 sm:h-24 lg:h-32 overflow-hidden">
          <img 
            src={aviso.imagem_url!} 
            alt="" 
            className="w-full h-full object-cover"
          />
        </div>
      )}
    </Card>
  );
}
