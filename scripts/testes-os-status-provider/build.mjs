// Empacota o teste do OSStatusConfigProvider (provider e hook reais; Supabase simulado que conta requisições).
// Uso: ver run.sh. argv[2] = raiz do repositório, argv[3] = pasta com jsdom/testing-library instalados.
import path from "node:path";
import fs from "node:fs";
import { createRequire } from "node:module";
const RAIZ = path.resolve(process.argv[2]);
const DEPS = path.resolve(process.argv[3]);
const H = path.dirname(new URL(import.meta.url).pathname);
const reqRaiz = createRequire(path.join(RAIZ, "package.json"));
const { build } = reqRaiz("esbuild");
const mocks = {
  "@/integrations/supabase/client": `${H}/mocks/supabase.ts`,
};
const exts = [".tsx", ".ts", "/index.tsx", "/index.ts", ""];
const alias = {
  name: "alias",
  setup(b) {
    b.onResolve({ filter: /^@\// }, (a) => {
      if (mocks[a.path]) return { path: mocks[a.path] };
      const base = path.join(RAIZ, "src", a.path.slice(2));
      for (const e of exts) if (fs.existsSync(base + e) && fs.statSync(base + e).isFile()) return { path: base + e };
      return undefined;
    });
    // Uma cópia só de React (a do projeto), também para a testing-library.
    b.onResolve({ filter: /^react(-dom)?(\/.*)?$/ }, (a) => ({ path: reqRaiz.resolve(a.path) }));
  },
};
await build({
  entryPoints: [`${H}/runner.tsx`], bundle: true, platform: "node", format: "cjs",
  outfile: path.join(DEPS, "runner-os-status.cjs"), plugins: [alias], jsx: "automatic",
  nodePaths: [path.join(RAIZ, "node_modules"), path.join(DEPS, "node_modules")],
  external: ["jsdom"],
  define: { "import.meta.env.DEV": "false", "import.meta.env.PROD": "true", "import.meta.env.MODE": '"test"' },
  loader: { ".css": "empty", ".png": "empty", ".svg": "empty" }, logLevel: "error",
});
