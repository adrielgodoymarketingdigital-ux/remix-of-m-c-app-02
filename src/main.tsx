import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Tracking é inicializado no index.html para capturar parâmetros mais cedo
// Apenas importamos para expor a função global
import "./lib/tracking";

// Importar Build ID para garantir cache bust do bundle principal
import { APP_BUILD_ID } from "./lib/build";

// Registrar Service Worker do PWA com update agressivo para evitar código antigo no app instalado
// (resolve casos onde a PWA fica presa em uma versão anterior e aplica guards antigos)
import { registerSW } from "virtual:pwa-register";
import { registerNotificationSoundListener } from "./lib/notification-sounds";

// Log do Build ID no console para debug
console.log(`[Méc] Build ID: ${APP_BUILD_ID}`);

const updateSW = registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    registration?.update();
    setInterval(() => registration?.update(), 60 * 60 * 1000);
  },
  onNeedRefresh() {
    // Atualiza o SW e recarrega para pegar o bundle novo
    console.log("[PWA] Nova versão disponível - atualizando e recarregando");
    updateSW(true);
  },
  onOfflineReady() {
    console.log("[PWA] Offline pronto");
  },
});

// Listener para tocar sons customizados de notificação enviados pelo SW
registerNotificationSoundListener();

createRoot(document.getElementById("root")!).render(<App />);
