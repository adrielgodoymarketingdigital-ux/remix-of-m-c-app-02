// deno test -A --no-check src/lib/ordemServico/textoAceiteEntrega.test.ts
// Aceite da entrega da OS: o texto segue o prazo de garantia da OS, nunca 90 fixo.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { textoAceiteEntrega } from "./textoAceiteEntrega.ts";

const RAIZ = new URL("../../../", import.meta.url);
const ler = (caminho: string) => readFileSync(new URL(caminho, RAIZ), "utf8");

const TEXTO_ANTIGO_90 =
  "Declaro ter recebido o dispositivo nas condições descritas acima e estou ciente do termo de garantia de 90 dias para o serviço executado.";
const TEXTO_SEM_GARANTIA =
  "Declaro ter recebido o dispositivo nas condições descritas acima e estou ciente de que este serviço não possui garantia.";

test("null, undefined, 0, NaN e negativo => sem garantia", () => {
  for (const valor of [null, undefined, 0, Number.NaN, -5]) {
    assert.equal(textoAceiteEntrega(valor), TEXTO_SEM_GARANTIA, `valor ${valor}`);
  }
});

test("prazo positivo aparece no texto", () => {
  for (const dias of [7, 30, 90, 180, 365]) {
    assert.equal(
      textoAceiteEntrega(dias),
      `Declaro ter recebido o dispositivo nas condições descritas acima e estou ciente do termo de garantia de ${dias} dias para o serviço executado.`,
    );
  }
});

test("90 dias fica idêntico ao texto antigo", () => {
  assert.equal(textoAceiteEntrega(90), TEXTO_ANTIGO_90);
});

test("diálogo de entrega usa a função e não tem mais o 90 fixo", () => {
  const dialogo = ler("src/components/ordens/DialogAssinaturaSaida.tsx");
  assert.match(dialogo, /textoAceite=\{textoAceiteEntrega\(ordem\.tempo_garantia\)\}/);
  assert.ok(!dialogo.includes("garantia de 90 dias"));
});
