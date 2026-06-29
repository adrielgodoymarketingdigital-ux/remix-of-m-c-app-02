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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SeletorTempoGarantia } from "@/components/dispositivos/SeletorTempoGarantia";
import { useConfiguracaoLoja } from "@/hooks/useConfiguracaoLoja";
import {
  ModeloGarantia,
  TermoGarantiaDispositivoConfig,
  MODELOS_PADRAO_GARANTIA,
} from "@/components/dispositivos/DialogConfiguracaoTermoGarantiaDispositivo";

export interface ItemVenda {
  id: string;
  tipo: "dispositivo" | "produto" | "peca";
  nome: string;
  preco: number;
  precoOriginal?: number;
  custo: number;
  quantidade: number;
  estoque: number;
  dispositivo_id?: string;
  produto_id?: string;
  peca_id?: string;
  imei_dispositivo?: string;
  imei?: string;
  condicao?: string;
  cor?: string;
  capacidade_gb?: number;
  numero_serie?: string;
  tempo_garantia?: number;
  modelo_termo_garantia_id?: string;
}

export const MODELO_TERMO_GLOBAL = "__global__";

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
  const { config: configLoja } = useConfiguracaoLoja();
  const [busca, setBusca] = useState("");
  const [quantidades, setQuantidades] = useState<Record<string, number>>({});
  const [imeisSelecionados, setImeisSelecionados] = useState<Record<string, string>>({});
  const [garantiaPendenteId, setGarantiaPendenteId] = useState<string | null>(null);
  const [garantiaMeses, setGarantiaMeses] = useState<number | undefined>(undefined);
  const [modeloTermoId, setModeloTermoId] = useState<string>(MODELO_TERMO_GLOBAL);

  const termoConfig = configLoja?.termo_garantia_dispositivo_config as TermoGarantiaDispositivoConfig | undefined;
  const modelosSalvos: ModeloGarantia[] = termoConfig?.modelos?.length ? termoConfig.modelos : MODELOS_PADRAO_GARANTIA;

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
      d.codigo_barras?.toLowerCase().includes(busca.toLowerCase()) ||
      (d.imeis as string[])?.some((imei) =>
        imei.toLowerCase().includes(busca.toLowerCase())
      )
  );

  const filtrarProdutos = produtosVenda.filter((p) =>
    p.nome.toLowerCase().includes(busca.toLowerCase()) ||
    (p.tipo === 'produto' && p.sku?.toLowerCase().includes(busca.toLowerCase())) ||
    p.codigo_barras?.toLowerCase().includes(busca.toLowerCase())
  );

  const handleAdicionarDispositivo = (dispositivo: any) => {
    const temImeis = dispositivo.imeis && dispositivo.imeis.length > 0;
    if (temImeis && !imeisSelecionados[dispositivo.id]) {
      setImeisSelecionados((prev) => ({ ...prev, [dispositivo.id]: "__pendente__" }));
      return;
    }
    if (garantiaPendenteId !== dispositivo.id) {
      setGarantiaPendenteId(dispositivo.id);
      setGarantiaMeses(dispositivo.garantia ? dispositivo.tempo_garantia : undefined);
      setModeloTermoId(MODELO_TERMO_GLOBAL);
      return;
    }
    const imei = imeisSelecionados[dispositivo.id] !== "__pendente__"
      ? imeisSelecionados[dispositivo.id]
      : (dispositivo.imei || undefined);
    const quantidade = quantidades[dispositivo.id] || 1;
    onAdicionarItem({
      id: dispositivo.id,
      tipo: "dispositivo",
      nome: `${dispositivo.marca} ${dispositivo.modelo}`,
      preco: Number(dispositivo.preco || 0),
      precoOriginal: Number(dispositivo.preco || 0),
      custo: Number(dispositivo.custo || 0),
      quantidade,
      estoque: dispositivo.quantidade,
      dispositivo_id: dispositivo.id,
      imei_dispositivo: imei,
      imei: dispositivo.imei || undefined,
      condicao: dispositivo.condicao || undefined,
      tempo_garantia: garantiaMeses,
      modelo_termo_garantia_id: modeloTermoId !== MODELO_TERMO_GLOBAL ? modeloTermoId : undefined,
    });
    setQuantidades((prev) => ({ ...prev, [dispositivo.id]: 1 }));
    setImeisSelecionados((prev) => { const n = { ...prev }; delete n[dispositivo.id]; return n; });
    setGarantiaPendenteId(null);
    setGarantiaMeses(undefined);
    setModeloTermoId(MODELO_TERMO_GLOBAL);
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
      precoOriginal: Number(produto.preco || 0),
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

          <Tabs defaultValue="produtos">
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
                filtrarDispositivos.map((dispositivo) => {
                  const temImeis = dispositivo.imeis && (dispositivo.imeis as string[]).length > 0;
                  const aguardandoImei = imeisSelecionados[dispositivo.id] === "__pendente__";
                  const imeiEscolhido = imeisSelecionados[dispositivo.id];
                  const aguardandoGarantia = !aguardandoImei && garantiaPendenteId === dispositivo.id;
                  return (
                  <div
                    key={dispositivo.id}
                    className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="font-medium">
                          {dispositivo.marca} {dispositivo.modelo}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline">{dispositivo.tipo}</Badge>
                          <span className="text-sm text-muted-foreground">
                            Estoque: {dispositivo.quantidade}
                          </span>
                          {temImeis && (
                            <Badge variant="secondary" className="text-xs">
                              {(dispositivo.imeis as string[]).length} IMEI{(dispositivo.imeis as string[]).length > 1 ? "s" : ""}
                            </Badge>
                          )}
                        </div>
                        <div className="text-lg font-semibold mt-1">
                          {formatCurrency(Number(dispositivo.preco || 0))}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {!temImeis && (
                          <div className="space-y-2">
                            <Label className="text-xs">Quantidade</Label>
                            <Input
                              type="number"
                              min="1"
                              max={dispositivo.quantidade}
                              value={quantidades[dispositivo.id] || 1}
                              onChange={(e) =>
                                setQuantidade(dispositivo.id, parseInt(e.target.value) || 1)
                              }
                              className="w-20"
                            />
                          </div>
                        )}
                        <Button
                          onClick={() => handleAdicionarDispositivo(dispositivo)}
                          className="self-end"
                          disabled={aguardandoImei && !imeiEscolhido}
                        >
                          Adicionar
                        </Button>
                      </div>
                    </div>

                    {/* Seleção de IMEI — aparece após clicar Adicionar */}
                    {aguardandoImei && (
                      <div className="mt-3 pt-3 border-t space-y-2">
                        <Label className="text-sm font-medium">Selecione o IMEI da unidade a vender</Label>
                        <div className="flex gap-2">
                          <Select
                            value={imeiEscolhido === "__pendente__" ? "" : (imeiEscolhido || "")}
                            onValueChange={(v) =>
                              setImeisSelecionados((prev) => ({ ...prev, [dispositivo.id]: v }))
                            }
                          >
                            <SelectTrigger className="flex-1">
                              <SelectValue placeholder="Selecionar IMEI" />
                            </SelectTrigger>
                            <SelectContent>
                              {(dispositivo.imeis as string[]).map((imei: string) => (
                                <SelectItem key={imei} value={imei}>
                                  {imei}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            onClick={() => handleAdicionarDispositivo(dispositivo)}
                            disabled={!imeiEscolhido || imeiEscolhido === "__pendente__"}
                          >
                            Confirmar
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Seleção de garantia — aparece após IMEI (se houver) e antes de adicionar ao carrinho */}
                    {aguardandoGarantia && (
                      <div className="mt-3 pt-3 border-t space-y-3">
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Tempo de garantia para o recibo</Label>
                          <SeletorTempoGarantia value={garantiaMeses} onChange={setGarantiaMeses} />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Modelo do termo</Label>
                          <Select value={modeloTermoId} onValueChange={setModeloTermoId}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={MODELO_TERMO_GLOBAL}>Configuração global</SelectItem>
                              {modelosSalvos.map((m) => (
                                <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex justify-end">
                          <Button onClick={() => handleAdicionarDispositivo(dispositivo)}>
                            Confirmar
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                  );
                })
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
