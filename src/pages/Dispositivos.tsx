import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Plus, Grid3x3, Table as TableIcon, Smartphone, ShoppingCart, Settings, Layout, FileText, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DialogConfiguracaoLayoutDispositivos } from "@/components/dispositivos/DialogConfiguracaoLayoutDispositivos";
import { DialogConfiguracaoTermoGarantiaDispositivo } from "@/components/dispositivos/DialogConfiguracaoTermoGarantiaDispositivo";
import { useDispositivos } from "@/hooks/useDispositivos";
import { useAssinatura } from "@/hooks/useAssinatura";
import { useFuncionarioPermissoes } from "@/hooks/useFuncionarioPermissoes";
import { DialogCadastroDispositivo } from "@/components/dispositivos/DialogCadastroDispositivo";
import { DialogLimiteAtingido } from "@/components/planos/DialogLimiteAtingido";
import { TabelaDispositivos } from "@/components/dispositivos/TabelaDispositivos";
import { GridDispositivos } from "@/components/dispositivos/GridDispositivos";
import { CardInventario } from "@/components/produtos/CardInventario";
import { Dispositivo, FormularioDispositivo } from "@/types/dispositivo";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { BotaoScanner } from "@/components/scanner/LeitorCodigoBarras";
import { AppLayout } from "@/components/layout/AppLayout";
import { SecaoDispositivosVendidos } from "@/components/dispositivos/SecaoDispositivosVendidos";
import { SecaoDispositivosExcluidos } from "@/components/dispositivos/SecaoDispositivosExcluidos";

