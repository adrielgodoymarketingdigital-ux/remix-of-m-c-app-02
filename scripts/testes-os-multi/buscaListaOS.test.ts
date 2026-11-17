// deno test --no-check --no-lock scripts/testes-os-multi/
// Busca da lista de OS (src/lib/ordemServico/buscaListaOS.ts): número de série
// do aparelho principal e dos adicionais. Regra principal: para termos que NÃO
// aparecem em nenhum número de série, o resultado é IDÊNTICO ao da origin/main
// (4b6da43). Só dados fictícios; nada vai à rede.
import { assertEquals, assertStrictEquals } from "jsr:@std/assert@1";
import { filtrarOSPorBusca, osCorrespondeBusca, serieCorrespondeBusca, type OSParaBusca } from "../../src/lib/ordemServico/buscaListaOS.ts";
import type { AdicionaisPorOS, ResumoDispositivoAdicional } from "../../src/lib/ordemServico/dispositivosAdicionaisOS.ts";

// ── Cópia LITERAL da busca da origin/main (4b6da43) ─────────────────────────
// useOrdensServico.ts (useMemo "ordens", bloco da busca) + adicionaisCorrespondemBusca.
function adicionaisAntigo(adicionais: readonly ResumoDispositivoAdicional[] | null | undefined, termo: string): boolean {
  if (!termo || !adicionais) return false;
  return adicionais.some((a) =>
    (a.dispositivo_imei?.toLowerCase() || "").includes(termo) ||
    (a.dispositivo_modelo?.toLowerCase() || "").includes(termo) ||
    (a.dispositivo_marca?.toLowerCase() || "").includes(termo),
  );
}
// deno-lint-ignore no-explicit-any
function filtroAntigo(ordensBase: any[], busca: string, adicionaisPorOs: AdicionaisPorOS) {
  let resultado = ordensBase;
  const termo = busca.trim().toLowerCase();
  if (termo) {
    // deno-lint-ignore no-explicit-any
    resultado = resultado.filter((o: any) => {
      const nome = o.cliente?.nome?.toLowerCase() || '';
      const cpf = o.cliente?.cpf?.toLowerCase() || '';
      const imei = o.dispositivo_imei?.toLowerCase() || '';
      const modelo = o.dispositivo_modelo?.toLowerCase() || '';
      const marca = o.dispositivo_marca?.toLowerCase() || '';
      const numeroOs = o.numero_os?.toLowerCase() || '';
      const defeito = o.defeito_relatado?.toLowerCase() || '';
      return (
        nome.includes(termo) ||
        cpf.includes(termo) ||
        imei.includes(termo) ||
        modelo.includes(termo) ||
        marca.includes(termo) ||
        numeroOs.includes(termo) ||
        defeito.includes(termo) ||
        adicionaisAntigo(adicionaisPorOs[o.id], termo)
      );
    });
  }
  return resultado;
}

// ── Dados fictícios ─────────────────────────────────────────────────────────
const os = (id: string, extra: Partial<OSParaBusca> = {}): OSParaBusca => ({
  id,
  numero_os: id.toUpperCase(),
  defeito_relatado: "tela quebrada",
  dispositivo_imei: null,
  dispositivo_modelo: "Moto G",
  dispositivo_marca: "Motorola",
  dispositivo_numero_serie: null,
  cliente: { nome: "Cliente Teste", cpf: null },
  ...extra,
});
const adicional = (os_id: string, extra: Partial<ResumoDispositivoAdicional> = {}): ResumoDispositivoAdicional => ({
  id: `${os_id}-a`, os_id, ordem: 2,
  dispositivo_marca: "Samsung", dispositivo_modelo: "Galaxy", dispositivo_imei: null, dispositivo_numero_serie: null,
  ...extra,
});
const ids = (l: OSParaBusca[]) => l.map((o) => o.id);

const LISTA = [
  os("os-1", { dispositivo_numero_serie: "C02XK1ABJG5H" }),
  os("os-2", { dispositivo_numero_serie: "R58M-12 AB" }),
  os("os-3", { dispositivo_numero_serie: null }),
  os("os-4", { dispositivo_numero_serie: "" }),
  os("os-5"),
];
const ADICIONAIS: AdicionaisPorOS = {
  "os-5": [adicional("os-5", { dispositivo_numero_serie: "PF-3XYZ99" })],
};

// ── Série: aparelho principal e adicional ───────────────────────────────────
Deno.test("busca por série acha a OS certa (aparelho principal)", () => {
  assertEquals(ids(filtrarOSPorBusca(LISTA, "C02XK1ABJG5H", ADICIONAIS)), ["os-1"]);
});

Deno.test("busca por série de aparelho adicional acha a OS dele", () => {
  assertEquals(ids(filtrarOSPorBusca(LISTA, "PF-3XYZ99", ADICIONAIS)), ["os-5"]);
  // sem o mapa de adicionais a OS 5 não aparece
  assertEquals(ids(filtrarOSPorBusca(LISTA, "PF-3XYZ99", {})), []);
});

