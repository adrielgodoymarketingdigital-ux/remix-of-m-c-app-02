import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useOnboardingConfig } from "@/hooks/useOnboardingConfig";
import { useOnboardingFlow } from "@/hooks/useOnboardingFlow";
import { OnboardingFlowEditor } from "@/components/admin/flow/OnboardingFlowEditor";
import { ConfiguracoesGlobais } from "@/components/admin/onboarding/ConfiguracoesGlobais";
import { TestarOnboarding } from "@/components/admin/onboarding/TestarOnboarding";
import type { OnboardingFlowConfig } from "@/components/admin/flow/types";
import { 
  Settings2, 
  GitBranch,
  Play,
  Save,
  Settings
} from "lucide-react";

export default function AdminOnboarding() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  
  const { 
    config, 
    loading, 
    saving,
    toggleAtivo, 
    updatePublicoAlvo, 
    toggleMostrarParaAtivos,
    updateTextos
  } = useOnboardingConfig();

  const {
    flowConfig,
    loading: loadingFlow,
    saving: savingFlow,
    saveFlow
  } = useOnboardingFlow();

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }
      
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      
      if (!data) {
        navigate("/dashboard");
        toast({
          title: "Acesso negado",
          description: "Você não tem permissão para acessar esta página.",
          variant: "destructive",
        });
        return;
      }
      
      setIsAdmin(true);
      setCheckingAdmin(false);
    };
    
    checkAdmin();
  }, [navigate, toast]);

  if (checkingAdmin || !isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <AppLayout>
      <main className="flex-1 p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Settings2 className="h-6 w-6" />
              Painel de Onboarding
            </h1>
            <p className="text-muted-foreground">
              Gerencie a experiência de onboarding dos usuários
            </p>
          </div>
          {(saving || savingFlow) && (
            <Badge variant="secondary" className="animate-pulse">
              <Save className="h-3 w-3 mr-1" />
              Salvando...
            </Badge>
          )}
        </div>

        {/* Tabs Principais - Nova Estrutura */}
        <Tabs defaultValue="configuracoes" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="configuracoes" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Configurações</span>
              <span className="sm:hidden">Config</span>
            </TabsTrigger>
            <TabsTrigger value="editor" className="flex items-center gap-2">
              <GitBranch className="h-4 w-4" />
              <span className="hidden sm:inline">Editor de Funil</span>
              <span className="sm:hidden">Editor</span>
            </TabsTrigger>
            <TabsTrigger value="testar" className="flex items-center gap-2">
              <Play className="h-4 w-4" />
              <span className="hidden sm:inline">Testar Onboarding</span>
              <span className="sm:hidden">Testar</span>
            </TabsTrigger>
          </TabsList>

          {/* Aba Configurações */}
          <TabsContent value="configuracoes">
            <ConfiguracoesGlobais
              config={config}
              loading={loading}
              saving={saving}
              onToggleAtivo={toggleAtivo}
              onToggleMostrarParaAtivos={toggleMostrarParaAtivos}
              onUpdatePublicoAlvo={updatePublicoAlvo}
              onUpdateTextos={updateTextos}
            />
          </TabsContent>

          {/* Aba Editor de Funil */}
          <TabsContent value="editor">
            <OnboardingFlowEditor
              initialConfig={flowConfig || undefined}
              onSave={async (config: OnboardingFlowConfig) => {
                await saveFlow(config);
              }}
              saving={savingFlow}
            />
          </TabsContent>

          {/* Aba Testar Onboarding */}
          <TabsContent value="testar">
            <TestarOnboarding />
          </TabsContent>
        </Tabs>
      </main>
    </AppLayout>
  );
}
