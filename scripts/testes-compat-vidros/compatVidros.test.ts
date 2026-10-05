// deno test --no-check --allow-read --allow-env scripts/testes-compat-vidros/
// Roda as funções reais de src/lib/compatibilidade/compatibilidade.ts (busca e
// seletor das abas Películas | Vidros) e do importador
// scripts/gerar_seed_compatibilidade_vidro.ts. O teste com a planilha real
// procura compatibilidade_vidros*.xlsx no projeto ou em
// ~/Documents/compatibilidade-vidros/ (ou em $COMPAT_VIDROS_XLSX) e é ignorado se não achar.
import { assert, assertEquals, assertThrows } from "jsr:@std/assert@1";
import {
  GrupoComModelos,
  ehErroColunaTipoAusente,
  encontrarCompativeis,
  filtrarPorTipo,
  lerTipoCompatibilidade,
  montarOpcoesMarcaModelo,
} from "../../src/lib/compatibilidade/compatibilidade.ts";
import {
  ErroImportacao,
  GrupoImportado,
  LinhaPlanilha,
  encontrarPlanilha,
  lerLinhasDaMatriz,
  lerPlanilha,
  montarSqlSeed,
  validarEAgrupar,
} from "../gerar_seed_compatibilidade_vidro.ts";

// ── Importador: validações que abortam ─────────────────────────────────────

const CAB = ["Marca", "Modelo", "Compatíveis com o mesmo vidro"];
const linhas = (...rows: string[][]): LinhaPlanilha[] => lerLinhasDaMatriz([CAB, ...rows]);

function falha(rows: string[][], trecho: string) {
  const erro = assertThrows(() => validarEAgrupar(linhas(...rows)), ErroImportacao);
  assert(erro.problemas.some((p) => p.includes(trecho)), `esperava "${trecho}" em ${JSON.stringify(erro.problemas)}`);
}

Deno.test("importador: planilha válida agrupa em componentes com nome A/B", () => {
  const grupos = validarEAgrupar(linhas(
    ["Motorola", "G10", "G20 | G30"],
    ["Motorola", "G20", "G10 | G30"],
    ["Motorola", "G30", "G10 | G20"],
    ["Motorola", "E7", "E7 Power"],
    ["Motorola", "E7 Power", "E7"],
  ));
  assertEquals(grupos, [
    { nome: "G10/G20/G30", modelos: [{ marca: "Motorola", modelo: "G10" }, { marca: "Motorola", modelo: "G20" }, { marca: "Motorola", modelo: "G30" }] },
    { nome: "E7/E7 Power", modelos: [{ marca: "Motorola", modelo: "E7" }, { marca: "Motorola", modelo: "E7 Power" }] },
  ]);
});

Deno.test("importador: cabeçalho diferente aborta", () => {
  assertThrows(() => lerLinhasDaMatriz([["Marca", "Modelo", "Preço"], ["A", "B", "C"]]), ErroImportacao);
});

Deno.test("importador: campo vazio aborta (marca, modelo, compatíveis e item da lista)", () => {
  falha([["", "G10", "G20"], ["Motorola", "G20", "G10"]], "marca vazia");
  falha([["Motorola", "", "G20"], ["Motorola", "G20", ""]], "modelo vazio");
  falha([["Motorola", "G10", ""]], "sem compatíveis");
  falha([["Motorola", "G10", "G20 |  | G30"], ["Motorola", "G20", "G10"], ["Motorola", "G30", "G10"]], "item vazio");
});

Deno.test("importador: duplicado de marca+modelo aborta", () => {
  falha([["Motorola", "G10", "G20"], ["Motorola", "G20", "G10"], ["Motorola", "G10", "G20"]], "duplicado");
});

Deno.test("importador: modelo compatível consigo mesmo aborta", () => {
  falha([["Motorola", "G10", "G10 | G20"], ["Motorola", "G20", "G10"]], "consigo mesmo");
});

Deno.test("importador: modelo citado sem linha própria aborta (inclusive de outra marca)", () => {
  falha([["Motorola", "G10", "G99"]], "não tem linha própria");
  falha([["Motorola", "G10", "A10"], ["Samsung", "A10", "G10"]], "não tem linha própria");
});

Deno.test("importador: assimetria aborta", () => {
  falha([["Motorola", "G10", "G20"], ["Motorola", "G20", "G30"], ["Motorola", "G30", "G20"]], "assimetria");
});

Deno.test("importador: grupo não fechado aborta (A~B, B~C, A não ~ C)", () => {
  falha([["Motorola", "A", "B"], ["Motorola", "B", "A | C"], ["Motorola", "C", "B"]], "grupo não fechado");
});

Deno.test("seed SQL: escapa apóstrofo, usa tipo vidro e confere totais", () => {
  const grupos: GrupoImportado[] = [{ nome: "X'1/X2", modelos: [{ marca: "Marca'A", modelo: "X'1" }, { marca: "Marca'A", modelo: "X2" }] }];
  const sql = montarSqlSeed(grupos, "teste.xlsx");
  assert(sql.includes("VALUES ('X''1/X2', 'vidro')"));
  assert(sql.includes("('Marca''A', 'X''1')"));
  assert(sql.includes("IF v_grupos <> 1 OR v_vinculos <> 2 THEN"));
  assert(sql.trimStart().startsWith("--") && sql.includes("BEGIN;") && sql.trimEnd().endsWith("COMMIT;"));
  assert(sql.includes("RAISE EXCEPTION 'Já existem grupos com tipo = vidro"));
});

