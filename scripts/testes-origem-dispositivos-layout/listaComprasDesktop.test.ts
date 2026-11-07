// deno test --no-check scripts/testes-origem-dispositivos-layout/
// Dados totalmente fictícios (nomes "Teste", IMEIs de zeros).
import { assertEquals, assertStrictEquals } from "jsr:@std/assert@1";
import {
  CABECALHO_CSV,
  celulaCsv,
  type CompraDaLista,
  comprasParaExportar,
  filtrarPorValor,
  lerValorFiltro,
  montarCsvCompras,
  nomeArquivoCsvCompras,
  ordenarCompras,
  paginar,
  paginasVisiveis,
  proximaOrdenacao,
  quantidadeAparelhosDaCompra,
  resumoCompras,
} from "../../src/lib/origem/listaComprasDesktop.ts";

const c = (id: string, extra: Partial<CompraDaLista> = {}): CompraDaLista => ({
  id, dispositivo_id: `d-${id}`, data_compra: "2026-11-01", valor_pago: 100, forma_pagamento: "dinheiro", ...extra,
});
const ids = (l: { id: string }[]) => l.map((x) => x.id).join(",");

// ---------- Indicadores ----------

Deno.test("aparelhos da compra: principal + vinculados, sem repetir; sem vínculo conta 1", () => {
  assertEquals(quantidadeAparelhosDaCompra(c("a")), 1);
  assertEquals(quantidadeAparelhosDaCompra(c("a", { aparelhos: [] })), 1);
  assertEquals(quantidadeAparelhosDaCompra(c("a", { aparelhos: [{ id: "d-a" }] })), 1);
  assertEquals(quantidadeAparelhosDaCompra(c("a", { aparelhos: [{ id: "d-a" }, { id: "x" }, { id: "y" }] })), 3);
  assertEquals(quantidadeAparelhosDaCompra(c("a", { aparelhos: [{ id: "x" }, { id: "y" }] })), 3, "principal sem compra_id ainda conta");
  assertEquals(quantidadeAparelhosDaCompra(c("a", { aparelhos: null })), 1);
});

Deno.test("resumo: soma em centavos, conta aparelhos e repassa pessoas cadastradas", () => {
  const lista = [
    c("1", { valor_pago: 0.1 }),
    c("2", { valor_pago: 0.2, aparelhos: [{ id: "d-2" }, { id: "z" }] }),
    c("3", { valor_pago: 999999.99 }),
    c("4", { valor_pago: null }),
  ];
  assertEquals(resumoCompras(lista, 7), { totalCompras: 4, valorTotal: 1000000.29, dispositivos: 5, fornecedores: 7 });
});

Deno.test("resumo da lista vazia", () => {
  assertEquals(resumoCompras([], 0), { totalCompras: 0, valorTotal: 0, dispositivos: 0, fornecedores: 0 });
  assertEquals(resumoCompras([], 3).fornecedores, 3, "pessoas não dependem do filtro");
});

// ---------- Filtro de valor ----------

Deno.test("lerValorFiltro aceita formatos brasileiros e com ponto", () => {
  assertEquals(lerValorFiltro("1234,56"), 1234.56);
  assertEquals(lerValorFiltro("1.234,56"), 1234.56);
  assertEquals(lerValorFiltro("R$ 1.234,56"), 1234.56);
  assertEquals(lerValorFiltro("1234.56"), 1234.56);
  assertEquals(lerValorFiltro("1.234"), 1234);
  assertEquals(lerValorFiltro("1.000.000"), 1000000);
  assertEquals(lerValorFiltro("0"), 0);
  assertEquals(lerValorFiltro(" 50 "), 50);
});

Deno.test("lerValorFiltro: vazio e inválido viram null (sem limite)", () => {
  for (const t of ["", "   ", null, undefined, "abc", "-10", "1,2,3", "1e5", "R$"]) assertEquals(lerValorFiltro(t), null, String(t));
});

Deno.test("filtrarPorValor: limites inclusivos, null ignora, centavos exatos", () => {
  const l = [c("a", { valor_pago: 50 }), c("b", { valor_pago: 100 }), c("c", { valor_pago: 100.01 }), c("d", { valor_pago: 0.1 + 0.2 })];
  assertStrictEquals(filtrarPorValor(l, null, null), l);
  assertEquals(ids(filtrarPorValor(l, 50, 100)), "a,b");
  assertEquals(ids(filtrarPorValor(l, 100, null)), "b,c");
  assertEquals(ids(filtrarPorValor(l, null, 0.3)), "d", "0.1+0.2 conta como 0,30");
  assertEquals(ids(filtrarPorValor(l, 200, 10)), "", "mínimo maior que máximo não é invertido");
});

