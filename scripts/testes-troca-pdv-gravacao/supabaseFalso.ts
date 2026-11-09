// Banco falso em memória para registrarEntradaTroca (só dados fictícios; nada vai à rede).
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

export function reiniciarBanco(opcoes: { falharEm?: string } = {}) {
  chamadas.length = 0;
  falharEm = opcoes.falharEm ?? null;
  contador = 0;
}

const resposta = (tabela: string, data: unknown) =>
  Promise.resolve(falharEm === tabela ? { data: null, error: { message: `falha ${tabela}` } } : { data, error: null });

export const supabase = {
  from(tabela: string) {
    return {
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
