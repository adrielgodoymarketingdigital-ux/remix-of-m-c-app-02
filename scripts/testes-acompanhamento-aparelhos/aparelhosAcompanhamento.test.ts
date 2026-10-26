// deno test --no-check --allow-read scripts/testes-acompanhamento-aparelhos/
// Aparelhos extras nos links de acompanhamento (src/lib/acompanhamento/aparelhosAcompanhamento.ts):
// leitura da coluna "dispositivos_adicionais" das RPCs e a lista que o card mostra.
// O que sai do banco (só tipo, marca, modelo e defeito da própria OS) é decidido no SQL;
// aqui é o que a tela faz com a resposta.
import { assertEquals } from "jsr:@std/assert@1";
import {
  aparelhosDoAcompanhamento, listaAparelhosOS, nomeAparelho, nomesExtras, tituloAparelho,
} from "../../src/lib/acompanhamento/aparelhosAcompanhamento.ts";

const extra = (marca: string, modelo: string, defeito: string | null = null, tipo = "Celular") => ({
  dispositivo_tipo: tipo, dispositivo_marca: marca, dispositivo_modelo: modelo, defeito_relatado: defeito,
});
const os1 = { dispositivo_marca: "Apple", dispositivo_modelo: "iPhone 12", defeito_relatado: "Tela quebrada" };

Deno.test("resposta da RPC: lista de extras vira lista de aparelhos, na ordem", () => {
  assertEquals(aparelhosDoAcompanhamento([extra("Samsung", "A55"), extra("Motorola", "G84", "Não carrega")]), [
    extra("Samsung", "A55"), extra("Motorola", "G84", "Não carrega"),
  ]);
});

Deno.test("resposta antiga, sem o campo (antes da migration) ou lixo: nenhum extra, sem erro", () => {
  for (const v of [undefined, null, "", "[]", 7, {}, { 0: extra("A", "B") }, [], [null, 1, "x", []]]) {
    assertEquals(aparelhosDoAcompanhamento(v), []);
  }
});

Deno.test("só os 4 campos conhecidos passam — chave extra na resposta é descartada", () => {
  const vindo = [{ ...extra("Samsung", "A55"), dispositivo_imei: "351234567890123", senha_desbloqueio: { tipo: "pin" }, fotos_dispositivo: ["https://x/y.jpg"], observacoes: "interna" }];
  assertEquals(aparelhosDoAcompanhamento(vindo), [extra("Samsung", "A55")]);
  assertEquals(Object.keys(aparelhosDoAcompanhamento(vindo)[0]).sort(), ["defeito_relatado", "dispositivo_marca", "dispositivo_modelo", "dispositivo_tipo"]);
});

Deno.test("textos vazios viram null; item sem tipo, marca e modelo é descartado", () => {
  assertEquals(aparelhosDoAcompanhamento([{ dispositivo_tipo: " ", dispositivo_marca: "", dispositivo_modelo: null, defeito_relatado: "x" }]), []);
  assertEquals(aparelhosDoAcompanhamento([{ dispositivo_marca: " Samsung ", dispositivo_modelo: "A55", defeito_relatado: "  " }]), [
    { dispositivo_tipo: null, dispositivo_marca: "Samsung", dispositivo_modelo: "A55", defeito_relatado: null },
  ]);
});

Deno.test("nome: marca + modelo; sem os dois, o tipo", () => {
  assertEquals(nomeAparelho(extra("Samsung", "A55")), "Samsung A55");
  assertEquals(nomeAparelho({ dispositivo_tipo: "Notebook", dispositivo_marca: null, dispositivo_modelo: null }), "Notebook");
  assertEquals(nomeAparelho({}), "");
  assertEquals(tituloAparelho(2), "Aparelho 2");
});

Deno.test("OS de 1 aparelho (sem extras ou campo ausente): lista vazia = card de sempre", () => {
  assertEquals(listaAparelhosOS({ ...os1 }, true), []);
  assertEquals(listaAparelhosOS({ ...os1, dispositivos_adicionais: [] }, true), []);
});

Deno.test("OS com 2 extras: Aparelho 1 (da OS) + 2 e 3, com defeito", () => {
  const lista = listaAparelhosOS({ ...os1, dispositivos_adicionais: [extra("Samsung", "A55", "Bateria"), extra("Motorola", "G84")] }, true);
  assertEquals(lista, [
    { titulo: "Aparelho 1", nome: "Apple iPhone 12", defeito: "Tela quebrada" },
    { titulo: "Aparelho 2", nome: "Samsung A55", defeito: "Bateria" },
    { titulo: "Aparelho 3", nome: "Motorola G84", defeito: null },
  ]);
});

Deno.test("loja desligou mostrar defeito: nenhum defeito na lista, nem do aparelho 1", () => {
  const lista = listaAparelhosOS({ ...os1, dispositivos_adicionais: [extra("Samsung", "A55", "Bateria")] }, false);
  assertEquals(lista.map((a) => a.defeito), [null, null]);
});

Deno.test("aparelho 1 sem marca e modelo aparece como —", () => {
  const lista = listaAparelhosOS({ dispositivo_marca: null, dispositivo_modelo: null, defeito_relatado: null, dispositivos_adicionais: [extra("Samsung", "A55")] }, true);
  assertEquals(lista[0], { titulo: "Aparelho 1", nome: "—", defeito: null });
});

Deno.test("10 extras: Aparelho 1 a 11, na ordem recebida", () => {
  const extras = Array.from({ length: 10 }, (_, i) => extra("Marca", `Modelo ${i + 2}`));
  const lista = listaAparelhosOS({ ...os1, dispositivos_adicionais: extras }, true);
  assertEquals(lista.length, 11);
  assertEquals(lista.map((a) => a.titulo), Array.from({ length: 11 }, (_, i) => `Aparelho ${i + 1}`));
  assertEquals(lista[10].nome, "Marca Modelo 11");
});

Deno.test("nomes dos extras para resumo e planilha", () => {
  assertEquals(nomesExtras(undefined), []);
  assertEquals(nomesExtras([extra("Samsung", "A55"), extra("Motorola", "G84")]), ["Samsung A55", "Motorola G84"]);
});
