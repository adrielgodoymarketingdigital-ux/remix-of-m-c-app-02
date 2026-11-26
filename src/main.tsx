import { createRoot } from "react-dom/client";
// i18next com o pt-BR embutido, iniciado antes da primeira renderização.
import "./lib/i18n/instancia";
import App from "./App.tsx";
import "./fontes.css";
import "./index.css";
// OneSignal (push) é iniciado só para usuário logado fora das landings: ver
// iniciarOneSignal() em src/hooks/useNotificacoes.ts.

// Tracking é inicializado no index.html para capturar parâmetros mais cedo
// Apenas importamos para expor a função global
import "./lib/tracking";

// Versão do build (gerada no vite.config.ts), no console para o suporte
import { APP_BUILD_ID } from "./lib/build";

import { registrarServiceWorker } from "./lib/pwa/atualizacaoApp";
import { registerNotificationSoundListener } from "./lib/notification-sounds";
import { aplicarCorMenuLembrada } from "./lib/menu/aplicarCorMenu";

console.log(`[Méc] Build ID: ${APP_BUILD_ID}`);

// Registra o SW sem nunca recarregar sozinho: a versão nova espera o usuário tocar
// em "Atualizar agora" (PWAUpdateBanner) ou a próxima abertura do app.
registrarServiceWorker();

// Listener para tocar sons customizados de notificação enviados pelo SW
registerNotificationSoundListener();

// Cor do menu escolhida pela loja (lembrada da última vez): antes do primeiro
// render, para não piscar o padrão. Sem cor lembrada não toca em nada.
aplicarCorMenuLembrada();

createRoot(document.getElementById("root")!).render(<App />);