Deno.test("série: maiúsculas e minúsculas tanto faz", () => {
  for (const t of ["c02xk1abjg5h", "C02XK1ABJG5H", "c02Xk1AbJg5H"]) {
    assertEquals(ids(filtrarOSPorBusca(LISTA, t, ADICIONAIS)), ["os-1"]);
  }
  assertEquals(ids(filtrarOSPorBusca(LISTA, "pf-3xyz", ADICIONAIS)), ["os-5"]);
});

Deno.test("série: por trecho e com espaços nas pontas", () => {
  assertEquals(ids(filtrarOSPorBusca(LISTA, "xk1ab", ADICIONAIS)), ["os-1"]);
  assertEquals(ids(filtrarOSPorBusca(LISTA, "   jg5h  ", ADICIONAIS)), ["os-1"]);
  assertEquals(ids(filtrarOSPorBusca(LISTA, "3xyz", ADICIONAIS)), ["os-5"]);
});

Deno.test("série: ignora espaços e hífens no meio, nos dois sentidos", () => {
  // digitado sem hífen/espaço acha o gravado com hífen/espaço
  assertEquals(ids(filtrarOSPorBusca(LISTA, "r58m12ab", ADICIONAIS)), ["os-2"]);
  assertEquals(ids(filtrarOSPorBusca(LISTA, "pf3xyz", ADICIONAIS)), ["os-5"]);
  // digitado com hífen/espaço acha o gravado sem
  assertEquals(ids(filtrarOSPorBusca(LISTA, "c02-xk1 ab", ADICIONAIS)), ["os-1"]);
  // termo só de separadores não casa com toda série
  for (const t of ["-", "--", "- -", " "]) {
    assertStrictEquals(serieCorrespondeBusca("ABC123", t), false, JSON.stringify(t));
  }
  assertEquals(ids(filtrarOSPorBusca([os("só-sem-hífen", { numero_os: "1", dispositivo_numero_serie: "ABC123" })], "--", {})), []);
  // hífen literal na série ainda casa por trecho literal
  assertStrictEquals(serieCorrespondeBusca("R58M-12 AB", "-"), true);
});

Deno.test("série nula, vazia ou ausente não quebra e não casa", () => {
  for (const s of [null, undefined, ""]) {
    assertStrictEquals(serieCorrespondeBusca(s, "abc"), false);
  }
  assertStrictEquals(serieCorrespondeBusca("ABC", ""), false);
  const semNada = [os("x", { dispositivo_numero_serie: undefined, cliente: null, dispositivo_modelo: null, dispositivo_marca: null, numero_os: null, defeito_relatado: null })];
  assertEquals(filtrarOSPorBusca(semNada, "abc", { x: [adicional("x", { dispositivo_numero_serie: null, dispositivo_modelo: "", dispositivo_marca: "" })] }), []);
});

Deno.test("termo vazio ou só espaços devolve a MESMA lista (mesma referência)", () => {
  for (const t of ["", " ", "   \t "]) {
    assertStrictEquals(filtrarOSPorBusca(LISTA, t, ADICIONAIS), LISTA);
    assertStrictEquals(filtrarOSPorBusca(LISTA, t, ADICIONAIS), filtroAntigo(LISTA, t, ADICIONAIS));
  }
});

Deno.test("critérios antigos continuam: nome, cpf, imei, modelo, marca, nº da OS, defeito, adicionais", () => {
  const l = [
    os("a", { cliente: { nome: "Maria Souza", cpf: "123.456.789-00" } }),
    os("b", { dispositivo_imei: "356789012345678" }),
    os("c", { dispositivo_modelo: "iPhone 13", dispositivo_marca: "Apple" }),
    os("d", { numero_os: "OS-777", defeito_relatado: "não liga" }),
    os("e"),
  ];
  const ad: AdicionaisPorOS = { e: [adicional("e", { dispositivo_imei: "990011", dispositivo_modelo: "Redmi", dispositivo_marca: "Xiaomi" })] };
  const casos: [string, string[]][] = [
    ["maria", ["a"]], ["456.789", ["a"]], ["35678901", ["b"]], ["iphone", ["c"]], ["apple", ["c"]],
    ["os-777", ["d"]], ["NÃO LIGA", ["d"]], ["990011", ["e"]], ["redmi", ["e"]], ["xiaomi", ["e"]],
  ];
  for (const [t, esperado] of casos) {
    assertEquals(ids(filtrarOSPorBusca(l, t, ad)), esperado, t);
    assertEquals(filtrarOSPorBusca(l, t, ad), filtroAntigo(l, t, ad), t);
  }
});

