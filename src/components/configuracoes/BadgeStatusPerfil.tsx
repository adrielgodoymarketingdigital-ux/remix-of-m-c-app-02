import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2 } from "lucide-react";

interface BadgeStatusPerfilProps {
  percentual: number;
  camposFaltando: string[];
}

export function BadgeStatusPerfil({ percentual, camposFaltando }: BadgeStatusPerfilProps) {
  const getVariant = () => {
    if (percentual === 100) return "default";
    if (percentual >= 71) return "secondary";
    if (percentual >= 31) return "outline";
    return "destructive";
  };

  const getIcon = () => {
    if (percentual === 100) {
      return <CheckCircle2 className="h-4 w-4" />;
    }
    return <AlertCircle className="h-4 w-4" />;
  };

  const getTexto = () => {
    if (percentual === 100) return "Perfil Completo";
    if (percentual >= 71) return "Quase Completo";
    if (percentual >= 31) return "Incompleto";
    return "Dados Insuficientes";
  };

  return (
    <div className="flex items-center gap-2">
      <Badge variant={getVariant()} className="gap-1.5">
        {getIcon()}
        {getTexto()} - {percentual}%
      </Badge>
      {camposFaltando.length > 0 && (
        <span className="text-sm text-muted-foreground">
          ({camposFaltando.length} campos faltando)
        </span>
      )}
    </div>
  );
}
