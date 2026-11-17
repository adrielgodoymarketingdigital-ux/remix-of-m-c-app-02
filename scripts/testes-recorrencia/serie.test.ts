// TZ=America/Sao_Paulo deno test --no-check --no-lock scripts/testes-recorrencia/
// (também rodar com TZ=UTC: o resultado não pode depender do fuso)
import { assert, assertEquals, assertNotEquals } from "jsr:@std/assert@1";
import {
  chaveOcorrencia,
  chaveSerie,
  competenciasFaltantes,
  deveGerarProxima,
  diaFixoDaSerie,
  normalizarNomeConta,
  ocorrenciaJaExiste,
  parcelaDoMesAtual,
  proximaDataComDiaFixo,
  type ContaRecorrencia,
} from "../../src/lib/contas/recorrencia.ts";

const base: ContaRecorrencia = {
  id: "c1",
  user_id: "dono",
  empresa_id: null,
  nome: "Aluguel",
  tipo: "pagar",
  data: "2026-11-10",
  status: "pago",
  recorrente: true,
  usa_historico_pagamentos: false,
};

// ---------------------------------------------------------------- (a) causa
Deno.test("(a) causa: recorrente do modelo novo (usa_historico_pagamentos) quitada gera a próxima", () => {
  const conta = { ...base, usa_historico_pagamentos: true, status: "pago" };
  const p = deveGerarProxima(conta);
  assert(p !== null, "conta do modelo novo quitada tem que gerar a próxima");
  assertEquals(p.data, "2026-12-10");
});

Deno.test("(a) mesma resposta nos dois modelos e nos dois tipos", () => {
  for (const usa of [true, false]) {
    assertEquals(deveGerarProxima({ ...base, usa_historico_pagamentos: usa })?.data, "2026-12-10");
    assertEquals(
      deveGerarProxima({ ...base, tipo: "receber", status: "recebido", usa_historico_pagamentos: usa })?.data,
      "2026-12-10",
    );
  }
});

// ------------------------------------------------------- (b) nada a gerar
Deno.test("(b) conta NÃO recorrente: nada a gerar, em qualquer status e modelo", () => {
  for (const recorrente of [false, null, undefined]) {
    for (const status of ["pago", "recebido", "pendente", null]) {
      for (const usa of [true, false, null]) {
        assertEquals(deveGerarProxima({ ...base, recorrente, status, usa_historico_pagamentos: usa }), null);
      }
    }
  }
});

Deno.test("(b) recorrente ainda pendente (pagamento parcial) não gera", () => {
  assertEquals(deveGerarProxima({ ...base, status: "pendente" }), null);
  assertEquals(deveGerarProxima({ ...base, status: null }), null);
});

Deno.test("(b) conta virtual de venda nunca gera", () => {
  assertEquals(deveGerarProxima({ ...base, id: "venda_abc", tipo: "receber", status: "recebido" }), null);
});

// ------------------------------------------------- (c) calendário e dia fixo
Deno.test("(c) dia fixo 31 não recua: 31/01 → 28/02 → 31/03 → 30/04 → 31/05", () => {
  const datas = ["2027-01-31"];
  for (let i = 0; i < 4; i++) {
    datas.push(proximaDataComDiaFixo(datas[datas.length - 1], diaFixoDaSerie(datas)).data);
  }
  assertEquals(datas, ["2027-01-31", "2027-02-28", "2027-03-31", "2027-04-30", "2027-05-31"]);
});

Deno.test("(c) fevereiro bissexto e dias 29/30", () => {
  assertEquals(proximaDataComDiaFixo("2028-01-31", 31).data, "2028-02-29");
  assertEquals(proximaDataComDiaFixo("2028-02-29", 31).data, "2028-03-31");
  assertEquals(proximaDataComDiaFixo("2027-01-29", 29).data, "2027-02-28");
  assertEquals(proximaDataComDiaFixo("2027-02-28", 29).data, "2027-03-29");
  assertEquals(proximaDataComDiaFixo("2028-01-29", 29).data, "2028-02-29");
  assertEquals(proximaDataComDiaFixo("2027-01-30", 30).data, "2027-02-28");
  assertEquals(proximaDataComDiaFixo("2027-02-28", 30).data, "2027-03-30");
  assertEquals(proximaDataComDiaFixo("2026-03-31", 31).data, "2026-04-30");
});

Deno.test("(c) virada de ano", () => {
  const p = proximaDataComDiaFixo("2026-12-31", 31);
  assertEquals([p.data, p.ano, p.mes], ["2027-01-31", 2027, 1]);
  assertEquals(proximaDataComDiaFixo("2026-12-05").data, "2027-01-05");
  assertEquals(competenciasFaltantes("2026-11-10", "2027-01-15"), [{ ano: 2026, mes: 12 }, { ano: 2027, mes: 1 }]);
  assertEquals(parcelaDoMesAtual("2026-11-30", "2027-01-15", 30), "2027-01-30");
});

Deno.test("(c) sem dia fixo, usa o dia da própria data (igual a proximaDataRecorrente)", () => {
  assertEquals(proximaDataComDiaFixo("2026-11-20").data, "2026-12-20");
  assertEquals(proximaDataComDiaFixo("2027-01-31").data, "2027-02-28");
  assertEquals(proximaDataComDiaFixo("2026-11-20T00:00:00+00:00").data, "2026-12-20");
});

