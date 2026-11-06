import type { ClienteFidelidade, FidelidadeNivel } from "@/types/fidelidade";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Gift, Search } from "lucide-react";
import { CabecalhoFidelidadeDesktop } from "./CabecalhoFidelidadeDesktop";
import { IndicadoresFidelidadeDesktop, type ContagemNivel } from "./IndicadoresFidelidadeDesktop";
import { formatarDataFidelidade, formatarMoedaFidelidade } from "./formatacao";

export type { ContagemNivel };

export interface PaginaFidelidadeDesktopProps {
  clientes: ClienteFidelidade[];
  niveis: FidelidadeNivel[];
  isLoading: boolean;
  busca: string;
  onBuscaChange: (valor: string) => void;
  totalPontosDistribuidos: number;
  contagemNiveis: ContagemNivel[];
  onAbrirConfiguracoes: () => void;
  onResgatar: (cliente: ClienteFidelidade) => void;
}

function NivelBadge({ nivel }: { nivel: FidelidadeNivel | null }) {
  if (!nivel) return <Badge variant="secondary">Sem nível</Badge>;
  return (
    <Badge style={{ backgroundColor: nivel.cor, color: "#fff" }}>
      {nivel.nome}
    </Badge>
  );
}

/**
 * Tela de Fidelidade no computador (>= 1024px). Recebe o mesmo estado e os mesmos
 * handlers da página; não consulta nada nem calcula pontos/níveis.
 */
export function PaginaFidelidadeDesktop({
  clientes,
  isLoading,
  busca,
  onBuscaChange,
  totalPontosDistribuidos,
  contagemNiveis,
  onAbrirConfiguracoes,
  onResgatar,
}: PaginaFidelidadeDesktopProps) {
  const clientesFiltrados = clientes.filter(c =>
    c.nome.toLowerCase().includes(busca.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <CabecalhoFidelidadeDesktop onAbrirConfiguracoes={onAbrirConfiguracoes} />

      <IndicadoresFidelidadeDesktop
        isLoading={isLoading}
        totalClientes={clientes.length}
        totalPontosDistribuidos={totalPontosDistribuidos}
        contagemNiveis={contagemNiveis}
      />

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Buscar cliente..."
          value={busca}
          onChange={e => onBuscaChange(e.target.value)}
        />
      </div>

      {/* Grid de clientes */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-48" />)}
        </div>
      ) : clientesFiltrados.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Gift className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Nenhum cliente no programa ainda</p>
          <p className="text-sm mt-1">Os clientes aparecerão aqui conforme acumulam pontos.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {clientesFiltrados.map(c => (
            <Card key={c.cliente_id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-5 pb-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-base leading-tight">{c.nome}</p>
                    {c.celular && <p className="text-xs text-muted-foreground">{c.celular}</p>}
                  </div>
                  <NivelBadge nivel={c.nivel} />
                </div>

                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-primary">{c.total_pontos.toLocaleString("pt-BR")}</span>
                  <span className="text-sm text-muted-foreground">pts</span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs text-muted-foreground border rounded-lg p-2">
                  <div>
                    <p className="font-semibold text-foreground">{c.total_vendas + c.total_os}</p>
                    <p>compras</p>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{formatarMoedaFidelidade(c.valor_total_gasto)}</p>
                    <p>gasto total</p>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{formatarDataFidelidade(c.ultima_compra)}</p>
                    <p>última compra</p>
                  </div>
                </div>

                <Button
                  size="sm"
                  className="w-full"
                  variant="outline"
                  disabled={c.total_pontos <= 0}
                  onClick={() => onResgatar(c)}
                >
                  <Gift className="w-4 h-4 mr-2" />
                  Resgatar Pontos
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