// ── Busca e seletor ────────────────────────────────────────────────────────

const g = (id: string, tipo: string | null | undefined, ...pares: [string, string][]): GrupoComModelos => ({
  id, nome: pares.map((p) => p[1]).join("/"), tipo,
  modelos: pares.map(([marca, modelo], i) => ({ id: `${id}-${i}`, grupo_id: id, marca, modelo })),
});

const DADOS: GrupoComModelos[] = [
  g("p1", "pelicula", ["Xiaomi", "Mi 11i"], ["Xiaomi", "Mi 11i HyperCharge 5G"]),
  g("p2", "pelicula", ["Xiaomi", "Mi 11X (Pro)"], ["Xiaomi", "Mi 11i"]),
  g("p3", null, ["Samsung", "Galaxy A02(S)"], ["Samsung", "Galaxy A03 Core"]),
  g("p4", undefined, ["Samsung", "Galaxy A10"]),
  g("v1", "vidro", ["Samsung", "A04S"], ["Samsung", "A04E"], ["Samsung", "M04"]),
  g("v2", "vidro", ["Xiaomi / Redmi / Poco", "Redmi Note 10"], ["Xiaomi / Redmi / Poco", "Redmi Note 10S"]),
  g("v3", "vidro", ["Samsung", "A04s"], ["Samsung", "A10"]),
  g("v4", "vidro", ["Itel / Tecno", "Itel A70"], ["Itel / Tecno", "Tecno Spark Go 2024"]),
];

Deno.test("tipo: ?tipo=vidro é vidro; qualquer outra coisa é película", () => {
  assertEquals(lerTipoCompatibilidade("vidro"), "vidro");
  assertEquals(lerTipoCompatibilidade("pelicula"), "pelicula");
  assertEquals(lerTipoCompatibilidade(null), "pelicula");
  assertEquals(lerTipoCompatibilidade("VIDRO"), "pelicula");
});

Deno.test("filtro: tipo=pelicula não devolve vidros e vice-versa (sem tipo = película)", () => {
  assertEquals(filtrarPorTipo(DADOS, "pelicula").map((x) => x.id), ["p1", "p2", "p3", "p4"]);
  assertEquals(filtrarPorTipo(DADOS, "vidro").map((x) => x.id), ["v1", "v2", "v3", "v4"]);
  const opcoesPelicula = montarOpcoesMarcaModelo(filtrarPorTipo(DADOS, "pelicula"));
  assert(!opcoesPelicula.marcas.includes("Xiaomi / Redmi / Poco"));
  assertEquals(encontrarCompativeis(filtrarPorTipo(DADOS, "pelicula"), "Samsung", "A04S").grupos, []);
  assertEquals(encontrarCompativeis(filtrarPorTipo(DADOS, "vidro"), "Xiaomi", "Mi 11i").grupos, []);
});

Deno.test("busca de vidro: compatíveis do modelo, comparação exata (A04S ≠ A04s)", () => {
  const vidros = filtrarPorTipo(DADOS, "vidro");
  const r = encontrarCompativeis(vidros, "Samsung", "A04S");
  assertEquals(r.grupos.map((x) => x.id), ["v1"]);
  assertEquals(r.compativeis, [{ marca: "Samsung", modelo: "A04E" }, { marca: "Samsung", modelo: "M04" }]);
  assertEquals(encontrarCompativeis(vidros, "Samsung", "A04s").compativeis, [{ marca: "Samsung", modelo: "A10" }]);
  assertEquals(encontrarCompativeis(vidros, "Xiaomi / Redmi / Poco", "Redmi Note 10").compativeis, [{ marca: "Xiaomi / Redmi / Poco", modelo: "Redmi Note 10S" }]);
  assertEquals(encontrarCompativeis(vidros, "Samsung", "Galaxy A04s").grupos, []);
});

Deno.test("modelo em dois grupos: devolve a união sem repetidos", () => {
  const dados = [...DADOS, g("p5", "pelicula", ["Xiaomi", "Mi 11i"], ["Xiaomi", "Mi 11i HyperCharge 5G"], ["Xiaomi", "Poco F3"])];
  const r = encontrarCompativeis(filtrarPorTipo(dados, "pelicula"), "Xiaomi", "Mi 11i");
  assertEquals(r.grupos.map((x) => x.id), ["p1", "p2", "p5"]);
  assertEquals(r.compativeis, [
    { marca: "Xiaomi", modelo: "Mi 11i HyperCharge 5G" },
    { marca: "Xiaomi", modelo: "Mi 11X (Pro)" },
    { marca: "Xiaomi", modelo: "Poco F3" },
  ]);
});

