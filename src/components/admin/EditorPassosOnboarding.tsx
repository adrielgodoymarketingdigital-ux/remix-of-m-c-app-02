import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { 
  ConfigPassos, 
  PassoOnboarding, 
  ICONES_DISPONIVEIS, 
  ROTAS_DISPONIVEIS,
  CONFIG_PASSOS_PADRAO
} from '@/types/onboarding-config';
import { 
  GripVertical, 
  Trash2, 
  Plus, 
  Save,
  RotateCcw,
  User,
  Users,
  Smartphone,
  Tablet,
  Laptop,
  Package,
  ClipboardList,
  TrendingUp,
  DollarSign,
  Settings,
  Wrench,
  CheckCircle,
  Star,
  Heart,
  Home,
  ShoppingCart,
  CreditCard,
  FileText,
  Calendar
} from 'lucide-react';

const ICON_MAP: Record<string, React.ElementType> = {
  'user': User,
  'users': Users,
  'smartphone': Smartphone,
  'tablet': Tablet,
  'laptop': Laptop,
  'package': Package,
  'clipboard-list': ClipboardList,
  'trending-up': TrendingUp,
  'dollar-sign': DollarSign,
  'settings': Settings,
  'wrench': Wrench,
  'check-circle': CheckCircle,
  'star': Star,
  'heart': Heart,
  'home': Home,
  'shopping-cart': ShoppingCart,
  'credit-card': CreditCard,
  'file-text': FileText,
  'calendar': Calendar
};

interface EditorPassosOnboardingProps {
  configPassos: ConfigPassos;
  onSave: (passos: ConfigPassos) => Promise<void>;
  saving: boolean;
}

function PassoCard({
  passo,
  onUpdate,
  onRemove,
  index
}: {
  passo: PassoOnboarding;
  onUpdate: (passo: PassoOnboarding) => void;
  onRemove: () => void;
  index: number;
}) {
  const IconComponent = ICON_MAP[passo.icone] || User;

  return (
    <Card className="border-l-4 border-l-primary">
      <CardContent className="pt-4">
        <div className="flex items-start gap-4">
          {/* Drag handle */}
          <div className="flex items-center gap-2 text-muted-foreground mt-2">
            <GripVertical className="h-5 w-5 cursor-grab" />
            <Badge variant="outline">{index + 1}</Badge>
          </div>

          {/* Content */}
          <div className="flex-1 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-md bg-primary/10">
                  <IconComponent className="h-4 w-4 text-primary" />
                </div>
                <span className="font-medium">{passo.titulo}</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Label htmlFor={`ativo-${passo.id}`} className="text-sm">Ativo</Label>
                  <Switch
                    id={`ativo-${passo.id}`}
                    checked={passo.ativo}
                    onCheckedChange={(checked) => onUpdate({ ...passo, ativo: checked })}
                  />
                </div>
                <Button variant="ghost" size="icon" onClick={onRemove}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Ícone</Label>
                <Select 
                  value={passo.icone} 
                  onValueChange={(v) => onUpdate({ ...passo, icone: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ICONES_DISPONIVEIS.map(icone => {
                      const Icon = ICON_MAP[icone] || User;
                      return (
                        <SelectItem key={icone} value={icone}>
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4" />
                            <span>{icone}</span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Rota</Label>
                <Select 
                  value={passo.rota} 
                  onValueChange={(v) => onUpdate({ ...passo, rota: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
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

              <div className="space-y-2">
                <Label>Título</Label>
                <Input
                  value={passo.titulo}
                  onChange={(e) => onUpdate({ ...passo, titulo: e.target.value })}
                  placeholder="Título do passo"
                />
              </div>

              <div className="space-y-2">
                <Label>Texto do Botão</Label>
                <Input
                  value={passo.botao_texto}
                  onChange={(e) => onUpdate({ ...passo, botao_texto: e.target.value })}
                  placeholder="Texto do botão"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>Descrição</Label>
                <Textarea
                  value={passo.descricao}
                  onChange={(e) => onUpdate({ ...passo, descricao: e.target.value })}
                  placeholder="Descrição do passo"
                  rows={2}
                />
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function EditorPassosOnboarding({ configPassos, onSave, saving }: EditorPassosOnboardingProps) {
  const [fluxoSelecionado, setFluxoSelecionado] = useState<'assistencia' | 'vendas'>('assistencia');
  const [localConfig, setLocalConfig] = useState<ConfigPassos>(configPassos);
  const [hasChanges, setHasChanges] = useState(false);

  const passos = localConfig[fluxoSelecionado];

  const handleUpdatePasso = (index: number, passo: PassoOnboarding) => {
    const newPassos = [...passos];
    newPassos[index] = passo;
    setLocalConfig({
      ...localConfig,
      [fluxoSelecionado]: newPassos
    });
    setHasChanges(true);
  };

  const handleRemovePasso = (index: number) => {
    const newPassos = passos.filter((_, i) => i !== index);
    setLocalConfig({
      ...localConfig,
      [fluxoSelecionado]: newPassos
    });
    setHasChanges(true);
  };

  const handleAddPasso = () => {
    const newPasso: PassoOnboarding = {
      id: `passo_${Date.now()}`,
      titulo: 'Novo Passo',
      descricao: 'Descrição do novo passo',
      icone: 'check-circle',
      rota: '/clientes',
      botao_texto: 'Continuar',
      ordem: passos.length + 1,
      ativo: true
    };
    setLocalConfig({
      ...localConfig,
      [fluxoSelecionado]: [...passos, newPasso]
    });
    setHasChanges(true);
  };

  const handleReset = () => {
    setLocalConfig(CONFIG_PASSOS_PADRAO);
    setHasChanges(true);
  };

  const handleSave = async () => {
    await onSave(localConfig);
    setHasChanges(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-lg font-semibold">Personalizar Passos</h3>
          <p className="text-sm text-muted-foreground">
            Edite os passos do onboarding para cada tipo de negócio
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleReset} disabled={saving}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Restaurar Padrão
          </Button>
          <Button onClick={handleSave} disabled={!hasChanges || saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </div>

      {/* Seletor de fluxo */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Selecionar Fluxo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Button
              variant={fluxoSelecionado === 'assistencia' ? 'default' : 'outline'}
              onClick={() => setFluxoSelecionado('assistencia')}
            >
              <Wrench className="h-4 w-4 mr-2" />
              Assistência Técnica
              <Badge variant="secondary" className="ml-2">
                {localConfig.assistencia.length} passos
              </Badge>
            </Button>
            <Button
              variant={fluxoSelecionado === 'vendas' ? 'default' : 'outline'}
              onClick={() => setFluxoSelecionado('vendas')}
            >
              <ShoppingCart className="h-4 w-4 mr-2" />
              Venda de Dispositivos
              <Badge variant="secondary" className="ml-2">
                {localConfig.vendas.length} passos
              </Badge>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Lista de passos */}
      <div className="space-y-4">
        {passos.map((passo, index) => (
          <PassoCard
            key={passo.id}
            passo={passo}
            index={index}
            onUpdate={(p) => handleUpdatePasso(index, p)}
            onRemove={() => handleRemovePasso(index)}
          />
        ))}
      </div>

      {/* Botão adicionar */}
      <Button variant="outline" onClick={handleAddPasso} className="w-full">
        <Plus className="h-4 w-4 mr-2" />
        Adicionar Novo Passo
      </Button>

      {hasChanges && (
        <p className="text-sm text-amber-600 text-center">
          ⚠️ Você tem alterações não salvas
        </p>
      )}
    </div>
  );
}
