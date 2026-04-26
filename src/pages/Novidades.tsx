import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useNovidades } from "@/hooks/useNovidades";
import { useAssinatura } from "@/hooks/useAssinatura";
import { CardNovidade } from "@/components/novidades/CardNovidade";
import { VisualizadorNovidade } from "@/components/novidades/VisualizadorNovidade";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Novidade } from "@/types/novidade";
import { Sparkles, ArrowLeft } from "lucide-react";

export default function Novidades() {
  const { assinatura } = useAssinatura();
  const { data: novidades, isLoading } = useNovidades(assinatura?.plano_tipo);
  const [novidadeSelecionada, setNovidadeSelecionada] = useState<Novidade | null>(null);

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-600">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Novidades</h1>
            <p className="text-muted-foreground">
              Confira as últimas atualizações e novidades do sistema
            </p>
          </div>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="aspect-video w-full" />
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && (!novidades || novidades.length === 0) && (
          <div className="text-center py-12">
            <Sparkles className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhuma novidade disponível</h3>
            <p className="text-muted-foreground">
              Fique atento! Em breve teremos novidades para você.
            </p>
          </div>
        )}

        {/* Grid de Novidades */}
        {!isLoading && novidades && novidades.length > 0 && (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {novidades.map((novidade) => (
              <CardNovidade
                key={novidade.id}
                novidade={novidade}
                onClick={() => setNovidadeSelecionada(novidade)}
              />
            ))}
          </div>
        )}

        {/* Dialog de Visualização */}
        <Dialog 
          open={!!novidadeSelecionada} 
          onOpenChange={(open) => !open && setNovidadeSelecionada(null)}
        >
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center gap-2">
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => setNovidadeSelecionada(null)}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <DialogTitle>{novidadeSelecionada?.titulo}</DialogTitle>
              </div>
              {novidadeSelecionada?.descricao && (
                <p className="text-muted-foreground">
                  {novidadeSelecionada.descricao}
                </p>
              )}
            </DialogHeader>
            
            {novidadeSelecionada && (
              <VisualizadorNovidade conteudo={novidadeSelecionada.conteudo} />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
