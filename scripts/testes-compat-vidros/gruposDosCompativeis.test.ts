// deno test --no-check --allow-read --allow-env scripts/testes-compat-vidros/
// Grupo(s) de cada compatível na lista do computador (gruposDosCompativeis),
// sempre a partir do resultado real de encontrarCompativeis. Dados fictícios.
import { assertEquals } from "jsr:@std/assert@1";
import { GrupoComModelos, encontrarCompativeis } from "../../src/lib/compatibilidade/compatibilidade.ts";
import { gruposDosCompativeis } from "../../src/lib/compatibilidade/gruposDosCompativeis.ts";

let seq = 0;
const grupo = (nome: string, ...pares: [string, string][]): GrupoComModelos => {
  const id = `g${++seq}`;
  return { id, nome, tipo: "pelicula", modelos: pares.map(([marca, modelo], i) => ({ id: `${id}-m${i}`, grupo_id: id, marca, modelo })) };
};
const buscar = (grupos: GrupoComModelos[], marca: string, modelo: string) =>
  gruposDosCompativeis(encontrarCompativeis(grupos, marca, modelo));

Deno.test("grupos dos compatíveis: 1 grupo, todos com o mesmo nome de grupo", () => {
  const grupos = [grupo("APPLE 11/XR", ["Apple", "iPhone 11"], ["Apple", "iPhone XR"], ["Apple", "iPhone 11 Teste"])];
  assertEquals(buscar(grupos, "Apple", "iPhone 11"), [
    { marca: "Apple", modelo: "iPhone XR", grupos: ["APPLE 11/XR"] },
    { marca: "Apple", modelo: "iPhone 11 Teste", grupos: ["APPLE 11/XR"] },
  ]);
});

Deno.test("grupos dos compatíveis: modelo em 2 grupos; compatível que está nos dois mostra os dois", () => {
  const grupos = [
    grupo("GRUPO A", ["Marca X", "M1"], ["Marca X", "M2"], ["Marca X", "M3"]),
    grupo("GRUPO B", ["Marca X", "M1"], ["Marca X", "M3"], ["Marca X", "M4"]),
  ];
  assertEquals(buscar(grupos, "Marca X", "M1"), [
    { marca: "Marca X", modelo: "M2", grupos: ["GRUPO A"] },
    { marca: "Marca X", modelo: "M3", grupos: ["GRUPO A", "GRUPO B"] },
    { marca: "Marca X", modelo: "M4", grupos: ["GRUPO B"] },
  ]);
});

Deno.test("grupos dos compatíveis: modelo de outra marca mantém a marca e acha o grupo", () => {
  const grupos = [grupo("MISTO", ["Marca X", "M1"], ["Marca Y", "M1"], ["Marca Y", "Z9"])];
  assertEquals(buscar(grupos, "Marca X", "M1"), [
    { marca: "Marca Y", modelo: "M1", grupos: ["MISTO"] },
    { marca: "Marca Y", modelo: "Z9", grupos: ["MISTO"] },
  ]);
});

Deno.test("grupos dos compatíveis: grupo sem outros modelos dá lista vazia", () => {
  const grupos = [grupo("SOZINHO", ["Marca X", "M1"]), grupo("OUTRO", ["Marca X", "M2"], ["Marca X", "M3"])];
  const resultado = encontrarCompativeis(grupos, "Marca X", "M1");
  assertEquals(resultado.grupos.map((g) => g.nome), ["SOZINHO"]);
  assertEquals(gruposDosCompativeis(resultado), []);
});

Deno.test("grupos dos compatíveis: dois grupos com o mesmo nome aparecem uma vez só", () => {
  const grupos = [
    grupo("REPETIDO", ["Marca X", "M1"], ["Marca X", "M2"]),
    grupo("REPETIDO", ["Marca X", "M1"], ["Marca X", "M2"], ["Marca X", "M5"]),
  ];
  assertEquals(buscar(grupos, "Marca X", "M1"), [
    { marca: "Marca X", modelo: "M2", grupos: ["REPETIDO"] },
    { marca: "Marca X", modelo: "M5", grupos: ["REPETIDO"] },
  ]);
});

Deno.test("grupos dos compatíveis: ordem estável (compatíveis e grupos na ordem recebida, sem reordenar)", () => {
  const grupos = [
    grupo("Z ÚLTIMO EM ORDEM ALFABÉTICA", ["Marca X", "M1"], ["Marca X", "B"], ["Marca X", "A"]),
    grupo("A PRIMEIRO EM ORDEM ALFABÉTICA", ["Marca X", "M1"], ["Marca X", "A"]),
  ];
  const primeira = buscar(grupos, "Marca X", "M1");
  assertEquals(primeira, [
    { marca: "Marca X", modelo: "B", grupos: ["Z ÚLTIMO EM ORDEM ALFABÉTICA"] },
    { marca: "Marca X", modelo: "A", grupos: ["Z ÚLTIMO EM ORDEM ALFABÉTICA", "A PRIMEIRO EM ORDEM ALFABÉTICA"] },
  ]);
  // Mesma entrada, mesma saída.
  assertEquals(buscar(grupos, "Marca X", "M1"), primeira);
});
