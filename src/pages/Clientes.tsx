import { useState, useMemo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Upload, Users } from "lucide-react";
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
import { useIsDesktop } from "@/hooks/use-mobile";

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
    excluirEmMassa,
    importarEmLote,
  } = useClientes();

  const { assinatura } = useAssinatura();
  const isDesktop = useIsDesktop();

  // Verificar se tem plano profissional
  const temPlanoProfissional = useMemo(() => {
    if (!assinatura) return false;
    const planosProfissionais = ['profissional_mensal', 'profissional_anual', 'profissional_ultra_mensal', 'profissional_ultra_anual', 'admin', 'trial'];
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

  const handleExcluirEmMassa = async (ids: string[]) => {
    await excluirEmMassa(ids);
  };

  const handleVerHistorico = (cliente: Cliente) => {
    setClienteHistorico(cliente);
    setDialogHistoricoAberto(true);
  };

  return (
    <AppLayout>
      {isDesktop ? (
        <ClientesDesktop
          loading={loading}
          busca={busca}
          onBuscaChange={setBusca}
          totalClientes={clientes.length}
          totalFiltrados={clientesFiltrados.length}
          onImportar={() => setDialogImportarAberto(true)}
          onNovoCliente={handleNovoCliente}
          aniversariantes={
            temPlanoProfissional ? (
              <CardAniversariantes clientes={clientes} />
            ) : (
              <CardAniversariantesBloqueado />
            )
          }
          tabela={
            <TabelaClientes
              clientes={clientesFiltrados}
              onEditar={handleEditar}
              onExcluir={handleExcluir}
              onExcluirEmMassa={handleExcluirEmMassa}
              onVerHistorico={handleVerHistorico}
            />
          }
        />
      ) : (
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
            onExcluirEmMassa={handleExcluirEmMassa}
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
      )}

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

interface ClientesDesktopProps {
  loading: boolean;
  busca: string;
  onBuscaChange: (valor: string) => void;
  totalClientes: number;
  totalFiltrados: number;
  onImportar: () => void;
  onNovoCliente: () => void;
  aniversariantes: ReactNode;
  tabela: ReactNode;
}

/** Layout do computador (≥1024px). Mesmos dados e ações do layout de baixo; só muda a apresentação. */
function ClientesDesktop({
  loading,
  busca,
  onBuscaChange,
  totalClientes,
  totalFiltrados,
  onImportar,
  onNovoCliente,
  aniversariantes,
  tabela,
}: ClientesDesktopProps) {
  const indicadores = [
    { rotulo: "Total de Clientes", valor: totalClientes, Icone: Users, cor: "bg-primary/10 text-primary" },
    {
      rotulo: "Resultados da Busca",
      valor: totalFiltrados,
      Icone: Search,
      cor: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Users className="h-6 w-6" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h1 className="text-3xl font-bold tracking-tight">Clientes</h1>
            <p className="text-muted-foreground">Cadastre e gerencie seus clientes</p>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" onClick={onImportar}>
            <Upload className="h-4 w-4 mr-2" />
            Importar
          </Button>
          <Button onClick={onNovoCliente}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Cliente
          </Button>
        </div>
      </div>

      {/* Indicadores (dados que a tela já tinha no rodapé) */}
      <div className="grid grid-cols-2 gap-4">
        {indicadores.map(({ rotulo, valor, Icone, cor }) => (
          <Card key={rotulo} className="flex items-center gap-4 p-5">
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${cor}`}>
              <Icone className="h-6 w-6" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">{rotulo}</p>
              {loading ? (
                <Skeleton className="mt-1 h-8 w-16" />
              ) : (
                <p className="text-2xl font-bold tabular-nums">{valor.toLocaleString("pt-BR")}</p>
              )}
            </div>
          </Card>
        ))}
      </div>

      {/* Card Aniversariantes (igual ao de baixo) */}
      {!loading && aniversariantes}

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <Input
          placeholder="Buscar por nome, CPF ou telefone..."
          aria-label="Buscar por nome, CPF ou telefone"
          value={busca}
          onChange={(e) => onBuscaChange(e.target.value)}
          className="pl-11 h-12 bg-card shadow-sm"
        />
      </div>

      {/* Tabela */}
      {loading ? <EsqueletoTabelaClientes /> : tabela}
    </div>
  );
}

/** Esqueleto no formato da tabela do computador. */
function EsqueletoTabelaClientes() {
  return (
    <Card className="overflow-hidden" aria-busy="true" aria-label="Carregando clientes">
      <div className="flex items-center gap-6 border-b bg-muted/40 px-4 py-3">
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="ml-auto h-4 w-16" />
      </div>
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="flex items-center gap-4 border-b px-4 py-3 last:border-b-0">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-9 w-9 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-8 w-40" />
        </div>
      ))}
    </Card>
  );
}
