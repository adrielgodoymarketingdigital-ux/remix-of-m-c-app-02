// Banco falso em memória para registrarEntradaTroca e para os carregadores do
// recibo (só dados fictícios; nada vai à rede).
// Entra no lugar de "@/integrations/supabase/client" pelo deno.json desta pasta.
export interface Chamada {
  tabela: string;
  op: "insert" | "update" | "upsert";
  linha: Record<string, unknown>;
  filtro?: [string, unknown];
}

export const chamadas: Chamada[] = [];
let falharEm: string | null = null;
let contador = 0;

let tabelas: Record<string, Record<string, unknown>[]> = {};
/** Colunas pedidas em cada select (para provar que o select traz o que precisa). */
export const selects: { tabela: string; colunas: string[] }[] = [];

export function reiniciarBanco(opcoes: { falharEm?: string; tabelas?: Record<string, Record<string, unknown>[]> } = {}) {
  chamadas.length = 0;
  selects.length = 0;
  falharEm = opcoes.falharEm ?? null;
  contador = 0;
  tabelas = opcoes.tabelas ?? {};
}

/** Leitura: filtros eq/in/is; devolve SÓ as colunas do select (coluna não pedida não aparece). */
function leitura(tabela: string, colunasTexto: string) {
  const colunas = colunasTexto.split(",").map((c) => c.trim()).filter(Boolean);
  selects.push({ tabela, colunas });
  const filtros: ((l: Record<string, unknown>) => boolean)[] = [];
  const resultado = () => (tabelas[tabela] ?? [])
    .filter((l) => filtros.every((f) => f(l)))
    .map((l) => Object.fromEntries(colunas.filter((c) => c in l).map((c) => [c, l[c]])));
  const q = {
    eq(c: string, v: unknown) { filtros.push((l) => l[c] === v); return q; },
    in(c: string, vs: unknown[]) { filtros.push((l) => vs.includes(l[c])); return q; },
    is(c: string, v: unknown) { filtros.push((l) => (l[c] ?? null) === v); return q; },
    order() { return q; },
    maybeSingle: () => Promise.resolve({ data: resultado()[0] ?? null, error: null }),
    single: () => Promise.resolve({ data: resultado()[0] ?? null, error: null }),
    then: (ok: (v: unknown) => unknown, erro?: (e: unknown) => unknown) => Promise.resolve({ data: resultado(), error: null }).then(ok, erro),
  };
  return q;
}

const resposta = (tabela: string, data: unknown) =>
  Promise.resolve(falharEm === tabela ? { data: null, error: { message: `falha ${tabela}` } } : { data, error: null });

export const supabase = {
  from(tabela: string) {
    return {
      select: (colunas: string) => leitura(tabela, colunas),
      insert(linha: Record<string, unknown>) {
        chamadas.push({ tabela, op: "insert", linha });
        const id = `${tabela}-${++contador}`;
        return { select: () => ({ single: () => resposta(tabela, { id }) }) };
      },
      update(linha: Record<string, unknown>) {
        return {
          eq(coluna: string, valor: unknown) {
            chamadas.push({ tabela, op: "update", linha, filtro: [coluna, valor] });
            return resposta(tabela, null);
          },
        };
      },
      upsert(linha: Record<string, unknown>) {
        chamadas.push({ tabela, op: "upsert", linha });
        return resposta(tabela, null);
      },
    };
  },
};
