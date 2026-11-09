// node --test src/lib/multiempresas/espelhoRegrasFinanceiras.test.ts
// Trava do espelho: as Edge Functions não importam de src/, então as regras
// financeiras do Dashboard foram COPIADAS para supabase/functions/_shared/.
// Este teste falha se alguém mudar um lado e esquecer o outro.
// Para atualizar: copie de novo (cp src/lib/<arquivo> supabase/functions/_shared/).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

const ESPELHOS = ["vendasFinanceiras.ts", "dataBrasilia.ts"];

for (const nome of ESPELHOS) {
  test(`_shared/${nome} é cópia byte a byte de src/lib/${nome}`, () => {
    const original = readFileSync(join(RAIZ, "src", "lib", nome));
    const copia = readFileSync(join(RAIZ, "supabase", "functions", "_shared", nome));
    assert.ok(original.equals(copia), `supabase/functions/_shared/${nome} divergiu de src/lib/${nome}`);
  });
}

test("a cópia só importa a outra cópia (nada de src/ nem de alias @/)", () => {
  const s = readFileSync(join(RAIZ, "supabase", "functions", "_shared", "vendasFinanceiras.ts"), "utf8");
  const imports = [...s.matchAll(/^import .* from "([^"]+)";$/gm)].map((m) => m[1]);
  assert.deepEqual(imports, ["./dataBrasilia.ts"]);
  assert.ok(!readFileSync(join(RAIZ, "supabase", "functions", "_shared", "dataBrasilia.ts"), "utf8").includes('from "'));
});
