// Topo das landings (/, /lp1, /lp2, /es) em HTML puro, para o título aparecer antes do
// JavaScript (LCP). Roda no fim do `vite build`, qualquer que seja o comando de build.
//
// Saída em dist/:
//  - app.html            → cópia byte a byte do index.html gerado pelo Vite (shell do app).
//                          O catch-all do vercel.json aponta para ele.
//  - index.html          → landing "/" (shell + bloco #topo-estatico).
//  - _landing/lp1.html, _landing/lp2.html, _landing/es.html → as outras landings.
//
// O bloco fica FORA do #root: o React monta como sempre (createRoot, sem hydration) e a
// página da landing remove o bloco ao montar (src/components/landing/topoEstatico.ts).
// O bloco é position:absolute no topo, por cima do #root: o #root não muda de lugar quando
// o bloco sai (senão o Chrome conta a página inteira como deslocamento, CLS ≈ 1), e o
// spinner/"Carregando..." que o React mostra antes da landing fica escondido embaixo dele.
// Fora da rota certa (rewrite errado) ou no app instalado, o bloco some antes de aparecer.
//
// O build FALHA e apaga dist/ se: app.html faltar ou não for igual ao index.html do Vite,
// app.html tiver o bloco, alguma landing não tiver o <h1> esperado, o HTML da landing
// diferir do shell em algo além do bloco, ou o bloco usar um arquivo que não existe.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build, type Plugin, type ResolvedConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import type { OutputBundle, OutputChunk } from "rollup";

interface Landing {
  rota: string;
  /** Caminho do HTML dentro de dist/. */
  arquivo: string;
  /** Página do app que monta nessa rota (para achar o CSS próprio dela). */
  pagina: string;
  /** Texto esperado no <h1> (se a headline mudar, atualizar aqui). */
  h1: string;
}

export const LANDINGS: Landing[] = [
  { rota: "/", arquivo: "index.html", pagina: "src/pages/Landing.tsx", h1: "Quando as vendas caem, organização vira lucro." },
  { rota: "/lp1", arquivo: "_landing/lp1.html", pagina: "src/pages/LandingLP1.tsx", h1: "Organize a bancada. Multiplique o lucro." },
  { rota: "/lp2", arquivo: "_landing/lp2.html", pagina: "src/pages/LandingLP2.tsx", h1: "Seu concorrente está organizando tudo." },
  { rota: "/es", arquivo: "_landing/es.html", pagina: "src/pages/LandingES.tsx", h1: "Cuando las ventas bajan, la organización se vuelve ganancia." },
];

export const ARQUIVO_APP = "app.html";
const ID_BLOCO = "topo-estatico";
const MARCADOR_ROOT = '<div id="root"></div>';
const SAIDA_SSR = "node_modules/.cache/mec-topo-estatico";

/** Bloco inserido antes do #root. `rota` é a única rota em que o bloco pode aparecer. */
function montarBloco(rota: string, markup: string) {
  const guarda =
    "(function(){var p=location.pathname;if(p.length>1)p=p.replace(/\\/+$/,\"\");" +
    `if(p!==${JSON.stringify(rota)}||navigator.standalone===true)` +
    'document.documentElement.setAttribute("data-sem-topo-estatico","")})()';
  const remover =
    'if(document.documentElement.hasAttribute("data-sem-topo-estatico")){' +
    `var t=document.getElementById("${ID_BLOCO}");t&&t.remove()}`;
  return (
    `<style data-topo-estatico>#${ID_BLOCO}{position:absolute;top:0;left:0;right:0}` +
    `@media (display-mode: standalone){#${ID_BLOCO}{display:none}}` +
    `[data-sem-topo-estatico] #${ID_BLOCO}{display:none}</style>\n    ` +
    `<script>${guarda}</script>\n    ` +
    `<div id="${ID_BLOCO}">${markup}</div>\n    ` +
    `<script>${remover}</script>\n    `
  );
}

