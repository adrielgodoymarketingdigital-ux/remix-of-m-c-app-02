import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIdentidade } from "@/hooks/useResolvedUserId";
import type { CandidatoEstoque } from "@/lib/nfe/sugestaoVinculo";

/** Por tabela (produtos e pecas). Passou disso, a tela avisa que a lista foi cortada. */
export const LIMITE_CANDIDATOS_POR_TABELA = 5000;
// O PostgREST do Supabase devolve no máximo 1000 linhas por requisição.
const TAMANHO_PAGINA = 1000;

export interface CandidatosVinculoXml {
  candidatos: CandidatoEstoque[];
  /** true quando alguma tabela tinha mais que o limite (sugestões podem faltar). */
  truncado: boolean;
  carregando: boolean;
  erro: boolean;
}

type Tabela = "produtos" | "pecas";
interface LinhaCandidato {
  id: string;
  nome: string;
  variacao_label: string | null;
  sku?: string | null;
  codigo_barras: string | null;
  quantidade: number | null;
  custo: number | null;
}

async function carregarTabela(tabela: Tabela, userId: string, empresaId: string | null, isFilial: boolean) {
  // Só os campos que a sugestão e a previsão de custo usam. Mesmo escopo da
  // listagem de Produtos (useProdutos.carregarTodos): dono + empresa (filial
  // exata; matriz inclui empresa_id nulo dos registros antigos).
  const colunas = tabela === "produtos"
    ? "id, nome, variacao_label, sku, codigo_barras, quantidade, custo"
    : "id, nome, variacao_label, codigo_barras, quantidade, custo";
  const linhas: LinhaCandidato[] = [];
  for (let pagina = 0; linhas.length <= LIMITE_CANDIDATOS_POR_TABELA; pagina++) {
    let q = supabase
      .from(tabela)
      .select(colunas)
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("nome")
      .order("id")
      .range(pagina * TAMANHO_PAGINA, pagina * TAMANHO_PAGINA + TAMANHO_PAGINA - 1);
    if (empresaId) {
      q = isFilial ? q.eq("empresa_id", empresaId) : q.or(`empresa_id.eq.${empresaId},empresa_id.is.null`);
    }
    const { data, error } = await q;
    if (error) throw error;
    linhas.push(...((data ?? []) as unknown as LinhaCandidato[]));
    if (!data || data.length < TAMANHO_PAGINA) break;
  }
  const truncado = linhas.length > LIMITE_CANDIDATOS_POR_TABELA;
  const candidatos: CandidatoEstoque[] = linhas.slice(0, LIMITE_CANDIDATOS_POR_TABELA).map((l) => ({
    id: l.id,
    tipo: tabela === "produtos" ? "produto" : "peca",
    nome: l.nome,
    variacaoLabel: l.variacao_label ?? null,
    sku: l.sku ?? null,
    codigoBarras: l.codigo_barras ?? null,
    quantidade: Number(l.quantidade ?? 0),
    custo: l.custo === null || l.custo === undefined ? null : Number(l.custo),
  }));
  return { candidatos, truncado };
}

/**
 * Produtos e peças do estoque para sugerir vínculo na importação de XML de
 * compra. SOMENTE LEITURA (SELECT sob a RLS atual). Carrega ao abrir a página
 * (antes de escolher o arquivo), para a leitura do XML seguir sem requisição.
 */
export function useCandidatosVinculoXml(habilitado: boolean): CandidatosVinculoXml {
  const { userId, empresaId, isFilial, carregando: carregandoIdentidade } = useIdentidade();
  const query = useQuery({
    queryKey: ["xml-compra-candidatos", userId, empresaId, isFilial],
    enabled: habilitado && !carregandoIdentidade && !!userId,
    staleTime: 60_000,
    queryFn: async () => {
      const [produtos, pecas] = await Promise.all([
        carregarTabela("produtos", userId as string, empresaId, isFilial),
        carregarTabela("pecas", userId as string, empresaId, isFilial),
      ]);
      return {
        candidatos: [...produtos.candidatos, ...pecas.candidatos],
        truncado: produtos.truncado || pecas.truncado,
      };
    },
  });
  return {
    candidatos: query.data?.candidatos ?? [],
    truncado: query.data?.truncado ?? false,
    carregando: query.isLoading || (habilitado && carregandoIdentidade),
    erro: query.isError,
  };
}
