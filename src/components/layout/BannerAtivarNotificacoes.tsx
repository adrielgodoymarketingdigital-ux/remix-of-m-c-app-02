import { useState, useEffect } from "react";
import { Bell, X } from "lucide-react";
import OneSignal from "react-onesignal";
import { supabase } from "@/integrations/supabase/client";

export function BannerAtivarNotificacoes() {
  const [permissaoAtiva, setPermissaoAtiva] = useState(false);
  const [dispensado, setDispensado] = useState(false);

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isPWA = window.matchMedia("(display-mode: standalone)").matches;

  useEffect(() => {
    setPermissaoAtiva(OneSignal.Notifications.permission);
    setDispensado(localStorage.getItem("notif_banner_dismissed") === "1");

    OneSignal.Notifications.addEventListener("permissionChange", (granted: boolean) => {
      setPermissaoAtiva(granted);
    });
  }, []);

  if (!isPWA || !isIOS || permissaoAtiva || dispensado) return null;

  const handleAtivar = async () => {
    await OneSignal.Notifications.requestPermission();
    if (OneSignal.Notifications.permission) {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        await OneSignal.login(data.user.id);
      }
      setPermissaoAtiva(true);
    }
  };

  const handleDispensar = () => {
    localStorage.setItem("notif_banner_dismissed", "1");
    setDispensado(true);
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-[60] bg-gradient-to-r from-violet-600 to-violet-700 text-white px-4 py-3 flex items-center justify-between gap-3 shadow-lg">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <Bell className="h-4 w-4 flex-shrink-0" />
        <p className="text-xs font-medium truncate">
          Ative as notificações para receber alertas importantes
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={handleAtivar}
          className="bg-white text-violet-700 text-xs font-semibold px-3 py-1.5 rounded-full hover:bg-violet-50 transition-colors active:scale-95"
        >
          Ativar
        </button>
        <button
          onClick={handleDispensar}
          className="text-white/70 hover:text-white transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
