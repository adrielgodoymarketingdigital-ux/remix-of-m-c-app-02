import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Plus, AlertCircle, BarChart3, ChevronDown, UserCheck } from "lucide-react";
import { useFuncionarios } from "@/hooks/useFuncionarios";
import { TabelaFuncionarios } from "@/components/equipe/TabelaFuncionarios";
import { DialogCadastroFuncionario } from "@/components/equipe/DialogCadastroFuncionario";
import { DashboardEquipe } from "@/components/equipe/DashboardEquipe";
import { ConfiguracaoOSEquipe } from "@/components/equipe/ConfiguracaoOSEquipe";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";
import type { Funcionario, FuncionarioFormData } from "@/types/funcionario";
import { useAssinatura } from "@/hooks/useAssinatura";
import { rotuloPlano } from "@/lib/planoVencido";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useDonoComoFuncionario } from "@/hooks/useDonoComoFuncionario";
import { contarVagasUsadas } from "@/lib/equipe/donoFuncionario.core";
import { useIsDesktop } from "@/hooks/use-mobile";

export default function Equipe() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [funcionarioEditando, setFuncionarioEditando] = useState<Funcionario | null>(null);
  const [salvando, setSalvando] = useState(false);

  const { assinatura, carregando: carregandoAssinatura, planoVencido, planoAnterior } = useAssinatura();
  const {
    funcionarios,
    carregando,
    criarFuncionario,
    atualizarFuncionario,
    toggleAtivo,
    excluirFuncionario,
    reenviarConvite,
  } = useFuncionarios();
  const donoFuncionario = useDonoComoFuncionario(funcionarios);
  const isDesktop = useIsDesktop();

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
  // A linha do próprio dono não ocupa vaga do plano.
  const vagasUsadas = contarVagasUsadas(funcionarios);
  const podeAdicionarMais = vagasUsadas < limiteFuncionarios;
  const planoPermiteEquipe = limiteFuncionarios > 0;

  // Abas no computador: maiores, com borda e texto na cor primária na aba ativa.
  // leading-6 fixa a altura em pixels inteiros (24 + 20 + 2 de borda = 46; barra com p-1 = 54). Sem ele, o
  // text-[15px] dava 22,5px de linha e tudo abaixo da barra ficava em meio pixel (texto e bordas borrados).
  const classeAbaDesktop = isDesktop
    ? "rounded-lg border border-transparent px-6 py-2.5 text-[15px] leading-6 data-[state=active]:border-primary/50 data-[state=active]:text-primary"
    : undefined;

  // Computador: título e contador ficam na mesma linha da busca (dentro da tabela).
  const cabecalhoPainel = (
    <div className="min-w-0">
      <CardTitle className="text-xl">Funcionários</CardTitle>
      <CardDescription className="mt-1">
        {vagasUsadas} de {limiteFuncionarios === 999 ? "∞" : limiteFuncionarios} funcionário(s)
      </CardDescription>
    </div>
  );

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

  // Mesmo botão e mesmo interruptor no computador e no celular; só a moldura do card muda.
  const botaoMinhaComissao = donoFuncionario.incluido && donoFuncionario.linhaDono && (
    <Button variant="outline" size="sm" onClick={() => handleEditar(donoFuncionario.linhaDono!)}>
      Minha comissão
    </Button>
  );
  const interruptorDono = (
    <Switch
      checked={donoFuncionario.incluido}
      disabled={donoFuncionario.definir.isPending}
      onCheckedChange={(incluir) => donoFuncionario.definir.mutate(incluir)}
      aria-label="Incluir meu usuário como funcionário"
    />
  );

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
      <div className="p-4 sm:p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="hidden lg:flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600">
              <Users className="h-5 w-5 text-white" />
            </span>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Users className="h-6 w-6 lg:hidden" />
                Equipe
              </h1>
              <p className="text-muted-foreground">
                Gerencie os funcionários e suas permissões de acesso.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <NotificationCenter className="hidden lg:flex" />
            {planoPermiteEquipe && (
              <Button
                onClick={handleNovoFuncionario}
                disabled={!podeAdicionarMais}
              >
                <Plus className="h-4 w-4 mr-2" />
                Novo Funcionário
                <ChevronDown className="hidden lg:inline-block h-4 w-4 ml-2" />
              </Button>
            )}
          </div>
        </div>

        {/* Fora do bloqueio por plano: o dono pode se incluir também no Free e no Básico. */}
        {donoFuncionario.souDono && (
          isDesktop ? (
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="flex items-center gap-4 p-5">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <UserCheck className="h-6 w-6" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">Incluir meu usuário como funcionário</p>
                  <p className="text-sm text-muted-foreground">
                    Para se escolher como vendedor e técnico e calcular comissão para você. Não ocupa vaga do plano
                    e não muda suas permissões de dono. Ao desligar, seu histórico é mantido.
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {botaoMinhaComissao}
                  {interruptorDono}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <UserCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <div>
                    <p className="font-medium">Incluir meu usuário como funcionário</p>
                    <p className="text-sm text-muted-foreground">
                      Para se escolher como vendedor e técnico e calcular comissão para você. Não ocupa vaga do plano
                      e não muda suas permissões de dono. Ao desligar, seu histórico é mantido.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 self-end sm:self-auto">
                  {botaoMinhaComissao}
                  {interruptorDono}
                </div>
              </CardContent>
            </Card>
          )
        )}

        {!planoPermiteEquipe && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {planoVencido
                ? `Seu plano venceu. Renove o ${rotuloPlano(planoAnterior)} para voltar a usar Equipe.`
                : "O gerenciamento de equipe está disponível apenas nos planos Intermediário e Profissional."}
              <Button variant="link" className="px-1 h-auto" onClick={() => window.location.href = "/plano"}>
                {planoVencido ? "Renovar agora" : "Fazer upgrade"}
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {planoPermiteEquipe && !podeAdicionarMais && vagasUsadas > 0 && (
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
            <TabsList className={isDesktop ? "h-auto gap-1 rounded-xl p-1" : undefined}>
              <TabsTrigger value="funcionarios" className={classeAbaDesktop}>
                <Users className="h-4 w-4 mr-2" />
                Funcionários
              </TabsTrigger>
              <TabsTrigger value="desempenho" className={classeAbaDesktop}>
                <BarChart3 className="h-4 w-4 mr-2" />
                Desempenho
              </TabsTrigger>
            </TabsList>

            <TabsContent value="funcionarios">
              <div className="space-y-4">
              <ConfiguracaoOSEquipe />
              {isDesktop ? (
                <Card>
                  <CardContent className="p-5">
                    {carregando ? (
                      <div className="space-y-4" aria-busy="true">
                        <div className="flex items-end justify-between gap-4">
                          {cabecalhoPainel}
                          <div className="flex shrink-0 items-center gap-2">
                            <Skeleton className="h-10 w-64" />
                            <Skeleton className="h-10 w-24" />
                          </div>
                        </div>
                        <div className="overflow-hidden rounded-lg border">
                          <div className="h-11 border-b bg-muted/50" />
                          {[0, 1, 2].map((i) => (
                            <div key={i} className="flex items-center gap-4 border-b px-4 py-3 last:border-b-0">
                              <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
                              <div className="flex-1 space-y-2">
                                <Skeleton className="h-4 w-40" />
                                <Skeleton className="h-3 w-56" />
                              </div>
                              <Skeleton className="h-6 w-20 rounded-full" />
                              <Skeleton className="h-4 w-32" />
                              <Skeleton className="h-6 w-16 rounded-full" />
                              <Skeleton className="h-8 w-20" />
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <TabelaFuncionarios
                        funcionarios={funcionarios}
                        onEditar={handleEditar}
                        onToggleAtivo={(id, ativo) => toggleAtivo.mutate({ id, ativo })}
                        onExcluir={(id) => excluirFuncionario.mutate(id)}
                        onReenviarConvite={(id) => reenviarConvite.mutate(id)}
                        cabecalho={cabecalhoPainel}
                      />
                    )}
                  </CardContent>
                </Card>
              ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Funcionários</CardTitle>
                  <CardDescription>
                    {vagasUsadas} de {limiteFuncionarios === 999 ? "∞" : limiteFuncionarios} funcionário(s)
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
              )}
              </div>
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
