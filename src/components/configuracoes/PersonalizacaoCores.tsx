import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Palette, RotateCcw, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface CoresPersonalizadas {
  primary_from: string;
  primary_via: string;
  primary_to: string;
  card_faturamento_from: string;
  card_faturamento_via: string;
  card_faturamento_to: string;
}

const CORES_PREDEFINIDAS = [
  // Blues
  { nome: "Azul Escuro", from: "#1e40af", via: "#1d4ed8", to: "#0891b2" },
  { nome: "Azul Royal", from: "#1e3a8a", via: "#2563eb", to: "#3b82f6" },
  { nome: "Azul Profundo", from: "#172554", via: "#1e40af", to: "#0284c7" },
  { nome: "Azul Índigo", from: "#312e81", via: "#4338ca", to: "#6366f1" },
  // Greens
  { nome: "Verde Esmeralda", from: "#064e3b", via: "#059669", to: "#10b981" },
  { nome: "Verde Floresta", from: "#14532d", via: "#166534", to: "#22c55e" },
  // Purples
  { nome: "Roxo Profundo", from: "#581c87", via: "#7c3aed", to: "#a855f7" },
  { nome: "Violeta", from: "#4c1d95", via: "#6d28d9", to: "#8b5cf6" },
  // Oranges & Reds
  { nome: "Laranja Fogo", from: "#c2410c", via: "#ea580c", to: "#f97316" },
  { nome: "Vermelho Carmim", from: "#991b1b", via: "#dc2626", to: "#ef4444" },
  // Teals & Cyans
  { nome: "Teal", from: "#134e4a", via: "#0d9488", to: "#14b8a6" },
  { nome: "Ciano", from: "#155e75", via: "#0891b2", to: "#22d3ee" },
  // Grays
  { nome: "Grafite", from: "#1f2937", via: "#374151", to: "#6b7280" },
  { nome: "Slate", from: "#1e293b", via: "#334155", to: "#64748b" },
];

const DEFAULT_CORES: CoresPersonalizadas = {
  primary_from: "#1e40af",
  primary_via: "#1d4ed8",
  primary_to: "#0891b2",
  card_faturamento_from: "#1e3a8a",
  card_faturamento_via: "#1d4ed8",
  card_faturamento_to: "#0891b2",
};

