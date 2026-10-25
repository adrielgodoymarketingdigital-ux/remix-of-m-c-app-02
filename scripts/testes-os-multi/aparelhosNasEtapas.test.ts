// deno test --no-check --no-lock scripts/testes-os-multi/
// Etapa 6 da OS com vários dispositivos: blocos por aparelho nas etapas 4
// (defeito/observações) e 5 (checklist/avarias) do assistente
// (src/lib/ordemServico/formularioDispositivosAdicionaisOS.ts). Só dados
// fictícios; nada vai à rede.
import { assertEquals, assertNotStrictEquals, assertStrictEquals } from "jsr:@std/assert@1";
import {
  alterarAparelhoNoEstado,
  entradaGravacaoParaSalvar,
  estadoAdicionaisCarregados,
  estadoAdicionaisCarregando,
  estadoAdicionaisErro,
  estadoAdicionaisNovaOS,
  exibicaoAparelhosNasEtapas,
  prefixoIdAparelho,
  removerAparelhoDoEstado,
  salvarAparelhoNoEstado,
  tituloBlocoDispositivo,
  type EstadoAdicionaisForm,
} from "../../src/lib/ordemServico/formularioDispositivosAdicionaisOS.ts";
import {
  type DispositivoAdicionalForm,
  MAX_DISPOSITIVOS_ADICIONAIS,
  novoDispositivoAdicionalForm,
} from "../../src/lib/ordemServico/gravacaoDispositivosAdicionaisOS.ts";
import { numeroAdicional } from "../../src/lib/ordemServico/dispositivosAdicionaisOS.ts";

const aparelho = (id: string, extra: Partial<DispositivoAdicionalForm> = {}): DispositivoAdicionalForm => ({
  ...novoDispositivoAdicionalForm(id),
  dispositivo_tipo: "Celular",
  dispositivo_marca: "Apple",
  dispositivo_modelo: `iPhone ${id}`,
  ...extra,
});
const comAparelhos = (...ds: DispositivoAdicionalForm[]): EstadoAdicionaisForm =>
  ds.reduce(salvarAparelhoNoEstado, estadoAdicionaisNovaOS());

// ------------------------------------------------------ alterarAparelhoNoEstado

Deno.test("alterar: muda só o campo e só o aparelho pedido", () => {
  const a = aparelho("a");
  const b = aparelho("b");
  const e = comAparelhos(a, b);
  const r = alterarAparelhoNoEstado(e, "b", { defeito_relatado: "Tela quebrada" });
  assertNotStrictEquals(r, e);
  assertEquals(r.dispositivos[1].defeito_relatado, "Tela quebrada");
  assertEquals(r.dispositivos[1], { ...b, defeito_relatado: "Tela quebrada" });
  assertStrictEquals(r.dispositivos[0], a);
  assertStrictEquals(r.removidos, e.removidos);
  assertStrictEquals(r.idsGravados, e.idsGravados);
  // não mexe no original
  assertEquals(b.defeito_relatado, "");
});

Deno.test("alterar: MESMO objeto quando nada muda", () => {
  const checklist = { entrada: { tela: true }, saida: {} };
  const e = comAparelhos(aparelho("a", { observacoes: "risco", checklist }));
  assertStrictEquals(alterarAparelhoNoEstado(e, "a", {}), e);
  assertStrictEquals(alterarAparelhoNoEstado(e, "a", { observacoes: "risco" }), e);
  assertStrictEquals(alterarAparelhoNoEstado(e, "a", { checklist }), e);
  assertStrictEquals(alterarAparelhoNoEstado(e, "a", { defeito_relatado: undefined }), e);
});

Deno.test("alterar: aparelho removido (id que não existe mais) não muda nada", () => {
  const e = comAparelhos(aparelho("a"), aparelho("b"));
  const semB = removerAparelhoDoEstado(e, "b", []).estado;
  assertStrictEquals(alterarAparelhoNoEstado(semB, "b", { defeito_relatado: "x" }), semB);
  assertStrictEquals(alterarAparelhoNoEstado(e, "nao-existe", { defeito_relatado: "x" }), e);
});

Deno.test("alterar: seção carregando/erro não muda nada (nada é enviado para gravar)", () => {
  for (const e of [estadoAdicionaisCarregando(), estadoAdicionaisErro()]) {
    assertStrictEquals(alterarAparelhoNoEstado(e, "a", { defeito_relatado: "x" }), e);
  }
});

Deno.test("alterar: campos vazios gravam vazio (defeito opcional nos extras)", () => {
  const e = comAparelhos(aparelho("a", { defeito_relatado: "Não liga", observacoes: "ok" }));
  const r = alterarAparelhoNoEstado(e, "a", { defeito_relatado: "", observacoes: "" });
  assertEquals(r.dispositivos[0].defeito_relatado, "");
  assertEquals(r.dispositivos[0].observacoes, "");
});