export default function Dispositivos() {
  const navigate = useNavigate();
  const [busca, setBusca] = useState("");
  const [abaAtiva, setAbaAtiva] = useState<"estoque" | "vendidos" | "excluidos">("estoque");
  const [filtroGarantia, setFiltroGarantia] = useState<"todos" | "com" | "sem">("todos");
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  const [filtroCondicao, setFiltroCondicao] = useState<string>("todos");
  const [visualizacao, setVisualizacao] = useState<"grid" | "tabela">("grid");
  const [dialogAberto, setDialogAberto] = useState(false);
  const [dialogLimiteAtingido, setDialogLimiteAtingido] = useState(false);
  const [contadorDispositivos, setContadorDispositivos] = useState({ usados: 0, limite: -1 });
  const [dispositivoParaEditar, setDispositivoParaEditar] = useState<Dispositivo | null>(null);
  const [dialogLayoutDispositivos, setDialogLayoutDispositivos] = useState(false);
  const [dialogTermoGarantiaDispositivo, setDialogTermoGarantiaDispositivo] = useState(false);

  const {
    dispositivos,
    loading,
    criarDispositivo,
    atualizarDispositivo,
    excluirDispositivo,
  } = useDispositivos();

  const { obterContagemDispositivos, assinatura, limites } = useAssinatura();
  const { isFuncionario, permissoes } = useFuncionarioPermissoes();

  const resumoInventario = useMemo(() => {
    const naoVendidos = dispositivos.filter(d => !d.vendido);
    return {
      quantidade: naoVendidos.reduce((s, d) => s + d.quantidade, 0),
      custo: naoVendidos.reduce((s, d) => s + (d.custo || 0) * d.quantidade, 0),
      venda: naoVendidos.reduce((s, d) => s + (d.preco || 0) * d.quantidade, 0),
      lucro: naoVendidos.reduce((s, d) => s + ((d.preco || 0) - (d.custo || 0)) * d.quantidade, 0),
    };
  }, [dispositivos]);

  const carregarContador = async () => {
    const dados = await obterContagemDispositivos();
    setContadorDispositivos({ usados: dados.usados, limite: dados.limite === Infinity ? -1 : dados.limite });
  };

  // Recarregar quando limites mudam (assinatura carregou)
  useEffect(() => {
    carregarContador();
  }, [limites.dispositivos]);

  // Tipos fixos disponíveis no sistema
  const TIPOS_FIXOS = [
    "Celular",
    "Tablet", 
    "Notebook/Computador",
    "Relógio Smart"
  ];

  const tiposDisponiveis = useMemo(() => {
    // Combinar tipos fixos com tipos do banco (removendo duplicatas e valores vazios)
    const tiposDoBanco = dispositivos
      .map(d => d.tipo)
      .filter(tipo => tipo && tipo.trim() !== '');
    const todosOsTipos = [...TIPOS_FIXOS, ...tiposDoBanco];
    const tiposUnicos = Array.from(new Set(todosOsTipos));
    return tiposUnicos.sort();
  }, [dispositivos]);

  const dispositivosFiltrados = useMemo(() => {
    let resultado = dispositivos;

    if (busca.trim()) {
      const termo = busca.toLowerCase().trim();
      resultado = resultado.filter(
        (dispositivo) =>
          dispositivo.marca.toLowerCase().includes(termo) ||
          dispositivo.modelo.toLowerCase().includes(termo) ||
          dispositivo.imei?.toLowerCase().includes(termo) ||
          dispositivo.numero_serie?.toLowerCase().includes(termo) ||
          dispositivo.codigo_barras?.toLowerCase().includes(termo)
      );
    }

    if (filtroGarantia === "com") {
      resultado = resultado.filter((d) => d.garantia);
    } else if (filtroGarantia === "sem") {
      resultado = resultado.filter((d) => !d.garantia);
    }

    if (filtroTipo !== "todos") {
      resultado = resultado.filter((d) => d.tipo === filtroTipo);
    }

    if (filtroCondicao !== "todos") {
      resultado = resultado.filter((d) => d.condicao === filtroCondicao);
    }

    return resultado;
  }, [dispositivos, busca, filtroGarantia, filtroTipo, filtroCondicao]);

  const handleSubmit = async (dados: FormularioDispositivo) => {
    if (dispositivoParaEditar) {
      await atualizarDispositivo(dispositivoParaEditar.id, dados);
      setDialogAberto(false);
      setDispositivoParaEditar(null);
    } else {
      const dispositivo = await criarDispositivo(dados);
      if (dispositivo) {
        setDialogAberto(false);
        
        // Oferecer registrar origem/compra
        toast(
          <div className="flex flex-col gap-2">
            <p className="font-semibold">Dispositivo cadastrado!</p>
            <p className="text-sm text-muted-foreground">
              Deseja registrar a origem/compra deste dispositivo?
            </p>
            <div className="flex gap-2 mt-2">
              <Button
                size="sm"
                onClick={() => {
                  toast.dismiss();
                  navigate(`/origem-dispositivos?novo=true&dispositivo=${dispositivo.id}`);
                }}
              >
                Sim, registrar origem
              </Button>
              <Button size="sm" variant="outline" onClick={() => toast.dismiss()}>
                Não, agora não
              </Button>
            </div>
          </div>,
          { duration: 10000 }
        );
      }
    }
  };

  const handleEditar = (dispositivo: Dispositivo) => {
    setDispositivoParaEditar(dispositivo);
    setDialogAberto(true);
  };

  const handleExcluir = async (id: string) => {
    await excluirDispositivo(id);
  };

  const handleNovoDispositivo = () => {
    // Verificar limite antes de abrir o dialog
    if (assinatura?.plano_tipo === 'free' && contadorDispositivos.limite !== -1 && contadorDispositivos.usados >= contadorDispositivos.limite) {
      setDialogLimiteAtingido(true);
      return;
    }
    setDispositivoParaEditar(null);
    setDialogAberto(true);
  };

  return (
    <AppLayout>
      <main className="flex-1 p-6 overflow-auto">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Dispositivos</h1>
              <p className="text-muted-foreground">
                Gerencie o estoque de dispositivos
              </p>
            </div>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <Settings className="h-4 w-4" />
                    <span className="hidden sm:inline">Configurações</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setDialogLayoutDispositivos(true)}>
                    <Layout className="h-4 w-4 mr-2" />
                    Layout de Impressão
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setDialogTermoGarantiaDispositivo(true)}>
                    <FileText className="h-4 w-4 mr-2" />
                    Termo de Garantia
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              {abaAtiva === "estoque" && (
                <Button onClick={handleNovoDispositivo}>
                  <Plus className="mr-2 h-4 w-4" />
                  Novo Dispositivo
                </Button>
              )}
            </div>
          </div>

          {/* Tabs Estoque / Vendidos */}
          <Tabs value={abaAtiva} onValueChange={(v) => setAbaAtiva(v as any)}>
            <TabsList>
              <TabsTrigger value="estoque" className="flex items-center gap-2">
                <Smartphone className="h-4 w-4" />
                <span>Estoque</span>
              </TabsTrigger>
              <TabsTrigger value="vendidos" className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" />
                <span>Vendidos</span>
              </TabsTrigger>
              <TabsTrigger value="excluidos" className="flex items-center gap-2">
                <Trash2 className="h-4 w-4" />
                <span>Excluídos</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {abaAtiva === "vendidos" ? (
            <SecaoDispositivosVendidos />
          ) : abaAtiva === "excluidos" ? (
            <SecaoDispositivosExcluidos />
          ) : (
            <>

          {/* Card de Inventário */}
          {(!isFuncionario || permissoes?.recursos?.ver_inventario) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <CardInventario
                titulo="Estoque de Dispositivos"
                icon={Smartphone}
                iconColor="text-violet-500"
                totalQuantidade={resumoInventario.quantidade}
                valorCusto={resumoInventario.custo}
                valorVenda={resumoInventario.venda}
                valorLucro={resumoInventario.lucro}
              />
            </div>
          )}

          <div className="space-y-4">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="relative flex-1 max-w-md flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por marca, modelo, IMEI, série ou código..."
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <BotaoScanner onCodigoLido={(codigo) => setBusca(codigo)} />
              </div>

              <div className="flex gap-2 ml-auto">
                <Button
                  variant={visualizacao === "grid" ? "default" : "outline"}
                  onClick={() => setVisualizacao("grid")}
                  className="flex items-center gap-2"
                >
                  <Grid3x3 className="h-4 w-4" />
                  <span className="hidden sm:inline">Grade</span>
                </Button>
                <Button
                  variant={visualizacao === "tabela" ? "default" : "outline"}
                  onClick={() => setVisualizacao("tabela")}
                  className="flex items-center gap-2"
                >
                  <TableIcon className="h-4 w-4" />
                  <span className="hidden sm:inline">Lista</span>
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Tipo:</span>
                <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Todos os tipos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    {tiposDisponiveis.map((tipo) => (
                      <SelectItem key={tipo} value={tipo}>
                        {tipo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Condição:</span>
                <Select value={filtroCondicao} onValueChange={setFiltroCondicao}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Todas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todas</SelectItem>
                    <SelectItem value="novo">Novo</SelectItem>
                    <SelectItem value="semi_novo">Semi Novo</SelectItem>
                    <SelectItem value="usado">Usado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Tabs
                value={filtroGarantia}
                onValueChange={(value) => setFiltroGarantia(value as any)}
              >
                <TabsList>
                  <TabsTrigger value="todos">Todos</TabsTrigger>
                  <TabsTrigger value="com">Com Garantia</TabsTrigger>
                  <TabsTrigger value="sem">Sem Garantia</TabsTrigger>
                </TabsList>
              </Tabs>

              <div className="text-sm text-muted-foreground ml-auto">
                {dispositivosFiltrados.length} dispositivo(s) encontrado(s)
              </div>
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-[400px] w-full" />
              ))}
            </div>
          ) : visualizacao === "grid" ? (
            <GridDispositivos
              dispositivos={dispositivosFiltrados}
              onEditar={handleEditar}
              onExcluir={handleExcluir}
            />
          ) : (
            <TabelaDispositivos
              dispositivos={dispositivosFiltrados}
              onEditar={handleEditar}
              onExcluir={handleExcluir}
            />
          )}
          </>
          )}
        </div>
      </main>

      <DialogCadastroDispositivo
        open={dialogAberto}
        onOpenChange={setDialogAberto}
        onSubmit={handleSubmit}
        dispositivoParaEditar={dispositivoParaEditar}
      />

      {/* Dialog de Limite Atingido */}
      <DialogLimiteAtingido
        open={dialogLimiteAtingido}
        onOpenChange={setDialogLimiteAtingido}
        tipo="dispositivos"
        usados={contadorDispositivos.usados}
        limite={contadorDispositivos.limite}
      />

      <DialogConfiguracaoLayoutDispositivos
        open={dialogLayoutDispositivos}
        onOpenChange={setDialogLayoutDispositivos}
      />

      <DialogConfiguracaoTermoGarantiaDispositivo
        open={dialogTermoGarantiaDispositivo}
        onOpenChange={setDialogTermoGarantiaDispositivo}
      />
    </AppLayout>
  );
}
