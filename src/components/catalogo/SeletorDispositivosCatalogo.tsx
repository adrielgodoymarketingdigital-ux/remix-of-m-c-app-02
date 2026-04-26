import { useState, useMemo } from "react";
import { ItemCatalogo } from "@/types/catalogo-item";
import { formatCurrency } from "@/lib/formatters";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, CheckSquare, Square, Smartphone, Package } from "lucide-react";

interface SeletorDispositivosCatalogoProps {
  itens: ItemCatalogo[];
  selecionados: string[];
  onSelecionar: (ids: string[]) => void;
}

export function SeletorDispositivosCatalogo({
  itens,
  selecionados,
  onSelecionar,
}: SeletorDispositivosCatalogoProps) {
  const [busca, setBusca] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  const [ordenacao, setOrdenacao] = useState<string>("nome");

  const tiposDisponiveis = useMemo(() => {
    const tipos = new Set<string>();
    itens.forEach((item) => {
      if (item.tipo_item === 'dispositivo' && item.tipo_dispositivo) {
        tipos.add(item.tipo_dispositivo);
      } else if (item.tipo_item === 'produto') {
        tipos.add('Produto');
      } else if (item.tipo_item === 'peca') {
        tipos.add('Peça');
      }
    });
    return Array.from(tipos).sort();
  }, [itens]);

  const itensFiltrados = useMemo(() => {
    let resultado = [...itens];

    if (busca) {
      const termoBusca = busca.toLowerCase();
      resultado = resultado.filter(
        (item) =>
          item.nome.toLowerCase().includes(termoBusca) ||
          (item.subtitulo && item.subtitulo.toLowerCase().includes(termoBusca)) ||
          (item.sku && item.sku.toLowerCase().includes(termoBusca)) ||
          (item.codigo_barras && item.codigo_barras.toLowerCase().includes(termoBusca))
      );
    }

    if (filtroTipo !== "todos") {
      resultado = resultado.filter((item) => {
        if (filtroTipo === 'Produto') return item.tipo_item === 'produto';
        if (filtroTipo === 'Peça') return item.tipo_item === 'peca';
        return item.tipo_dispositivo === filtroTipo;
      });
    }

    switch (ordenacao) {
      case "nome":
        resultado.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
        break;
      case "preco":
        resultado.sort((a, b) => (a.preco || 0) - (b.preco || 0));
        break;
    }

    return resultado;
  }, [itens, busca, filtroTipo, ordenacao]);

  const toggleItem = (id: string) => {
    if (selecionados.includes(id)) {
      onSelecionar(selecionados.filter((s) => s !== id));
    } else {
      onSelecionar([...selecionados, id]);
    }
  };

  const selecionarTodos = () => {
    onSelecionar(itensFiltrados.map((d) => d.id));
  };

  const deselecionarTodos = () => {
    onSelecionar([]);
  };

  const todosVisiveis = itensFiltrados.every((d) => selecionados.includes(d.id));

  const getTipoBadge = (item: ItemCatalogo) => {
    if (item.tipo_item === 'produto') return <Badge variant="outline" className="text-xs">Produto</Badge>;
    if (item.tipo_item === 'peca') return <Badge variant="outline" className="text-xs">Peça</Badge>;
    return <Badge variant="outline" className="text-xs">{item.tipo_dispositivo}</Badge>;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar item..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9"
          />
        </div>
        
        <Select value={filtroTipo} onValueChange={setFiltroTipo}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            {tiposDisponiveis.map((tipo) => (
              <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={ordenacao} onValueChange={setOrdenacao}>
          <SelectTrigger className="w-full sm:w-[150px]">
            <SelectValue placeholder="Ordenar" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="nome">Nome</SelectItem>
            <SelectItem value="preco">Preço</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-lg">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={todosVisiveis ? deselecionarTodos : selecionarTodos}
            className="h-8"
          >
            {todosVisiveis ? (
              <>
                <Square className="w-4 h-4 mr-2" />
                Desmarcar todos
              </>
            ) : (
              <>
                <CheckSquare className="w-4 h-4 mr-2" />
                Selecionar todos
              </>
            )}
          </Button>
        </div>
        <div className="text-sm text-muted-foreground">
          <span className="font-medium text-primary">{selecionados.length}</span> de {itensFiltrados.length} selecionados
        </div>
      </div>

      <div className="max-h-[400px] overflow-y-auto space-y-2 pr-2">
        {itensFiltrados.length > 0 ? (
          itensFiltrados.map((item) => {
            const isSelected = selecionados.includes(item.id);
            const foto = item.foto_url || item.fotos?.[0];

            return (
              <div
                key={item.id}
                onClick={() => toggleItem(item.id)}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                  isSelected
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50 hover:bg-muted/50"
                }`}
              >
                <Checkbox
                  checked={isSelected}
                  onClick={(event) => event.stopPropagation()}
                  onCheckedChange={() => toggleItem(item.id)}
                />

                <div className="w-12 h-12 rounded-lg bg-muted flex-shrink-0 overflow-hidden">
                  {foto ? (
                    <img src={foto} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      {item.tipo_item === 'dispositivo' ? (
                        <Smartphone className="w-6 h-6 text-muted-foreground/30" />
                      ) : (
                        <Package className="w-6 h-6 text-muted-foreground/30" />
                      )}
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{item.nome}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {getTipoBadge(item)}
                    {item.tipo_item === 'dispositivo' && item.capacidade_gb && (
                      <span className="text-xs text-muted-foreground">{item.capacidade_gb}GB</span>
                    )}
                    {item.tipo_item === 'dispositivo' && item.cor && (
                      <span className="text-xs text-muted-foreground">{item.cor}</span>
                    )}
                  </div>
                </div>

                <div className="text-right flex-shrink-0">
                  {item.preco != null && item.preco > 0 && (
                    <div className="font-medium text-primary">{formatCurrency(item.preco)}</div>
                  )}
                  <div className="text-xs text-muted-foreground">{item.quantidade} un.</div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Package className="w-12 h-12 mx-auto mb-2 opacity-30" />
            <p>Nenhum item encontrado</p>
          </div>
        )}
      </div>
    </div>
  );
}
