import { Novidade } from "@/types/novidade";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, Image as ImageIcon } from "lucide-react";

interface CardNovidadeProps {
  novidade: Novidade;
  onClick?: () => void;
}

export function CardNovidade({ novidade, onClick }: CardNovidadeProps) {
  return (
    <Card 
      className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
      onClick={onClick}
    >
      {novidade.thumbnail_url ? (
        <div className="aspect-video overflow-hidden">
          <img 
            src={novidade.thumbnail_url} 
            alt={novidade.titulo}
            className="w-full h-full object-cover transition-transform hover:scale-105"
          />
        </div>
      ) : (
        <div className="aspect-video bg-muted flex items-center justify-center">
          <ImageIcon className="h-12 w-12 text-muted-foreground" />
        </div>
      )}
      <CardHeader className="pb-2">
        <CardTitle className="text-lg line-clamp-2">{novidade.titulo}</CardTitle>
        {novidade.descricao && (
          <CardDescription className="line-clamp-2">
            {novidade.descricao}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <span>
            {format(new Date(novidade.data_inicio), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
          </span>
        </div>
        <div className="flex flex-wrap gap-1 mt-2">
          <Badge variant="secondary">
            {novidade.conteudo.length} {novidade.conteudo.length === 1 ? 'seção' : 'seções'}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
