// Apoio dos testes da cor do cabeçalho dos recibos (node --test, Node 23+).
// Dados 100% fictícios; nada sai da máquina (o fetch do supabase-js é simulado).
import { execSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";

export const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

let copiaMain: string | null = null;
/** Importa um módulo de src/ como está na origin/main (cópia de src/ numa pasta temporária). */
export async function importarDaMain<T>(caminho: string): Promise<T> {
  if (!copiaMain) {
    copiaMain = mkdtempSync(join(tmpdir(), "recibo-cor-main-"));
    execSync(`git archive origin/main src | tar -x -C "${copiaMain}"`, { cwd: RAIZ, stdio: "ignore" });
  }
  return (await import(pathToFileURL(join(copiaMain, caminho)).href)) as T;
}

// ── PostgREST simulado para configuracoes_loja (GET por user_id, PATCH por id) ──

export interface Linha { id: string; user_id: string; empresa_id: string | null; cores_personalizadas: unknown }
export interface Requisicao { metodo: string; busca: string; corpo: unknown }

export function supabaseSimulado(linhasIniciais: Linha[], op: { falhaLeitura?: boolean; falhaGravacao?: boolean } = {}) {
  const linhas = linhasIniciais.map((l) => structuredClone(l));
  const log: Requisicao[] = [];
  const json = (status: number, corpo: unknown) => new Response(corpo === null ? null : JSON.stringify(corpo), { status, headers: { "content-type": "application/json" } });
  const fetchSimulado = async (entrada: string | URL | Request, init?: RequestInit) => {
    const url = new URL(typeof entrada === "string" ? entrada : entrada instanceof URL ? entrada.href : entrada.url);
    const metodo = (init?.method ?? "GET").toUpperCase();
    const corpo = init?.body ? JSON.parse(String(init.body)) : null;
    log.push({ metodo, busca: decodeURIComponent(url.search), corpo });
    if (!url.pathname.endsWith("/rest/v1/configuracoes_loja")) return json(404, { message: "tabela não simulada" });
    const filtro = (l: Linha) => [...url.searchParams.entries()].every(([k, v]) => k === "select" || String((l as Record<string, unknown>)[k]) === v.replace(/^eq\./, ""));
    if (metodo === "GET") {
      if (op.falhaLeitura) return json(500, { message: "erro simulado na leitura", code: "XX000" });
      const cols = (url.searchParams.get("select") ?? "*").split(",").map((c) => c.trim());
      return json(200, linhas.filter(filtro).map((l) => Object.fromEntries(cols.map((c) => [c, (l as Record<string, unknown>)[c]]))));
    }
    if (metodo === "PATCH") {
      if (op.falhaGravacao) return json(500, { message: "erro simulado na gravação", code: "XX000" });
      for (const l of linhas.filter(filtro)) Object.assign(l, corpo);
      return json(204, null);
    }
    return json(405, { message: `método não simulado: ${metodo}` });
  };
  const cliente = createClient("http://supabase-simulado.local", "chave-ficticia", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: fetchSimulado as typeof fetch },
  });
  return { cliente, log, linhas };
}
