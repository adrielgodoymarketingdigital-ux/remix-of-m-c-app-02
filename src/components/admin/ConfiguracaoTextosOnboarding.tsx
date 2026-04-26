import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TextosPersonalizados, TEXTOS_PADRAO, ROTAS_DISPONIVEIS } from '@/types/onboarding-config';
import { Save, RotateCcw, Type, MessageSquare, Sparkles, Navigation } from 'lucide-react';

interface ConfiguracaoTextosOnboardingProps {
  textos: TextosPersonalizados;
  onSave: (textos: TextosPersonalizados) => Promise<void>;
  saving: boolean;
}

export function ConfiguracaoTextosOnboarding({ textos, onSave, saving }: ConfiguracaoTextosOnboardingProps) {
  const [localTextos, setLocalTextos] = useState<TextosPersonalizados>(textos);
  const [hasChanges, setHasChanges] = useState(false);

  const handleChange = (field: keyof TextosPersonalizados, value: string) => {
    setLocalTextos(prev => ({
      ...prev,
      [field]: value
    }));
    setHasChanges(true);
  };

  const handleReset = () => {
    setLocalTextos(TEXTOS_PADRAO);
    setHasChanges(true);
  };

  const handleSave = async () => {
    await onSave(localTextos);
    setHasChanges(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-lg font-semibold">Textos Personalizados</h3>
          <p className="text-sm text-muted-foreground">
            Personalize as mensagens exibidas durante o onboarding
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

      {/* Tela de Boas-vindas */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Type className="h-4 w-4" />
            Tela de Boas-vindas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="titulo_boas_vindas">Título</Label>
              <Input
                id="titulo_boas_vindas"
                value={localTextos.titulo_boas_vindas}
                onChange={(e) => handleChange('titulo_boas_vindas', e.target.value)}
                placeholder="Bem-vindo ao MEC App!"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subtitulo_boas_vindas">Subtítulo</Label>
              <Input
                id="subtitulo_boas_vindas"
                value={localTextos.subtitulo_boas_vindas}
                onChange={(e) => handleChange('subtitulo_boas_vindas', e.target.value)}
                placeholder="Vamos configurar o sistema..."
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Seleção de Tipo */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Seleção de Tipo de Negócio
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="titulo_selecao_tipo">Título da Seleção</Label>
            <Input
              id="titulo_selecao_tipo"
              value={localTextos.titulo_selecao_tipo}
              onChange={(e) => handleChange('titulo_selecao_tipo', e.target.value)}
              placeholder="Qual é o seu foco principal?"
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="titulo_assistencia">Título - Assistência Técnica</Label>
              <Input
                id="titulo_assistencia"
                value={localTextos.titulo_assistencia}
                onChange={(e) => handleChange('titulo_assistencia', e.target.value)}
                placeholder="Assistência Técnica"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="titulo_vendas">Título - Vendas</Label>
              <Input
                id="titulo_vendas"
                value={localTextos.titulo_vendas}
                onChange={(e) => handleChange('titulo_vendas', e.target.value)}
                placeholder="Venda de Dispositivos"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="descricao_assistencia">Descrição - Assistência</Label>
              <Textarea
                id="descricao_assistencia"
                value={localTextos.descricao_assistencia}
                onChange={(e) => handleChange('descricao_assistencia', e.target.value)}
                placeholder="Conserto de celulares, tablets..."
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="descricao_vendas">Descrição - Vendas</Label>
              <Textarea
                id="descricao_vendas"
                value={localTextos.descricao_vendas}
                onChange={(e) => handleChange('descricao_vendas', e.target.value)}
                placeholder="Venda de celulares, tablets..."
                rows={2}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Botões e Navegação */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Botões e Navegação
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="botao_primeiros_passos">Botão Primeiros Passos</Label>
              <Input
                id="botao_primeiros_passos"
                value={localTextos.botao_primeiros_passos}
                onChange={(e) => handleChange('botao_primeiros_passos', e.target.value)}
                placeholder="Primeiros Passos"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="botao_pular">Botão Pular</Label>
              <Input
                id="botao_pular"
                value={localTextos.botao_pular}
                onChange={(e) => handleChange('botao_pular', e.target.value)}
                placeholder="Já sei como usar"
              />
            </div>
          </div>

          {/* Destino ao Pular */}
          <div className="p-4 rounded-lg border bg-muted/30 space-y-3">
            <div className="flex items-center gap-2">
              <Navigation className="h-4 w-4 text-muted-foreground" />
              <Label className="font-medium">Destino ao Pular Onboarding</Label>
            </div>
            <p className="text-sm text-muted-foreground">
              Selecione para onde o usuário será redirecionado quando clicar em pular o onboarding
            </p>
            <Select 
              value={localTextos.destino_ao_pular || '/dashboard'} 
              onValueChange={(v) => handleChange('destino_ao_pular', v)}
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
        </CardContent>
      </Card>

      {/* Mensagem Aha Moment */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Mensagem de Conclusão (Aha Moment)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="mensagem_aha_moment">Mensagem de Parabéns</Label>
            <Textarea
              id="mensagem_aha_moment"
              value={localTextos.mensagem_aha_moment}
              onChange={(e) => handleChange('mensagem_aha_moment', e.target.value)}
              placeholder="Parabéns! Você completou o onboarding..."
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      {hasChanges && (
        <p className="text-sm text-amber-600 text-center">
          ⚠️ Você tem alterações não salvas
        </p>
      )}
    </div>
  );
}
