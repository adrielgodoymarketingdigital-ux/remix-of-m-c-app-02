import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FormularioPerfilLoja } from "@/components/configuracoes/FormularioPerfilLoja";
import { UploadLogoLoja } from "@/components/configuracoes/UploadLogoLoja";
import { AssinaturaLojaConfig } from "@/components/configuracoes/AssinaturaLojaConfig";
import { CardProgressoPerfil, CardStatusPerfil } from "@/components/configuracoes/ProgressoPerfil";
import { PreviewRecibo } from "@/components/configuracoes/PreviewRecibo";
import { SeletorTema } from "@/components/configuracoes/SeletorTema";
import { SeletorIdioma } from "@/components/configuracoes/SeletorIdioma";
import { PersonalizacaoCores } from "@/components/configuracoes/PersonalizacaoCores";
import { NotificationSettings } from "@/components/pwa/NotificationSettings";
import { ConfiguracaoNumeracaoOS } from "@/components/configuracoes/ConfiguracaoNumeracaoOS";
import { ConfiguracaoPermissoes } from "@/components/configuracoes/ConfiguracaoPermissoes";
import { ExportacaoDados } from "@/components/configuracoes/ExportacaoDados";
import { CardComecarDoZero } from "@/components/configuracoes/comecar-do-zero/CardComecarDoZero";

import { useConfiguracaoLoja } from "@/hooks/useConfiguracaoLoja";
import { useToast } from "@/hooks/use-toast";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { ConfiguracaoLoja } from "@/types/configuracao-loja";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Bell,
  Building2,
  Download,
  Droplet,
  Eye,
  Hash,
  Image as ImageIcon,
  Palette,
  ShieldCheck,
  User,
  type LucideIcon,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AppLayout } from "@/components/layout/AppLayout";
import { FormatoMoedaProvider } from "@/components/ui/valor-monetario";
import { useFormatadores } from "@/hooks/useFormatadores";
import { cn } from "@/lib/utils";

/** Abas da página (mesmos values de antes; só ganham ícone). Rótulo: abas.<value> no namespace "configuracoes". */
const ABAS: { value: string; icone: LucideIcon }[] = [
  { value: "perfil", icone: User },
  { value: "logo", icone: ImageIcon },
  { value: "aparencia", icone: Palette },
  { value: "cores", icone: Droplet },
  { value: "numeracao", icone: Hash },
  { value: "notificacoes", icone: Bell },
  { value: "permissoes", icone: ShieldCheck },
  { value: "preview", icone: Eye },
  { value: "exportacao", icone: Download },
];

const BOTAO_CONTORNO =
  "inline-flex h-10 shrink-0 items-center gap-2 rounded-lg border bg-card px-4 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/**
 * "Ver minha loja": página pública da loja com os dados que o config já traz
 * (select * em configuracoes_loja). Landing page ativa > catálogo ativo >
 * tela /catalogo, onde a loja é configurada.
 */
function BotaoVerLoja({ config }: { config: ConfiguracaoLoja | null }) {
  const { t } = useTranslation("configuracoes");
  const extra = config as (ConfiguracaoLoja & {
    catalogo_slug?: string | null;
    catalogo_ativo?: boolean | null;
    landing_page_ativa?: boolean | null;
  }) | null;
  const slug = extra?.catalogo_slug;
  const destino = slug && extra?.landing_page_ativa ? `/lp/${slug}` : slug && extra?.catalogo_ativo ? `/c/${slug}` : null;
  const conteudo = (
    <>
      <Eye className="h-4 w-4" aria-hidden="true" />
      {t("verMinhaLoja")}
    </>
  );
  return destino ? (
    <a href={destino} target="_blank" rel="noopener noreferrer" className={BOTAO_CONTORNO}>
      {conteudo}
    </a>
  ) : (
    <Link to="/catalogo" className={BOTAO_CONTORNO} title={t("verMinhaLojaDica")}>
      {conteudo}
    </Link>
  );
}

