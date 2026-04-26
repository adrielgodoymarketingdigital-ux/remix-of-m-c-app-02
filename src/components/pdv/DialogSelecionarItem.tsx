import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useDispositivos } from "@/hooks/useDispositivos";
import { useProdutos } from "@/hooks/useProdutos";
import { formatCurrency } from "@/lib/formatters";
import { Smartphone, Package, Search } from "lucide-react";
import { BotaoScanner } from "@/components/scanner/LeitorCodigoBarras";

export interface ItemVenda {
  id: string;
  tipo: "dispositivo" | "produto" | "peca";
  nome: string;
  preco: number;
  custo: number;
  quantidade: number;
  estoque: number;
  dispositivo_id?: string;
  produto_id?: string;
  peca_id?: string;
}

interface DialogSelecionarItemProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdicionarItem: (item: ItemVenda) => void;
}

export const DialogSelecionarItem = ({
  open,
  onOpenChange,
  onAdicionarItem,
}: DialogSelecionarItemProps) => {
  const { dispositivos, carregarDispositivos } = useDispositivos();
  const { items: produtos, carregarTodos: carregarProdutos } = useProdutos();
  const [busca, setBusca] = useState("");
  const [quantidades, setQuantidades] = useState<Record<string, number>>({});

  useEffect(() => {
    if (open) {
      carregarDispositivos();
      carregarProdutos();
    }
  }, [open]);

  const dispositivosVenda = dispositivos.filter(
    (d) => !d.vendido && d.quantidade > 0
  );

  // Mostrar todos os produtos/peças, mesmo com estoque zero ou negativo
  const produtosVenda = produtos;

  const filtrarDispositivos = dispositivosVenda.filter(
    (d) =>
      d.marca.toLowerCase().includes(busca.toLowerCase()) ||
      d.modelo.toLowerCase().includes(busca.toLowerCase()) ||
      d.tipo.toLowerCase().includes(busca.toLowerCase()) ||
      d.codigo_barras?.toLowerCase().includes(busca.toLowerCase())
  );

  const filtrarProdutos = produtosVenda.filter((p) =>
    p.nome.toLowerCase().includes(busca.toLowerCase()) ||
    (p.tipo === 'produto' && p.sku?.toLowerCase().includes(busca.toLowerCase())) ||
    p.codigo_barras?.toLowerCase().includes(busca.toLowerCase())
  );

  const handleAdicionarDispositivo = (dispositivo: any) => {
    const quantidade = quantidades[dispositivo.id] || 1;
    onAdicionarItem({
      id: dispositivo.id,
      tipo: "dispositivo",
      nome: `${dispositivo.marca} ${dispositivo.modelo}`,
      preco: Number(dispositivo.preco || 0),
      custo: Number(dispositivo.custo || 0),
      quantidade,
      estoque: dispositivo.quantidade,
      dispositivo_id: dispositivo.id,
    });
    setQuantidades((prev) => ({ ...prev, [dispositivo.id]: 1 }));
    onOpenChange(false);
  };

  const handleAdicionarProduto = (produto: any) => {
    const quantidade = quantidades[produto.id] || 1;
    // Usar o tipo real do item (produto ou peca)
    const tipoReal = produto.tipo as "produto" | "peca";
    onAdicionarItem({
      id: produto.id,
      tipo: tipoReal,
      nome: produto.nome,
      preco: Number(produto.preco || 0),
      custo: Number(produto.custo || 0),
      quantidade,
      estoque: produto.quantidade,
      // Preencher campos específicos baseado no tipo
      produto_id: tipoReal === "produto" ? produto.id : undefined,
      peca_id: tipoReal === "peca" ? produto.id : undefined,
    });
    setQuantidades((prev) => ({ ...prev, [produto.id]: 1 }));
    onOpenChange(false);
  };

  const setQuantidade = (id: string, qtd: number) => {
    setQuantidades((prev) => ({ ...prev, [id]: Math.max(1, qtd) }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Adicionar Item à Venda</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, marca, modelo ou código..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="pl-10"
              />
            </div>
            <BotaoScanner onCodigoLido={(codigo) => setBusca(codigo)} />
          </div>

          <Tabs defaultValue="dispositivos">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="dispositivos">
                <Smartphone className="h-4 w-4 mr-2" />
                Dispositivos
              </TabsTrigger>
              <TabsTrigger value="produtos">
                <Package className="h-4 w-4 mr-2" />
                Produtos
              </TabsTrigger>
            </TabsList>

            <TabsContent value="dispositivos" className="space-y-2 mt-4">
              {filtrarDispositivos.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum dispositivo disponível
                </div>
              ) : (
                filtrarDispositivos.map((dispositivo) => (
                  <div
                    key={dispositivo.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="font-medium">
                        {dispositivo.marca} {dispositivo.modelo}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline">{dispositivo.tipo}</Badge>
                        <span className="text-sm text-muted-foreground">
                          Estoque: {dispositivo.quantidade}
                        </span>
                      </div>
                      <div className="text-lg font-semibold mt-1">
                        {formatCurrency(Number(dispositivo.preco || 0))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="space-y-2">
                        <Label className="text-xs">Quantidade</Label>
                        <Input
                          type="number"
                          min="1"
                          max={dispositivo.quantidade}
                          value={quantidades[dispositivo.id] || 1}
                          onChange={(e) =>
                            setQuantidade(
                              dispositivo.id,
                              parseInt(e.target.value) || 1
                            )
                          }
                          className="w-20"
                        />
                      </div>
                      <Button
                        onClick={() => handleAdicionarDispositivo(dispositivo)}
                        className="self-end"
                      >
                        Adicionar
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </TabsContent>

            <TabsContent value="produtos" className="space-y-2 mt-4">
              {filtrarProdutos.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum produto disponível
                </div>
              ) : (
                filtrarProdutos.map((produto) => (
                  <div
                    key={produto.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="font-medium">{produto.nome}</div>
                      <div className="flex items-center gap-2 mt-1">
                        {produto.tipo === "produto" && "sku" in produto && produto.sku && (
                          <Badge variant="outline">{produto.sku}</Badge>
                        )}
                        <span className="text-sm text-muted-foreground">
                          Estoque: {produto.quantidade}
                        </span>
                        {produto.quantidade === 0 && (
                          <Badge variant="outline" className="text-orange-500 border-orange-500">
                            Sem estoque
                          </Badge>
                        )}
                        {produto.quantidade < 0 && (
                          <Badge variant="destructive">
                            Negativo
                          </Badge>
                        )}
                      </div>
                      <div className="text-lg font-semibold mt-1">
                        {formatCurrency(Number(produto.preco || 0))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="space-y-2">
                        <Label className="text-xs">Quantidade</Label>
                        <Input
                          type="number"
                          min="1"
                          value={quantidades[produto.id] || 1}
                          onChange={(e) =>
                            setQuantidade(produto.id, parseInt(e.target.value) || 1)
                          }
                          className="w-20"
                        />
                      </div>
                      <Button
                        onClick={() => handleAdicionarProduto(produto)}
                        className="self-end"
                      >
                        Adicionar
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
};
