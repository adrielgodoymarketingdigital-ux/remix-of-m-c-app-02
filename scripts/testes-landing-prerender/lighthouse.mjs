// Lighthouse mobile (padrão do PageSpeed: Moto G emulado, 4G lento simulado, CPU 4×),
// N rodadas alternando main e branch, mediana por rota. Pixels (Meta, UTMify, TikTok) e
// Supabase bloqueados nos dois lados: nenhuma rodada manda evento nem toca a produção.
//
//   node scripts/testes-landing-prerender/lighthouse.mjs <pasta-de-saida> [rodadas] [simulate|devtools]
//   simulate (padrão) = método do PageSpeed; devtools = rede e CPU limitadas de verdade.
//   (servidores da main em :4800 e da branch em :4801, ver servidor.mjs)
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const SAIDA = path.resolve(process.argv[2] ?? "saida-lighthouse");
const RODADAS = Number(process.argv[3] ?? 5);
const METODO = process.argv[4] ?? "simulate";
const LADOS = { main: process.env.URL_MAIN ?? "http://localhost:4800", branch: process.env.URL_BRANCH ?? "http://localhost:4801" };
const ROTAS = ["/", "/lp1", "/lp2", "/es"];
const BLOQUEADOS = ["*connect.facebook.net*", "*facebook.com/tr*", "*utmify.com.br*", "*tiktok.com*", "*supabase.co*"];
fs.mkdirSync(SAIDA, { recursive: true });

function rodar(url, arquivo) {
  execFileSync(
    "npx",
    [
      "-y", "lighthouse@12.6.1", url,
      "--only-categories=performance", "--output=json", `--output-path=${arquivo}`, "--quiet",
      "--chrome-flags=--headless=new", `--throttling-method=${METODO}`,
      ...BLOQUEADOS.map((p) => `--blocked-url-patterns=${p}`),
    ],
    { stdio: "inherit" },
  );
  const r = JSON.parse(fs.readFileSync(arquivo, "utf8"));
  const a = r.audits;
  return {
    nota: Math.round(r.categories.performance.score * 100),
    fcp: a["first-contentful-paint"].numericValue,
    lcp: a["largest-contentful-paint"].numericValue,
    tbt: a["total-blocking-time"].numericValue,
    cls: a["cumulative-layout-shift"].numericValue,
    si: a["speed-index"].numericValue,
    lcpElemento: a["largest-contentful-paint-element"]?.details?.items?.[0]?.items?.[0]?.node?.snippet?.slice(0, 90) ?? "",
  };
}

const mediana = (xs) => { const o = [...xs].sort((a, b) => a - b); return o[Math.floor(o.length / 2)]; };
const medidas = {};
for (const rota of ROTAS) {
  for (let i = 1; i <= RODADAS; i++) {
    for (const [lado, base] of i % 2 ? Object.entries(LADOS) : Object.entries(LADOS).reverse()) {
      const nome = `${lado}-${rota === "/" ? "raiz" : rota.slice(1)}-${i}`;
      const m = rodar(`${base}${rota}`, path.join(SAIDA, `${nome}.json`));
      ((medidas[rota] ??= {})[lado] ??= []).push(m);
      console.log(nome, JSON.stringify(m));
    }
  }
}

const tabela = [];
for (const rota of ROTAS) {
  for (const lado of Object.keys(LADOS)) {
    const ms = medidas[rota][lado];
    tabela.push({
      rota, lado,
      nota: mediana(ms.map((m) => m.nota)),
      "FCP (s)": +(mediana(ms.map((m) => m.fcp)) / 1000).toFixed(2),
      "LCP (s)": +(mediana(ms.map((m) => m.lcp)) / 1000).toFixed(2),
      "TBT (ms)": Math.round(mediana(ms.map((m) => m.tbt))),
      CLS: +mediana(ms.map((m) => m.cls)).toFixed(3),
      "SI (s)": +(mediana(ms.map((m) => m.si)) / 1000).toFixed(2),
      "elemento LCP": ms[0].lcpElemento,
    });
  }
}
fs.writeFileSync(path.join(SAIDA, "medianas.json"), JSON.stringify({ tabela, medidas }, null, 2));
console.table(tabela);
