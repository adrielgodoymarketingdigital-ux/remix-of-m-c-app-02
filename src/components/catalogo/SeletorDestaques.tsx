import { useState } from "react";
import { Check, Star, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Dispositivo } from "@/types/dispositivo";
import { formatCurrency } from "@/lib/formatters";
import { ValorMonetario } from "@/components/ui/valor-monetario";

interface SeletorDestaquesProps {
  dispositivos: Dispositivo[];
  selecionados: string[];
  onSelecionar: (ids: string[]) => void;
  maxDestaques?: number;
}

export function SeletorDestaques({
  dispositivos,
  selecionados,
  onSelecionar,
  maxDestaques = 3,
}: SeletorDestaquesProps) {
  const [busca, setBusca] = useState("");

  const dispositivosFiltrados = dispositivos.filter((d) => {
    const termo = busca.toLowerCase();
    return (
      d.marca?.toLowerCase().includes(termo) ||
      d.modelo?.toLowerCase().includes(termo)
    );
  });

  const toggleSelecao = (id: string) => {
    if (selecionados.includes(id)) {
      onSelecionar(selecionados.filter((s) => s !== id));
    } else if (selecionados.length < maxDestaques) {
      onSelecionar([...selecionados, id]);
    }
  };

  const removerDestaque = (id: string) => {
    onSelecionar(selecionados.filter((s) => s !== id));
  };

  const dispositivosSelecionados = dispositivos.filter((d) =>
    selecionados.includes(d.id)
  );

  return (
    <div className="space-y-4">
      {/* Dispositivos em destaque */}
      {dispositivosSelecionados.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium flex items-center gap-2">
            <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
            Dispositivos em Destaque ({dispositivosSelecionados.length}/{maxDestaques})
          </p>
          <div className="flex flex-wrap gap-2">
            {dispositivosSelecionados.map((d) => (
              <Badge
                key={d.id}
                variant="secondary"
                className="py-1.5 px-3 flex items-center gap-2"
              >
                {d.marca} {d.modelo}
                <button
                  onClick={() => removerDestaque(d.id)}
                  className="hover:bg-destructive/20 rounded-full p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Busca */}
      <input
        type="text"
        placeholder="Buscar dispositivo..."
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 bg-background"
      />

      {/* Lista de dispositivos */}
      <ScrollArea className="h-[300px] border rounded-lg">
        <div className="p-2 space-y-1">
          {dispositivosFiltrados.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhum dispositivo encontrado
            </p>
          ) : (
            dispositivosFiltrados.map((dispositivo) => {
              const isSelected = selecionados.includes(dispositivo.id);
              const isDisabled = !isSelected && selecionados.length >= maxDestaques;

              return (
                <button
                  key={dispositivo.id}
                  onClick={() => toggleSelecao(dispositivo.id)}
                  disabled={isDisabled}
                  className={cn(
                    "w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all",
                    isSelected
                      ? "bg-primary/10 border-primary border"
                      : "hover:bg-muted border border-transparent",
                    isDisabled && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {/* Imagem */}
                  <div className="w-12 h-12 rounded-md overflow-hidden bg-muted flex-shrink-0">
                    {dispositivo.foto_url ? (
                      <img
                        src={dispositivo.foto_url}
                        alt={`${dispositivo.marca} ${dispositivo.modelo}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                        Sem foto
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {dispositivo.marca} {dispositivo.modelo}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {dispositivo.capacidade_gb && `${dispositivo.capacidade_gb}GB • `}
                      {dispositivo.preco ? <ValorMonetario valor={dispositivo.preco} /> : "Sem preço"}
                    </p>
                  </div>

                  {/* Check */}
                  <div
                    className={cn(
                      "w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0",
                      isSelected
                        ? "bg-primary border-primary text-primary-foreground"
                        : "border-muted-foreground/30"
                    )}
                  >
                    {isSelected && <Check className="w-4 h-4" />}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </ScrollArea>

      {selecionados.length === 0 && (
        <p className="text-xs text-muted-foreground text-center">
          Selecione até {maxDestaques} dispositivos para destacar na landing page
        </p>
      )}
    </div>
  );
}