/** Todo par marca/modelo dos dados está nas opções do seletor (nenhum fica de fora). */
function conferirAlcance(grupos: GrupoComModelos[]): number {
  const pares = new Set(grupos.flatMap((x) => x.modelos.map((m) => `${m.marca}\u0000${m.modelo}`)));
  const { marcas, modelosPorMarca } = montarOpcoesMarcaModelo(grupos);
  const alcancaveis = new Set(marcas.flatMap((marca) => modelosPorMarca[marca].map((modelo) => `${marca}\u0000${modelo}`)));
  assertEquals(alcancaveis, pares);
  assertEquals(new Set(marcas).size, marcas.length, "marcas repetidas");
  for (const marca of marcas) assertEquals(new Set(modelosPorMarca[marca]).size, modelosPorMarca[marca].length, `modelos repetidos em ${marca}`);
  return pares.size;
}

Deno.test("seletor: todos os pares do exemplo são alcançáveis, ordenados e sem repetidos", () => {
  assertEquals(conferirAlcance(filtrarPorTipo(DADOS, "pelicula")), 6);
  assertEquals(conferirAlcance(filtrarPorTipo(DADOS, "vidro")), 9);
  const { marcas, modelosPorMarca } = montarOpcoesMarcaModelo(filtrarPorTipo(DADOS, "vidro"));
  assertEquals(marcas, ["Itel / Tecno", "Samsung", "Xiaomi / Redmi / Poco"]);
  assertEquals(modelosPorMarca.Samsung, ["A04E", "A04S", "A04s", "A10", "M04"]);
});

Deno.test("seletor: ordem natural (A2 antes de A10)", () => {
  const { modelosPorMarca } = montarOpcoesMarcaModelo([g("x", "vidro", ["S", "A10"], ["S", "A2"], ["S", "A1"])]);
  assertEquals(modelosPorMarca.S, ["A1", "A2", "A10"]);
});

Deno.test("erro de coluna tipo ausente (front antes da migration) é reconhecido", () => {
  assert(ehErroColunaTipoAusente({ code: "42703", message: "column grupos_compatibilidade_pelicula.tipo does not exist" }));
  assert(ehErroColunaTipoAusente({ code: "PGRST204", message: "Could not find the 'tipo' column of 'grupos_compatibilidade_pelicula' in the schema cache" }));
  assert(!ehErroColunaTipoAusente({ code: "42703", message: "column grupos_compatibilidade_pelicula.outra does not exist" }));
  assert(!ehErroColunaTipoAusente({ code: "42501", message: "permission denied for table tipo" }));
  assert(!ehErroColunaTipoAusente(null));
});

// ── Planilha real ──────────────────────────────────────────────────────────

const RAIZ = new URL("../..", import.meta.url).pathname.replace(/\/$/, "");
function acharPlanilhaReal(): string | null {
  const doAmbiente = Deno.env.get("COMPAT_VIDROS_XLSX");
  if (doAmbiente) return doAmbiente;
  const noProjeto = encontrarPlanilha(RAIZ);
  if (noProjeto) return noProjeto;
  try {
    return encontrarPlanilha(`${Deno.env.get("HOME")}/Documents/compatibilidade-vidros`);
  } catch {
    return null;
  }
}
const PLANILHA = (() => {
  try {
    return acharPlanilhaReal();
  } catch {
    return null;
  }
})();

Deno.test({
  name: `planilha real: 631 vínculos em 167 grupos, todos alcançáveis na aba Vidros (${PLANILHA ?? "não encontrada — ignorado"})`,
  ignore: !PLANILHA,
  fn: () => {
    const linhasReais = lerPlanilha(PLANILHA!);
    assertEquals(linhasReais.length, 631);
    const grupos = validarEAgrupar(linhasReais);
    assertEquals(grupos.length, 167);
    assertEquals(grupos.reduce((acc, x) => acc + x.modelos.length, 0), 631);

    const porMarca: Record<string, number> = {};
    for (const l of linhasReais) porMarca[l.marca] = (porMarca[l.marca] ?? 0) + 1;
    assertEquals(porMarca, {
      "Apple": 6, "Samsung": 106, "Motorola": 116, "Xiaomi / Redmi / Poco": 160, "LG": 20,
      "Realme": 119, "Infinix": 80, "Itel / Tecno": 12, "Asus": 4, "Huawei / Honor": 8,
    });

    // Como o front vê depois do seed: grupos de vidro.
    const comoNoBanco = grupos.map((x, i) => g(`v${i}`, "vidro", ...x.modelos.map((m) => [m.marca, m.modelo] as [string, string])));
    assertEquals(conferirAlcance(comoNoBanco), 631);
    const r = encontrarCompativeis(comoNoBanco, "Apple", "iPhone 12");
    assertEquals(r.compativeis, [{ marca: "Apple", modelo: "iPhone 12 Pro" }]);

    const sql = montarSqlSeed(grupos, "planilha.xlsx");
    assertEquals(sql.match(/^WITH novo_grupo AS/gm)?.length, 167);
    assertEquals(sql.match(/^  \('.*', '.*'\),?$/gm)?.length, 631);
    assert(sql.includes("IF v_grupos <> 167 OR v_vinculos <> 631 THEN"));
  },
});
