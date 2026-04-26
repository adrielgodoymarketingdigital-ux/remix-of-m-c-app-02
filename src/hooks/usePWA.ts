import { useState, useEffect, useCallback } from "react";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

export function usePWA() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [hasDeclinedInstall, setHasDeclinedInstall] = useState(false);

  useEffect(() => {
    // Verificar se já está instalado
    const checkIfInstalled = () => {
      // Verificar se está em modo standalone
      const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
      // Verificar se foi instalado via iOS
      const isIOSInstalled = (navigator as any).standalone === true;
      setIsInstalled(isStandalone || isIOSInstalled);
    };

    // Verificar se é iOS
    const checkIfIOS = () => {
      const userAgent = window.navigator.userAgent.toLowerCase();
      const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
      setIsIOS(isIOSDevice);
    };

    // Verificar se o usuário já recusou a instalação
    const checkIfDeclined = () => {
      const declined = localStorage.getItem("pwa-install-declined");
      if (declined) {
        const declinedDate = new Date(declined);
        const now = new Date();
        // Mostrar novamente após 7 dias
        const daysDiff = (now.getTime() - declinedDate.getTime()) / (1000 * 60 * 60 * 24);
        setHasDeclinedInstall(daysDiff < 7);
      }
    };

    checkIfInstalled();
    checkIfIOS();
    checkIfDeclined();

    // Capturar o evento beforeinstallprompt
    const handleBeforeInstallPrompt = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    // Detectar quando o app é instalado
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
      localStorage.removeItem("pwa-install-declined");
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    // Escutar mudanças no display mode
    const mediaQuery = window.matchMedia("(display-mode: standalone)");
    const handleDisplayModeChange = (e: MediaQueryListEvent) => {
      setIsInstalled(e.matches);
    };
    mediaQuery.addEventListener("change", handleDisplayModeChange);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
      mediaQuery.removeEventListener("change", handleDisplayModeChange);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) {
      return { accepted: false, reason: "no-prompt" };
    }

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === "dismissed") {
        localStorage.setItem("pwa-install-declined", new Date().toISOString());
        setHasDeclinedInstall(true);
      }

      setDeferredPrompt(null);
      setIsInstallable(false);

      return { accepted: outcome === "accepted", reason: outcome };
    } catch (error) {
      console.error("Erro ao exibir prompt de instalação:", error);
      return { accepted: false, reason: "error" };
    }
  }, [deferredPrompt]);

  const dismissInstallPrompt = useCallback(() => {
    localStorage.setItem("pwa-install-declined", new Date().toISOString());
    setHasDeclinedInstall(true);
  }, []);

  const canShowInstallPrompt = isInstallable && !isInstalled && !hasDeclinedInstall;
  const showIOSInstructions = isIOS && !isInstalled && !hasDeclinedInstall;

  return {
    isInstallable,
    isInstalled,
    isIOS,
    hasDeclinedInstall,
    canShowInstallPrompt,
    showIOSInstructions,
    promptInstall,
    dismissInstallPrompt
  };
}
