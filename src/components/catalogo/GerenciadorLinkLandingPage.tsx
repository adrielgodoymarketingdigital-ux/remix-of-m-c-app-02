import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ConfiguracaoLandingPage, LANDING_PAGE_PADRAO } from "@/types/catalogo";
import { 
  Globe, 
  Link2, 
  Copy, 
  Check, 
  ExternalLink, 
  Share2, 
  Loader2,
  Sparkles,
  CheckCircle2,
  XCircle
} from "lucide-react";

interface GerenciadorLinkLandingPageProps {
  configLP: ConfiguracaoLandingPage;
  onConfigLPChange: (config: ConfiguracaoLandingPage) => void;
  onSalvar?: () => void;
}

export function GerenciadorLinkLandingPage({
  configLP,
  onConfigLPChange,
  onSalvar,
}: GerenciadorLinkLandingPageProps) {
  const [slug, setSlug] = useState("");
  const [ativa, setAtiva] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [verificandoSlug, setVerificandoSlug] = useState(false);
  const [slugDisponivel, setSlugDisponivel] = useState<boolean | null>(null);

  useEffect(() => {
    carregarConfiguracoes();
  }, []);

  // Verificar disponibilidade do slug com debounce
  useEffect(() => {
    if (!slug || slug.length < 3) {
      setSlugDisponivel(null);
      return;
    }

    const timer = setTimeout(() => {
      verificarDisponibilidadeSlug(slug);
    }, 500);

    return () => clearTimeout(timer);
  }, [slug]);

  const carregarConfiguracoes = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('configuracoes_loja')
        .select('catalogo_slug, landing_page_config, landing_page_ativa')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        setSlug(data.catalogo_slug || '');
        setAtiva(data.landing_page_ativa || false);
        if (data.landing_page_config && typeof data.landing_page_config === 'object') {
          onConfigLPChange(data.landing_page_config as unknown as ConfiguracaoLandingPage);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
    } finally {
      setLoading(false);
    }
  };

  const verificarDisponibilidadeSlug = async (slugParaVerificar: string) => {
    setVerificandoSlug(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('configuracoes_loja')
        .select('user_id')
        .eq('catalogo_slug', slugParaVerificar)
        .neq('user_id', user.id)
        .maybeSingle();

      setSlugDisponivel(!data);
    } catch (error) {
      console.error('Erro ao verificar slug:', error);
      setSlugDisponivel(null);
    } finally {
      setVerificandoSlug(false);
    }
  };

  const gerarSlugAutomatico = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: configData } = await supabase
        .from('configuracoes_loja')
        .select('nome_loja')
        .eq('user_id', user.id)
        .maybeSingle();

      if (configData?.nome_loja) {
        const novoSlug = formatarSlug(configData.nome_loja);
        setSlug(novoSlug);
      }
    } catch (error) {
      console.error('Erro ao gerar slug:', error);
    }
  };

  const salvarConfiguracoes = async () => {
    if (!slug || slug.length < 3) {
      toast({
        title: "Link inválido",
        description: "O link deve ter pelo menos 3 caracteres.",
        variant: "destructive",
      });
      return;
    }

    if (slugDisponivel === false) {
      toast({
        title: "Link indisponível",
        description: "Este link já está sendo usado por outra loja.",
        variant: "destructive",
      });
      return;
    }

    setSalvando(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { error } = await supabase
        .from('configuracoes_loja')
        .update({
          catalogo_slug: slug,
          landing_page_config: JSON.parse(JSON.stringify(configLP)),
          landing_page_ativa: ativa,
        })
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: "Configurações salvas!",
        description: ativa 
          ? "Sua landing page está publicada e disponível." 
          : "Configurações salvas. Ative para publicar.",
      });

      onSalvar?.();
    } catch (error) {
      console.error('Erro ao salvar:', error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar as configurações.",
        variant: "destructive",
      });
    } finally {
      setSalvando(false);
    }
  };

  const copiarLink = async () => {
    try {
      await navigator.clipboard.writeText(getLinkCompleto());
      setCopiado(true);
      toast({ title: "Link copiado!" });
      setTimeout(() => setCopiado(false), 2000);
    } catch (error) {
      toast({
        title: "Erro ao copiar",
        description: "Não foi possível copiar o link.",
        variant: "destructive",
      });
    }
  };

  const compartilhar = async () => {
    const link = getLinkCompleto();
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Confira nossa loja!',
          url: link,
        });
      } catch (error) {
        copiarLink();
      }
    } else {
      copiarLink();
    }
  };

  const getLinkCompleto = () => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/lp/${slug}`;
  };

  const formatarSlug = (texto: string) => {
    return texto
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="w-5 h-5" />
          Link da Landing Page
        </CardTitle>
        <CardDescription>
          Configure e compartilhe sua landing page profissional
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Campo do slug */}
        <div className="space-y-2">
          <Label>Link personalizado</Label>
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                /lp/
              </div>
              <Input
                value={slug}
                onChange={(e) => setSlug(formatarSlug(e.target.value))}
                placeholder="sua-loja"
                className="pl-10"
              />
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={gerarSlugAutomatico}
              title="Gerar automaticamente"
            >
              <Sparkles className="w-4 h-4" />
            </Button>
          </div>
          
          {/* Indicador de disponibilidade */}
          {slug.length >= 3 && (
            <div className="flex items-center gap-2 text-sm">
              {verificandoSlug ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-muted-foreground">Verificando...</span>
                </>
              ) : slugDisponivel === true ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span className="text-green-600">Link disponível!</span>
                </>
              ) : slugDisponivel === false ? (
                <>
                  <XCircle className="w-4 h-4 text-red-500" />
                  <span className="text-red-600">Este link já está em uso</span>
                </>
              ) : null}
            </div>
          )}
        </div>

        {/* Toggle de ativação */}
        <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
          <div className="space-y-1">
            <Label className="text-base">Publicar Landing Page</Label>
            <p className="text-sm text-muted-foreground">
              {ativa 
                ? "Sua landing page está visível para todos" 
                : "Ative para tornar sua landing page pública"}
            </p>
          </div>
          <Switch
            checked={ativa}
            onCheckedChange={setAtiva}
          />
        </div>

        {/* Preview do link */}
        {slug && (
          <div className="space-y-3">
            <Label>Seu link</Label>
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <Link2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <span className="text-sm font-mono truncate flex-1">
                {getLinkCompleto()}
              </span>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={copiarLink}
                  className="h-8 w-8"
                >
                  {copiado ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => window.open(getLinkCompleto(), '_blank')}
                  className="h-8 w-8"
                  disabled={!ativa}
                >
                  <ExternalLink className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={compartilhar}
                  className="h-8 w-8"
                >
                  <Share2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Status */}
        <div className="flex items-center gap-2">
          <Badge variant={ativa ? "default" : "secondary"}>
            {ativa ? "Publicada" : "Não publicada"}
          </Badge>
        </div>

        {/* Botão salvar */}
        <Button
          onClick={salvarConfiguracoes}
          disabled={salvando || !slug || slug.length < 3 || slugDisponivel === false}
          className="w-full"
          size="lg"
        >
          {salvando ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Check className="w-4 h-4 mr-2" />
              Salvar e {ativa ? 'Publicar' : 'Salvar'} Landing Page
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
