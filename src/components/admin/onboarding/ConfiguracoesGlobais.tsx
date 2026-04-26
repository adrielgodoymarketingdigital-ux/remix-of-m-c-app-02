import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { 
  Power, 
  Users, 
  UserCheck, 
  SkipForward,
  Info
} from "lucide-react";
import { PLANOS_DISPONIVEIS, ROTAS_DISPONIVEIS } from "@/types/onboarding-config";
import type { OnboardingConfig, TextosPersonalizados } from "@/types/onboarding-config";

interface ConfiguracoesGlobaisProps {
  config: OnboardingConfig | null;
  loading: boolean;
  saving: boolean;
  onToggleAtivo: () => void;
  onToggleMostrarParaAtivos: () => void;
  onUpdatePublicoAlvo: (planos: string[]) => void;
  onUpdateTextos: (textos: TextosPersonalizados) => void;
}

export function ConfiguracoesGlobais({
  config,
  loading,
  saving,
  onToggleAtivo,
  onToggleMostrarParaAtivos,
  onUpdatePublicoAlvo,
  onUpdateTextos
}: ConfiguracoesGlobaisProps) {
  const handlePlanoChange = (plano: string, checked: boolean) => {
    if (!config) return;
    
    const novosPlanos = checked
      ? [...config.publico_alvo, plano]
      : config.publico_alvo.filter(p => p !== plano);
    
    onUpdatePublicoAlvo(novosPlanos);
  };

  const handleDestinoAoPularChange = (destino: string) => {
    if (!config) return;
    onUpdateTextos({
      ...config.textos_personalizados,
      destino_ao_pular: destino
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!config) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Erro ao carregar configurações
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status do Onboarding */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Power className="h-5 w-5" />
            Status do Onboarding
          </CardTitle>
          <CardDescription>
            Ative ou desative o onboarding globalmente
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full ${config.ativo ? 'bg-green-100 dark:bg-green-900' : 'bg-muted'}`}>
                <Power className={`h-5 w-5 ${config.ativo ? 'text-green-600' : 'text-muted-foreground'}`} />
              </div>
              <div>
                <p className="font-medium">Onboarding Global</p>
                <p className="text-sm text-muted-foreground">
                  {config.ativo ? 'Ativo - Usuários verão o onboarding' : 'Inativo - Onboarding desabilitado para todos'}
                </p>
              </div>
            </div>
            <Switch
              checked={config.ativo}
              onCheckedChange={onToggleAtivo}
              disabled={saving}
            />
          </div>
        </CardContent>
      </Card>

      {/* Público-Alvo */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" />
            Público-Alvo
          </CardTitle>
          <CardDescription>
            Selecione quais tipos de usuários verão o onboarding
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4 p-4 rounded-lg border">
            {PLANOS_DISPONIVEIS.map(plano => (
              <div key={plano.value} className="flex items-center gap-2">
                <Checkbox
                  id={`plano-${plano.value}`}
                  checked={config.publico_alvo.includes(plano.value)}
                  onCheckedChange={(checked) => handlePlanoChange(plano.value, checked as boolean)}
                  disabled={saving || !config.ativo}
                />
                <Label 
                  htmlFor={`plano-${plano.value}`}
                  className="text-sm cursor-pointer"
                >
                  {plano.label}
                </Label>
              </div>
            ))}
          </div>
          
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Info className="h-3 w-3" />
            <span>
              {config.publico_alvo.length === 0 
                ? 'Nenhum plano selecionado - onboarding não será exibido'
                : `Onboarding será exibido para ${config.publico_alvo.length} tipo(s) de plano`}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Tipo de Usuário */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <UserCheck className="h-5 w-5" />
            Tipo de Usuário
          </CardTitle>
          <CardDescription>
            Defina para quais usuários o onboarding será exibido
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 rounded-lg border">
            <div className="flex items-center gap-3">
              <UserCheck className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">Mostrar para Usuários Ativos</p>
                <p className="text-sm text-muted-foreground">
                  Exibir onboarding também para quem já usou o sistema
                </p>
              </div>
            </div>
            <Switch
              checked={config.mostrar_para_usuarios_ativos}
              onCheckedChange={onToggleMostrarParaAtivos}
              disabled={saving || !config.ativo}
            />
          </div>
          
          <div className="mt-3 p-3 rounded-lg bg-muted/30 text-xs text-muted-foreground">
            <strong>Apenas novos usuários:</strong> O onboarding só aparece para quem nunca completou nenhuma ação no sistema.
            <br />
            <strong>Novos e ativos:</strong> O onboarding aparecerá mesmo para quem já usou o sistema.
          </div>
        </CardContent>
      </Card>

      {/* Comportamento ao Pular */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <SkipForward className="h-5 w-5" />
            Comportamento ao Pular
          </CardTitle>
          <CardDescription>
            Configure o que acontece quando o usuário pula o onboarding
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Redirecionar para:</Label>
            <Select
              value={config.textos_personalizados.destino_ao_pular || '/dashboard'}
              onValueChange={handleDestinoAoPularChange}
              disabled={saving || !config.ativo}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o destino" />
              </SelectTrigger>
              <SelectContent>
                {ROTAS_DISPONIVEIS.map(rota => (
                  <SelectItem key={rota.value} value={rota.value}>
                    {rota.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 text-xs">
            <div className="flex items-start gap-2">
              <Info className="h-3 w-3 text-blue-600 mt-0.5" />
              <div className="text-blue-800 dark:text-blue-200">
                <strong>Lembrete:</strong> Quando o usuário pula, um banner de lembrete aparece no dashboard permitindo retomar o onboarding.
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resumo Atual */}
      <Card className="border-dashed">
        <CardContent className="py-4">
          <div className="flex flex-wrap gap-2 items-center justify-center text-sm">
            <span className="text-muted-foreground">Status:</span>
            <Badge variant={config.ativo ? "default" : "secondary"}>
              {config.ativo ? "Ativo" : "Inativo"}
            </Badge>
            
            <span className="text-muted-foreground ml-4">Público:</span>
            {config.publico_alvo.length > 0 ? (
              config.publico_alvo.slice(0, 3).map(p => (
                <Badge key={p} variant="outline" className="text-xs">
                  {PLANOS_DISPONIVEIS.find(pl => pl.value === p)?.label || p}
                </Badge>
              ))
            ) : (
              <Badge variant="destructive">Nenhum</Badge>
            )}
            {config.publico_alvo.length > 3 && (
              <Badge variant="outline">+{config.publico_alvo.length - 3}</Badge>
            )}
            
            <span className="text-muted-foreground ml-4">Destino ao pular:</span>
            <Badge variant="outline">
              {ROTAS_DISPONIVEIS.find(r => r.value === config.textos_personalizados.destino_ao_pular)?.label || 'Dashboard'}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
