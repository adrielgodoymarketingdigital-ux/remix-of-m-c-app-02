// deno test --allow-env supabase/functions/_shared/pagarmeAssinatura.test.ts
import { assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import { bancoFake } from "./testes/bancoFake.ts";
import { avisarAdmin } from "./pagarmeAssinatura.ts";

type Linha = Record<string, unknown>;

const AVISO = {
  tipo: "cancelamento_pagarme_falhou",
  titulo: "Cancelamento falhou",
  mensagem: "Cancele a assinatura sub_X",
  dados: { user_id: "u1", email: "cliente@exemplo.com", subscription_id: "sub_X" },
};

/** Captura o console.error durante `fn`. */
async function comConsoleError(fn: () => Promise<unknown>) {
  const original = console.error;
  const linhas: string[] = [];
  console.error = (...args: unknown[]) => linhas.push(args.map(String).join(" "));
  try {
    const r = await fn();
    return { r, linhas };
  } finally {
    console.error = original;
  }
}

Deno.test("avisarAdmin: banco recusa (CHECK do tipo) → registra no log, não lança e devolve false", async () => {
  const tabelas: Record<string, Linha[]> = { admin_notifications: [] };
  const db = bancoFake(tabelas, (tabela, op) =>
    tabela === "admin_notifications" && op === "insert"
      ? 'new row for relation "admin_notifications" violates check constraint "admin_notifications_tipo_check"'
      : null
  );

  const { r, linhas } = await comConsoleError(() => avisarAdmin(db, AVISO));

  assertEquals(r, false);
  assertEquals(tabelas.admin_notifications.length, 0);
  assertEquals(linhas.length, 1);
  assertStringIncludes(linhas[0], "Aviso ao admin não gravado");
  assertStringIncludes(linhas[0], "cancelamento_pagarme_falhou");
  assertStringIncludes(linhas[0], "admin_notifications_tipo_check");
  // Nada dos dados do aviso vai para o log.
  assertEquals(linhas[0].includes("cliente@exemplo.com"), false);
  assertEquals(linhas[0].includes("sub_X"), false);
});

Deno.test("avisarAdmin: erro com code e details → loga code e mensagem, nunca details", async () => {
  const db = {
    from: () => ({
      insert: () =>
        Promise.resolve({
          data: null,
          error: {
            code: "23514",
            message: "violates check constraint",
            details: "Failing row contains (cliente@exemplo.com, sub_X)",
          },
        }),
    }),
  };

  const { r, linhas } = await comConsoleError(() => avisarAdmin(db, AVISO));

  assertEquals(r, false);
  assertEquals(linhas.length, 1);
  assertStringIncludes(linhas[0], "23514 violates check constraint");
  assertEquals(linhas[0].includes("Failing row"), false);
  assertEquals(linhas[0].includes("cliente@exemplo.com"), false);
});

Deno.test("avisarAdmin: cliente que lança (rede) → registra no log e não lança", async () => {
  const db = { from: () => ({ insert: () => Promise.reject(new Error("fetch failed")) }) };

  const { r, linhas } = await comConsoleError(() => avisarAdmin(db, AVISO));

  assertEquals(r, false);
  assertEquals(linhas.length, 1);
  assertStringIncludes(linhas[0], "fetch failed");
});

Deno.test("avisarAdmin: gravou → devolve true e não registra erro", async () => {
  const tabelas: Record<string, Linha[]> = { admin_notifications: [] };
  const db = bancoFake(tabelas);

  const { r, linhas } = await comConsoleError(() => avisarAdmin(db, AVISO));

  assertEquals(r, true);
  assertEquals(linhas.length, 0);
  assertEquals(tabelas.admin_notifications.length, 1);
  assertEquals(tabelas.admin_notifications[0].tipo, "cancelamento_pagarme_falhou");
});
