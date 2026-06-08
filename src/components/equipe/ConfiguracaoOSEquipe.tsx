import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings2 } from "lucide-react";
import { useOSBehaviorConfig } from "@/hooks/useOSBehaviorConfig";

export function ConfiguracaoOSEquipe() {
  const { tecnicoObrigatorioOS, carregando, salvar, salvando } = useOSBehaviorConfig();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Settings2 className="h-4 w-4" />
          Configurações de Ordem de Serviço
        </CardTitle>
        <CardDescription>
          Controla o comportamento do formulário de OS para todos os usuários da loja.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Label htmlFor="tecnico-obrigatorio" className="text-sm font-medium">
              Técnico/Funcionário obrigatório
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Ao ativar, não será possível salvar uma OS sem selecionar um técnico responsável.
            </p>
          </div>
          <Switch
            id="tecnico-obrigatorio"
            checked={tecnicoObrigatorioOS}
            onCheckedChange={salvar}
            disabled={carregando || salvando}
          />
        </div>
      </CardContent>
    </Card>
  );
}
