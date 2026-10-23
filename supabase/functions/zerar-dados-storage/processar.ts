// Fluxo de zerar-dados-storage com as dependências injetadas (token -> usuário,
// fila, Storage, relógio) para os testes simularem cada caso sem rede
// (processar.test.ts). index.ts só liga isto aos clientes reais (adaptador.ts).
import { corsHeaders } from "../_shared/cors.ts";

/** Únicos buckets de onde este recurso remove arquivos. Logo, catálogo e admin nunca. */
export const BUCKETS_PERMITIDOS = [
  "dispositivos-fotos",
  "produtos-fotos",
  "compras-fotos",
  "compras-documentos",
  "origem-documentos",
  "termos-compra",
  "notas-compra-xml",
] as const;

export const TAMANHO_LOTE = 100;
export const MAX_TENTATIVAS = 3;
export const ORCAMENTO_MS_PADRAO = 25_000;
const MAX_CORPO_BYTES = 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type Situacao = "pendente" | "removido" | "mantido_em_uso" | "ignorado" | "falhou";
export interface ArquivoFila {
  id: string;
  bucket: string;
  caminho: string;
  tentativas: number;
}
export interface Execucao {
  id: string;
  user_id: string;
  storage_status: string;
}
export interface CamposArquivo {
  situacao?: Situacao;
  removido_em?: string;
  tentativas?: number;
  erro?: string | null;
}

export interface Dependencias {
  /** user_id dono do JWT, ou null se o token não vale. */
  usuarioDoToken: (token: string) => Promise<string | null>;
  buscarExecucao: (id: string) => Promise<Execucao | null>;
  /** RPC zerar_dados_marcar_em_uso: marca o que ainda é citado por dado que ficou. */
  marcarEmUso: (execucaoId: string) => Promise<number>;
  listarPendentes: (execucaoId: string, limite: number) => Promise<ArquivoFila[]>;
  /** Remove pela API do Storage. Arquivo que já não existe não é erro. */
  removerDoStorage: (bucket: string, caminhos: string[]) => Promise<{ ok: true } | { ok: false; erro: string }>;
  atualizarArquivos: (ids: string[], campos: CamposArquivo) => Promise<void>;
  contarPorSituacao: (execucaoId: string) => Promise<Record<Situacao, number>>;
  atualizarStatusExecucao: (execucaoId: string, status: "pendente" | "concluido" | "erro") => Promise<void>;
  agora?: () => number;
  orcamentoMs?: number;
  log?: (passo: string, detalhes?: unknown) => void;
}

const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

/** Lê { execucao_id } com limite de tamanho; null se inválido. */
async function lerCorpo(req: Request): Promise<string | null> {
  const declarado = Number(req.headers.get("Content-Length") ?? "0");
  if (declarado > MAX_CORPO_BYTES) return null;
  const texto = await req.text();
  if (new TextEncoder().encode(texto).length > MAX_CORPO_BYTES) return null;
  try {
    const corpo = JSON.parse(texto) as unknown;
    if (!corpo || typeof corpo !== "object" || Array.isArray(corpo)) return null;
    const chaves = Object.keys(corpo);
    const id = (corpo as Record<string, unknown>).execucao_id;
    if (chaves.length !== 1 || typeof id !== "string" || !UUID.test(id)) return null;
    return id.toLowerCase();
  } catch {
    return null;
  }
}

export function criarHandler(deps: Dependencias) {
  const log = deps.log ?? (() => {});
  const agora = deps.agora ?? (() => Date.now());
  const orcamento = deps.orcamentoMs ?? ORCAMENTO_MS_PADRAO;
  const permitidos = new Set<string>(BUCKETS_PERMITIDOS);

  return async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
    if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

    const inicio = agora();
    try {
      const auth = req.headers.get("Authorization") ?? "";
      const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
      if (!token) return json({ error: "Não autorizado" }, 401);
      // user_id SEMPRE do token, nunca do corpo.
      const userId = await deps.usuarioDoToken(token);
      if (!userId) return json({ error: "Não autorizado" }, 401);

      const execucaoId = await lerCorpo(req);
      if (!execucaoId) return json({ error: "Corpo inválido: envie { execucao_id }." }, 400);

      // Execução de outra pessoa responde igual a inexistente (não vaza que existe).
      const execucao = await deps.buscarExecucao(execucaoId);
      if (!execucao || execucao.user_id !== userId) return json({ error: "Execução não encontrada" }, 404);

      const emUso = await deps.marcarEmUso(execucaoId);
      let removidosAgora = 0;
      let parouPorTempo = false;

      while (true) {
        if (agora() - inicio >= orcamento) {
          parouPorTempo = true;
          break;
        }
        const lote = await deps.listarPendentes(execucaoId, TAMANHO_LOTE);
        if (lote.length === 0) break;

        const fora = lote.filter((a) => !permitidos.has(a.bucket));
        if (fora.length) {
          await deps.atualizarArquivos(fora.map((a) => a.id), { situacao: "ignorado", erro: "bucket_nao_permitido" });
          log("ignorados (bucket fora da lista)", { execucaoId, quantidade: fora.length });
        }

        const porBucket = new Map<string, ArquivoFila[]>();
        for (const a of lote) if (permitidos.has(a.bucket)) porBucket.set(a.bucket, [...(porBucket.get(a.bucket) ?? []), a]);

        let falhouNesteLote = false;
        for (const [bucket, arquivos] of porBucket) {
          const r = await deps.removerDoStorage(bucket, arquivos.map((a) => a.caminho));
          if (r.ok) {
            await deps.atualizarArquivos(arquivos.map((a) => a.id), { situacao: "removido", removido_em: new Date(agora()).toISOString(), erro: null });
            removidosAgora += arquivos.length;
          } else {
            falhouNesteLote = true;
            // Agrupa por tentativas para gravar o novo número de uma vez.
            const porTentativa = new Map<number, string[]>();
            for (const a of arquivos) porTentativa.set(a.tentativas + 1, [...(porTentativa.get(a.tentativas + 1) ?? []), a.id]);
            for (const [t, ids] of porTentativa) {
              await deps.atualizarArquivos(ids, {
                tentativas: t,
                situacao: t >= MAX_TENTATIVAS ? "falhou" : "pendente",
                erro: "falha_remocao_storage",
              });
            }
            // Sem caminho nem mensagem crua do Storage no log.
            log("falha ao remover lote", { execucaoId, bucket, quantidade: arquivos.length });
          }
        }
        // Falhou: para por aqui; a próxima chamada tenta de novo (até MAX_TENTATIVAS por arquivo).
        if (falhouNesteLote) break;
      }

      const c = await deps.contarPorSituacao(execucaoId);
      const restantes = c.pendente;
      const status = restantes > 0 ? "pendente" : c.falhou > 0 ? "erro" : "concluido";
      if (status !== execucao.storage_status && execucao.storage_status !== "sem_arquivos") {
        await deps.atualizarStatusExecucao(execucaoId, status);
      }
      log("fim", { execucaoId, removidosAgora, emUso, restantes, status, parouPorTempo, ms: agora() - inicio });

      return json({
        execucao_id: execucaoId,
        removidos: c.removido,
        mantidos_em_uso: c.mantido_em_uso,
        ignorados: c.ignorado,
        falharam: c.falhou,
        restantes,
        concluido: restantes === 0,
      });
    } catch (err) {
      log("erro", { message: err instanceof Error ? err.message : String(err) });
      return json({ error: "Não foi possível remover os arquivos agora. Tente de novo." }, 500);
    }
  };
}
