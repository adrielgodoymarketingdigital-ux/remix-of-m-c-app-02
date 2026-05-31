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

// Força atualização do SW e limpa todos os caches ao detectar nova versão
const updateSW = registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    registration?.update();
    setInterval(() => registration?.update(), 60 * 1000); // verifica a cada 1 min
  },
  onNeedRefresh() {
    console.log("[PWA] Nova versão detectada - limpando caches e recarregando");
    caches.keys().then(names => Promise.all(names.map(n => caches.delete(n)))).then(() => {
      updateSW(true);
    });
  },
  onOfflineReady() {
    console.log("[PWA] Offline pronto");
  },
});

// Recebe mensagem do SW quando ele ativa (nova versão instalada) e recarrega a página
navigator.serviceWorker?.addEventListener("message", (event) => {
  if (event.data?.type === "SW_UPDATED") {
    console.log("[PWA] SW sinalizou atualização - recarregando");
    window.location.reload();
  }
});

// Listener para tocar sons customizados de notificação enviados pelo SW
registerNotificationSoundListener();

createRoot(document.getElementById("root")!).render(<App />);
