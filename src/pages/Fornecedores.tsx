import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, Plus, Search, Truck, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DialogCadastroFornecedor } from "@/components/fornecedores/DialogCadastroFornecedor";
import { TabelaFornecedores } from "@/components/fornecedores/TabelaFornecedores";
import { TabelaFornecedoresDesktop } from "@/components/fornecedores/TabelaFornecedoresDesktop";
import { DialogFichaFornecedor } from "@/components/fornecedores/DialogFichaFornecedor";
import { usePodeVerContas } from "@/hooks/usePodeVerContas";
import { useFornecedores } from "@/hooks/useFornecedores";
import { Fornecedor } from "@/types/fornecedor";
import { Skeleton } from "@/components/ui/skeleton";
import { AppLayout } from "@/components/layout/AppLayout";
import { useIsDesktop } from "@/hooks/use-mobile";

export default function Fornecedores() {
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<"todos" | "ativo" | "inativo">("todos");
  const [filtroTipo, setFiltroTipo] = useState<"todos" | "juridica" | "fisica">("todos");
  const [dialogAberto, setDialogAberto] = useState(false);
  const [fornecedorEditando, setFornecedorEditando] = useState<Fornecedor | null>(null);
  const [fornecedorFicha, setFornecedorFicha] = useState<Fornecedor | null>(null);
  // Ficha mostra contas: só com o módulo Contas liberado (mesma regra da rota /contas).
  const podeVerContas = usePodeVerContas();
  const isDesktop = useIsDesktop();

  const {
    fornecedores,
    loading,
    criarFornecedor,
    atualizarFornecedor,
    excluirFornecedor,
  } = useFornecedores();

  const fornecedoresFiltrados = useMemo(() => {
    return fornecedores.filter((fornecedor) => {
      const buscaLower = busca.toLowerCase();
      const matchBusca =
        fornecedor.nome.toLowerCase().includes(buscaLower) ||
        fornecedor.nome_fantasia?.toLowerCase().includes(buscaLower) ||
        fornecedor.cnpj?.includes(busca) ||
        fornecedor.cpf?.includes(busca) ||
        fornecedor.email?.toLowerCase().includes(buscaLower);

      const matchStatus =
        filtroStatus === "todos" ||
        (filtroStatus === "ativo" && fornecedor.ativo) ||
        (filtroStatus === "inativo" && !fornecedor.ativo);

      const matchTipo =
        filtroTipo === "todos" || fornecedor.tipo === filtroTipo;

      return matchBusca && matchStatus && matchTipo;
    });
  }, [fornecedores, busca, filtroStatus, filtroTipo]);

  const handleSubmit = async (dados: any) => {
    if (fornecedorEditando) {
      return await atualizarFornecedor(fornecedorEditando.id, dados);
    } else {
      return await criarFornecedor(dados);
    }
  };

  const handleEditar = (fornecedor: Fornecedor) => {
    setFornecedorEditando(fornecedor);
    setDialogAberto(true);
  };

  const handleNovoFornecedor = () => {
    setFornecedorEditando(null);
    setDialogAberto(true);
  };

  const handleExcluir = async (id: string) => {
    await excluirFornecedor(id);
  };

  return (
    <AppLayout>
      {isDesktop ? (
        // Computador (>= 1024px): mesmo estado e mesmos handlers, só o visual muda.
        // Abaixo disso segue o layout de sempre (ramo de baixo, intocado).
        <main className="flex-1 p-6 space-y-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-4">
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-500 text-white shadow-lg shadow-blue-500/20">
                <Truck className="h-7 w-7" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <h1 className="text-[28px] font-bold leading-9 tracking-tight">Fornecedores</h1>
                <p className="text-sm leading-5 text-muted-foreground">
                  Cadastre e gerencie seus fornecedores
                </p>
              </div>
            </div>
            <Button onClick={handleNovoFornecedor} className="h-11 shrink-0 rounded-xl px-5">
              <Plus className="h-4 w-4 mr-2" />
              Novo Fornecedor
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {[
              { rotulo: "Total de Fornecedores", valor: fornecedores.length, Icone: Users, cor: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
              { rotulo: "Fornecedores Ativos", valor: fornecedores.filter((f) => f.ativo).length, Icone: CheckCircle2, cor: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
              { rotulo: "Resultados da Busca", valor: fornecedoresFiltrados.length, Icone: Search, cor: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
            ].map(({ rotulo, valor, Icone, cor }) => (
              <Card key={rotulo} className="flex items-center gap-4 rounded-2xl p-5 shadow-sm">
                <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ${cor}`}>
                  <Icone className="h-6 w-6" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm text-muted-foreground">{rotulo}</p>
                  {loading ? (
                    <Skeleton className="mt-1.5 h-7 w-12" />
                  ) : (
                    <p className="text-2xl font-bold tabular-nums leading-9">{valor}</p>
                  )}
                </div>
              </Card>
            ))}
          </div>

          <Card className="rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="relative min-w-0 flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <Input
                  placeholder="Buscar por nome, documento, email..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="h-11 rounded-xl pl-10"
                />
              </div>

              <Select value={filtroTipo} onValueChange={(v) => setFiltroTipo(v as typeof filtroTipo)}>
                <SelectTrigger className="h-11 w-[200px] shrink-0 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os Tipos</SelectItem>
                  <SelectItem value="juridica">Pessoa Jurídica</SelectItem>
                  <SelectItem value="fisica">Pessoa Física</SelectItem>
                </SelectContent>
              </Select>

              <Tabs value={filtroStatus} onValueChange={(v) => setFiltroStatus(v as typeof filtroStatus)} className="shrink-0">
                <TabsList className="grid h-11 grid-cols-3 rounded-xl p-1">
                  <TabsTrigger value="todos" className="h-9 rounded-lg px-5">Todos</TabsTrigger>
                  <TabsTrigger value="ativo" className="h-9 rounded-lg px-5">Ativos</TabsTrigger>
                  <TabsTrigger value="inativo" className="h-9 rounded-lg px-5">Inativos</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </Card>

          <TabelaFornecedoresDesktop
            fornecedores={fornecedoresFiltrados}
            carregando={loading}
            filtroAtivo={busca !== "" || filtroStatus !== "todos" || filtroTipo !== "todos"}
            onEditar={handleEditar}
            onExcluir={handleExcluir}
            onVisualizar={podeVerContas ? setFornecedorFicha : undefined}
          />
        </main>
      ) : (
        <main className="flex-1 p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Fornecedores</h1>
              <p className="text-muted-foreground">
                Cadastre e gerencie seus fornecedores
              </p>
            </div>
            <Button onClick={handleNovoFornecedor}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Fornecedor
            </Button>
          </div>

          {/* Filtros */}
          <Card className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, documento, email..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="pl-10"
                />
              </div>

              <Select value={filtroTipo} onValueChange={(v: any) => setFiltroTipo(v)}>
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os Tipos</SelectItem>
                  <SelectItem value="juridica">Pessoa Jurídica</SelectItem>
                  <SelectItem value="fisica">Pessoa Física</SelectItem>
                </SelectContent>
              </Select>

              <Tabs
                value={filtroStatus}
                onValueChange={(v: any) => setFiltroStatus(v)}
                className="w-full md:w-auto"
              >
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="todos">Todos</TabsTrigger>
                  <TabsTrigger value="ativo">Ativos</TabsTrigger>
                  <TabsTrigger value="inativo">Inativos</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </Card>

          {/* Tabela */}
          {loading ? (
            <Card className="p-6">
              <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            </Card>
          ) : (
            <TabelaFornecedores
              fornecedores={fornecedoresFiltrados}
              onEditar={handleEditar}
              onExcluir={handleExcluir}
              onVisualizar={podeVerContas ? setFornecedorFicha : undefined}
            />
          )}

          {/* Estatísticas */}
          {!loading && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="p-4">
                <p className="text-sm text-muted-foreground">Total de Fornecedores</p>
                <p className="text-2xl font-bold">{fornecedores.length}</p>
              </Card>
              <Card className="p-4">
                <p className="text-sm text-muted-foreground">Fornecedores Ativos</p>
                <p className="text-2xl font-bold">
                  {fornecedores.filter((f) => f.ativo).length}
                </p>
              </Card>
              <Card className="p-4">
                <p className="text-sm text-muted-foreground">Resultados da Busca</p>
                <p className="text-2xl font-bold">{fornecedoresFiltrados.length}</p>
              </Card>
            </div>
          )}
        </main>
      )}

      <DialogCadastroFornecedor
        open={dialogAberto}
        onOpenChange={setDialogAberto}
        onSubmit={handleSubmit}
        fornecedor={fornecedorEditando}
      />

      {podeVerContas && (
        <DialogFichaFornecedor
          fornecedor={fornecedorFicha}
          onOpenChange={(aberto) => { if (!aberto) setFornecedorFicha(null); }}
        />
      )}
    </AppLayout>
  );
}
