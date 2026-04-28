import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useNotificacoes } from "@/hooks/useNotificacoes";
import { usePWA } from "@/hooks/usePWA";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Bell, X, Smartphone, Share, Plus } from "lucide-react";

const STORAGE_KEY = "mec_notif_banner_dismissed";

export function BannerAtivarNotificacoes() {
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(STORAGE_KEY) === "true");
  const [hasSubscription, setHasSubscription] = useState<boolean | null>(null);
  const { isSupported, permission, isSubscribed, isLoading } = usePushNotifications();
  const { solicitarPermissao, notificacaoAtiva } = useNotificacoes();
  const { isIOS, isInstalled } = usePWA();

  useEffect(() => {
    const checkSubscription = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("push_subscriptions")
        .select("id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .limit(1);

      setHasSubscription(data && data.length > 0);
    };
    checkSubscription();
  }, [isSubscribed]);

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem(STORAGE_KEY, "true");
  };

  // Don't show if already subscribed, dismissed, or still loading
  if (hasSubscription === null || hasSubscription || isSubscribed || notificacaoAtiva || dismissed) return null;

  // iOS not installed as PWA - show install instructions
  if (isIOS && !isInstalled) {
    return (
      <Alert className="mb-4 border-primary/30 bg-primary/5">
        <Smartphone className="h-4 w-4" />
        <AlertTitle className="flex items-center justify-between">
          <span>Ative as notificações no iPhone</span>
          <Button variant="ghost" size="icon" className="h-6 w-6 -mr-2" onClick={handleDismiss}>
            <X className="h-3 w-3" />
          </Button>
        </AlertTitle>
        <AlertDescription className="text-xs space-y-1 mt-1">
          <p>Para receber alertas, instale o app na tela inicial:</p>
          <ol className="list-decimal pl-4 space-y-0.5">
            <li className="flex items-center gap-1">
              Toque em <Share className="inline h-3 w-3" /> <strong>Compartilhar</strong>
            </li>
            <li className="flex items-center gap-1">
              Toque em <Plus className="inline h-3 w-3" /> <strong>Adicionar à Tela Inicial</strong>
            </li>
            <li>Abra o app e ative as notificações</li>
          </ol>
        </AlertDescription>
      </Alert>
    );
  }

  // Browser doesn't support push
  if (!isSupported) return null;

  // Permission denied
  if (permission === "denied") return null;

  return (
    <Alert className="mb-4 border-primary/30 bg-primary/5">
      <Bell className="h-4 w-4" />
      <AlertTitle className="flex items-center justify-between">
        <span>Ative as notificações</span>
        <Button variant="ghost" size="icon" className="h-6 w-6 -mr-2" onClick={handleDismiss}>
          <X className="h-3 w-3" />
        </Button>
      </AlertTitle>
      <AlertDescription className="space-y-2 mt-1">
        <p className="text-xs">
          Receba alertas de vendas, ordens de serviço e pagamentos em tempo real.
        </p>
        <Button
          size="sm"
          variant="default"
          disabled={isLoading}
          onClick={() => solicitarPermissao()}
        >
          <Bell className="h-3 w-3 mr-1" />
          {isLoading ? "Ativando..." : "Ativar Notificações"}
        </Button>
      </AlertDescription>
    </Alert>
  );
}