export default function Configuracoes() {
  const { isProprietario, empresas, nomeMatriz, empresaAtiva, setEmpresaAtiva } = useEmpresa();

  // empresaId usado para buscar/gravar a config: null = matriz/conta principal.
  // Reaproveita o seletor de filial ativa já existente no app (EmpresaContext).
  const empresaIdConfig = isProprietario ? empresaAtiva : null;

  const { config, loading, atualizarConfiguracao, validarParaRecibos } =
    useConfiguracaoLoja(empresaIdConfig);
  const { toast } = useToast();
  // Textos: namespace "configuracoes"; moeda: useFormatadores (conta).
  const { t } = useTranslation("configuracoes");
  const fmt = useFormatadores();

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
        title: t("logoAtualizada"),
        description: t("logoAtualizadaDescricao"),
      });
    } else {
      toast({
        title: t("erroAtualizarLogo"),
        description: t("erroAtualizarLogoDescricao"),
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <main className="flex-1 p-4 sm:p-6 overflow-auto">
          <div className="max-w-5xl lg:max-w-none mx-auto">
            <p className="text-center text-muted-foreground">{t("carregando")}</p>
          </div>
        </main>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <FormatoMoedaProvider value={fmt.moeda}>
      <main className="flex-1 p-4 sm:p-6 overflow-auto">
        <div className="max-w-5xl lg:max-w-none mx-auto space-y-5 sm:space-y-6">
          {/* Cabeçalho. lg:pt-6: o olho flutuante do layout (BotaoOcultarValores,
              fixed top-4 right-4, só no desktop) ficaria por cima de "Ver minha loja" */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between lg:pt-6">
            <div className="min-w-0">
              <h1 className="text-2xl font-extrabold tracking-tight sm:text-[28px]">{t("titulo")}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("subtitulo")}
              </p>
            </div>
            <BotaoVerLoja config={config} />
          </div>

          {isProprietario && empresas.length > 0 && (
            <Card className="rounded-2xl">
              <CardContent className="pt-4 sm:pt-6">
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">{t("editandoDadosDe")}</Label>
                </div>
                <Select
                  value={empresaAtiva ?? "__matriz__"}
                  onValueChange={(value) =>
                    setEmpresaAtiva(value === "__matriz__" ? null : value)
                  }
                >
                  <SelectTrigger className="w-full sm:w-80">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__matriz__">{t("matriz", { nome: nomeMatriz })}</SelectItem>
                    {empresas.map((empresa) => (
                      <SelectItem key={empresa.id} value={empresa.id}>
                        {empresa.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-2">
                  {t("filialDescricao")}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Status do perfil (mesma porcentagem/campos de validarParaRecibos) */}
          <CardStatusPerfil status={statusRecibos} />

          <Tabs defaultValue="perfil" className="w-full">
            {/* Barra única de abas em pílula; rola na horizontal no celular/tablet */}
            <TabsList className="flex h-auto w-full justify-start gap-1 overflow-x-auto rounded-xl bg-muted/70 p-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {ABAS.map(({ value, icone: Icone }) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  className={cn(
                    "shrink-0 gap-2 rounded-lg px-4 py-2.5 text-[13px] font-medium text-muted-foreground xl:flex-1",
                    "hover:text-foreground",
                    "data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-[0_4px_12px_hsl(var(--primary)/0.25)]",
                  )}
                >
                  <Icone className="h-4 w-4" aria-hidden="true" />
                  {t(`abas.${value}`)}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* Conteúdo das abas + cartão "Progresso do Perfil" ao lado (1 coluna abaixo do xl) */}
            <div className="mt-5 grid items-start gap-5 sm:mt-6 xl:grid-cols-[minmax(0,1fr)_300px]">
              <div className="min-w-0">
                <TabsContent value="perfil" className="space-y-4 mt-0">
                  <FormularioPerfilLoja
                    configuracao={config}
                    onSalvar={handleSalvarDados}
                  />
                </TabsContent>

                <TabsContent value="logo" className="space-y-4 mt-0">
                  <UploadLogoLoja
                    logoAtual={config?.logo_url}
                    onUploadSuccess={handleUploadLogo}
                  />
                  <AssinaturaLojaConfig
                    assinaturaAtual={config?.assinatura_loja}
                    usarAssinatura={config?.usar_assinatura_loja}
                    onSalvar={handleSalvarDados}
                  />
                </TabsContent>

                <TabsContent value="aparencia" className="space-y-4 mt-0">
                  <SeletorTema />
                  {/* Só existe para quem pode ver (useI18nVisivel: hoje, admin); para os demais, nada muda. */}
                  <SeletorIdioma />
                </TabsContent>

                <TabsContent value="cores" className="space-y-4 mt-0">
                  <PersonalizacaoCores />
                </TabsContent>

                <TabsContent value="numeracao" className="space-y-4 mt-0">
                  <ConfiguracaoNumeracaoOS />
                </TabsContent>

                <TabsContent value="notificacoes" className="space-y-4 mt-0">
                  <NotificationSettings />
                </TabsContent>

                <TabsContent value="permissoes" className="space-y-4 mt-0">
                  <ConfiguracaoPermissoes />
                </TabsContent>

                <TabsContent value="preview" className="space-y-4 mt-0">
                  <PreviewRecibo configuracao={config} />
                </TabsContent>

                <TabsContent value="exportacao" className="space-y-4 mt-0">
                  <div id="exportacao-dados">
                    <ExportacaoDados />
                  </div>
                  {/* Só existe para quem pode ver (useComecarDoZeroVisivel); para os demais, nada muda. */}
                  <CardComecarDoZero idExportacao="exportacao-dados" />
                </TabsContent>
              </div>

              <CardProgressoPerfil status={statusRecibos} />
            </div>
          </Tabs>
        </div>
      </main>
      </FormatoMoedaProvider>
    </AppLayout>
  );
}