// ---------- Ordenação ----------

Deno.test("ciclo do clique no cabeçalho", () => {
  assertEquals(proximaOrdenacao(null, "data"), { campo: "data", direcao: "asc" });
  assertEquals(proximaOrdenacao({ campo: "data", direcao: "asc" }, "data"), { campo: "data", direcao: "desc" });
  assertEquals(proximaOrdenacao({ campo: "data", direcao: "desc" }, "data"), null);
  assertEquals(proximaOrdenacao({ campo: "data", direcao: "desc" }, "valor"), { campo: "valor", direcao: "asc" });
});

Deno.test("padrão (null) devolve a mesma lista, na ordem do hook", () => {
  const l = [c("1"), c("2")];
  assertStrictEquals(ordenarCompras(l, null), l);
});

Deno.test("ordena por data como texto, desempate pela hora do cadastro", () => {
  const l = [
    c("a", { data_compra: "2026-11-05", created_at: "2026-11-05T10:00:00Z" }),
    c("b", { data_compra: "2025-12-31" }),
    c("c", { data_compra: "2026-11-05", created_at: "2026-11-05T09:00:00Z" }),
    c("d", { data_compra: "2026-01-13" }),
  ];
  assertEquals(ids(ordenarCompras(l, { campo: "data", direcao: "asc" })), "b,d,c,a");
  assertEquals(ids(ordenarCompras(l, { campo: "data", direcao: "desc" })), "a,c,d,b");
});

Deno.test("ordena por dispositivo ignorando acento/maiúscula e com número pelo valor", () => {
  const d = (id: string, marca: string | null, modelo: string | null) => c(id, { dispositivos: { marca, modelo } });
  const l = [d("1", "Marca Teste", "Modelo 10"), d("2", "marca teste", "modelo 2"), d("3", "Ágata", "X"), d("4", null, null)];
  assertEquals(ids(ordenarCompras(l, { campo: "dispositivo", direcao: "asc" })), "4,3,2,1");
  assertEquals(ids(ordenarCompras(l, { campo: "dispositivo", direcao: "desc" })), "1,2,3,4");
});

Deno.test("ordena por valor; empate mantém a ordem recebida (estável)", () => {
  const l = [c("a", { valor_pago: 300 }), c("b", { valor_pago: 50 }), c("c", { valor_pago: 300 }), c("d", { valor_pago: null })];
  assertEquals(ids(ordenarCompras(l, { campo: "valor", direcao: "asc" })), "d,b,a,c");
  assertEquals(ids(ordenarCompras(l, { campo: "valor", direcao: "desc" })), "a,c,b,d");
  assertEquals(ids(l), "a,b,c,d", "não altera a lista original");
});

// ---------- Paginação ----------

const vinte = Array.from({ length: 23 }, (_, i) => i + 1);

Deno.test("paginar: fatias, faixa 'Exibindo X a Y de Z'", () => {
  assertEquals(paginar(vinte, 1, 10), { itens: vinte.slice(0, 10), pagina: 1, totalPaginas: 3, inicio: 1, fim: 10, total: 23 });
  assertEquals(paginar(vinte, 3, 10), { itens: [21, 22, 23], pagina: 3, totalPaginas: 3, inicio: 21, fim: 23, total: 23 });
});

Deno.test("paginar: página fora do intervalo é corrigida", () => {
  assertEquals(paginar(vinte, 9, 10).pagina, 3, "filtro reduziu a lista");
  assertEquals(paginar(vinte, 0, 10).pagina, 1);
  assertEquals(paginar(vinte, -2, 10).pagina, 1);
  assertEquals(paginar(vinte, Number.NaN, 10).pagina, 1);
});

Deno.test("paginar lista vazia: 1 página, 0 a 0 de 0", () => {
  assertEquals(paginar([], 1, 10), { itens: [], pagina: 1, totalPaginas: 1, inicio: 0, fim: 0, total: 0 });
});

Deno.test("paginasVisiveis com reticências", () => {
  assertEquals(paginasVisiveis(1, 1), [1]);
  assertEquals(paginasVisiveis(2, 3), [1, 2, 3]);
  assertEquals(paginasVisiveis(1, 12), [1, 2, "…", 12]);
  assertEquals(paginasVisiveis(5, 12), [1, "…", 4, 5, 6, "…", 12]);
  assertEquals(paginasVisiveis(12, 12), [1, "…", 11, 12]);
  assertEquals(paginasVisiveis(3, 12), [1, 2, 3, 4, "…", 12]);
});

