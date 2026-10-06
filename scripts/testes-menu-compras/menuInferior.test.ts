// deno test --no-check scripts/testes-menu-compras/
// Roda a função real de src/lib/menuInferior.ts (leitura do localStorage
// "mobile-nav-items" da barra inferior do celular). Caso real: escolher 1 a 3
// itens e salvar voltava ao padrão (a leitura só aceitava exatamente 4).
import { assertEquals } from "jsr:@std/assert@1";
import { lerItensMenuInferior } from "../../src/lib/menuInferior.ts";

const VALIDOS = ["dashboard", "pdv", "os", "dispositivos", "produtos", "clientes", "origem"];
const PADRAO = ["dashboard", "pdv", "os", "dispositivos"];
const ler = (valor: string | null | undefined) => lerItensMenuInferior(valor, VALIDOS, PADRAO);
const json = (v: unknown) => JSON.stringify(v);

Deno.test("0 itens (lista vazia) volta ao padrão", () => {
  assertEquals(ler(json([])), PADRAO);
});

Deno.test("1, 2 e 3 itens são mantidos (antes voltavam ao padrão)", () => {
  assertEquals(ler(json(["origem"])), ["origem"]);
  assertEquals(ler(json(["clientes", "os"])), ["clientes", "os"]);
  assertEquals(ler(json(["produtos", "pdv", "origem"])), ["produtos", "pdv", "origem"]);
});

Deno.test("4 itens: mantidos na ordem salva", () => {
  assertEquals(ler(json(["origem", "clientes", "pdv", "os"])), ["origem", "clientes", "pdv", "os"]);
});

Deno.test("5 itens: corta nos 4 primeiros", () => {
  assertEquals(ler(json(["origem", "clientes", "pdv", "os", "dashboard"])), ["origem", "clientes", "pdv", "os"]);
});

Deno.test("ids inválidos são descartados; só inválidos volta ao padrão", () => {
  assertEquals(ler(json(["xpto", "origem", 7, null, "os"])), ["origem", "os"]);
  assertEquals(ler(json(["equipe", "nao-existe"])), PADRAO);
});

Deno.test("repetidos contam uma vez, preservando a primeira posição", () => {
  assertEquals(ler(json(["os", "pdv", "os", "pdv", "origem"])), ["os", "pdv", "origem"]);
  // Repetidos não "gastam" vaga: o 4º distinto ainda entra.
  assertEquals(ler(json(["os", "os", "pdv", "clientes", "origem", "dashboard"])), ["os", "pdv", "clientes", "origem"]);
});

Deno.test("JSON inválido, não-lista, nulo e vazio voltam ao padrão", () => {
  assertEquals(ler("{quebrado"), PADRAO);
  assertEquals(ler(json({ itens: ["os"] })), PADRAO);
  assertEquals(ler(json("os")), PADRAO);
  assertEquals(ler(null), PADRAO);
  assertEquals(ler(undefined), PADRAO);
  assertEquals(ler(""), PADRAO);
});

Deno.test("o padrão devolvido é uma cópia (não muda a constante)", () => {
  const r = ler(null);
  r.push("x");
  assertEquals(PADRAO.length, 4);
});