const textoSemTags = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

/** CSS que a página da rota carrega sob demanda (ex.: LandingLP2.css), incluindo os imports dela. */
function cssDaPagina(bundle: OutputBundle, root: string, pagina: string): string[] {
  const chunks = Object.values(bundle).filter((s): s is OutputChunk => s.type === "chunk");
  // Pelo módulo, não pelo facadeModuleId: o chunk da LP1 é compartilhado (sem fachada).
  const modulo = path.resolve(root, pagina);
  const inicial = chunks.find((c) => c.facadeModuleId === modulo) ?? chunks.find((c) => modulo in c.modules);
  if (!inicial) throw new Error(`chunk da página ${pagina} não encontrado`);
  const css = new Set<string>();
  const vistos = new Set<string>();
  const fila = [inicial];
  for (const chunk of fila) {
    if (vistos.has(chunk.fileName) || chunk.isEntry) continue;
    vistos.add(chunk.fileName);
    chunk.viteMetadata?.importedCss.forEach((arquivo) => css.add(arquivo));
    for (const importado of chunk.imports) {
      const proximo = bundle[importado];
      if (proximo?.type === "chunk") fila.push(proximo);
    }
  }
  return [...css];
}

function falhar(motivo: string): never {
  throw new Error(`[topo-estatico] ${motivo}`);
}

async function gerar(config: ResolvedConfig, cssPorRota: Map<string, string[]>) {
  const root = config.root;
  const dist = path.resolve(root, config.build.outDir);
  const saidaSsr = path.resolve(root, SAIDA_SSR);

  try {
    await gerarEmDist(config, cssPorRota, dist, saidaSsr);
  } finally {
    fs.rmSync(saidaSsr, { recursive: true, force: true });
  }
}

async function gerarEmDist(config: ResolvedConfig, cssPorRota: Map<string, string[]>, dist: string, saidaSsr: string) {
  const root = config.root;
  // 1. Build SSR só das páginas das landings (mesmos aliases e assets do build do app).
  await build({
    configFile: false,
    root,
    mode: config.mode,
    base: config.base,
    logLevel: "warn",
    publicDir: false,
    plugins: [react()],
    resolve: { alias: { "@": path.resolve(root, "src") } },
    assetsInclude: ["**/*.JPG"],
    build: {
      ssr: path.resolve(root, "src/prerender/entrada.tsx"),
      outDir: saidaSsr,
      emptyOutDir: true,
      copyPublicDir: false,
      rollupOptions: { output: { entryFileNames: "entrada.mjs" } },
    },
  });
  const { renderizarLanding } = (await import(
    `${pathToFileURL(path.join(saidaSsr, "entrada.mjs")).href}?t=${Date.now()}`
  )) as { renderizarLanding: (rota: string) => string };

  // 2. Shell do app: app.html = index.html do Vite, byte a byte.
  const caminhoIndex = path.join(dist, "index.html");
  const shell = fs.readFileSync(caminhoIndex, "utf8");
  if (shell.split(MARCADOR_ROOT).length !== 2) falhar(`index.html do Vite sem ${MARCADOR_ROOT} (ou com mais de um)`);
  if (shell.includes(ID_BLOCO)) falhar("index.html do Vite já contém o bloco da landing");
  fs.copyFileSync(caminhoIndex, path.join(dist, ARQUIVO_APP));

  // 3. Uma página por landing: shell + bloco antes do #root (+ CSS próprio da página no <head>).
  for (const landing of LANDINGS) {
    const markup = renderizarLanding(landing.rota);
    const bloco = montarBloco(landing.rota, markup);
    const links = (cssPorRota.get(landing.rota) ?? [])
      .map((arquivo) => `${config.base}${arquivo}`)
      .filter((href) => !shell.includes(`href="${href}"`))
      .map((href) => `<link rel="stylesheet" crossorigin href="${href}" data-topo-estatico>\n`)
      .join("");
    const html = shell.replace("</head>", `${links}</head>`).replace(MARCADOR_ROOT, `${bloco}${MARCADOR_ROOT}`);
    const destino = path.join(dist, landing.arquivo);
    fs.mkdirSync(path.dirname(destino), { recursive: true });
    fs.writeFileSync(destino, html);
  }

  validar(dist, shell);
}

