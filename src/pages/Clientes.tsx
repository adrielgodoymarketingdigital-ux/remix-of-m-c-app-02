import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Upload } from "lucide-react";
import { Card } from "@/components/ui/card";
import { DialogCadastroCliente } from "@/components/clientes/DialogCadastroCliente";
import { DialogImportarClientes } from "@/components/clientes/DialogImportarClientes";
import { TabelaClientes } from "@/components/clientes/TabelaClientes";
import { DialogHistoricoCliente } from "@/components/clientes/DialogHistoricoCliente";
import { CardAniversariantes, CardAniversariantesBloqueado } from "@/components/clientes/CardAniversariantes";
import { useClientes } from "@/hooks/useClientes";
import { useAssinatura } from "@/hooks/useAssinatura";
import { Cliente } from "@/types/cliente";
import { Skeleton } from "@/components/ui/skeleton";
import { AppLayout } from "@/components/layout/AppLayout";

export default function Clientes() {
  const [busca, setBusca] = useState("");
  const [dialogAberto, setDialogAberto] = useState(false);
  const [dialogHistoricoAberto, setDialogHistoricoAberto] = useState(false);
  const [dialogImportarAberto, setDialogImportarAberto] = useState(false);
  const [clienteEditando, setClienteEditando] = useState<Cliente | null>(null);
  const [clienteHistorico, setClienteHistorico] = useState<Cliente | null>(null);

  const {
    clientes,
    loading,
    criarCliente,
    atualizarCliente,
    excluirCliente,
    importarEmLote,
  } = useClientes();

  const { assinatura } = useAssinatura();

  // Verificar se tem plano profissional
  const temPlanoProfissional = useMemo(() => {
    if (!assinatura) return false;
    const planosProfissionais = ['profissional_mensal', 'profissional_anual', 'admin', 'trial'];
    return planosProfissionais.includes(assinatura.plano_tipo);
  }, [assinatura]);

  const clientesFiltrados = useMemo(() => {
    return clientes.filter((cliente) => {
      const buscaLower = busca.toLowerCase();
      return (
        cliente.nome.toLowerCase().includes(buscaLower) ||
        cliente.cpf?.includes(busca) ||
        cliente.telefone?.includes(busca)
      );
    });
  }, [clientes, busca]);

  const handleSubmit = async (dados: any): Promise<boolean> => {
    if (clienteEditando) {
      return await atualizarCliente(clienteEditando.id, dados);
    } else {
      const cliente = await criarCliente(dados);
      return cliente !== null;
    }
  };

  const handleEditar = (cliente: Cliente) => {
    setClienteEditando(cliente);
    setDialogAberto(true);
  };

  const handleNovoCliente = () => {
    setClienteEditando(null);
    setDialogAberto(true);
  };

  const handleExcluir = async (id: string) => {
    await excluirCliente(id);
  };

  const handleVerHistorico = (cliente: Cliente) => {
    setClienteHistorico(cliente);
    setDialogHistoricoAberto(true);
  };

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Clientes</h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              Cadastre e gerencie seus clientes
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setDialogImportarAberto(true)} className="w-full sm:w-auto">
              <Upload className="h-4 w-4 mr-2" />
              Importar
            </Button>
            <Button onClick={handleNovoCliente} className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Novo Cliente
            </Button>
          </div>
        </div>

        {/* Card Aniversariantes */}
        {!loading && (
          temPlanoProfissional ? (
            <CardAniversariantes clientes={clientes} />
          ) : (
            <CardAniversariantesBloqueado />
          )
        )}

        {/* Busca */}
        <Card className="p-3 sm:p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, CPF ou telefone..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-10 h-11"
            />
          </div>
        </Card>

        {/* Tabela */}
        {loading ? (
          <Card className="p-4 sm:p-6">
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </Card>
        ) : (
          <TabelaClientes
            clientes={clientesFiltrados}
            onEditar={handleEditar}
            onExcluir={handleExcluir}
            onVerHistorico={handleVerHistorico}
          />
        )}

        {/* Estatísticas */}
        {!loading && (
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <Card className="p-3 sm:p-4">
              <p className="text-xs sm:text-sm text-muted-foreground">Total de Clientes</p>
              <p className="text-xl sm:text-2xl font-bold">{clientes.length}</p>
            </Card>
            <Card className="p-3 sm:p-4">
              <p className="text-xs sm:text-sm text-muted-foreground">Resultados da Busca</p>
              <p className="text-xl sm:text-2xl font-bold">{clientesFiltrados.length}</p>
            </Card>
          </div>
        )}
      </div>

      <DialogCadastroCliente
        open={dialogAberto}
        onOpenChange={setDialogAberto}
        onSubmit={handleSubmit}
        cliente={clienteEditando}
      />

      <DialogHistoricoCliente
        open={dialogHistoricoAberto}
        onOpenChange={setDialogHistoricoAberto}
        cliente={clienteHistorico}
      />

      <DialogImportarClientes
        open={dialogImportarAberto}
        onOpenChange={setDialogImportarAberto}
        onImportar={importarEmLote}
      />
    </AppLayout>
  );
}
