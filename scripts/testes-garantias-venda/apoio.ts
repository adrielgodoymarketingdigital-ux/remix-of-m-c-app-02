// Apoio dos testes da fase B de "Minhas garantias" (node --test, Node 23+).
// Dados 100% fictícios; nada sai da máquina (o fetch do supabase-js é simulado).
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { transformSync } from "esbuild";
import { createClient } from "@supabase/supabase-js";

export const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

/** Fonte do arquivo na branch (disco) ou na origin/main (git show). */
export function fonte(caminho: string, versao: "branch" | "main"): string {
  if (versao === "branch") return readFileSync(join(RAIZ, caminho), "utf8");
  return execSync(`git --no-pager show origin/main:${caminho}`, { cwd: RAIZ, encoding: "utf8", maxBuffer: 20 * 1024 * 1024 });
}

/** Trecho entre `inicio` (incluído) e o `fim` balanceado de chaves a partir do 1º "{" depois de inicio. */
export function objetoLiteral(codigo: string, inicio: string, aPartirDe = 0): string {
  const i = codigo.indexOf(inicio, aPartirDe);
  if (i < 0) throw new Error(`não achei: ${inicio}`);
  const abre = codigo.indexOf("{", i + inicio.length - 1);
  let nivel = 0;
  for (let j = abre; j < codigo.length; j++) {
    if (codigo[j] === "{") nivel++;
    else if (codigo[j] === "}" && --nivel === 0) return codigo.slice(abre, j + 1);
  }
  throw new Error("chaves não fecham");
}

/** Escopo para `with`: só os nomes fornecidos (e globais de verdade); outro nome = erro (o teste não esqueceu nada). */
function escopoEstrito(valores: Record<string, unknown>) {
  return new Proxy(valores, {
    has: () => true,
    get(alvo, chave) {
      if (chave === Symbol.unscopables) return undefined;
      if (typeof chave === "string" && chave in alvo) return alvo[chave];
      if (typeof chave === "string" && chave in globalThis) return (globalThis as Record<string, unknown>)[chave];
      throw new ReferenceError(`identificador não fornecido ao trecho: ${String(chave)}`);
    },
  });
}

/** Avalia um objeto literal TypeScript com os nomes do escopo. */
export function avaliarObjeto(literalTs: string, escopo: Record<string, unknown>): Record<string, unknown> {
  const { code } = transformSync(`(${literalTs})`, { loader: "ts" });
  // eslint-disable-next-line no-new-func
  return new Function("escopo", `with (escopo) { return ${code.trim().replace(/;$/, "")}; }`)(escopoEstrito(escopo));
}

/** Avalia um bloco de código TypeScript assíncrono e devolve `retorno`. */
export async function avaliarBloco(blocoTs: string, retorno: string, escopo: Record<string, unknown>): Promise<unknown> {
  const { code } = transformSync(`async function __trecho() {\n${blocoTs}\nreturn ${retorno};\n}`, { loader: "ts" });
  // eslint-disable-next-line no-new-func
  return new Function("escopo", `with (escopo) { ${code}\n return __trecho(); }`)(escopoEstrito(escopo));
}

// ── PostgREST simulado para garantias_textos_venda ──────────────────────────

export interface Requisicao { metodo: string; caminho: string; busca: string; corpo: unknown }
export interface OpcoesSimulado {
  /** Textos que já existem: { id, user_id, texto }. */
  existentes?: { id: string; user_id: string; texto: string; texto_md5?: string }[];
  /** "erro500" = INSERT falha; "corrida" = outro grava o mesmo texto entre a busca e o insert (409/23505). */
  falhaInsert?: "erro500" | "corrida";
  /** A leitura falha (rede/RLS). */
  falhaBusca?: boolean;
}

export function supabaseSimulado(op: OpcoesSimulado = {}) {
  // texto_md5 explícito = simular colisão (mesmo md5, texto diferente)
  const linhas = (op.existentes ?? []).map((l) => ({ ...l, texto_md5: l.texto_md5 ?? createHash("md5").update(l.texto, "utf8").digest("hex") }));
  const log: Requisicao[] = [];
  let seq = 0;
  const json = (status: number, corpo: unknown) => new Response(JSON.stringify(corpo), { status, headers: { "content-type": "application/json" } });
  const fetchSimulado = async (entrada: string | URL | Request, init?: RequestInit) => {
    const url = new URL(typeof entrada === "string" ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
    const metodo = (init?.method ?? "GET").toUpperCase();
    const corpo = init?.body ? JSON.parse(String(init.body)) : null;
    log.push({ metodo, caminho: url.pathname, busca: url.search, corpo });
    if (!url.pathname.endsWith("/rest/v1/garantias_textos_venda")) return json(404, { message: `tabela não simulada: ${url.pathname}` });
    if (metodo === "GET") {
      if (op.falhaBusca) return json(500, { message: "erro simulado na leitura", code: "XX000" });
      const uid = url.searchParams.get("user_id")?.replace(/^eq\./, "");
      const md5 = url.searchParams.get("texto_md5")?.replace(/^eq\./, "");
      return json(200, linhas.filter((l) => l.user_id === uid && l.texto_md5 === md5).slice(0, 1).map(({ id, texto }) => ({ id, texto })));
    }
    if (metodo === "POST") {
      const nova = Array.isArray(corpo) ? corpo[0] : corpo;
      const md5 = createHash("md5").update(nova.texto, "utf8").digest("hex");
      if (op.falhaInsert === "erro500") return json(500, { message: "erro simulado no insert", code: "XX000" });
      if (op.falhaInsert === "corrida" && !linhas.some((l) => l.user_id === nova.user_id && l.texto_md5 === md5)) {
        linhas.push({ id: "texto-da-outra-venda", user_id: nova.user_id, texto: nova.texto, texto_md5: md5 });
      }
      if (linhas.some((l) => l.user_id === nova.user_id && l.texto_md5 === md5)) {
        return json(409, { code: "23505", message: "duplicate key value violates unique constraint \"uq_garantias_textos_venda_dono_md5\"" });
      }
      const id = `texto-${++seq}`;
      linhas.push({ id, user_id: nova.user_id, texto: nova.texto, texto_md5: md5 });
      return json(201, { id });
    }
    return json(405, { message: `método não permitido no simulado: ${metodo}` });
  };
  const cliente = createClient("http://supabase-simulado.local", "chave-ficticia", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: fetchSimulado as typeof fetch },
  });
  return { cliente, log, linhas };
}