export function PersonalizacaoCores() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [cores, setCores] = useState<CoresPersonalizadas>(DEFAULT_CORES);
  const [corSelecionada, setCorSelecionada] = useState<number | null>(null);

  useEffect(() => {
    carregarCores();
  }, []);

  const carregarCores = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("configuracoes_loja")
        .select("cores_personalizadas")
        .eq("user_id", user.id)
        .single();

      if (error && error.code !== "PGRST116") {
        console.error("Erro ao carregar cores:", error);
        return;
      }

      if (data?.cores_personalizadas) {
        const coresDB = data.cores_personalizadas as unknown as CoresPersonalizadas;
        setCores({ ...DEFAULT_CORES, ...coresDB });
        
        // Encontrar índice da cor predefinida selecionada
        const idx = CORES_PREDEFINIDAS.findIndex(
          (c) => c.from === coresDB.primary_from && c.via === coresDB.primary_via && c.to === coresDB.primary_to
        );
        setCorSelecionada(idx >= 0 ? idx : null);
      }
    } catch (error) {
      console.error("Erro ao carregar cores:", error);
    } finally {
      setLoading(false);
    }
  };

  const aplicarCorPredefinida = (index: number) => {
    const cor = CORES_PREDEFINIDAS[index];
    setCorSelecionada(index);
    setCores({
      primary_from: cor.from,
      primary_via: cor.via,
      primary_to: cor.to,
      card_faturamento_from: cor.from,
      card_faturamento_via: cor.via,
      card_faturamento_to: cor.to,
    });
  };

  const salvarCores = async () => {
    setSalvando(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { error } = await supabase
        .from("configuracoes_loja")
        .update({ cores_personalizadas: cores as unknown as null })
        .eq("user_id", user.id);

      if (error) throw error;

      // Aplicar cores via CSS custom properties
      aplicarCoresNoDOM(cores);

      toast({
        title: "Cores salvas!",
        description: "As cores do sistema foram personalizadas com sucesso.",
      });
    } catch (error) {
      console.error("Erro ao salvar cores:", error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar as cores.",
        variant: "destructive",
      });
    } finally {
      setSalvando(false);
    }
  };

  const resetarCores = async () => {
    setSalvando(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { error } = await supabase
        .from("configuracoes_loja")
        .update({ cores_personalizadas: null })
        .eq("user_id", user.id);

      if (error) throw error;

      setCores(DEFAULT_CORES);
      setCorSelecionada(null);
      
      // Remover custom properties
      document.documentElement.style.removeProperty("--custom-primary-from");
      document.documentElement.style.removeProperty("--custom-primary-via");
      document.documentElement.style.removeProperty("--custom-primary-to");

      toast({
        title: "Cores resetadas!",
        description: "As cores voltaram ao padrão do sistema.",
      });
    } catch (error) {
      console.error("Erro ao resetar cores:", error);
      toast({
        title: "Erro ao resetar",
        description: "Não foi possível resetar as cores.",
        variant: "destructive",
      });
    } finally {
      setSalvando(false);
    }
  };

  const aplicarCoresNoDOM = (coresConfig: CoresPersonalizadas) => {
    document.documentElement.style.setProperty("--custom-primary-from", coresConfig.primary_from);
    document.documentElement.style.setProperty("--custom-primary-via", coresConfig.primary_via);
    document.documentElement.style.setProperty("--custom-primary-to", coresConfig.primary_to);
  };

  // Aplicar cores ao carregar
  useEffect(() => {
    if (!loading && cores.primary_from !== DEFAULT_CORES.primary_from) {
      aplicarCoresNoDOM(cores);
    }
  }, [loading, cores]);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-10 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Cores do Sistema
          </CardTitle>
          <CardDescription>
            Personalize as cores dos botões e cards do seu sistema. As cores da barra lateral e menus não serão alteradas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Paleta de cores predefinidas */}
          <div className="space-y-3">
            <Label>Escolha uma paleta de cores</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
              {CORES_PREDEFINIDAS.map((cor, index) => (
                <button
                  key={index}
                  onClick={() => aplicarCorPredefinida(index)}
                  className={cn(
                    "relative h-16 rounded-lg overflow-hidden border-2 transition-all hover:scale-105",
                    corSelecionada === index
                      ? "border-foreground ring-2 ring-foreground ring-offset-2"
                      : "border-transparent hover:border-muted-foreground/50"
                  )}
                  style={{
                    background: `linear-gradient(to right, ${cor.from}, ${cor.via}, ${cor.to})`,
                  }}
                  title={cor.nome}
                >
                  {corSelecionada === index && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                      <Check className="h-6 w-6 text-white drop-shadow-lg" />
                    </div>
                  )}
                  <span className="absolute bottom-1 left-1 right-1 text-[10px] text-white font-medium text-center truncate drop-shadow-lg">
                    {cor.nome}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="space-y-3">
            <Label>Preview</Label>
            <div className="p-4 rounded-lg border bg-muted/30 space-y-4">
              {/* Preview do Card de Faturamento */}
              <div
                className="p-4 rounded-lg text-white shadow-lg"
                style={{
                  background: `linear-gradient(to right, ${cores.card_faturamento_from}, ${cores.card_faturamento_via}, ${cores.card_faturamento_to})`,
                }}
              >
                <p className="text-sm opacity-90">Faturamento Total do Mês</p>
                <p className="text-2xl font-bold">R$ 2.350,00</p>
              </div>

              {/* Preview dos Botões */}
              <div className="flex flex-wrap gap-3">
                <button
                  className="px-4 py-2 rounded-md text-white font-medium shadow-md"
                  style={{
                    background: `linear-gradient(to right, ${cores.primary_from}, ${cores.primary_via}, ${cores.primary_to})`,
                  }}
                >
                  Nova Ordem
                </button>
                <button
                  className="px-4 py-2 rounded-md text-white font-medium shadow-md"
                  style={{
                    background: `linear-gradient(to right, ${cores.primary_from}, ${cores.primary_via}, ${cores.primary_to})`,
                  }}
                >
                  Novo Produto
                </button>
                <button
                  className="px-4 py-2 rounded-md text-white font-medium shadow-md"
                  style={{
                    background: `linear-gradient(to right, ${cores.primary_from}, ${cores.primary_via}, ${cores.primary_to})`,
                  }}
                >
                  Salvar
                </button>
              </div>
            </div>
          </div>

          {/* Ações */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
            <Button onClick={salvarCores} disabled={salvando} className="flex-1">
              {salvando ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Salvar Cores
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={resetarCores}
              disabled={salvando}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Resetar para Padrão
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Informações</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>• As cores personalizadas serão aplicadas nos botões principais e cards de destaque.</p>
          <p>• A barra lateral (menu) e o header mantêm o tema padrão do sistema.</p>
          <p>• As alterações são salvas automaticamente na sua conta e sincronizadas em todos os dispositivos.</p>
        </CardContent>
      </Card>
    </div>
  );
}
