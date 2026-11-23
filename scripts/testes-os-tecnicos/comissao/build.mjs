// Empacota useComissoes e useDesempenhoFuncionario REAIS (antes = REF_ANTES,
// novo = árvore de trabalho) com Supabase em memória e useQuery falso.
// argv[2] = raiz, argv[3] = saída, argv[4] = commit "antes". Uso: ver run.sh.
import path from "node:path";
import { empacotarAntesNovo } from "../empacotarAntesNovo.mjs";
const H = path.dirname(new URL(import.meta.url).pathname);
await empacotarAntesNovo({
  raiz: path.resolve(process.argv[2]),
  saida: path.resolve(process.argv[3]),
  refAntes: process.argv[4],
  alvos: ["src/hooks/useComissoes.ts", "src/hooks/useDesempenhoFuncionario.ts", "src/lib/comissao/comissaoOsDoSnapshot.ts"],
  mocks: {
    "@/integrations/supabase/client": `${H}/mocks/supabaseClient.ts`,
    "@tanstack/react-query": `${H}/mocks/reactQuery.ts`,
  },
});
