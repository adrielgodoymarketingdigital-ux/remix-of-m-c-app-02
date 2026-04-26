import { AlertCircle, Sparkles } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface AlertaLimiteFreeProps {
  tipo: 'dispositivos' | 'ordens' | 'produtos';
  usados: number;
  limite: number;
  ilimitado?: boolean;
}

const LABELS = {
  dispositivos: {
    titulo: "Limite de Dispositivos",
    descricao: "dispositivos cadastrados",
    icone: "📱",
  },
  ordens: {
    titulo: "Limite de Ordens de Serviço",
    descricao: "ordens de serviço este mês",
    icone: "🔧",
  },
  produtos: {
    titulo: "Limite de Produtos/Peças",
    descricao: "produtos/peças este mês",
    icone: "📦",
  },
};

export function AlertaLimiteFree({ tipo, usados, limite, ilimitado }: AlertaLimiteFreeProps) {
  const navigate = useNavigate();
  const { titulo, descricao, icone } = LABELS[tipo];
  
  // Não mostrar se ilimitado
  if (ilimitado || limite === -1) return null;
  
  const percentual = limite > 0 ? Math.min((usados / limite) * 100, 100) : 0;
  const restantes = Math.max(0, limite - usados);
  const atingiuLimite = usados >= limite;
  const proximoLimite = percentual >= 80;
  
  // Só mostrar se está próximo ou atingiu o limite
  if (percentual < 60) return null;
  
  return (
    <Alert 
      variant={atingiuLimite ? "destructive" : "default"} 
      className={atingiuLimite 
        ? "border-destructive/50 bg-destructive/10" 
        : proximoLimite 
          ? "border-amber-500/50 bg-amber-50 dark:bg-amber-950/20" 
          : "border-primary/30 bg-primary/5"
      }
    >
      <AlertCircle className={`h-4 w-4 ${atingiuLimite ? "text-destructive" : proximoLimite ? "text-amber-600" : "text-primary"}`} />
      <AlertTitle className="flex items-center gap-2">
        <span>{icone}</span>
        {titulo}
      </AlertTitle>
      <AlertDescription className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span>
            {usados} de {limite} {descricao}
          </span>
          <span className={atingiuLimite ? "text-destructive font-semibold" : "text-muted-foreground"}>
            {atingiuLimite ? "Limite atingido!" : `${restantes} restantes`}
          </span>
        </div>
        
        <Progress 
          value={percentual} 
          className={`h-2 ${atingiuLimite ? "[&>div]:bg-destructive" : proximoLimite ? "[&>div]:bg-amber-500" : ""}`} 
        />
        
        {(atingiuLimite || proximoLimite) && (
          <div className="flex items-center justify-between pt-1">
            <p className="text-xs text-muted-foreground">
              {atingiuLimite 
                ? "Faça upgrade para continuar usando esta funcionalidade." 
                : "Você está próximo do limite do plano Free."
              }
            </p>
            <Button 
              size="sm" 
              variant={atingiuLimite ? "default" : "outline"}
              onClick={() => navigate('/plano')}
              className="gap-1"
            >
              <Sparkles className="h-3 w-3" />
              Upgrade
            </Button>
          </div>
        )}
      </AlertDescription>
    </Alert>
  );
}

// Componente compacto para uso em headers
export function BadgeLimiteFree({ usados, limite, tipo }: { usados: number; limite: number; tipo: string }) {
  if (limite === -1) return null;
  
  const percentual = limite > 0 ? (usados / limite) * 100 : 0;
  const atingiuLimite = usados >= limite;
  
  return (
    <div className={`
      inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium
      ${atingiuLimite 
        ? "bg-destructive/10 text-destructive border border-destructive/20" 
        : percentual >= 80 
          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800" 
          : "bg-muted text-muted-foreground"
      }
    `}>
      <span>{usados}/{limite}</span>
      <span className="text-[10px] opacity-70">{tipo}</span>
    </div>
  );
}
