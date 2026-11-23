// Empacota o salvarOrdemServico REAL duas vezes (antes = REF_ANTES, novo =
// árvore de trabalho) com o cliente do Supabase trocado por um falso que só
// registra as chamadas. Uso: ver run.sh.
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
const ALVO = "src/components/ordens/ordem-servico-wizard/handleSubmitOrdemServico.ts";

// O "antes" usa as dependências da árvore atual: só vale se nenhuma outra
// dependência mudou desde REF_ANTES (o módulo novo não é importado pelo antes).
const mudados = execFileSync("git", ["-C", RAIZ, "diff", "--name-only", REF_ANTES, "--", "src"]).toString().trim().split("\n").filter(Boolean);
const permitidos = new Set([
  ALVO,
  "src/components/ordens/ordem-servico-wizard/useOrdemServicoWizardState.ts",
  "src/lib/ordemServico/tecnicosPorServicoOS.ts",
]);
const fora = mudados.filter((f) => !permitidos.has(f));
const naoRastreados = execFileSync("git", ["-C", RAIZ, "ls-files", "--others", "--exclude-standard", "src"]).toString().trim().split("\n").filter((f) => f && !permitidos.has(f));
if (fora.length || naoRastreados.length) {
  console.error("Outros arquivos de src mudaram desde", REF_ANTES, [...fora, ...naoRastreados]);
  process.exit(1);
}

const dirAntes = path.join(SAIDA, "antes");
fs.mkdirSync(dirAntes, { recursive: true });
const antes = path.join(dirAntes, "handleSubmitOrdemServico.ts");
fs.writeFileSync(antes, execFileSync("git", ["-C", RAIZ, "show", `${REF_ANTES}:${ALVO}`]));
const dirOriginal = path.join(RAIZ, path.dirname(ALVO));

const mocks = { "@/integrations/supabase/client": `${H}/mocks/supabaseClient.ts` };
const exts = [".ts", ".tsx", "/index.ts", "/index.tsx", ""];
const achar = (base) => {
  for (const e of exts) if (fs.existsSync(base + e) && fs.statSync(base + e).isFile()) return base + e;
  return undefined;
};
const alias = {
  name: "alias",
  setup(b) {
    b.onResolve({ filter: /.*/ }, (a) => {
      if (mocks[a.path]) return { path: mocks[a.path] };
      if (a.path.startsWith("@/")) {
        const p = achar(path.join(RAIZ, "src", a.path.slice(2)));
        return p ? { path: p } : undefined;
      }
      // Imports relativos do arquivo "antes" apontam para a pasta original.
      if (a.path.startsWith(".") && a.importer.startsWith(dirAntes)) {
        const p = achar(path.join(dirOriginal, a.path));
        return p ? { path: p } : undefined;
      }
      return undefined;
    });
  },
};
for (const [nome, entrada] of [["antes", antes], ["novo", path.join(RAIZ, ALVO)]]) {
  await build({
    entryPoints: [entrada], bundle: true, platform: "browser", format: "esm",
    outfile: path.join(SAIDA, `${nome}.mjs`), plugins: [alias],
    define: { "import.meta.env.DEV": "false", "import.meta.env.PROD": "true", "import.meta.env.MODE": '"test"' },
    logLevel: "error",
  });
}
console.log(`bundles em ${SAIDA} (antes = ${REF_ANTES})`);
