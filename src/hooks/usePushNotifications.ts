import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

// Helper para converter base64 URL para Uint8Array (necessário para VAPID key)
function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray.buffer as ArrayBuffer;
}

export function usePushNotifications() {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activationError, setActivationError] = useState<string | null>(null);
  const [activationStep, setActivationStep] = useState<string | null>(null);
  const activationRunRef = useRef(false);
  const serviceWorkerRegistrationRef = useRef<ServiceWorkerRegistration | null>(null);
  const vapidPublicKeyRef = useRef<string | null>(null);
  const preparationPromiseRef = useRef<Promise<void> | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    // Verificar suporte a Push Notifications
    const checkSupport = () => {
      const supported = 
        "serviceWorker" in navigator && 
        "PushManager" in window && 
        "Notification" in window;
      setIsSupported(supported);
      
      if (supported) {
        setPermission(Notification.permission);
      }
    };

    checkSupport();
  }, []);

  const preparePushResources = useCallback(async () => {
    if (!isSupported) return;
    if (serviceWorkerRegistrationRef.current && vapidPublicKeyRef.current) return;

    if (!preparationPromiseRef.current) {
      preparationPromiseRef.current = (async () => {
        const [registration, vapidResult] = await Promise.all([
          getPushServiceWorkerRegistration(8000),
          withTimeout(
            supabase.functions.invoke("get-vapid-key"),
            8000,
            "Tempo esgotado ao preparar chave de notificações"
          ),
        ]);

        const { data: vapidData, error: vapidError } = vapidResult;
        if (vapidError || !vapidData?.vapidPublicKey) {
          console.error("Erro ao preparar VAPID key:", vapidError);
          throw new Error("Não foi possível preparar a chave de notificações");
        }

        serviceWorkerRegistrationRef.current = registration;
        vapidPublicKeyRef.current = vapidData.vapidPublicKey;
      })().finally(() => {
        preparationPromiseRef.current = null;
      });
    }

    await preparationPromiseRef.current;
  }, [isSupported]);

  useEffect(() => {
    if (!isSupported) return;
    preparePushResources().catch((error) => {
      console.warn("[Push] Preparação em segundo plano falhou:", error);
    });
  }, [isSupported, preparePushResources]);

  // Verificar se já está inscrito
  const checkSubscription = useCallback(async () => {
    if (!isSupported) return false;

    try {
      await preparePushResources();
      const registration = serviceWorkerRegistrationRef.current;
      if (!registration) return false;
      const subscription = await withTimeout(
        registration.pushManager.getSubscription(),
        5000,
        "Tempo esgotado ao verificar inscrição"
      );
      const subscribed = subscription !== null;
      setIsSubscribed(subscribed);
      return subscribed;
    } catch (error) {
      console.error("Erro ao verificar subscription:", error);
      return false;
    }
  }, [isSupported, preparePushResources]);

  useEffect(() => {
    checkSubscription();
  }, [checkSubscription]);

  // Solicitar permissão e inscrever
  const requestPermissionAndSubscribe = useCallback(async () => {
    if (activationRunRef.current) return false;

    if (!isSupported) {
      toast({
        title: "Não suportado",
        description: "Seu navegador não suporta notificações push.",
        variant: "destructive"
      });
      return false;
    }

    activationRunRef.current = true;
    let loadingWatchdog: number | undefined;

    try {
      console.log("[Push] Iniciando ativação...");
      console.log("[Push] Build de notificações: 2026-04-25-005");

      // No iOS, a permissão precisa ser solicitada diretamente a partir do toque do usuário.
      // Por isso ela roda antes de qualquer estado de carregamento ou chamada assíncrona do backend.
      const permissionResult = Notification.permission === "granted"
        ? "granted"
        : await requestNotificationPermissionCompat(15000);

      setActivationError(null);
      console.log("[Push] Permissão:", permissionResult);
      setPermission(permissionResult);

      if (permissionResult !== "granted") {
        const message = permissionResult === "default"
          ? "A permissão não foi confirmada. Toque novamente e escolha Permitir no aviso do iPhone."
          : "Você precisa permitir notificações para receber alertas importantes.";
        setActivationError(message);
        toast({
          title: "Permissão negada",
          description: message,
          variant: "destructive"
        });
        return false;
      }

      setIsLoading(true);
      loadingWatchdog = window.setTimeout(() => {
        const message = "A ativação demorou demais. Feche e abra o app pela tela inicial e tente novamente.";
        activationRunRef.current = false;
        setActivationError(message);
        setActivationStep(null);
        setIsLoading(false);
        toast({ title: "Tempo esgotado", description: message, variant: "destructive" });
      }, 12000);

      setActivationStep("Registrando este dispositivo...");
      await preparePushResources();
      const registration = serviceWorkerRegistrationRef.current;
      const vapidPublicKey = vapidPublicKeyRef.current;
      if (!registration || !vapidPublicKey) {
        throw new Error("Notificações ainda não estão prontas. Feche e abra o app pela tela inicial.");
      }
      console.log("[Push] Service worker pronto:", registration.scope);

      // No iOS, criar a subscription deve acontecer logo após a permissão, antes de chamadas extras.
      let subscription = await withTimeout(
        registration.pushManager.getSubscription(),
        6000,
        "Tempo esgotado ao verificar inscrição atual"
      );
      if (!subscription) {
        console.log("[Push] Criando nova subscription...");
        subscription = await withTimeout(
          registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
          }),
          12000,
          "O iPhone não concluiu o registro push. Feche o app, abra pela tela inicial e tente novamente."
        );
      } else {
        console.log("[Push] Reaproveitando subscription existente");
      }

      setActivationStep("Salvando ativação...");

      // Obter usuário atual
      const { data: { user } } = await withTimeout(
        supabase.auth.getUser(),
        12000,
        "Tempo esgotado ao verificar usuário logado"
      );
      if (!user) {
        toast({
          title: "Erro",
          description: "Você precisa estar logado para ativar notificações.",
          variant: "destructive"
        });
        return false;
      }

      // Converter subscription para formato salvável
      const subscriptionData: PushSubscriptionData = {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: arrayBufferToBase64(subscription.getKey("p256dh")),
          auth: arrayBufferToBase64(subscription.getKey("auth"))
        }
      };

      // Salvar no banco usando raw SQL via RPC ou fetch direto
      // Como a tabela acabou de ser criada, vamos usar fetch direto para evitar problemas de tipos
      const { data: { session } } = await withTimeout(
        supabase.auth.getSession(),
        12000,
        "Tempo esgotado ao verificar sessão"
      );
      if (!session) {
        throw new Error("Sessão não encontrada");
      }

      const response = await withTimeout(fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/push_subscriptions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            "Authorization": `Bearer ${session.access_token}`,
            "Prefer": "resolution=merge-duplicates"
          },
          body: JSON.stringify({
            user_id: user.id,
            endpoint: subscriptionData.endpoint,
            p256dh_key: subscriptionData.keys.p256dh,
            auth_key: subscriptionData.keys.auth,
            user_agent: navigator.userAgent,
            is_active: true,
            device: detectDevice(),
            is_pwa_installed: detectPWAInstalled(),
            updated_at: new Date().toISOString()
          })
        }
      ), 15000, "Tempo esgotado ao salvar inscrição");

      if (!response.ok) {
        const errBody = await response.text().catch(() => "");
        console.error("[Push] Falha ao salvar subscription", response.status, errBody);
        throw new Error("Falha ao salvar subscription");
      }

      setIsSubscribed(true);
      setActivationStep(null);
      toast({
        title: "Notificações ativadas!",
        description: "Você receberá alertas importantes do sistema."
      });

      return true;
    } catch (error: any) {
      console.error("Erro ao ativar notificações:", error);
      const message = error?.message || "Não foi possível ativar as notificações. Tente novamente.";
      setActivationError(message);
      setActivationStep(null);
      toast({
        title: "Erro",
        description: message,
        variant: "destructive"
      });
      return false;
    } finally {
      if (loadingWatchdog) window.clearTimeout(loadingWatchdog);
      activationRunRef.current = false;
      setActivationStep(null);
      setIsLoading(false);
    }
  }, [isSupported, preparePushResources, toast]);

  // Cancelar inscrição
  const unsubscribe = useCallback(async () => {
    if (!isSupported) return false;

    setIsLoading(true);

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();

        // Atualizar no banco
        const { data: { user } } = await supabase.auth.getUser();
        const { data: { session } } = await supabase.auth.getSession();
        
        if (user && session) {
          await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/push_subscriptions?user_id=eq.${user.id}&endpoint=eq.${encodeURIComponent(subscription.endpoint)}`,
            {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
                "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
                "Authorization": `Bearer ${session.access_token}`
              },
              body: JSON.stringify({ is_active: false })
            }
          );
        }
      }

      setIsSubscribed(false);
      toast({
        title: "Notificações desativadas",
        description: "Você não receberá mais alertas push."
      });

      return true;
    } catch (error) {
      console.error("Erro ao desativar notificações:", error);
      toast({
        title: "Erro",
        description: "Não foi possível desativar as notificações.",
        variant: "destructive"
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, toast]);

  return {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    activationError,
    activationStep,
    requestPermissionAndSubscribe,
    unsubscribe,
    checkSubscription
  };
}

// Detectar dispositivo
function detectDevice(): "ios" | "android" | "desktop" {
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  if (/android/.test(ua)) return "android";
  return "desktop";
}

// Detectar se PWA está instalado
function detectPWAInstalled(): boolean {
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  if ((navigator as any).standalone === true) return true;
  return false;
}

// Helpers
function arrayBufferToBase64(buffer: ArrayBuffer | null): string {
  if (!buffer) return "";
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Obtém um registro ativo sem depender de navigator.serviceWorker.ready,
// que pode travar em PWAs iOS mesmo com o service worker já instalado.
async function getPushServiceWorkerRegistration(timeoutMs: number): Promise<ServiceWorkerRegistration> {
  if (!("serviceWorker" in navigator)) {
    throw new Error("Service Worker não suportado");
  }

  const timeoutError = new Error("Tempo esgotado preparando notificações");
  const getRegistration = async () => {
    const existingRegistration = await navigator.serviceWorker.getRegistration("/");
    if (existingRegistration?.active) return existingRegistration;

    const registered = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    if (registered.active) return registered;

    const activeRegistration = await waitForActiveWorker(registered, timeoutMs);
    return activeRegistration;
  };

  return await withTimeout(getRegistration(), timeoutMs, timeoutError.message);
}

function waitForActiveWorker(
  registration: ServiceWorkerRegistration,
  timeoutMs: number
): Promise<ServiceWorkerRegistration> {
  return new Promise((resolve, reject) => {
    let done = false;
    const finish = () => {
      if (done) return;
      if (!registration.active) return;
      done = true;
      clearTimeout(timer);
      resolve(registration);
    };

    const timer = window.setTimeout(() => {
      if (done) return;
      done = true;
      reject(new Error("Tempo esgotado ativando notificações"));
    }, timeoutMs);

    finish();

    const worker = registration.installing || registration.waiting;
    if (worker) {
      worker.addEventListener("statechange", finish);
    }
  });
}

// Wrapper genérico de timeout para qualquer Promise
function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(message)), ms)
    ),
  ]);
}

// requestPermission compatível: alguns Safari antigos só suportam callback
function requestNotificationPermissionCompat(timeoutMs = 30000): Promise<NotificationPermission> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (p: NotificationPermission) => {
      if (settled) return;
      settled = true;
      resolve(p);
    };
    // Timeout de segurança caso nem promise nem callback resolvam (raro, mas evita travar a UI)
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error("Tempo esgotado aguardando resposta de permissão de notificação"));
    }, timeoutMs);
    try {
      const supportsPromiseRequest = Notification.requestPermission.length === 0;
      const maybePromise = supportsPromiseRequest
        ? Notification.requestPermission()
        : Notification.requestPermission((perm) => {
            clearTimeout(timer);
            finish(perm);
          });
      if (maybePromise && typeof (maybePromise as Promise<NotificationPermission>).then === "function") {
        (maybePromise as Promise<NotificationPermission>)
          .then((perm) => {
            clearTimeout(timer);
            finish(perm);
          })
          .catch((err) => {
            clearTimeout(timer);
            if (!settled) {
              settled = true;
              reject(err);
            }
          });
      }
    } catch (err) {
      clearTimeout(timer);
      if (!settled) {
        settled = true;
        reject(err);
      }
    }
  });
}