Deno.test("alterar: checklist, avarias e sistema/fabricante/subtipo", () => {
  const e = comAparelhos(aparelho("a"));
  const checklist = { entrada: { tela: true }, saida: { tela: false } };
  const avarias = [{ id: "v1", tipo: "riscos" as const, lado: "frente" as const, x: 10, y: 20 }];
  const r = alterarAparelhoNoEstado(e, "a", {
    checklist,
    avarias_visuais: avarias as DispositivoAdicionalForm["avarias_visuais"],
    dispositivo_sistema: "android",
    dispositivo_fabricante: "samsung",
    dispositivo_subtipo: "",
  });
  assertStrictEquals(r.dispositivos[0].checklist, checklist);
  assertEquals(r.dispositivos[0].avarias_visuais.length, 1);
  assertEquals(r.dispositivos[0].dispositivo_sistema, "android");
  assertEquals(r.dispositivos[0].dispositivo_fabricante, "samsung");
  // tipo/marca/modelo intocados
  assertEquals(r.dispositivos[0].dispositivo_modelo, "iPhone a");
});

Deno.test("alterar: 10 aparelhos — muda só o 10º, os outros 9 são os mesmos objetos", () => {
  const ds = Array.from({ length: MAX_DISPOSITIVOS_ADICIONAIS }, (_, i) => aparelho(`d${i}`));
  const e = comAparelhos(...ds);
  const r = alterarAparelhoNoEstado(e, "d9", { observacoes: "último" });
  assertEquals(r.dispositivos.length, 10);
  assertEquals(r.dispositivos[9].observacoes, "último");
  for (let i = 0; i < 9; i++) assertStrictEquals(r.dispositivos[i], ds[i]);
});

Deno.test("alterar: OS reaberta — o que foi editado no bloco vai para a gravação da 5a", () => {
  const e = estadoAdicionaisCarregados([]);
  const comA = salvarAparelhoNoEstado(e, aparelho("a"));
  const r = alterarAparelhoNoEstado(comA, "a", { defeito_relatado: "Bateria" });
  const entrada = entradaGravacaoParaSalvar(true, r);
  assertEquals(entrada?.dispositivos[0].defeito_relatado, "Bateria");
  assertEquals(entradaGravacaoParaSalvar(false, r), undefined);
});

Deno.test("alterar + diálogo: o diálogo abre com o valor do bloco e o salvar volta para o bloco", () => {
  const e = comAparelhos(aparelho("a"));
  const r = alterarAparelhoNoEstado(e, "a", { defeito_relatado: "Do bloco" });
  // o diálogo abre com r.dispositivos[0] (mesma fonte)
  const doDialogo = { ...r.dispositivos[0], observacoes: "Do diálogo" };
  const depois = salvarAparelhoNoEstado(r, doDialogo);
  assertEquals(depois.dispositivos[0].defeito_relatado, "Do bloco");
  assertEquals(depois.dispositivos[0].observacoes, "Do diálogo");
});

// ------------------------------------------------------------------- rótulos

Deno.test("título do bloco: 'Dispositivo N — marca modelo'", () => {
  assertEquals(
    tituloBlocoDispositivo(1, { dispositivo_tipo: "Celular", dispositivo_marca: "Apple", dispositivo_modelo: "iPhone 11" }),
    "Dispositivo 1 — Apple iPhone 11",
  );
  assertEquals(tituloBlocoDispositivo(numeroAdicional(0), aparelho("12")), "Dispositivo 2 — Apple iPhone 12");
  assertEquals(tituloBlocoDispositivo(numeroAdicional(9), aparelho("x")), "Dispositivo 11 — Apple iPhone x");
});

Deno.test("título do bloco: campos vazios", () => {
  assertEquals(tituloBlocoDispositivo(2, { dispositivo_tipo: "Notebook", dispositivo_marca: "", dispositivo_modelo: "" }), "Dispositivo 2 — Notebook");
  assertEquals(tituloBlocoDispositivo(2, { dispositivo_marca: "  ", dispositivo_modelo: " A55 " }), "Dispositivo 2 — A55");
  assertEquals(tituloBlocoDispositivo(1, {}), "Dispositivo 1");
  assertEquals(tituloBlocoDispositivo(1, { dispositivo_tipo: null, dispositivo_marca: null, dispositivo_modelo: null }), "Dispositivo 1");
  assertEquals(tituloBlocoDispositivo(3, novoDispositivoAdicionalForm("z")), "Dispositivo 3");
});

Deno.test("prefixo de id: único por aparelho", () => {
  assertEquals(prefixoIdAparelho("abc"), "adicional-abc-");
  assertNotStrictEquals(prefixoIdAparelho("a"), prefixoIdAparelho("b"));
});

// ------------------------------------------------------------------ exibição

Deno.test("exibição: sem estado ou sem aparelhos = etapa idêntica (nenhuma)", () => {
  assertEquals(exibicaoAparelhosNasEtapas(undefined), "nenhuma");
  assertEquals(exibicaoAparelhosNasEtapas(estadoAdicionaisNovaOS()), "nenhuma");
  assertEquals(exibicaoAparelhosNasEtapas(estadoAdicionaisCarregados([])), "nenhuma");
});

Deno.test("exibição: carregando, erro e blocos", () => {
  assertEquals(exibicaoAparelhosNasEtapas(estadoAdicionaisCarregando()), "carregando");
  assertEquals(exibicaoAparelhosNasEtapas(estadoAdicionaisErro()), "erro");
  assertEquals(exibicaoAparelhosNasEtapas(comAparelhos(aparelho("a"))), "blocos");
});

Deno.test("exibição: remover o último aparelho volta para 'nenhuma'", () => {
  const e = comAparelhos(aparelho("a"));
  const r = removerAparelhoDoEstado(e, "a", []).estado;
  assertEquals(exibicaoAparelhosNasEtapas(r), "nenhuma");
});
