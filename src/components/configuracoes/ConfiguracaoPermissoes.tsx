import { useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useConfiguracaoLoja } from "@/hooks/useConfiguracaoLoja";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { Building2 } from "lucide-react";

export function ConfiguracaoPermissoes() {
  const { config, atualizarConfiguracao, loading } = useConfiguracaoLoja();
  const { empresas } = useEmpresa();
  const { toast } = useToast();
  const [salvando, setSalvando] = useState(false);
  const { t, i18n } = useTranslation("configuracoes");

  const mostrarOsFiliais = config?.permissoes_multiempresa?.mostrar_os_filiais_na_matriz ?? false;

  const handleToggle = async (valor: boolean) => {
    setSalvando(true);
    const sucesso = await atualizarConfiguracao({
      permissoes_multiempresa: {
        ...(config?.permissoes_multiempresa ?? {}),
        mostrar_os_filiais_na_matriz: valor,
      },
    });
    setSalvando(false);
    if (sucesso) {
      toast({
        title: i18n.t("permissoes.atualizadas", { ns: "configuracoes" }),
        description: valor
          ? i18n.t("permissoes.osNaMatriz", { ns: "configuracoes" })
          : i18n.t("permissoes.osSeparadas", { ns: "configuracoes" }),
      });
    } else {
      toast({
        title: i18n.t("permissoes.erroSalvar", { ns: "configuracoes" }),
        description: i18n.t("permissoes.erroSalvarDescricao", { ns: "configuracoes" }),
        variant: "destructive",
      });
    }
  };

  if (loading) return null;

  const temFiliais = empresas.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          {t("permissoes.titulo")}
        </CardTitle>
        <CardDescription>
          {t("permissoes.descricao")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {!temFiliais && (
          <p className="text-sm text-muted-foreground">
            {t("permissoes.semFiliais")}
          </p>
        )}

        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <Label htmlFor="mostrar-os-filiais" className="text-sm font-medium">
              {t("permissoes.mostrarOsFiliais")}
            </Label>
            <p className="text-xs text-muted-foreground max-w-sm">
              <Trans t={t} i18nKey="permissoes.ajudaAtivado" components={{ negrito: <strong /> }} />
            </p>
            <p className="text-xs text-muted-foreground max-w-sm mt-1">
              {t("permissoes.ajudaDesativado")}
            </p>
          </div>
          <Switch
            id="mostrar-os-filiais"
            checked={mostrarOsFiliais}
            onCheckedChange={handleToggle}
            disabled={salvando || !temFiliais}
          />
        </div>
      </CardContent>
    </Card>
  );
}
