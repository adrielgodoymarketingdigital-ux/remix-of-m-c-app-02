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

// Registra SW — atualiza automaticamente só quando o usuário não está usando o app:
// ao retornar ao app (volta de outra aba/app) ou na próxima abertura do browser/PWA.
let pendingUpdate = false;

const updateSW = registerSW({
  onRegisteredSW(_swUrl, registration) {
    // Verificar update quando o usuário voltar ao app (de outra aba ou do celular)
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        registration?.update();
      }
      // Se saiu do app com update pendente, o próximo acesso já terá o SW novo instalado
      // (sem abas abertas o SW ativa sozinho)
    });
  },
  onNeedRefresh() {
    console.log("[PWA] Nova versão disponível - será aplicada na próxima reabertura do app");
    pendingUpdate = true;
    // Aplicar imediatamente SE o usuário não está com o app visível (ex: aba em background)
    if (document.visibilityState === "hidden") {
      updateSW(true);
      return;
    }
    // Com o app visível: aguardar o usuário sair e voltar para aplicar sem interromper
    const applyOnReturn = () => {
      if (document.visibilityState === "hidden" && pendingUpdate) {
        pendingUpdate = false;
        updateSW(true);
        document.removeEventListener("visibilitychange", applyOnReturn);
      }
    };
    document.addEventListener("visibilitychange", applyOnReturn);
  },
  onOfflineReady() {
    console.log("[PWA] Offline pronto");
  },
});

// Listener para tocar sons customizados de notificação enviados pelo SW
registerNotificationSoundListener();

createRoot(document.getElementById("root")!).render(<App />);
