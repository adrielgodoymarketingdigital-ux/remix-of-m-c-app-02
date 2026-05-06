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
        // Pré-cachear o shell da app (JS/CSS do build + ícones).
        // Arquivos de mídia pesados (mp4, mov, jpg grandes) ficam de fora para não
        // travar a instalação do SW. O Vercel serve esses com Cache-Control imutável.
        globPatterns: [
          "index.html",
          "manifest.webmanifest",
          "favicon.ico",
          "pwa-*.png",
          "assets/*.js",
          "assets/*.css",
        ],
        globIgnores: [
          // Excluir vídeos, imagens pesadas e chunks raramente usados
          "assets/*.mp4",
          "assets/*.mov",
          "assets/depoimento*",
          "assets/adriel*",
          "assets/demo*",
          // Chunks grandes que só carregam em rotas específicas
          "assets/AdminOnboarding*",
          "assets/jspdf*",
          "assets/html2canvas*",
          "assets/templatePlanilha*",
          "assets/LeitorCodigoBarras*",
        ],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024, // 3MB por arquivo
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
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Frameworks core — raramente mudam, ficam em cache por muito tempo
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-query": ["@tanstack/react-query"],
          "vendor-supabase": ["@supabase/supabase-js"],
          // Recharts fica num chunk próprio — lazy-loaded pelo GraficosDashboard
          "vendor-recharts": ["recharts"],
          // UI libs grandes
          "vendor-radix": [
            "@radix-ui/react-dialog",
            "@radix-ui/react-select",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-tabs",
            "@radix-ui/react-popover",
            "@radix-ui/react-tooltip",
          ],
        },
      },
    },
  },
}));
