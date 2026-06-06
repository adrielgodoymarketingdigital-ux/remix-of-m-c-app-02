import { useState } from "react";
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
        title: "Permissões atualizadas",
        description: valor
          ? "As OS das filiais agora aparecem na matriz."
          : "As OS das filiais ficam separadas por empresa.",
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
          Multi-Empresa
        </CardTitle>
        <CardDescription>
          Controle como as Ordens de Serviço das filiais aparecem na conta da matriz.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {!temFiliais && (
          <p className="text-sm text-muted-foreground">
            Nenhuma filial cadastrada. Estas opções ficam disponíveis após criar pelo menos uma filial em Multi-Empresas.
          </p>
        )}

        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <Label htmlFor="mostrar-os-filiais" className="text-sm font-medium">
              Mostrar OS das filiais na matriz
            </Label>
            <p className="text-xs text-muted-foreground max-w-sm">
              Quando ativado, todas as Ordens de Serviço de todas as filiais aparecem juntas no menu de OS da matriz.
              Uma coluna <strong>Loja</strong> e um filtro por filial serão exibidos na listagem.
            </p>
            <p className="text-xs text-muted-foreground max-w-sm mt-1">
              Quando desativado, use o seletor de empresas na barra lateral para alternar entre matriz e filiais individualmente.
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
