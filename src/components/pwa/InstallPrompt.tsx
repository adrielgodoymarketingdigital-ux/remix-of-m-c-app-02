import { useState, useEffect } from "react";
import { usePWA } from "@/hooks/usePWA";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, X, Share, Plus, Smartphone } from "lucide-react";

export function InstallPrompt() {
  const { 
    canShowInstallPrompt, 
    showIOSInstructions, 
    isInstalled,
    promptInstall, 
    dismissInstallPrompt 
  } = usePWA();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);

  // Verificar se o usuário está logado
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setIsLoggedIn(!!user);
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setIsLoggedIn(!!session?.user);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Mostrar prompt apenas após login e com um pequeno delay
  useEffect(() => {
    if (isLoggedIn && (canShowInstallPrompt || showIOSInstructions) && !isInstalled) {
      const timer = setTimeout(() => {
        setShowPrompt(true);
      }, 3000); // 3 segundos após login

      return () => clearTimeout(timer);
    } else {
      setShowPrompt(false);
    }
  }, [isLoggedIn, canShowInstallPrompt, showIOSInstructions, isInstalled]);

  const handleInstall = async () => {
    const result = await promptInstall();
    if (result.accepted) {
      setShowPrompt(false);
    }
  };

  const handleDismiss = () => {
    dismissInstallPrompt();
    setShowPrompt(false);
  };

  if (!showPrompt) return null;

  // Instruções específicas para iOS
  if (showIOSInstructions) {
    return (
      <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:w-96 animate-in slide-in-from-bottom-4 duration-300">
        <Card className="border-primary/20 shadow-lg bg-card/95 backdrop-blur">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-full bg-primary/10">
                  <Smartphone className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base">Instalar o Méc</CardTitle>
                  <CardDescription className="text-xs">
                    Acesso rápido na sua tela inicial
                  </CardDescription>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 -mr-2 -mt-1"
                onClick={handleDismiss}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0 pb-4">
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Para instalar no seu iPhone/iPad:
              </p>
              <ol className="text-sm space-y-2">
                <li className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-xs font-medium">1</span>
                  <span>Toque no botão <Share className="inline h-4 w-4 mx-1" /> Compartilhar</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-xs font-medium">2</span>
                  <span>Role e toque em <Plus className="inline h-4 w-4 mx-1" /> Adicionar à Tela Inicial</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-xs font-medium">3</span>
                  <span>Confirme tocando em "Adicionar"</span>
                </li>
              </ol>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-4"
              onClick={handleDismiss}
            >
              Entendi, talvez depois
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Prompt padrão para Android/Desktop
  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:w-96 animate-in slide-in-from-bottom-4 duration-300">
      <Card className="border-primary/20 shadow-lg bg-card/95 backdrop-blur">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-full bg-primary/10">
                <Download className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">Instalar o Méc</CardTitle>
                <CardDescription className="text-xs">
                  Acesso rápido como um app nativo
                </CardDescription>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 -mr-2 -mt-1"
              onClick={handleDismiss}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0 pb-4">
          <p className="text-sm text-muted-foreground mb-4">
            Instale o Méc na sua tela inicial para acesso mais rápido, mesmo offline.
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={handleDismiss}
            >
              Agora não
            </Button>
            <Button
              size="sm"
              className="flex-1"
              onClick={handleInstall}
            >
              <Download className="h-4 w-4 mr-1" />
              Instalar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
