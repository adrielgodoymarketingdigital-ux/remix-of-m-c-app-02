import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  Link2, 
  Copy, 
  Check, 
  ExternalLink, 
  RefreshCw,
  Globe,
  Lock,
  Loader2,
  Share2,
  QrCode
} from "lucide-react";
import { ConfiguracaoCatalogo } from "@/types/catalogo";

interface GerenciadorLinkCatalogoProps {
  configCatalogo: ConfiguracaoCatalogo;
  onConfigSalva?: () => void;
}

export function GerenciadorLinkCatalogo({ configCatalogo, onConfigSalva }: GerenciadorLinkCatalogoProps) {
  const [slug, setSlug] = useState("");
  const [slugOriginal, setSlugOriginal] = useState("");
  const [ativo, setAtivo] = useState(false);
  const [copiado, setCopiadoo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [verificandoSlug, setVerificandoSlug] = useState(false);
  const [slugDisponivel, setSlugDisponivel] = useState<boolean | null>(null);

  useEffect(() => {
    carregarConfiguracoes();
  }, []);

  useEffect(() => {
    if (slug && slug !== slugOriginal) {
      const timeout = setTimeout(() => {
        verificarDisponibilidadeSlug();
      }, 500);
      return () => clearTimeout(timeout);
    } else {
      setSlugDisponivel(null);
    }
  }, [slug, slugOriginal]);

  const carregarConfiguracoes = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("configuracoes_loja")
        .select("catalogo_slug, catalogo_ativo, nome_loja")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Erro ao carregar configurações:", error);
        return;
      }

      if (data) {
        setSlug(data.catalogo_slug || "");
        setSlugOriginal(data.catalogo_slug || "");
        setAtivo(data.catalogo_ativo || false);
      }
    } catch (err) {
      console.error("Erro ao carregar:", err);
    } finally {
      setLoading(false);
    }
  };

  const verificarDisponibilidadeSlug = async () => {
    if (!slug || slug.length < 3) {
      setSlugDisponivel(null);
      return;
    }

    setVerificandoSlug(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("configuracoes_loja")
        .select("id")
        .eq("catalogo_slug", slug)
        .neq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Erro ao verificar slug:", error);
        return;
      }

      setSlugDisponivel(!data);
    } catch (err) {
      console.error("Erro:", err);
    } finally {
      setVerificandoSlug(false);
    }
  };

  const gerarSlugAutomatico = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("configuracoes_loja")
        .select("nome_loja")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error || !data) {
        console.error("Erro ao buscar nome:", error);
        return;
      }

      // Gerar slug baseado no nome da loja
      const novoSlug = data.nome_loja
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .substring(0, 30);

      setSlug(novoSlug || "minha-loja");
    } catch (err) {
      console.error("Erro:", err);
    }
  };

  const salvarConfiguracoes = async () => {
    if (!slug || slug.length < 3) {
      toast({
        title: "Slug inválido",
        description: "O link precisa ter pelo menos 3 caracteres.",
        variant: "destructive",
      });
      return;
    }

    if (slugDisponivel === false) {
      toast({
        title: "Link indisponível",
        description: "Este link já está em uso. Escolha outro.",
        variant: "destructive",
      });
      return;
    }

    setSalvando(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("configuracoes_loja")
        .update({
          catalogo_slug: slug,
          catalogo_ativo: ativo,
          catalogo_config: JSON.parse(JSON.stringify(configCatalogo)),
        })
        .eq("user_id", user.id);

      if (error) {
        console.error("Erro ao salvar:", error);
        toast({
          title: "Erro ao salvar",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      setSlugOriginal(slug);
      toast({
        title: "Configurações salvas!",
        description: ativo ? "Seu catálogo está público." : "Catálogo salvo mas ainda não está público.",
      });
      onConfigSalva?.();
    } catch (err) {
      console.error("Erro:", err);
    } finally {
      setSalvando(false);
    }
  };

  const copiarLink = async () => {
    const link = getLinkCompleto();
    try {
      await navigator.clipboard.writeText(link);
      setCopiadoo(true);
      toast({
        title: "Link copiado!",
        description: "O link foi copiado para a área de transferência.",
      });
      setTimeout(() => setCopiadoo(false), 2000);
    } catch (err) {
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
          title: "Catálogo de Dispositivos",
          text: "Confira nosso catálogo de dispositivos!",
          url: link,
        });
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          copiarLink();
        }
      }
    } else {
      copiarLink();
    }
  };

  const getLinkCompleto = () => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/c/${slug}`;
  };

  const formatarSlug = (valor: string) => {
    return valor
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9-]/g, "")
      .replace(/--+/g, "-")
      .substring(0, 30);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Link2 className="w-5 h-5 text-primary" />
          <CardTitle>Link do Catálogo</CardTitle>
        </div>
        <CardDescription>
          Crie um link público para compartilhar seu catálogo em tempo real
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Campo do slug - PRIMEIRO */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="slug">Link personalizado do catálogo</Label>
            <Button
              variant="ghost"
              size="sm"
              onClick={gerarSlugAutomatico}
              className="text-xs h-7"
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              Gerar automático
            </Button>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center">
              <span className="text-sm text-muted-foreground bg-muted px-3 py-2 rounded-l-md border border-r-0">
                {window.location.origin}/c/
              </span>
              <Input
                id="slug"
                value={slug}
                onChange={(e) => setSlug(formatarSlug(e.target.value))}
                placeholder="minha-loja"
                className="rounded-l-none"
              />
            </div>
          </div>

          {/* Indicador de disponibilidade */}
          {slug && slug.length >= 3 && (
            <div className="flex items-center gap-2">
              {verificandoSlug ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">Verificando...</span>
                </>
              ) : slugDisponivel === true ? (
                <>
                  <Check className="w-4 h-4 text-green-500" />
                  <span className="text-sm text-green-600">Link disponível!</span>
                </>
              ) : slugDisponivel === false ? (
                <>
                  <span className="text-sm text-destructive">Este link já está em uso</span>
                </>
              ) : null}
            </div>
          )}
        </div>

        {/* Status do catálogo - Publicar/Despublicar */}
        <div className="space-y-3">
          <Label>Publicar catálogo</Label>
          <div 
            className={`flex items-center justify-between p-4 rounded-lg border-2 transition-colors cursor-pointer ${
              ativo 
                ? "bg-green-500/10 border-green-500/30" 
                : "bg-muted/50 border-transparent hover:border-muted-foreground/20"
            }`}
            onClick={() => {
              if (!slug || slug.length < 3) {
                toast({
                  title: "Configure o link primeiro",
                  description: "Defina um link com pelo menos 3 caracteres antes de publicar.",
                  variant: "destructive",
                });
                return;
              }
              setAtivo(!ativo);
            }}
          >
            <div className="flex items-center gap-3">
              {ativo ? (
                <>
                  <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                    <Globe className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium text-green-700">Catálogo Publicado</p>
                    <p className="text-sm text-green-600/80">Qualquer pessoa pode acessar o link</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                    <Lock className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">Catálogo Não Publicado</p>
                    <p className="text-sm text-muted-foreground">Clique para publicar e compartilhar</p>
                  </div>
                </>
              )}
            </div>
            <Switch 
              checked={ativo} 
              onCheckedChange={(checked) => {
                if (!slug || slug.length < 3) {
                  toast({
                    title: "Configure o link primeiro",
                    description: "Defina um link com pelo menos 3 caracteres antes de publicar.",
                    variant: "destructive",
                  });
                  return;
                }
                setAtivo(checked);
              }} 
            />
          </div>
        </div>


        {/* Ações do link */}
        {slug && slug.length >= 3 && (
          <div className="space-y-3">
            <Label>Link do seu catálogo</Label>
            <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
              <p className="text-sm font-medium text-primary break-all">
                {getLinkCompleto()}
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={copiarLink}
                className="flex-1"
              >
                {copiado ? (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Copiado!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-2" />
                    Copiar link
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(getLinkCompleto(), "_blank")}
                className="flex-1"
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Visualizar
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={compartilhar}
                title="Compartilhar link"
              >
                <Share2 className="w-4 h-4" />
              </Button>
            </div>

            {!ativo && (
              <p className="text-xs text-amber-600 text-center bg-amber-50 p-2 rounded-md">
                ⚠️ O catálogo não está publicado. Ative a opção acima e salve para que outros possam acessar.
              </p>
            )}
          </div>
        )}

        {/* Botão salvar */}
        <Button
          onClick={salvarConfiguracoes}
          disabled={salvando || (slug !== slugOriginal && slugDisponivel === false)}
          className="w-full"
        >
          {salvando ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Salvando...
            </>
          ) : (
            "Salvar configurações do catálogo"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
