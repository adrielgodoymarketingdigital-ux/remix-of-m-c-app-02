// Liga as dependências de processar.ts ao Supabase real (cliente service role).
// Separado do index.ts para os testes conferirem as consultas (adaptador.test.ts).
import type { CamposArquivo, Dependencias, Situacao } from "./processar.ts";

type Resultado = { data: unknown; error: { message: string } | null; count?: number | null };
// Só o pedaço do supabase-js que usamos (o cliente real satisfaz; os testes simulam).
export interface ClienteSupabase {
  auth: { getUser: (token: string) => Promise<{ data: { user: { id: string } | null }; error: unknown }> };
  // deno-lint-ignore no-explicit-any
  from: (tabela: string) => any;
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<Resultado>;
  storage: { from: (bucket: string) => { remove: (caminhos: string[]) => Promise<{ data: unknown; error: unknown }> } };
}

const SITUACOES: Situacao[] = ["pendente", "removido", "mantido_em_uso", "ignorado", "falhou"];
const LOTE_UPDATE = 100; // ids por update (URL do PostgREST)

function falhou(r: Resultado, passo: string) {
  if (r.error) throw new Error(`${passo}: ${r.error.message}`);
}

export function criarDependencias(sb: ClienteSupabase): Omit<Dependencias, "agora" | "orcamentoMs" | "log"> {
  return {
    usuarioDoToken: async (token) => {
      const { data, error } = await sb.auth.getUser(token);
      return error || !data.user ? null : data.user.id;
    },

    buscarExecucao: async (id) => {
      const r = await sb.from("zerar_dados_execucoes").select("id, user_id, storage_status").eq("id", id).maybeSingle();
      falhou(r, "buscar execução");
      return (r.data as { id: string; user_id: string; storage_status: string } | null) ?? null;
    },

    marcarEmUso: async (execucaoId) => {
      const r = await sb.rpc("zerar_dados_marcar_em_uso", { p_execucao_id: execucaoId });
      falhou(r, "marcar em uso");
      return Number(r.data ?? 0);
    },

    listarPendentes: async (execucaoId, limite) => {
      const r = await sb.from("zerar_dados_arquivos").select("id, bucket, caminho, tentativas")
        .eq("execucao_id", execucaoId).eq("situacao", "pendente").order("id").limit(limite);
      falhou(r, "listar pendentes");
      return (r.data as { id: string; bucket: string; caminho: string; tentativas: number }[]) ?? [];
    },

    removerDoStorage: async (bucket, caminhos) => {
      try {
        // API do Storage (nunca DELETE em storage.objects). Arquivo inexistente não dá erro.
        const { error } = await sb.storage.from(bucket).remove(caminhos);
        return error ? { ok: false, erro: "storage" } : { ok: true };
      } catch {
        return { ok: false, erro: "rede" };
      }
    },

    atualizarArquivos: async (ids, campos: CamposArquivo) => {
      for (let i = 0; i < ids.length; i += LOTE_UPDATE) {
        const r = await sb.from("zerar_dados_arquivos").update(campos).in("id", ids.slice(i, i + LOTE_UPDATE));
        falhou(r, "atualizar fila");
      }
    },

    contarPorSituacao: async (execucaoId) => {
      const contagem = {} as Record<Situacao, number>;
      for (const s of SITUACOES) {
        const r = await sb.from("zerar_dados_arquivos").select("id", { count: "exact", head: true })
          .eq("execucao_id", execucaoId).eq("situacao", s);
        falhou(r, "contar fila");
        contagem[s] = r.count ?? 0;
      }
      return contagem;
    },

    atualizarStatusExecucao: async (execucaoId, status) => {
      const r = await sb.from("zerar_dados_execucoes").update({ storage_status: status }).eq("id", execucaoId);
      falhou(r, "atualizar execução");
    },
  };
}
