// Fluxo de fiscal-config-salvar, com as dependências injetadas (token -> usuário,
// has_role, banco) para os testes simularem cada caso sem rede (salvarConfig.test.ts).
// index.ts só liga isto aos clientes reais do Supabase.
import { corsHeaders } from "../_shared/cors.ts";
import { validarCorpo } from "./validarCorpo.ts";

export interface Dependencias {
  /** user_id dono do JWT, ou null se o token não vale. */
  usuarioDoToken: (token: string) => Promise<string | null>;
  /** has_role(user_id, 'admin'), conferido no servidor. */
  ehAdmin: (userId: string) => Promise<boolean>;
  /** Cliente service role (ou o bancoFake dos testes). */
  // deno-lint-ignore no-explicit-any
  db: { from: (tabela: string) => any };
  novoId?: () => string;
  log?: (passo: string, detalhes?: unknown) => void;
}

const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// Forçados em toda gravação nesta etapa: nada sai de homologação nem fica ativo.
const TRAVAS = { ambiente: "homologacao", ativo: false } as const;

export function criarHandler(deps: Dependencias) {
  const log = deps.log ?? (() => {});
  const novoId = deps.novoId ?? (() => crypto.randomUUID());

  const lerMatriz = async (userId: string) =>
    await deps.db.from("fiscal_config").select("*").eq("user_id", userId).is("empresa_id", null).maybeSingle();

  return async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
    if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

    try {
      const auth = req.headers.get("Authorization") ?? "";
      const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
      if (!token) return json({ error: "Não autorizado" }, 401);

      // user_id SEMPRE do token, nunca do corpo.
      const userId = await deps.usuarioDoToken(token);
      if (!userId) return json({ error: "Não autorizado" }, 401);
      if (!(await deps.ehAdmin(userId))) return json({ error: "Acesso negado" }, 403);

      let corpo: unknown;
      try {
        corpo = await req.json();
      } catch {
        return json({ error: "Corpo inválido: envie um objeto JSON." }, 400);
      }
      const validacao = validarCorpo(corpo);
      if (!validacao.ok) return json({ error: validacao.erro }, 400);

      // Upsert em (user_id, empresa_id nulo): o índice único usa COALESCE(empresa_id, ...),
      // que o on_conflict do PostgREST não alcança — então lê, e atualiza ou insere.
      const existente = await lerMatriz(userId);
      if (existente.error) throw new Error(existente.error.message);

      let id: string;
      if (existente.data) {
        id = existente.data.id;
        const up = await deps.db.from("fiscal_config").update({ ...validacao.dados, ...TRAVAS }).eq("id", id);
        if (up.error) throw new Error(up.error.message);
      } else {
        id = novoId();
        const ins = await deps.db.from("fiscal_config")
          .insert({ id, user_id: userId, empresa_id: null, ...validacao.dados, ...TRAVAS });
        if (ins.error) {
          // Duas abas salvando ao mesmo tempo: o índice único barrou a segunda; atualiza a que entrou.
          if (ins.error.code !== "23505") throw new Error(ins.error.message);
          const corrida = await lerMatriz(userId);
          if (corrida.error || !corrida.data) throw new Error(corrida.error?.message ?? ins.error.message);
          id = corrida.data.id;
          const up = await deps.db.from("fiscal_config").update({ ...validacao.dados, ...TRAVAS }).eq("id", id);
          if (up.error) throw new Error(up.error.message);
        }
      }

      const salvo = await deps.db.from("fiscal_config").select("*").eq("id", id).maybeSingle();
      if (salvo.error || !salvo.data) throw new Error(salvo.error?.message ?? "Configuração não encontrada após salvar");
      log("salvo", { userId, id, campos: Object.keys(validacao.dados) });
      return json({ config: salvo.data });
    } catch (err) {
      log("erro", { message: err instanceof Error ? err.message : String(err) });
      return json({ error: "Não foi possível salvar a configuração fiscal." }, 500);
    }
  };
}