/** Confere o que foi gravado em dist/ (relendo os arquivos). */
export function validar(dist: string, shellEsperado: string) {
  const caminhoApp = path.join(dist, ARQUIVO_APP);
  if (!fs.existsSync(caminhoApp)) falhar(`${ARQUIVO_APP} não foi gerado`);
  const app = fs.readFileSync(caminhoApp, "utf8");
  if (app !== shellEsperado) falhar(`${ARQUIVO_APP} difere do index.html gerado pelo Vite`);
  if (app.includes(ID_BLOCO)) falhar(`${ARQUIVO_APP} contém o bloco da landing`);

  for (const landing of LANDINGS) {
    const caminho = path.join(dist, landing.arquivo);
    if (!fs.existsSync(caminho)) falhar(`${landing.arquivo} não foi gerado`);
    const html = fs.readFileSync(caminho, "utf8");

    const inicio = html.indexOf(`<div id="${ID_BLOCO}">`);
    const fim = html.indexOf(MARCADOR_ROOT);
    if (inicio < 0 || fim < inicio) falhar(`${landing.arquivo} sem o bloco antes do #root`);
    const bloco = html.slice(inicio, fim);

    const h1s = [...bloco.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/g)];
    if (h1s.length !== 1) falhar(`${landing.arquivo}: esperado 1 <h1> no bloco, achou ${h1s.length}`);
    const textoH1 = textoSemTags(h1s[0][1]);
    if (!textoH1.startsWith(landing.h1)) {
      falhar(`${landing.arquivo}: <h1> "${textoH1}" não começa com "${landing.h1}" (headline mudou? atualizar LANDINGS)`);
    }

    // Fora do bloco e dos <link> de CSS da página, o HTML tem que ser o shell do app.
    const semBloco = html
      .replace(/<style data-topo-estatico>[\s\S]*?<div id="root"><\/div>/, MARCADOR_ROOT)
      .replace(/<link [^>]*data-topo-estatico>\n/g, "");
    if (semBloco !== shellEsperado) falhar(`${landing.arquivo}: fora do bloco, o HTML difere do shell do app`);

    for (const [, arquivo] of html.matchAll(/["'\s,(]\/(assets\/[^"'\s,)?#]+)/g)) {
      if (!fs.existsSync(path.join(dist, arquivo))) falhar(`${landing.arquivo} usa /${arquivo}, que não existe em dist/`);
    }
  }
}

/** Sem dist/: nenhum deploy sobe com landing ou shell quebrados. */
function apagarDist(config: ResolvedConfig) {
  fs.rmSync(path.resolve(config.root, config.build.outDir), { recursive: true, force: true });
}

export function pluginTopoEstatico(): Plugin {
  let config: ResolvedConfig;
  const cssPorRota = new Map<string, string[]>();
  return {
    name: "mec-topo-estatico",
    apply: "build",
    configResolved(resolvido) {
      config = resolvido;
    },
    writeBundle(_opcoes, bundle) {
      if (config.build.ssr) return;
      try {
        for (const landing of LANDINGS) cssPorRota.set(landing.rota, cssDaPagina(bundle, config.root, landing.pagina));
      } catch (erro) {
        apagarDist(config);
        throw erro;
      }
    },
    closeBundle: {
      // Depois dos outros plugins (inclusive o service worker do vite-plugin-pwa).
      order: "post",
      sequential: true,
      async handler() {
        if (config.build.ssr) return;
        try {
          await gerar(config, cssPorRota);
        } catch (erro) {
          apagarDist(config);
          throw erro;
        }
      },
    },
  };
}
