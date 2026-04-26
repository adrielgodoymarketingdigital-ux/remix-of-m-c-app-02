import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus } from "lucide-react";
import { useServicos } from "@/hooks/useServicos";
import { DialogCadastroServico } from "@/components/servicos/DialogCadastroServico";
import { GerenciadorTiposServico } from "@/components/servicos/GerenciadorTiposServico";
import { TabelaServicos } from "@/components/servicos/TabelaServicos";
import { Servico, FormularioServico } from "@/types/servico";
import { Skeleton } from "@/components/ui/skeleton";
import { AppLayout } from "@/components/layout/AppLayout";

export default function Servicos() {
  const [busca, setBusca] = useState("");
  const [dialogAberto, setDialogAberto] = useState(false);
  const [servicoParaEditar, setServicoParaEditar] = useState<Servico | null>(null);

  const {
    servicos,
    loading,
    criarServico,
    atualizarServico,
    excluirServico,
  } = useServicos();

  const servicosFiltrados = useMemo(() => {
    if (!busca.trim()) return servicos;

    const termo = busca.toLowerCase().trim();
    return servicos.filter(
      (servico) =>
        servico.nome.toLowerCase().includes(termo) ||
        servico.codigo?.toLowerCase().includes(termo)
    );
  }, [servicos, busca]);

  const handleSubmit = async (dados: FormularioServico) => {
    const dadosServico = {
      ...dados,
      quantidade: dados.quantidade ?? 0,
      peca_id: dados.peca_id || null,
    };

    if (servicoParaEditar) {
      await atualizarServico(servicoParaEditar.id, dadosServico as any);
    } else {
      await criarServico(dadosServico as any);
    }

    setDialogAberto(false);
    setServicoParaEditar(null);
  };

  const handleEditar = (servico: Servico) => {
    setServicoParaEditar(servico);
    setDialogAberto(true);
  };

  const handleExcluir = async (id: string) => {
    await excluirServico(id);
  };

  const handleNovoServico = () => {
    setServicoParaEditar(null);
    setDialogAberto(true);
  };

  return (
    <AppLayout>
      <main className="flex-1 p-6 overflow-auto">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Serviços</h1>
              <p className="text-muted-foreground">
                Gerencie os serviços oferecidos
              </p>
            </div>
            <Button onClick={handleNovoServico}>
              <Plus className="mr-2 h-4 w-4" />
              Novo Serviço
            </Button>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou código..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="text-sm text-muted-foreground">
              {servicosFiltrados.length} serviço(s) encontrado(s)
            </div>
          </div>

          {loading ? (
            <div className="space-y-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : (
            <TabelaServicos
              servicos={servicosFiltrados}
              onEditar={handleEditar}
              onExcluir={handleExcluir}
            />
          )}

          {/* Tipos de Serviço */}
          <GerenciadorTiposServico />
        </div>
      </main>

      <DialogCadastroServico
        open={dialogAberto}
        onOpenChange={setDialogAberto}
        onSubmit={handleSubmit}
        servicoParaEditar={servicoParaEditar}
      />
    </AppLayout>
  );
}