Deno.test("(c) diaFixoDaSerie: fim de mês encurtado volta ao dia certo; mudança de dia vale", () => {
  assertEquals(diaFixoDaSerie(["2027-01-31", "2027-02-28"]), 31);
  assertEquals(diaFixoDaSerie(["2027-02-28", "2027-01-31"]), 31); // ordem não importa
  assertEquals(diaFixoDaSerie(["2027-01-30", "2027-02-28"]), 30);
  assertEquals(diaFixoDaSerie(["2027-01-29", "2027-02-28"]), 29);
  assertEquals(diaFixoDaSerie(["2027-01-15", "2027-02-28"]), 28); // usuário mudou o dia
  assertEquals(diaFixoDaSerie(["2027-03-31", "2027-04-30"]), 31);
  assertEquals(diaFixoDaSerie(["2027-03-30", "2027-04-30"]), 30);
  assertEquals(diaFixoDaSerie(["2027-03-10", "2027-04-10"]), 10);
  assertEquals(diaFixoDaSerie(["2027-02-28"]), 28); // sem histórico: não inventa 31
});

Deno.test("(c) janela de 'já existe' cobre o dia em que o código antigo geraria", () => {
  assertEquals(proximaDataComDiaFixo("2026-11-20").janelaInicio, "2026-12-19");
  assertEquals(proximaDataComDiaFixo("2026-11-01").janelaInicio, "2026-11-30");
  // 28/02 com dia fixo 31: antigo geraria 28/03 (véspera 27/03); novo gera 31/03.
  const p = proximaDataComDiaFixo("2027-02-28", 31);
  assertEquals([p.janelaInicio, p.data], ["2027-03-27", "2027-03-31"]);
});

Deno.test("(c) competenciasFaltantes e parcelaDoMesAtual (só o mês atual)", () => {
  assertEquals(competenciasFaltantes("2026-11-10", "2026-11-17"), []);
  assertEquals(competenciasFaltantes("2026-12-10", "2026-11-17"), []); // série no futuro
  assertEquals(competenciasFaltantes("2026-10-10", "2026-11-17"), [{ ano: 2026, mes: 11 }]);
  assertEquals(competenciasFaltantes("2026-08-31", "2026-11-01").length, 3);
  assertEquals(parcelaDoMesAtual("2026-11-10", "2026-11-17"), null);
  assertEquals(parcelaDoMesAtual("2026-12-10", "2026-11-17"), null);
  assertEquals(parcelaDoMesAtual("2026-08-31", "2026-11-01", 31), "2026-11-30"); // 3 meses parada: 1 parcela
  assertEquals(parcelaDoMesAtual("2026-08-31", "2027-02-01", 31), "2027-02-28");
  assertEquals(parcelaDoMesAtual("2026-10-05", "2026-11-30"), "2026-11-05");
});

// -------------------------------------------------------- (d) idempotência
Deno.test("(d) chaveSerie: nome normalizado; filial, dono e tipo separam séries", () => {
  assertEquals(normalizarNomeConta("  Aluguel   da  Loja "), "aluguel da loja");
  assertEquals(chaveSerie(base), chaveSerie({ ...base, nome: " ALUGUEL " }));
  assertNotEquals(chaveSerie(base), chaveSerie({ ...base, empresa_id: "filial-1" }));
  assertNotEquals(chaveSerie(base), chaveSerie({ ...base, user_id: "outro" }));
  assertNotEquals(chaveSerie(base), chaveSerie({ ...base, tipo: "receber" }));
  assertNotEquals(chaveSerie(base), chaveSerie({ ...base, nome: "Água" }));
  assertNotEquals(normalizarNomeConta("Água"), normalizarNomeConta("Agua")); // acento conta
});

Deno.test("(d) gerar duas vezes da mesma conta dá a mesma ocorrência", () => {
  const a = deveGerarProxima(base)!;
  const b = deveGerarProxima({ ...base })!;
  assertEquals(chaveOcorrencia(base, a.data), chaveOcorrencia(base, b.data));
  // a ocorrência gerada é reconhecida como já existente
  const gerada = { ...base, data: a.data, status: "pendente" };
  assert(ocorrenciaJaExiste(base, a, [gerada]));
});

Deno.test("(d) ocorrenciaJaExiste: regra de filial, véspera antiga, nome, tipo, recorrente", () => {
  const p = deveGerarProxima(base)!; // 2026-12-10, janela desde 2026-12-09
  const c = { ...base, data: p.data };
  assert(ocorrenciaJaExiste(base, p, [{ ...c, nome: "aluguel " }]));
  assert(ocorrenciaJaExiste(base, p, [{ ...c, data: "2026-12-09" }])); // gerada pelo código antigo
  assert(!ocorrenciaJaExiste(base, p, [{ ...c, data: "2026-12-08" }]));
  assert(!ocorrenciaJaExiste(base, p, [{ ...c, data: "2026-12-11" }]));
  assert(!ocorrenciaJaExiste(base, p, [{ ...c, tipo: "receber" }]));
  assert(!ocorrenciaJaExiste(base, p, [{ ...c, recorrente: false }]));
  assert(!ocorrenciaJaExiste(base, p, [{ ...c, user_id: "outro" }]));
  assert(!ocorrenciaJaExiste(base, p, [{ ...c, nome: "Aluguel 2" }]));
  assert(!ocorrenciaJaExiste(base, p, []));
  // conta sem filial: só candidata sem filial
  assert(!ocorrenciaJaExiste(base, p, [{ ...c, empresa_id: "filial-1" }]));
  // conta de filial: mesma filial ou sem filial (código antigo gerava sem empresa_id)
  const f = { ...base, empresa_id: "filial-1" };
  assert(ocorrenciaJaExiste(f, p, [{ ...c, empresa_id: "filial-1" }]));
  assert(ocorrenciaJaExiste(f, p, [{ ...c, empresa_id: null }]));
  assert(!ocorrenciaJaExiste(f, p, [{ ...c, empresa_id: "filial-2" }]));
});
