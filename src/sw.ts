/// <reference lib="webworker" />

import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { CacheFirst, NetworkFirst, NetworkOnly } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";
import { CacheableResponsePlugin } from "workbox-cacheable-response";

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{
    url: string;
    revision: string | null;
  }>;
};

// O SW responde a skipWaiting() enviado pelo cliente (main.tsx via updateSW(true)).
// Isso só é chamado quando o app está em background (visibilityState === 'hidden'),
// nunca enquanto o usuário está preenchendo formulários.
self.addEventListener('install', (event) => {
  console.log('[SW] Nova versão instalada - aguardando sinal do cliente para ativar');
  // Não chama skipWaiting() automaticamente — espera o cliente decidir o momento certo
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    console.log('[SW] Recebido SKIP_WAITING - ativando nova versão');
    self.skipWaiting();
  }
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Service Worker ativado');
  event.waitUntil(self.clients.claim());
});

// Precache (gerenciado pelo vite-plugin-pwa)
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// index.html sempre da rede — garante que o browser receba o HTML mais recente após deploy
registerRoute(
  ({ request, url }) =>
    request.mode === 'navigate' || (request.destination === 'document' && url.origin === self.location.origin),
  new NetworkOnly()
);

// Assets JS/CSS: NetworkFirst garante que após deploy o browser sempre receba o bundle mais recente.
// Cache serve de fallback se offline. Hash no nome garante que nova versão = nova URL = sem conflito.
registerRoute(
  ({ request, url }) =>
    url.origin === self.location.origin &&
    (request.destination === "script" || request.destination === "style"),
  new NetworkFirst({
    cacheName: "app-assets-cache",
    networkTimeoutSeconds: 5,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 }),
    ],
  })
);

registerRoute(
  ({ url }) => url.origin === "https://fonts.googleapis.com",
  new CacheFirst({
    cacheName: "google-fonts-cache",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 10,
        maxAgeSeconds: 60 * 60 * 24 * 365,
      }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  })
);

registerRoute(
  ({ url }) => url.origin === "https://fonts.gstatic.com",
  new CacheFirst({
    cacheName: "gstatic-fonts-cache",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 10,
        maxAgeSeconds: 60 * 60 * 24 * 365,
      }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  })
);

// Não cachear requisições autenticadas
registerRoute(
  ({ request }) => request.headers.has("Authorization"),
  new NetworkOnly()
);

// Não cachear requisições do backend (dados dinâmicos)
registerRoute(
  ({ url }) => url.hostname.endsWith("supabase.co"),
  new NetworkOnly()
);

// Push Notifications
self.addEventListener("push", (event) => {
  let data: any = null;

  try {
    data = event.data ? event.data.json() : null;
  } catch {
    try {
      data = event.data ? { body: event.data.text() } : null;
    } catch {
      data = null;
    }
  }

  const title = data?.title ?? "Méc";
  const body = data?.body ?? "Você recebeu uma nova notificação.";
  const icon = data?.icon ?? "/pwa-192x192.png";
  const badge = data?.badge ?? "/pwa-192x192.png";
  const url = data?.data?.url ?? data?.url ?? "/dashboard";

  const notificationId = data?.notification_id ?? data?.data?.notification_id ?? null;
  const sound = data?.sound ?? data?.data?.sound ?? "default";
  const isSilent = sound === "silent";
  const isCustomSound = sound !== "default" && sound !== "silent";

  event.waitUntil(
    (async () => {
      // Quando há som customizado, tenta tocar via cliente aberto (SW não consegue tocar áudio direto).
      // Se nenhum cliente estiver aberto, cai no som padrão do sistema.
      let playedCustom = false;
      if (isCustomSound) {
        const allClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
        for (const client of allClients) {
          try {
            client.postMessage({ type: "PLAY_NOTIFICATION_SOUND", sound });
            playedCustom = true;
          } catch {}
        }
      }

      // Se tocou som customizado, mostra notificação SILENCIOSA (evita som duplicado do sistema)
      const shouldSilence = isSilent || playedCustom;

      await self.registration.showNotification(title, {
        body,
        icon,
        badge,
        data: { url, notification_id: notificationId, sound },
        silent: shouldSilence,
        // @ts-ignore - vibrate is supported on Android but not in TS types
        vibrate: isSilent ? [] : [200, 100, 200],
      } as NotificationOptions);
    })()
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const notifData = event.notification.data as any;
  let url = notifData?.url || "/dashboard";
  const notificationId = notifData?.notification_id;
  if (notificationId) {
    const separator = url.includes("?") ? "&" : "?";
    url = `${url}${separator}notification_id=${notificationId}`;
  }

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      // Reaproveita aba aberta se possível
      for (const client of allClients) {
        if ("focus" in client) {
          await client.focus();
          client.navigate(url);
          return;
        }
      }

      await self.clients.openWindow(url);
    })()
  );
});
