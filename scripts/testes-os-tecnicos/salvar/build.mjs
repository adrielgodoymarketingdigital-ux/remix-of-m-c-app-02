// Empacota o salvarOrdemServico REAL duas vezes (antes = REF_ANTES, novo =
// árvore de trabalho) com o cliente do Supabase trocado por um falso que só
// registra as chamadas. Uso: ver run.sh.
// argv[2] = raiz do repositório, argv[3] = pasta de saída, argv[4] = commit "antes".
import path from "node:path";
import { empacotarAntesNovo } from "../empacotarAntesNovo.mjs";
const H = path.dirname(new URL(import.meta.url).pathname);
await empacotarAntesNovo({
  raiz: path.resolve(process.argv[2]),
  saida: path.resolve(process.argv[3]),
  refAntes: process.argv[4],
  alvos: [
    "src/components/ordens/ordem-servico-wizard/handleSubmitOrdemServico.ts",
    // Módulo de regra importado pelo save: no "antes", a cópia antiga dele.
    "src/lib/ordemServico/tecnicosPorServicoOS.ts",
  ],
  mocks: { "@/integrations/supabase/client": `${H}/mocks/supabaseClient.ts` },
});
