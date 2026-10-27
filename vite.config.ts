import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";
import type { ManualChunkMeta } from "rollup";

// Pacotes de cada chunk de vendor. Como no formato objeto do manualChunks, o
// Rollup também puxa para o chunk as dependências que só eles usam.
const GRUPOS_VENDOR: Record<string, string[]> = {
  // Frameworks core — raramente mudam, ficam em cache por muito tempo
  "vendor-react": ["react", "react-dom", "react-router-dom"],
  "vendor-query": ["@tanstack/react-query"],
  // tslib fixado aqui: no formato objeto ele caía no vendor-supabase (o Radix também usa)
  "vendor-supabase": ["@supabase/supabase-js", "tslib"],
  // Utilitários do cn() — num chunk próprio para não irem parar dentro do
  // vendor-recharts (o Recharts também usa clsx), o que fazia toda página,
  // inclusive a landing, baixar o Recharts só por causa do clsx.
  "vendor-utils": ["clsx", "tailwind-merge"],
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
};

const pacoteDoModulo = (id: string) => id.match(/node_modules\/((?:@[^/]+\/)?[^/]+)\//)?.[1];

// Páginas de venda (/, /lp1, /lp2, /es) e suas seções.
const ehModuloDaLanding = (id: string) =>
  /\/src\/(components\/landing(-es)?\/|pages\/Landing(LP1|LP2|ES)?(Secoes)?\.tsx$|pages\/landingLP1)/.test(id);

const ICONE_LUCIDE = /\/lucide-react\/dist\/esm\/icons\//;
const INDICE_LUCIDE = /\/lucide-react\/dist\/esm\/lucide-react\.js$/;

// Componentes importam do índice ("lucide-react"), que reexporta os ~1.500 ícones,
// então o grafo não diz qual arquivo de ícone cada módulo usa. Os nomes importados
// são traduzidos para o arquivo pelos `export … from './icons/x.js'` do índice.
function iconesUsadosPor(modulos: Iterable<string>, { getModuleIds, getModuleInfo }: ManualChunkMeta) {
  const indice = [...getModuleIds()].find((id) => INDICE_LUCIDE.test(id));
  if (!indice) return new Set<string>();
  const arquivoPorNome = new Map<string, string>();
  const exportacoes = (getModuleInfo(indice)?.code ?? "").matchAll(/export\s*\{([^}]*)\}\s*from\s*['"](\.\/icons\/[^'"]+)['"]/g);
  for (const [, nomes, arquivo] of exportacoes) {
    for (const parte of nomes.split(",")) {
      const nome = parte.trim().split(/\s+as\s+/).pop();
      if (nome) arquivoPorNome.set(nome, path.join(path.dirname(indice), arquivo));
    }
  }
  const usados = new Set<string>();
  for (const id of modulos) {
    const importacoes = (getModuleInfo(id)?.code ?? "").matchAll(/import\s*\{([^}]*)\}\s*from\s*["']lucide-react["']/g);
    for (const [, nomes] of importacoes) {
      for (const parte of nomes.split(",")) {
        const arquivo = arquivoPorNome.get(parte.trim().split(/\s+as\s+/)[0]);
        if (arquivo) usados.add(arquivo);
      }
    }
  }
  return usados;
}

// Módulos que o pacote principal (index) importa direto, sem passar pelo índice do lucide.
function estaticosDaEntrada({ getModuleIds, getModuleInfo }: ManualChunkMeta) {
  const vistos = new Set<string>();
  const fila = [...getModuleIds()].filter((id) => getModuleInfo(id)?.isEntry);
  for (const id of fila) {
    if (vistos.has(id) || INDICE_LUCIDE.test(id)) continue;
    vistos.add(id);
    fila.push(...(getModuleInfo(id)?.importedIds ?? []));
  }
  return vistos;
}

// Ícones só das landings: os que elas usam menos os que o pacote principal já
// carrega em toda página (senão o app inteiro baixaria o chunk de ícones no início).
let iconesSoDaLanding: Set<string> | undefined;
function calcularIconesSoDaLanding(meta: ManualChunkMeta) {
  const daLanding = iconesUsadosPor([...meta.getModuleIds()].filter(ehModuloDaLanding), meta);
  const daEntrada = iconesUsadosPor(estaticosDaEntrada(meta), meta);
  return new Set([...daLanding].filter((id) => !daEntrada.has(id)));
}

// Traduções (src/locales/<idioma>/<namespace>.ts, menos o pt-BR, que vai no
// pacote principal): um chunk por idioma e namespace, com nome próprio para
// ficarem fora do precache do service worker (quem usa pt-BR nunca as baixa).
const TRADUCAO = /\/src\/locales\/(es|en|it)\/([a-z-]+)\.ts$/;

function manualChunks(id: string, meta: ManualChunkMeta): string | undefined {
  const traducao = id.match(TRADUCAO);
  if (traducao) return `idioma-${traducao[1]}-${traducao[2]}`;
  const pacote = pacoteDoModulo(id);
  if (!pacote) return undefined;
  for (const [chunk, pacotes] of Object.entries(GRUPOS_VENDOR)) {
    if (pacotes.includes(pacote)) return chunk;
  }
  if (pacote !== "lucide-react") return undefined;
  // Núcleo do lucide (createLucideIcon etc., ~2 KB): fica com os utilitários,
  // que toda página já carrega, para o chunk de ícones não virar dependência do index.
  // (Só o núcleo: o índice lucide-react.js puxaria todos os ícones junto.)
  if (/\/lucide-react\/dist\/esm\/(createLucideIcon|Icon|defaultAttributes)\.js$|\/lucide-react\/dist\/esm\/shared\//.test(id)) {
    return "vendor-utils";
  }
  if (!ICONE_LUCIDE.test(id)) return undefined;
  // Ícones das landings num arquivo só, em vez de ~30 arquivos de 0,3–2 KB.
  iconesSoDaLanding ??= calcularIconesSoDaLanding(meta);
  return iconesSoDaLanding.has(id) ? "icones-landing" : undefined;
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  assetsInclude: ["**/*.JPG"],
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
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
          // Traduções: só quem troca de idioma baixa (ver TRADUCAO)
          "assets/idioma-*",
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
        manualChunks,
      },
    },
  },
}));