// ---------- CSV ----------

Deno.test("comprasParaExportar: sem seleção = todas as filtradas; com seleção = só as selecionadas visíveis, na ordem da tela", () => {
  const l = [c("1"), c("2"), c("3")];
  assertStrictEquals(comprasParaExportar(l, new Set()), l);
  assertEquals(ids(comprasParaExportar(l, new Set(["3", "1"]))), "1,3");
  assertEquals(ids(comprasParaExportar(l, new Set(["9"]))), "", "selecionada que saiu do filtro não vai");
});

Deno.test("celulaCsv neutraliza injeção de planilha", () => {
  assertEquals(celulaCsv("=1+1"), "'=1+1");
  assertEquals(celulaCsv("+55 00"), "'+55 00");
  assertEquals(celulaCsv("-10"), "'-10");
  assertEquals(celulaCsv("@SOMA(A1)"), "'@SOMA(A1)");
  assertEquals(celulaCsv("\tx"), "'\tx");
  assertEquals(celulaCsv("\rx"), "\"'\rx\"", "CR no início: neutraliza e ainda põe entre aspas");
  assertEquals(celulaCsv("Texto = normal"), "Texto = normal");
});

Deno.test("celulaCsv escapa ; aspas e quebra de linha", () => {
  assertEquals(celulaCsv('Marca "Aspas"'), '"Marca ""Aspas"""');
  assertEquals(celulaCsv("Modelo; E"), '"Modelo; E"');
  assertEquals(celulaCsv("linha1\nlinha2"), '"linha1\nlinha2"');
  assertEquals(celulaCsv('=HYPERLINK("x";"y")'), `"'=HYPERLINK(""x"";""y"")"`);
  assertEquals(celulaCsv(null), "");
  assertEquals(celulaCsv(undefined), "");
  assertEquals(celulaCsv(3), "3");
});

Deno.test("montarCsvCompras: BOM, cabeçalho em português, ; e CRLF", () => {
  const csv = montarCsvCompras([]);
  assertEquals(csv.charCodeAt(0), 0xfeff);
  assertEquals(csv, "﻿" + CABECALHO_CSV.join(";") + "\r\n");
  assertEquals(CABECALHO_CSV.join(";"), "Data;Pessoa/Fornecedor;CPF/CNPJ;Dispositivo;Cor;IMEI;Aparelhos na compra;Valor pago;Pagamento;Termo");
});

Deno.test("montarCsvCompras: linhas com dados fictícios", () => {
  const csv = montarCsvCompras([
    c("1", {
      data_compra: "2026-11-05", valor_pago: 1234.5, forma_pagamento: "pix", termo_pdf_url: "http://teste.invalid/t.pdf",
      origem_pessoas: { nome: "Pessoa Teste Um", cpf_cnpj: "00000000000" },
      dispositivos: { marca: "Marca Teste", modelo: "Modelo A", cor: "Preto", imei: "000000000000001" },
      aparelhos: [{ id: "d-1" }, { id: "x" }],
    }),
    c("2", {
      data_compra: "2025-12-31", valor_pago: 0.1 + 0.2, forma_pagamento: "cartao_credito",
      fornecedores: { nome: "=Fornecedor Teste" },
      dispositivos: { marca: 'Marca "Aspas"', modelo: "Modelo; E" },
    }),
    c("3", { valor_pago: 999999.99, forma_pagamento: "desconhecida" }),
  ]);
  const linhas = csv.slice(1).split("\r\n");
  assertEquals(linhas[1], "05/11/2026;Pessoa Teste Um;00000000000;Marca Teste Modelo A;Preto;000000000000001;2;1234,50;PIX;Sim");
  assertEquals(linhas[2], `31/12/2025;'=Fornecedor Teste;;"Marca ""Aspas"" Modelo; E";;;1;0,30;Crédito;Não`);
  assertEquals(linhas[3], "01/11/2026;;;;;;1;999999,99;desconhecida;Não");
  assertEquals(linhas[4], "", "termina com CRLF");
  assertEquals(linhas.length, 5);
});

Deno.test("nome do arquivo usa a data de hoje (já em Brasília)", () => {
  assertEquals(nomeArquivoCsvCompras("2026-11-07"), "compras-dispositivos-2026-11-07.csv");
  // Timestamp não é recortado (o recorte daria o dia UTC): cai no nome neutro.
  assertEquals(nomeArquivoCsvCompras("2026-11-08T01:30:00Z"), "compras-dispositivos-sem-data.csv");
  assertEquals(nomeArquivoCsvCompras(""), "compras-dispositivos-sem-data.csv");
});