Deno.test("osCorrespondeBusca: série do principal ou do adicional", () => {
  assertStrictEquals(osCorrespondeBusca(os("z", { dispositivo_numero_serie: "SN-1" }), "sn1", undefined), true);
  assertStrictEquals(osCorrespondeBusca(os("z"), "sn1", [adicional("z", { dispositivo_numero_serie: "sn 1" })]), true);
  assertStrictEquals(osCorrespondeBusca(os("z"), "sn1", [adicional("z")]), false);
});

// ── Propriedade: termos fora de qualquer série = resultado idêntico ao antigo ──
function prng(semente: number) {
  let x = (Math.imul(semente, 2654435761) >>> 0) || 1;
  const prox = () => {
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5; x >>>= 0;
    return x / 0x100000000;
  };
  for (let i = 0; i < 20; i++) prox(); // aquece: sementes pequenas começam com valores minúsculos
  return prox;
}
const ALFABETO = "abcAB1239 -.ãÉ";
const textoAleatorio = (r: () => number, max: number) => {
  let s = "";
  const n = Math.floor(r() * (max + 1));
  for (let i = 0; i < n; i++) s += ALFABETO[Math.floor(r() * ALFABETO.length)];
  return s;
};
const talvez = (r: () => number, max: number): string | null | undefined => {
  const p = r();
  if (p < 0.12) return null;
  if (p < 0.18) return undefined;
  if (p < 0.24) return "";
  return textoAleatorio(r, max);
};
const compacto = (t: string) => t.replace(/[\s-]/g, "");

Deno.test("propriedade: termo fora de toda série → resultado idêntico ao da origin/main", () => {
  let comparados = 0;
  let naoVazios = 0;
  for (let semente = 1; semente <= 400; semente++) {
    const r = prng(semente);
    const lista: OSParaBusca[] = [];
    const ad: AdicionaisPorOS = {};
    const n = Math.floor(r() * 12);
    for (let i = 0; i < n; i++) {
      const id = `os-${semente}-${i}`;
      lista.push({
        id,
        numero_os: talvez(r, 5),
        defeito_relatado: talvez(r, 8),
        dispositivo_imei: talvez(r, 6),
        dispositivo_modelo: talvez(r, 6),
        dispositivo_marca: talvez(r, 5),
        dispositivo_numero_serie: talvez(r, 6),
        cliente: r() < 0.1 ? null : { nome: talvez(r, 7), cpf: talvez(r, 5) },
      });
      if (r() < 0.4) {
        ad[id] = Array.from({ length: 1 + Math.floor(r() * 2) }, (_, k) => ({
          id: `${id}-${k}`, os_id: id, ordem: k + 2,
          dispositivo_marca: talvez(r, 4) ?? "", dispositivo_modelo: talvez(r, 4) ?? "",
          dispositivo_imei: talvez(r, 5) ?? null, dispositivo_numero_serie: talvez(r, 5) ?? null,
        }));
      }
    }
    const series = [
      ...lista.map((o) => o.dispositivo_numero_serie),
      ...Object.values(ad).flat().map((a) => a.dispositivo_numero_serie),
    ].filter((s): s is string => !!s).map((s) => s.toLowerCase());

    for (let k = 0; k < 30; k++) {
      const busca = textoAleatorio(r, 3);
      const termo = busca.trim().toLowerCase();
      const tc = compacto(termo);
      const tocaSerie = termo !== "" && series.some((s) => s.includes(termo) || (tc !== "" && compacto(s).includes(tc)));
      if (tocaSerie) continue;
      const novo = filtrarOSPorBusca(lista, busca, ad);
      const antigo = filtroAntigo(lista, busca, ad);
      assertEquals(novo.length, antigo.length, `semente ${semente} termo ${JSON.stringify(busca)}`);
      novo.forEach((o, i) => assertStrictEquals(o, antigo[i]));
      comparados++;
      if (antigo.length > 0 && termo) naoVazios++;
    }
  }
  // a propriedade só vale se realmente exercitou bastante caso, inclusive com acerto
  if (comparados < 3000 || naoVazios < 500) throw new Error(`poucos casos: ${comparados} / ${naoVazios}`);
});

Deno.test("propriedade inversa: termo que está numa série sempre acha a OS dela", () => {
  for (let semente = 1; semente <= 200; semente++) {
    const r = prng(semente * 7919);
    const serie = textoAleatorio(r, 10) || "X";
    const ini = Math.floor(r() * serie.length);
    const fim = ini + 1 + Math.floor(r() * (serie.length - ini));
    const trecho = serie.slice(ini, fim);
    if (!trecho.trim()) continue;
    const alvo = os("alvo", { dispositivo_numero_serie: serie });
    const variacoes = [trecho, trecho.toUpperCase(), trecho.toLowerCase(), `  ${trecho}  `];
    for (const v of variacoes) {
      if (!v.trim()) continue;
      assertStrictEquals(filtrarOSPorBusca([alvo], v, {}).length, 1, `${JSON.stringify(serie)} / ${JSON.stringify(v)}`);
    }
  }
});
