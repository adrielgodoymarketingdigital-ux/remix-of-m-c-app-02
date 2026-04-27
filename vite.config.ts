import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      includeAssets: ["favicon.ico", "logo-mec.png", "logo-mec.svg"],
      manifest: {
        id: "/",
        name: "Méc - Sistema de Gestão para Assistência Técnica",
        short_name: "Méc",
        description: "Sistema completo de gestão para assistências técnicas. PDV, ordem de serviço, controle de estoque, relatórios financeiros.",
        theme_color: "#1a1a1a",
        background_color: "#1a1a1a",
        display: "standalone",
        display_override: ["standalone", "fullscreen", "minimal-ui"],
        orientation: "any",
        scope: "/",
        start_url: "/",
        categories: ["business", "productivity"],
        icons: [
          {
            src: "/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any"
          },
          {
            src: "/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any"
          },
          {
            src: "/pwa-maskable-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "maskable"
          },
          {
            src: "/pwa-maskable-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable"
          }
        ],
        screenshots: [
          {
            src: "/screenshots/dashboard.png",
            sizes: "1280x720",
            type: "image/png",
            form_factor: "wide",
            label: "Dashboard do Méc"
          }
        ]
      },
      injectManifest: {
        // iOS precisa que o Service Worker ative rápido para Web Push.
        // Não pré-cachear bundles/rotas: isso atrasava a ativação e travava notificações.
        globPatterns: ["manifest.webmanifest", "favicon.ico", "pwa-*.png"],
        maximumFileSizeToCacheInBytes: 1024 * 1024,
      },
      devOptions: {
        enabled: false // Desabilitar em dev para evitar problemas
      }
    })
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
