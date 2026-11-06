import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BadgeCheck, Settings2 } from "lucide-react";
import { useOSBehaviorConfig } from "@/hooks/useOSBehaviorConfig";
import { useIsDesktop } from "@/hooks/use-mobile";

export function ConfiguracaoOSEquipe() {
  const { tecnicoObrigatorioOS, carregando, salvar, salvando } = useOSBehaviorConfig();
  const isDesktop = useIsDesktop();

  const interruptor = (
    <Switch
      id="tecnico-obrigatorio"
      checked={tecnicoObrigatorioOS}
      onCheckedChange={salvar}
      disabled={carregando || salvando}
    />
  );

  // Computador: só o visual muda. O interruptor e o que ele grava são os mesmos.
  if (isDesktop) {
    return (
      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="flex items-start gap-3">
            <Settings2 className="mt-0.5 h-6 w-6 shrink-0 text-foreground" aria-hidden="true" />
            <div className="min-w-0">
              <CardTitle className="text-base">Configurações de Ordem de Serviço</CardTitle>
              <CardDescription className="mt-1">
                Controla o comportamento do formulário de OS para todos os usuários da loja.
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center justify-between gap-4 rounded-lg border bg-muted/30 p-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                <BadgeCheck className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <Label htmlFor="tecnico-obrigatorio" className="text-sm font-medium">
                  Técnico/Funcionário obrigatório
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Ao ativar, não será possível salvar uma OS sem selecionar um técnico responsável.
                </p>
              </div>
            </div>
            {interruptor}
          </div>
        </CardContent>
      </Card>
    );
  }

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
          {interruptor}
        </div>
      </CardContent>
    </Card>
  );
}
