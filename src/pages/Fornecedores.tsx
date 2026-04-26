import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search } from "lucide-react";
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
import { useFornecedores } from "@/hooks/useFornecedores";
import { Fornecedor } from "@/types/fornecedor";
import { Skeleton } from "@/components/ui/skeleton";
import { AppLayout } from "@/components/layout/AppLayout";

export default function Fornecedores() {
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<"todos" | "ativo" | "inativo">("todos");
  const [filtroTipo, setFiltroTipo] = useState<"todos" | "juridica" | "fisica">("todos");
  const [dialogAberto, setDialogAberto] = useState(false);
  const [fornecedorEditando, setFornecedorEditando] = useState<Fornecedor | null>(null);

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

      <DialogCadastroFornecedor
        open={dialogAberto}
        onOpenChange={setDialogAberto}
        onSubmit={handleSubmit}
        fornecedor={fornecedorEditando}
      />
    </AppLayout>
  );
}
