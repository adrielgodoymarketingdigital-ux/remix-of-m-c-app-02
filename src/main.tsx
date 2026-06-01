import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import OneSignal from "react-onesignal";

OneSignal.init({
  appId: "99d55b78-2fbb-4594-bfff-a5bfa5bf8e8f",
  allowLocalhostAsSecureOrigin: true,
  notifyButton: { enable: false },
  serviceWorkerParam: { scope: "/push/onesignal/" },
});

// Tracking é inicializado no index.html para capturar parâmetros mais cedo
// Apenas importamos para expor a função global
import "./lib/tracking";

// Importar Build ID para garantir cache bust do bundle principal
import { APP_BUILD_ID } from "./lib/build";

import { registerSW } from "virtual:pwa-register";
import { registerNotificationSoundListener } from "./lib/notification-sounds";

console.log(`[Méc] Build ID: ${APP_BUILD_ID}`);

// Registra SW — ao detectar nova versão limpa caches e recarrega automaticamente
const updateSW = registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        registration?.update();
      }
    });
  },
  onNeedRefresh() {
    console.log("[PWA] Nova versão detectada - limpando caches e recarregando");
    caches.keys()
      .then(names => Promise.all(names.map(n => caches.delete(n))))
      .then(() => updateSW(true));
  },
  onOfflineReady() {
    console.log("[PWA] Offline pronto");
  },
});

// Listener para tocar sons customizados de notificação enviados pelo SW
registerNotificationSoundListener();

createRoot(document.getElementById("root")!).render(<App />);
