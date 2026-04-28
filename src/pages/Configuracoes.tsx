import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FormularioPerfilLoja } from "@/components/configuracoes/FormularioPerfilLoja";
import { UploadLogoLoja } from "@/components/configuracoes/UploadLogoLoja";
import { BadgeStatusPerfil } from "@/components/configuracoes/BadgeStatusPerfil";
import { PreviewRecibo } from "@/components/configuracoes/PreviewRecibo";
import { SeletorTema } from "@/components/configuracoes/SeletorTema";
import { PersonalizacaoCores } from "@/components/configuracoes/PersonalizacaoCores";
import { NotificationSettings } from "@/components/pwa/NotificationSettings";
import { ConfiguracaoNumeracaoOS } from "@/components/configuracoes/ConfiguracaoNumeracaoOS";

import { useConfiguracaoLoja } from "@/hooks/useConfiguracaoLoja";
import { useToast } from "@/hooks/use-toast";
import { ConfiguracaoLoja } from "@/types/configuracao-loja";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";

export default function Configuracoes() {
  const { config, loading, atualizarConfiguracao, validarParaRecibos } =
    useConfiguracaoLoja();
  const { toast } = useToast();

  const statusRecibos = validarParaRecibos();

  const handleSalvarDados = async (
    dados: Partial<ConfiguracaoLoja>
  ): Promise<boolean> => {
    return await atualizarConfiguracao(dados);
  };

  const handleUploadLogo = async (url: string) => {
    const sucesso = await atualizarConfiguracao({ logo_url: url });
    if (sucesso) {
      toast({
        title: "Logo atualizada",
        description: "A logo da loja foi atualizada com sucesso.",
      });
    } else {
      toast({
        title: "Erro ao atualizar logo",
        description: "Não foi possível atualizar a logo da loja.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <main className="flex-1 p-4 sm:p-6 overflow-auto">
          <div className="max-w-5xl mx-auto">
            <p className="text-center text-muted-foreground">Carregando...</p>
          </div>
        </main>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <main className="flex-1 p-4 sm:p-6 overflow-auto">
        <div className="max-w-5xl mx-auto space-y-4 sm:space-y-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Configurações</h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              Gerencie as configurações e dados da sua loja
            </p>
          </div>

          {/* Card de Status */}
          <Card>
            <CardHeader className="pb-3 sm:pb-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base sm:text-lg">Status do Perfil</CardTitle>
                  <CardDescription className="text-sm">
                    Complete todos os dados para gerar recibos profissionais
                  </CardDescription>
                </div>
                <BadgeStatusPerfil
                  percentual={statusRecibos.percentual}
                  camposFaltando={statusRecibos.camposFaltando}
                />
              </div>
            </CardHeader>
            {statusRecibos.percentual < 100 && (
              <CardContent className="pt-0">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    Preencha os seguintes campos obrigatórios:{" "}
                    <strong>{statusRecibos.camposFaltando.join(", ")}</strong>
                  </AlertDescription>
                </Alert>
              </CardContent>
            )}
          </Card>

          <Tabs defaultValue="perfil" className="w-full">
            <TabsList className="grid w-full grid-cols-4 sm:grid-cols-7 h-auto">
              <TabsTrigger value="perfil" className="text-xs sm:text-sm py-2 sm:py-1.5">
                Perfil
              </TabsTrigger>
              <TabsTrigger value="logo" className="text-xs sm:text-sm py-2 sm:py-1.5">
                Logo
              </TabsTrigger>
              <TabsTrigger value="aparencia" className="text-xs sm:text-sm py-2 sm:py-1.5">
                Aparência
              </TabsTrigger>
              <TabsTrigger value="cores" className="text-xs sm:text-sm py-2 sm:py-1.5">
                Cores
              </TabsTrigger>
              <TabsTrigger value="numeracao" className="text-xs sm:text-sm py-2 sm:py-1.5">
                Numeração
              </TabsTrigger>
              <TabsTrigger value="notificacoes" className="text-xs sm:text-sm py-2 sm:py-1.5">
                Notificações
              </TabsTrigger>
              <TabsTrigger value="preview" className="text-xs sm:text-sm py-2 sm:py-1.5">
                Preview
              </TabsTrigger>
            </TabsList>

            <TabsContent value="perfil" className="space-y-4 mt-4 sm:mt-6">
              <FormularioPerfilLoja
                configuracao={config}
                onSalvar={handleSalvarDados}
              />
            </TabsContent>

            <TabsContent value="logo" className="space-y-4 mt-4 sm:mt-6">
              <UploadLogoLoja
                logoAtual={config?.logo_url}
                onUploadSuccess={handleUploadLogo}
              />
            </TabsContent>

            <TabsContent value="aparencia" className="space-y-4 mt-4 sm:mt-6">
              <SeletorTema />
            </TabsContent>

            <TabsContent value="cores" className="space-y-4 mt-4 sm:mt-6">
              <PersonalizacaoCores />
            </TabsContent>

            <TabsContent value="numeracao" className="space-y-4 mt-4 sm:mt-6">
              <ConfiguracaoNumeracaoOS />
            </TabsContent>

            <TabsContent value="notificacoes" className="space-y-4 mt-4 sm:mt-6">
              <NotificationSettings />
            </TabsContent>

            <TabsContent value="preview" className="space-y-4 mt-4 sm:mt-6">
              <PreviewRecibo configuracao={config} />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </AppLayout>
  );
}
