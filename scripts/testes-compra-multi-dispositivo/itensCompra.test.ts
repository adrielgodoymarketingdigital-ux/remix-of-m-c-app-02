// TZ=UTC deno test --no-check scripts/testes-compra-multi-dispositivo/
// TZ=America/Sao_Paulo deno test --no-check scripts/testes-compra-multi-dispositivo/
// Roda as funções reais de src/lib/origem/itensCompra.ts (compra com vários
// dispositivos: "+" que copia a unidade, IMEI/série repetido na compra, total e
// lista do "Visualizar").
import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  copiarParaNovaUnidade,
  duplicadoNaCompra,
  idsDispositivosDaCompra,
  normalizarIdentificador,
  ordenarDispositivosDaCompra,
  primeiroDuplicadoNaLista,
  statusDispositivoCompra,
  totalDaCompra,
} from "../../src/lib/origem/itensCompra.ts";

Deno.test(`fuso da máquina: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`, () => {});

const iphone = {
  tipo: "Celular",
  marca: "Apple",
  modelo: "iPhone 15",
  cor: "Preto",
  capacidade_gb: 128,
  condicao: "semi_novo" as const,
  garantia: true,
  tempo_garantia: 3,
  custo: 3200,
  preco: 4100,
  fornecedor_id: "forn-1",
  imei: "350000000000001",
  imei2: "350000000000002",
  numero_serie: "F2LXX1",
  codigo_barras: "7890001",
  saude_bateria: 91,
  fotos: ["https://x/f1.jpg"],
  foto_url: "https://x/f1.jpg",
};

Deno.test("(a) o + copia modelo/valores e deixa em branco o que é da unidade", () => {
  const copia = copiarParaNovaUnidade(iphone);
  assertEquals(copia, {
    tipo: "Celular",
    marca: "Apple",
    modelo: "iPhone 15",
    cor: "Preto",
    capacidade_gb: 128,
    subtipo_computador: undefined,
    condicao: "semi_novo",
    garantia: true,
    tempo_garantia: 3,
    custo: 3200,
    preco: 4100,
    fornecedor_id: "forn-1",
  });
  for (const campo of ["imei", "imei2", "numero_serie", "codigo_barras", "saude_bateria", "fotos", "foto_url"]) {
    assert(!(campo in copia), `${campo} não pode ser copiado`);
  }
});

Deno.test("(a) o + com dados faltando usa os padrões do cadastro", () => {
  const copia = copiarParaNovaUnidade({ marca: "Samsung", modelo: "A55" });
  assertEquals(copia.condicao, "novo");
  assertEquals(copia.garantia, false);
  assertEquals(copia.fornecedor_id, null);
  assertEquals(copia.custo, undefined);
});

Deno.test("(b) identificador normalizado ignora espaço, ponto, traço e maiúscula", () => {
  assertEquals(normalizarIdentificador(" 35 0000-0000.00001 "), "350000000000001");
  assertEquals(normalizarIdentificador("f2lxx1"), "F2LXX1");
  assertEquals(normalizarIdentificador(null), "");
});

Deno.test("(b) IMEI repetido na compra é bloqueado com mensagem clara", () => {
  const existentes = [{ id: "d1", rotulo: "Apple iPhone 15", imei: "350000000000001" }];
  const msg = duplicadoNaCompra({ imei: "35 0000 0000 00001" }, existentes);
  assert(msg);
  assert(msg.includes("IMEI 35 0000 0000 00001"));
  assert(msg.includes("Apple iPhone 15"));
});

Deno.test("(b) IMEI 2 de um igual ao IMEI 1 de outro também é repetido", () => {
  assert(duplicadoNaCompra({ imei: "111", imei2: "350000000000001" }, [{ imei: "350000000000001" }]));
});

Deno.test("(b) IMEI 1 e IMEI 2 iguais no mesmo aparelho", () => {
  const msg = duplicadoNaCompra({ imei: "123", imei2: "1-2-3" }, []);
  assert(msg?.includes("IMEI 1 e IMEI 2"));
});

Deno.test("(b) série repetida bloqueia; série igual a um IMEI não", () => {
  assert(duplicadoNaCompra({ numero_serie: "f2lxx1" }, [{ numero_serie: "F2LXX1" }])?.startsWith("Nº de série"));
  assertEquals(duplicadoNaCompra({ numero_serie: "12345" }, [{ imei: "12345" }]), null);
});

Deno.test("(b) campos vazios não contam como repetidos e o próprio aparelho é ignorado", () => {
  assertEquals(duplicadoNaCompra({ imei: "", numero_serie: "  " }, [{ imei: "", numero_serie: "" }]), null);
  assertEquals(duplicadoNaCompra({ id: "d1", imei: "1" }, [{ id: "d1", imei: "1" }]), null);
});

Deno.test("(b) conferência final: primeira repetição da lista", () => {
  const lista = [
    { id: "a", imei: "1" },
    { id: "b", imei: "2" },
    { id: "c", rotulo: "iPhone 15", imei: "3" },
    { id: "d", imei: "3" },
  ];
  const msg = primeiroDuplicadoNaLista(lista);
  assert(msg?.includes("IMEI 3"));
  assertEquals(primeiroDuplicadoNaLista(lista.slice(0, 3)), null);
  assertEquals(primeiroDuplicadoNaLista([]), null);
});

Deno.test("(c) total: quantidade e soma dos custos em centavos", () => {
  assertEquals(totalDaCompra([]), { quantidade: 0, somaCustos: 0 });
  assertEquals(
    totalDaCompra([{ custo: 3200 }, { custo: 3200 }, { custo: 3200 }, { custo: 3200 }, { custo: 3200 }]),
    { quantidade: 5, somaCustos: 16000 },
  );
  assertEquals(totalDaCompra([{ custo: 0.1 }, { custo: 0.2 }, { custo: null }, {}]), { quantidade: 4, somaCustos: 0.3 });
});

Deno.test("(d) ids vinculados: principal + adicionais, sem vazio nem repetido", () => {
  assertEquals(idsDispositivosDaCompra("a", undefined), ["a"]);
  assertEquals(idsDispositivosDaCompra("a", ["b", "a", "", "c", "b"]), ["a", "b", "c"]);
  assertEquals(idsDispositivosDaCompra("", ["b"]), ["b"]);
  assertEquals(idsDispositivosDaCompra(null, []), []);
});

Deno.test("(e) Visualizar: principal primeiro, depois por cadastro, sem repetir", () => {
  const lista = [
    { id: "c", created_at: "2026-10-14T13:00:02Z" },
    { id: "p", created_at: "2026-10-14T13:00:05Z" },
    { id: "b", created_at: "2026-10-14T13:00:01Z" },
    { id: "p", created_at: "2026-10-14T13:00:05Z" },
  ];
  assertEquals(ordenarDispositivosDaCompra(lista, "p").map((d) => d.id), ["p", "b", "c"]);
  // Compra antiga: só o principal.
  assertEquals(ordenarDispositivosDaCompra([{ id: "p" }], "p").map((d) => d.id), ["p"]);
});

Deno.test("(e) status do aparelho na compra", () => {
  assertEquals(statusDispositivoCompra({ vendido: false, deleted_at: null }), "em_estoque");
  assertEquals(statusDispositivoCompra({ vendido: true }), "vendido");
  assertEquals(statusDispositivoCompra({ vendido: true, deleted_at: "2026-10-01T00:00:00Z" }), "excluido");
});
