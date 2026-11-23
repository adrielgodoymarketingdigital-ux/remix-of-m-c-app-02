// Empacota arquivos REAIS do app duas vezes — "antes" (como estavam em
// refAntes) e "novo" (árvore de trabalho) — trocando módulos por falsos
// (Supabase, react-query...). Os dois pacotes usam as dependências da árvore
// atual; por isso a trava: toda dependência que entra no pacote "antes" (fora
// os próprios alvos e os falsos) tem de estar igual a refAntes.
import path from "node:path";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

export async function empacotarAntesNovo({ raiz, saida, refAntes, alvos, mocks }) {
  const { build } = createRequire(path.join(raiz, "package.json"))("esbuild");
  const dirAntes = path.join(saida, "antes-src");
  fs.rmSync(saida, { recursive: true, force: true });
  fs.mkdirSync(dirAntes, { recursive: true });
  const exts = [".ts", ".tsx", "/index.ts", "/index.tsx", ""];
  const achar = (base) => {
    for (const e of exts) if (fs.existsSync(base + e) && fs.statSync(base + e).isFile()) return base + e;
    return undefined;
  };
  // cópia "antes" de cada alvo → pasta original (para imports relativos)
  const copias = new Map(); // cópia "antes" → pasta original
  const copiaDoAlvo = new Map(); // caminho absoluto do alvo → cópia "antes"
  for (const alvo of alvos) {
    const destino = path.join(dirAntes, alvo.replaceAll("/", "__"));
    fs.writeFileSync(destino, execFileSync("git", ["-C", raiz, "show", `${refAntes}:${alvo}`]));
    copias.set(destino, path.join(raiz, path.dirname(alvo)));
    copiaDoAlvo.set(path.join(raiz, alvo), destino);
  }
  // No pacote "antes", importar um alvo (ex.: um módulo de regra alterado)
  // usa a cópia "antes" dele, não a da árvore.
  const plugin = (ehAntes) => ({
    name: "alias",
    setup(b) {
      const trocar = (p) => (p && ehAntes && copiaDoAlvo.has(p) ? copiaDoAlvo.get(p) : p);
      b.onResolve({ filter: /.*/ }, (a) => {
        if (mocks[a.path]) return { path: mocks[a.path] };
        let p;
        if (a.path.startsWith("@/")) p = achar(path.join(raiz, "src", a.path.slice(2)));
        else if (a.path.startsWith(".") && (copias.has(a.importer) || a.importer.startsWith(path.join(raiz, "src") + path.sep))) p = achar(path.join(copias.get(a.importer) ?? path.dirname(a.importer), a.path));
        else return undefined;
        return p ? { path: trocar(p) } : undefined;
      });
    },
  });
  const comum = {
    bundle: true, platform: "browser", format: "esm", metafile: true,
    nodePaths: [path.join(raiz, "node_modules")], // as cópias "antes" ficam fora do repositório
    define: { "import.meta.env.DEV": "false", "import.meta.env.PROD": "true", "import.meta.env.MODE": '"test"' },
    logLevel: "error",
  };
  const nomes = alvos.map((a) => path.basename(a).replace(/\.tsx?$/, ""));
  const rAntes = await build({ ...comum, plugins: [plugin(true)], entryPoints: [...copias.keys()], outdir: path.join(saida, "antes"), entryNames: "[name]" });
  await build({ ...comum, plugins: [plugin(false)], entryPoints: alvos.map((a) => path.join(raiz, a)), outdir: path.join(saida, "novo"), entryNames: "[name]" });
  // renomeia antes/<a__b__arquivo>.js → antes/<arquivo>.js
  for (const [destino] of copias) {
    const gerado = path.join(saida, "antes", path.basename(destino).replace(/\.tsx?$/, ".js"));
    const nome = path.basename(destino).split("__").pop().replace(/\.tsx?$/, ".js");
    fs.renameSync(gerado, path.join(saida, "antes", nome));
  }

  // Trava: dependências do "antes" iguais a refAntes.
  const mocksAbs = new Set(Object.values(mocks).map((m) => path.resolve(m)));
  const mudadas = [];
  for (const entrada of Object.keys(rAntes.metafile.inputs)) {
    const abs = path.resolve(process.cwd(), entrada);
    if (!abs.startsWith(path.join(raiz, "src") + path.sep) || mocksAbs.has(abs)) continue;
    const rel = path.relative(raiz, abs);
    try {
      execFileSync("git", ["-C", raiz, "cat-file", "-e", `${refAntes}:${rel}`], { stdio: "ignore" });
      execFileSync("git", ["-C", raiz, "diff", "--quiet", refAntes, "--", rel]);
    } catch {
      mudadas.push(rel);
    }
  }
  if (mudadas.length) {
    console.error(`Dependências do pacote "antes" mudaram desde ${refAntes} (a comparação não valeria):`, mudadas);
    process.exit(1);
  }
  console.log(`pacotes em ${saida} (antes = ${refAntes}): ${nomes.join(", ")}`);
}
