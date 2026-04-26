import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ValorMonetario } from "@/components/ui/valor-monetario";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface CardFinanceiroClicavelProps {
  titulo: string;
  valor?: number;
  quantidade?: number;
  subtitulo?: string;
  icon: LucideIcon;
  iconColor?: string;
  valorColor?: string;
  ativo?: boolean;
  onClick?: () => void;
  tipo?: "valor" | "quantidade" | "percentual";
}

export function CardFinanceiroClicavel({
  titulo,
  valor,
  quantidade,
  subtitulo,
  icon: Icon,
  iconColor = "text-muted-foreground",
  valorColor,
  ativo,
  onClick,
  tipo = "valor",
}: CardFinanceiroClicavelProps) {
  return (
    <Card
      className={cn(
        "transition-all hover:shadow-md overflow-hidden",
        onClick && "cursor-pointer",
        ativo && "ring-2 ring-primary shadow-md"
      )}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1">
        <CardTitle className="text-xs font-medium truncate pr-1">{titulo}</CardTitle>
        <Icon className={cn("h-3.5 w-3.5 shrink-0", iconColor)} />
      </CardHeader>
      <CardContent className="p-3 pt-0">
        {tipo === "valor" && (
          <div className={cn("text-base xl:text-lg font-bold truncate", valorColor)}>
            <ValorMonetario valor={valor ?? 0} />
          </div>
        )}
        {tipo === "quantidade" && (
          <div className={cn("text-base xl:text-lg font-bold", valorColor)}>
            {quantidade ?? 0}
          </div>
        )}
        {tipo === "percentual" && (
          <div className={cn("text-base xl:text-lg font-bold truncate", valorColor)}>
            {(valor ?? 0).toFixed(2)}%
          </div>
        )}
        {subtitulo && (
          <p className="text-[10px] text-muted-foreground truncate">{subtitulo}</p>
        )}
      </CardContent>
    </Card>
  );
}
