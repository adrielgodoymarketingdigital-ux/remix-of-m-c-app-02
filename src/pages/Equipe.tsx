import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Plus, AlertCircle, BarChart3 } from "lucide-react";
import { useFuncionarios } from "@/hooks/useFuncionarios";
import { TabelaFuncionarios } from "@/components/equipe/TabelaFuncionarios";
import { DialogCadastroFuncionario } from "@/components/equipe/DialogCadastroFuncionario";
import { DashboardEquipe } from "@/components/equipe/DashboardEquipe";
import type { Funcionario, FuncionarioFormData } from "@/types/funcionario";
import { useAssinatura } from "@/hooks/useAssinatura";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

export default function Equipe() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [funcionarioEditando, setFuncionarioEditando] = useState<Funcionario | null>(null);
  const [salvando, setSalvando] = useState(false);

  const { assinatura, carregando: carregandoAssinatura } = useAssinatura();
  const {
    funcionarios,
    carregando,
    criarFuncionario,
    atualizarFuncionario,
    toggleAtivo,
    excluirFuncionario,
    reenviarConvite,
  } = useFuncionarios();

  // Limites por plano
  const getLimiteFuncionarios = () => {
    if (!assinatura) return 0;
    const plano = assinatura.plano_tipo;
    if (plano === "intermediario_mensal" || plano === "intermediario_anual") return 1;
    if (plano === "profissional_mensal" || plano === "profissional_anual" || plano === "profissional_ultra_mensal" || plano === "profissional_ultra_anual") return 999; // Ilimitado
    if (plano === "trial" || plano === "demonstracao") return 1; // Trial pode testar com 1
    if (plano === "admin") return 999;
    return 0; // Free e Básico não têm acesso
  };

  const limiteFuncionarios = getLimiteFuncionarios();
  const podeAdicionarMais = funcionarios.length < limiteFuncionarios;
  const planoPermiteEquipe = limiteFuncionarios > 0;

  const handleSalvar = async (dados: FuncionarioFormData & { senha?: string }): Promise<{ id: string } | void> => {
    setSalvando(true);
    try {
      if (funcionarioEditando) {
        await atualizarFuncionario.mutateAsync({
          id: funcionarioEditando.id,
          dados,
        });
      } else {
        const result = await criarFuncionario.mutateAsync(dados);
        if (result?.funcionario?.id) {
          setDialogOpen(false);
          setFuncionarioEditando(null);
          return { id: result.funcionario.id };
        }
      }
      setDialogOpen(false);
      setFuncionarioEditando(null);
    } finally {
      setSalvando(false);
    }
  };

  const handleEditar = (funcionario: Funcionario) => {
    setFuncionarioEditando(funcionario);
    setDialogOpen(true);
  };

  const handleNovoFuncionario = () => {
    setFuncionarioEditando(null);
    setDialogOpen(true);
  };

  if (carregandoAssinatura) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Users className="h-6 w-6" />
              Equipe
            </h1>
            <p className="text-muted-foreground">
              Gerencie os funcionários e suas permissões de acesso.
            </p>
          </div>
          {planoPermiteEquipe && (
            <Button
              onClick={handleNovoFuncionario}
              disabled={!podeAdicionarMais}
            >
              <Plus className="h-4 w-4 mr-2" />
              Novo Funcionário
            </Button>
          )}
        </div>

        {!planoPermiteEquipe && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              O gerenciamento de equipe está disponível apenas nos planos Intermediário e Profissional.
              <Button variant="link" className="px-1 h-auto" onClick={() => window.location.href = "/plano"}>
                Fazer upgrade
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {planoPermiteEquipe && !podeAdicionarMais && funcionarios.length > 0 && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Você atingiu o limite de {limiteFuncionarios} funcionário(s) do seu plano.
              {(assinatura?.plano_tipo === "intermediario_mensal" || assinatura?.plano_tipo === "intermediario_anual") && (
                <Button variant="link" className="px-1 h-auto" onClick={() => window.location.href = "/plano"}>
                  Faça upgrade para o plano Profissional
                </Button>
              )}
            </AlertDescription>
          </Alert>
        )}

        {planoPermiteEquipe && (
          <Tabs defaultValue="funcionarios">
            <TabsList>
              <TabsTrigger value="funcionarios">
                <Users className="h-4 w-4 mr-2" />
                Funcionários
              </TabsTrigger>
              <TabsTrigger value="desempenho">
                <BarChart3 className="h-4 w-4 mr-2" />
                Desempenho
              </TabsTrigger>
            </TabsList>

            <TabsContent value="funcionarios">
              <Card>
                <CardHeader>
                  <CardTitle>Funcionários</CardTitle>
                  <CardDescription>
                    {funcionarios.length} de {limiteFuncionarios === 999 ? "∞" : limiteFuncionarios} funcionário(s)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {carregando ? (
                    <div className="space-y-4">
                      <Skeleton className="h-12 w-full" />
                      <Skeleton className="h-12 w-full" />
                      <Skeleton className="h-12 w-full" />
                    </div>
                  ) : (
                    <TabelaFuncionarios
                      funcionarios={funcionarios}
                      onEditar={handleEditar}
                      onToggleAtivo={(id, ativo) => toggleAtivo.mutate({ id, ativo })}
                      onExcluir={(id) => excluirFuncionario.mutate(id)}
                      onReenviarConvite={(id) => reenviarConvite.mutate(id)}
                    />
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="desempenho">
              <DashboardEquipe funcionarios={funcionarios} />
            </TabsContent>
          </Tabs>
        )}
      </div>

      <DialogCadastroFuncionario
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setFuncionarioEditando(null);
        }}
        funcionario={funcionarioEditando}
        onSalvar={handleSalvar}
        salvando={salvando}
      />
    </AppLayout>
  );
}
