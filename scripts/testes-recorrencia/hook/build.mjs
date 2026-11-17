// Empacota o useContas.ts REAL duas vezes (antes = REF_ANTES, novo = árvore de trabalho)
// com React, toast, identidade e cliente do Supabase falsos. Uso: ver run.sh.
// argv[2] = raiz do repositório, argv[3] = pasta de saída, argv[4] = commit "antes".
import path from "node:path";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
const RAIZ = path.resolve(process.argv[2]);
const SAIDA = path.resolve(process.argv[3]);
const REF_ANTES = process.argv[4];
const H = path.dirname(new URL(import.meta.url).pathname);
const { build } = createRequire(path.join(RAIZ, "package.json"))("esbuild");

fs.mkdirSync(path.join(SAIDA, "antes"), { recursive: true });
const antes = path.join(SAIDA, "antes", "useContas.ts");
fs.writeFileSync(antes, execFileSync("git", ["-C", RAIZ, "show", `${REF_ANTES}:src/hooks/useContas.ts`]));

const mocks = {
  "@/integrations/supabase/client": `${H}/mocks/supabaseClient.ts`,
  "@/hooks/use-toast": `${H}/mocks/useToast.ts`,
  "./useResolvedUserId": `${H}/mocks/identidade.ts`,
  "./useFuncionarioPermissoes": `${H}/mocks/identidade.ts`,
  "@/hooks/useResolvedUserId": `${H}/mocks/identidade.ts`,
  "@/hooks/useFuncionarioPermissoes": `${H}/mocks/identidade.ts`,
  react: `${H}/mocks/react.ts`,
};
const exts = [".ts", ".tsx", "/index.ts", "/index.tsx", ""];
const alias = {
  name: "alias",
  setup(b) {
    b.onResolve({ filter: /.*/ }, (a) => {
      if (mocks[a.path]) return { path: mocks[a.path] };
      if (!a.path.startsWith("@/")) return undefined;
      const base = path.join(RAIZ, "src", a.path.slice(2));
      for (const e of exts) if (fs.existsSync(base + e) && fs.statSync(base + e).isFile()) return { path: base + e };
      return undefined;
    });
  },
};
for (const [nome, entrada] of [["antes", antes], ["novo", path.join(RAIZ, "src/hooks/useContas.ts")]]) {
  await build({
    entryPoints: [entrada], bundle: true, platform: "browser", format: "esm",
    outfile: path.join(SAIDA, `${nome}.mjs`), plugins: [alias],
    define: { "import.meta.env.DEV": "false", "import.meta.env.PROD": "true", "import.meta.env.MODE": '"test"' },
    logLevel: "error",
  });
}
console.log(`bundles em ${SAIDA} (antes = ${REF_ANTES})`);
