// deno test supabase/functions/hotmart-webhook/avisos.test.ts
import { assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import { type AvisoAdmin, type ClienteAvisos, registrarAviso } from "./avisos.ts";

const AVISO: AvisoAdmin = {
  tipo: "hotmart_oferta_nao_mapeada",
  titulo: "Hotmart: oferta não mapeada",
  mensagem: "Evento PURCHASE_APPROVED de comprador@exemplo.com com a oferta x",
  dados: { email: "comprador@exemplo.com", transaction_id: "HP-1" },
};

function cliente(insert: (a: AvisoAdmin) => PromiseLike<{ error: { code?: string; message: string } | null }>) {
  const gravados: AvisoAdmin[] = [];
  const c: ClienteAvisos = {
    from: () => ({ insert: (a) => { gravados.push(a); return insert(a); } }),
  };
  return { c, gravados };
}

async function capturarErros(fn: () => Promise<void>) {
  const linhas: string[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => linhas.push(args.map((a) => typeof a === "string" ? a : JSON.stringify(a)).join(" "));
  try {
    await fn();
  } finally {
    console.error = original;
  }
  return linhas;
}

Deno.test("aviso gravado: insert recebe o aviso inteiro e nada vai para o log de erro", async () => {
  const { c, gravados } = cliente(() => Promise.resolve({ error: null }));
  const erros = await capturarErros(() => registrarAviso(c, AVISO));
  assertEquals(gravados, [AVISO]);
  assertEquals(erros, []);
});

Deno.test("insert recusado pelo CHECK: não lança, loga tipo e motivo sem dado pessoal", async () => {
  const { c } = cliente(() => Promise.resolve({ error: {
    code: "23514",
    message: 'new row for relation "admin_notifications" violates check constraint "admin_notifications_tipo_check"',
  } }));
  const erros = await capturarErros(() => registrarAviso(c, AVISO));
  assertEquals(erros.length, 1);
  assertStringIncludes(erros[0], "Aviso ao admin não gravado");
  assertStringIncludes(erros[0], "hotmart_oferta_nao_mapeada");
  assertStringIncludes(erros[0], "23514");
  assertStringIncludes(erros[0], "admin_notifications_tipo_check");
  assertEquals(erros[0].includes("comprador@exemplo.com"), false);
  assertEquals(erros[0].includes("HP-1"), false);
});

Deno.test("insert que lança (rede): não lança, loga tipo e motivo sem dado pessoal", async () => {
  const { c } = cliente(() => Promise.reject(new TypeError("error sending request: connection reset")));
  const erros = await capturarErros(() => registrarAviso(c, AVISO));
  assertEquals(erros.length, 1);
  assertStringIncludes(erros[0], "hotmart_oferta_nao_mapeada");
  assertStringIncludes(erros[0], "connection reset");
  assertEquals(erros[0].includes("comprador@exemplo.com"), false);
});

Deno.test("insert que lança na hora da chamada (sem promessa): também não lança", async () => {
  const c: ClienteAvisos = { from: () => { throw new Error("cliente quebrado"); } };
  const erros = await capturarErros(() => registrarAviso(c, AVISO));
  assertEquals(erros.length, 1);
  assertStringIncludes(erros[0], "cliente quebrado");
});
