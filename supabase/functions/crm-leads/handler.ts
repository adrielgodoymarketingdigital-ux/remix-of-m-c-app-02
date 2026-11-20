// Edge Function crm-leads — lógica do pedido, sem Deno.serve e sem cliente
// Supabase (recebidos por parâmetro), para o deno test rodar sem rede.
// Contrato: docs/crm-leads/CONTRATO.md.
//
// - Autenticação só pelo header x-crm-secret == secret CRM_N8N_SECRET
//   (>= 32 caracteres). Sem JWT, sem CORS: só servidor-a-servidor (n8n).
// - Grava SÓ pelas funções crm_* (service_role); nenhuma escrita direta.
// - Nunca loga telefone, nome ou texto: só contagens e códigos de erro.
// - A chave da Evolution e a da IA NÃO passam por aqui (ficam no n8n).

import { lerEnvelope, MAX_BYTES, MAX_ITENS, normalizarMensagem, segredoConfere } from "./contrato.ts";
import { normalizarTelefone } from "./telefone.ts";

export interface RpcCliente {
  rpc(fn: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: { code?: string } | null }>;
}

export interface Dependencias {
  segredo: string | undefined;
  db: () => RpcCliente;
  hojeBrasilia: () => string;
  log?: (msg: string, dados: Record<string, unknown>) => void;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const json = (status: number, corpo: unknown) =>
  new Response(JSON.stringify(corpo), { status, headers: { "Content-Type": "application/json" } });

class ErroBanco extends Error {
  constructor(readonly codigo: string) { super(codigo); }
}

async function chamar(db: RpcCliente, fn: string, args?: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await db.rpc(fn, args);
  if (error) throw new ErroBanco(error.code ?? "desconhecido");
  return data;
}

export function criarHandler(dep: Dependencias): (req: Request) => Promise<Response> {
  const log = dep.log ?? ((msg, dados) => console.log(msg, dados));

  return async (req: Request) => {
    if (req.method !== "POST") return json(405, { erro: "metodo_invalido" });
    if (!dep.segredo || dep.segredo.length < 32) return json(503, { erro: "nao_configurado" });
    if (!(await segredoConfere(req.headers.get("x-crm-secret"), dep.segredo))) {
      return json(401, { erro: "nao_autorizado" });
    }

    const bruto = await req.text();
    if (new TextEncoder().encode(bruto).length > MAX_BYTES) {
      return json(413, { erro: "corpo_grande", max_bytes: MAX_BYTES });
    }
    let corpo: unknown;
    try { corpo = JSON.parse(bruto); } catch { return json(400, { erro: "json_invalido" }); }

    const env = lerEnvelope(corpo);
    if (!env.ok) {
      return json(env.status, env.status === 413 ? { erro: env.erro, max_itens: MAX_ITENS } : { erro: env.erro });
    }

    const db = dep.db();
    try {
      switch (env.acao) {
        case "mensagens": {
          const validas: unknown[] = [];
          const mapa: number[] = []; // índice no lote do banco -> índice original
          const rejeitadas: { indice: number; erro: string }[] = [];
          env.itens.forEach((item, i) => {
            const r = normalizarMensagem(item);
            if (r.ok) { mapa.push(i); validas.push(r.valor); } else rejeitadas.push({ indice: i, erro: r.erro });
          });
          let banco = { inseridas: 0, duplicadas: 0, opt_outs: 0, rejeitadas: [] as { indice: number; erro: string }[] };
          if (validas.length > 0) banco = await chamar(db, "crm_ingerir_mensagens", { p_itens: validas }) as typeof banco;
          for (const r of banco.rejeitadas ?? []) rejeitadas.push({ indice: mapa[r.indice], erro: r.erro });
          rejeitadas.sort((a, b) => a.indice - b.indice);
          log("[crm-leads] mensagens", {
            recebidas: env.itens.length, inseridas: banco.inseridas, duplicadas: banco.duplicadas,
            rejeitadas: rejeitadas.length, opt_outs: banco.opt_outs,
          });
          return json(200, {
            ok: true, recebidas: env.itens.length, inseridas: banco.inseridas,
            duplicadas: banco.duplicadas, opt_outs: banco.opt_outs, rejeitadas,
          });
        }

        case "resumo": {
          const itens: unknown[] = [];
          const rejeitadas: { indice: number; erro: string }[] = [];
          env.itens.forEach((it, i) => {
            const o = (typeof it === "object" && it !== null ? it : {}) as Record<string, unknown>;
            const tel = normalizarTelefone(typeof o.telefone === "string" ? o.telefone : null);
            if (!tel) { rejeitadas.push({ indice: i, erro: "telefone_invalido" }); return; }
            itens.push({
              telefone: tel,
              assunto: typeof o.assunto === "string" ? o.assunto.slice(0, 120) : null,
              resumo: typeof o.resumo === "string" ? o.resumo.slice(0, 1500) : null,
              etapa: typeof o.etapa === "string" ? o.etapa : null,
            });
          });
          const data = itens.length > 0
            ? await chamar(db, "crm_atualizar_resumo", { p_itens: itens }) as Record<string, number>
            : { atualizados: 0, nao_encontrados: 0 };
          return json(200, { ok: true, ...data, rejeitadas });
        }

        case "vincular": {
          const resultados: string[] = [];
          for (const it of env.itens) {
            const o = (typeof it === "object" && it !== null ? it : {}) as Record<string, unknown>;
            const tel = normalizarTelefone(typeof o.telefone === "string" ? o.telefone : null);
            const uid = typeof o.user_id === "string" && UUID.test(o.user_id) ? o.user_id : null;
            if (!tel || !uid) { resultados.push("invalido"); continue; }
            resultados.push(await chamar(db, "crm_vincular_usuario", { p_telefone: tel, p_user_id: uid }) as string);
          }
          log("[crm-leads] vincular", { itens: env.itens.length, vinculados: resultados.filter((r) => r === "vinculado").length });
          return json(200, { ok: true, resultados });
        }

        case "vincular_lote": {
          const dias = Number(env.params.dias ?? 120);
          if (!Number.isInteger(dias) || dias < 1 || dias > 400) return json(400, { erro: "dias_invalido" });
          const data = await chamar(db, "crm_vincular_cadastros", { p_dias: dias }) as Record<string, number>;
          log("[crm-leads] vincular_lote", data);
          return json(200, { ok: true, ...data });
        }

        case "opt_out": {
          let registrados = 0;
          const rejeitadas: { indice: number; erro: string }[] = [];
          for (const [i, it] of env.itens.entries()) {
            const o = (typeof it === "object" && it !== null ? it : {}) as Record<string, unknown>;
            const tel = normalizarTelefone(typeof o.telefone === "string" ? o.telefone : null);
            if (!tel) { rejeitadas.push({ indice: i, erro: "telefone_invalido" }); continue; }
            await chamar(db, "crm_registrar_opt_out", { p_telefone: tel, p_origem: "n8n" });
            registrados++;
          }
          log("[crm-leads] opt_out", { registrados, rejeitadas: rejeitadas.length });
          return json(200, { ok: true, registrados, rejeitadas });
        }

        case "retencao": {
          const data = await chamar(db, "crm_aplicar_retencao") as Record<string, number>;
          log("[crm-leads] retencao", data);
          return json(200, { ok: true, ...data });
        }

        case "relatorio": {
          const p = env.params.dia;
          if (p !== undefined && (typeof p !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(p) || Number.isNaN(Date.parse(p)))) {
            return json(400, { erro: "dia_invalido" });
          }
          const dia = typeof p === "string" ? p : dep.hojeBrasilia();
          const data = await chamar(db, "crm_relatorio_diario", { p_dia: dia });
          return json(200, { ok: true, relatorio: data });
        }
      }
    } catch (e) {
      // Só o código do Postgres/PostgREST; nunca o payload.
      const codigo = e instanceof ErroBanco ? e.codigo : "desconhecido";
      console.error("[crm-leads] erro", env.acao, codigo);
      return json(500, { erro: "interno", codigo });
    }
    return json(400, { erro: "acao_invalida" });
  };
}
