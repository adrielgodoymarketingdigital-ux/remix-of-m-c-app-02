import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// Leitor de números (OCR, modo "Números" do LeitorCodigoBarras): arquivos do
// tesseract.js servidos pelo próprio app em /ocr/<versão>/ — copiados de
// node_modules no build e servidos direto no dev. Ficam FORA do precache do PWA
// (os globPatterns abaixo não incluem ocr/**); o sw.ts guarda em cache só depois
// do primeiro uso. O navegador baixa só um dos três cores (o que ele suportar).
const TESSERACT_VERSAO: string = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, "node_modules/tesseract.js/package.json"), "utf8"),
).version;
const ARQUIVOS_OCR: Record<string, string> = {
  "worker.min.js": "node_modules/tesseract.js/dist/worker.min.js",
  "core/tesseract-core-lstm.wasm.js": "node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js",
  "core/tesseract-core-simd-lstm.wasm.js": "node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js",
  "core/tesseract-core-relaxedsimd-lstm.wasm.js": "node_modules/tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js",
  "lang/eng.traineddata.gz": "node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz",
};

function arquivosOcr(): Plugin {
  const prefixo = `/ocr/${TESSERACT_VERSAO}/`;
  return {
    name: "arquivos-ocr",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url ?? "").split("?")[0];
        const origem = url.startsWith(prefixo) ? ARQUIVOS_OCR[url.slice(prefixo.length)] : undefined;
        if (!origem) return next();
        res.setHeader("Content-Type", url.endsWith(".js") ? "text/javascript" : "application/octet-stream");
        fs.createReadStream(path.resolve(__dirname, origem)).pipe(res);
      });
    },
    generateBundle() {
      for (const [destino, origem] of Object.entries(ARQUIVOS_OCR)) {
        this.emitFile({ type: "asset", fileName: `ocr/${TESSERACT_VERSAO}/${destino}`, source: fs.readFileSync(path.resolve(__dirname, origem)) });
      }
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  define: {
    __TESSERACT_VERSAO__: JSON.stringify(TESSERACT_VERSAO),
  },
  assetsInclude: ["**/*.JPG"],
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    arquivosOcr(),
    VitePWA({
      registerType: "prompt",
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      includeAssets: ["favicon.ico", "logo-mec.png", "logo-mec.svg"],
      manifest: {
        id: "/",
        name: "Méc - Sistema de Gestão para Assistência Técnica",
        short_name: "Méc",
        description: "Sistema completo de gestão para assistências técnicas. PDV, ordem de serviço, controle de estoque, relatórios financeiros.",
        theme_color: "#101318",
        background_color: "#101318",
        display: "standalone",
        display_override: ["standalone", "fullscreen", "minimal-ui"],
        orientation: "any",
        scope: "/",
        start_url: "/auth",
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
          // OCR (tesseract.js): só baixa ao abrir o modo Números do leitor
          "assets/vendor-ocr*",
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
          // OCR do leitor (import dinâmico em src/lib/ocr/motorOcr.ts)
          "vendor-ocr": ["tesseract.js"],
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
