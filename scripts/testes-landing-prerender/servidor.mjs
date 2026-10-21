// Servidor estático que imita a Vercel para testar o build localmente (sem deploy):
// arquivo que existe em dist/ primeiro ("/" → index.html), depois os "rewrites" do
// vercel.json na ordem, com gzip como na Vercel.
//
//   node scripts/testes-landing-prerender/servidor.mjs <dist> <vercel.json> <porta>
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import zlib from "node:zlib";

const [dist, arquivoVercel, porta] = process.argv.slice(2);
if (!dist || !arquivoVercel || !porta) {
  console.error("uso: servidor.mjs <dist> <vercel.json> <porta>");
  process.exit(1);
}
const raiz = path.resolve(dist);
const { rewrites = [] } = JSON.parse(fs.readFileSync(arquivoVercel, "utf8"));
const regras = rewrites.map(({ source, destination }) => ({
  regex: new RegExp(`^${source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace("\\(\\.\\*\\)", "(.*)")}$`),
  destino: destination,
}));

const TIPOS = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".mp4": "video/mp4",
  ".mp3": "audio/mpeg",
};
const COMPRIMIR = new Set([".html", ".js", ".mjs", ".css", ".json", ".webmanifest", ".svg"]);

function arquivoDoDisco(caminho) {
  const alvo = path.join(raiz, caminho === "/" ? "/index.html" : caminho);
  if (!alvo.startsWith(raiz)) return null;
  try {
    return fs.statSync(alvo).isFile() ? alvo : null;
  } catch {
    return null;
  }
}

/** Qual arquivo a Vercel serviria para este caminho (null = 404). */
export function resolver(caminho) {
  const doDisco = arquivoDoDisco(caminho);
  if (doDisco) return doDisco;
  for (const { regex, destino } of regras) {
    if (regex.test(caminho)) return arquivoDoDisco(destino);
  }
  return null;
}

http
  .createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    const arquivo = resolver(decodeURIComponent(url.pathname));
    if (!arquivo) {
      res.writeHead(404).end("404");
      return;
    }
    const ext = path.extname(arquivo).toLowerCase();
    let corpo = fs.readFileSync(arquivo);
    const cabecalhos = {
      "Content-Type": TIPOS[ext] ?? "application/octet-stream",
      "Cache-Control": arquivo.includes(`${path.sep}assets${path.sep}`) ? "public, max-age=31536000, immutable" : "public, max-age=0, must-revalidate",
      "X-Arquivo": path.relative(raiz, arquivo),
    };
    if (COMPRIMIR.has(ext) && /\bgzip\b/.test(req.headers["accept-encoding"] ?? "")) {
      corpo = zlib.gzipSync(corpo);
      cabecalhos["Content-Encoding"] = "gzip";
    }
    res.writeHead(200, cabecalhos).end(corpo);
  })
  .listen(Number(porta), () => console.log(`servindo ${raiz} em http://localhost:${porta}`));
