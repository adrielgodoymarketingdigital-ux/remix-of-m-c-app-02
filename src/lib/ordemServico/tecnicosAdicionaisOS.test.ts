// deno test -A --no-check src/lib/ordemServico/tecnicosAdicionaisOS.test.ts
// Técnicos adicionais da OS (F2): regras puras da tela e da gravação, sem banco.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_TECNICOS_ADICIONAIS,
  adicionaisAposTrocarPrincipal,
  adicionarTecnico,
  avisoFalhaTecnicosAdicionais,
  funcionariosElegiveis,
  itensTecnicosAdicionais,
  mensagemErroTecnicosAdicionais,
  mesmosAdicionais,
  normalizarAdicionais,
  planejarGravacaoTecnicosAdicionais,
  podeAdicionarMais,
  removerTecnico,
  validarTecnicosAdicionais,
} from "./tecnicosAdicionaisOS.ts";
import { OS_TECNICOS_ADICIONAIS_PARA_TODOS, tecnicosAdicionaisOSVisivelPara } from "./visibilidadeTecnicosAdicionais.ts";

const F = [
  { id: "dono", nome: "Adriel", cargo: "Dono", ativo: true },
  { id: "a", nome: "Ana", cargo: "Técnico", ativo: true },
  { id: "b", nome: "Bruno", cargo: null, ativo: true },
  { id: "c", nome: "Carla", ativo: true },
  { id: "d", nome: "Davi", ativo: true },
  { id: "e", nome: "Edu", ativo: true },
  { id: "x", nome: "Xico", cargo: "Técnico", ativo: false },
];

test("máximo é 4", () => {
  assert.equal(MAX_TECNICOS_ADICIONAIS, 4);
  assert.equal(podeAdicionarMais(["a", "b", "c"]), true);
  assert.equal(podeAdicionarMais(["a", "b", "c", "d"]), false);
});

test("normalização tira vazio, repetido e o principal, mantendo a ordem", () => {
  assert.deepEqual(normalizarAdicionais(["a", "", null, " b ", "a", "p", undefined, "c"], "p"), ["a", "b", "c"]);
  assert.deepEqual(normalizarAdicionais([], null), []);
});

test("elegíveis: só ativos, sem o principal e sem os já escolhidos; dono entra", () => {
  const ids = funcionariosElegiveis(F, "a", ["b"]).map((f) => f.id);
  assert.deepEqual(ids, ["dono", "c", "d", "e"]);
  assert.ok(!ids.includes("x"), "desativado nunca é elegível");
});

test("adicionar respeita principal, limite, repetição e desativado", () => {
  assert.deepEqual(adicionarTecnico([], "a", null, F), [], "sem principal não adiciona");
  assert.deepEqual(adicionarTecnico([], "a", "dono", F), ["a"]);
  assert.deepEqual(adicionarTecnico(["a"], "a", "dono", F), ["a"], "não repete");
  assert.deepEqual(adicionarTecnico([], "dono", "dono", F), [], "principal não vira adicional");
  assert.deepEqual(adicionarTecnico(["x"], "x", "dono", F), ["x"], "desativado não é readicionado");
  assert.deepEqual(adicionarTecnico([], "x", "dono", F), [], "desativado não entra");
  assert.deepEqual(adicionarTecnico(["a", "b", "c", "d"], "e", "dono", F), ["a", "b", "c", "d"], "para em 4");
  assert.deepEqual(adicionarTecnico([], "sumiu", "dono", F), [], "id fora da loja não entra");
});

test("remover e trocar o principal", () => {
  assert.deepEqual(removerTecnico(["a", "x"], "x"), ["a"]);
  assert.deepEqual(adicionaisAposTrocarPrincipal(["a", "b"], "b"), ["a"]);
  assert.deepEqual(adicionaisAposTrocarPrincipal(["a", "b"], null), ["a", "b"]);
});

test("itens da tela: desativado e removido", () => {
  assert.deepEqual(itensTecnicosAdicionais(["a", "b", "x", "sumiu"], F), [
    { id: "a", rotulo: "Ana (Técnico)", desativado: false },
    { id: "b", rotulo: "Bruno", desativado: false },
    { id: "x", rotulo: "Xico (Técnico) (desativado)", desativado: true },
    { id: "sumiu", rotulo: "Técnico removido", desativado: true },
  ]);
});

test("validação: adicional sem principal bloqueia", () => {
  assert.equal(validarTecnicosAdicionais(null, []), null);
  assert.equal(validarTecnicosAdicionais("a", ["b"]), null);
  assert.match(validarTecnicosAdicionais(null, ["b"]) ?? "", /técnico principal/);
  assert.match(validarTecnicosAdicionais("a", ["b", "c", "d", "e", "x"]) ?? "", /4/);
});

test("mesmos adicionais ignora a ordem", () => {
  assert.equal(mesmosAdicionais(["a", "b"], ["b", "a"]), true);
  assert.equal(mesmosAdicionais(["a"], ["a", "b"]), false);
  assert.equal(mesmosAdicionais(["a", "c"], ["a", "b"]), false);
});

test("plano: sem entrada (freio) nunca grava", () => {
  assert.deepEqual(planejarGravacaoTecnicosAdicionais(undefined, "a"), { acao: "nada" });
});

test("plano: criação", () => {
  const nova = (adicionais: string[]) => ({ adicionais, originais: null, principalOriginal: null });
  assert.deepEqual(planejarGravacaoTecnicosAdicionais(nova(["b", "c"]), "a"), { acao: "rpc", principal: "a", adicionais: ["b", "c"] });
  assert.deepEqual(planejarGravacaoTecnicosAdicionais(nova([]), "a"), { acao: "nada" }, "lista vazia: nada a gravar");
  assert.deepEqual(planejarGravacaoTecnicosAdicionais(nova([]), null), { acao: "nada" }, "sem principal não chama");
});

test("plano: edição", () => {
  const ed = (adicionais: string[], originais: string[], principalOriginal: string | null) => ({ adicionais, originais, principalOriginal });
  assert.deepEqual(planejarGravacaoTecnicosAdicionais(ed(["b", "c"], ["c", "b"], "a"), "a"), { acao: "nada" }, "nada mudou");
  assert.deepEqual(planejarGravacaoTecnicosAdicionais(ed(["b", "d"], ["b", "c"], "a"), "a"), { acao: "rpc", principal: "a", adicionais: ["b", "d"] }, "só adicionais");
  assert.deepEqual(planejarGravacaoTecnicosAdicionais(ed(["c"], ["b", "c"], "a"), "b"), { acao: "rpc", principal: "b", adicionais: ["c"] }, "adicional vira principal");
  assert.deepEqual(planejarGravacaoTecnicosAdicionais(ed([], [], "a"), "b"), { acao: "rpc", principal: "b", adicionais: [] }, "só o principal");
  assert.deepEqual(planejarGravacaoTecnicosAdicionais(ed(["b", "a"], ["b"], "b"), "a"), { acao: "rpc", principal: "a", adicionais: ["b"] }, "principal nunca vai na lista");
  assert.deepEqual(planejarGravacaoTecnicosAdicionais(ed([], ["b"], "a"), null), { acao: "limpar" }, "principal tirado: limpa sem chamar a função");
  assert.deepEqual(planejarGravacaoTecnicosAdicionais(ed([], [], "a"), null), { acao: "nada" });
});

test("erros TA001..TA008 e desconhecido em português", () => {
  for (const c of ["TA001", "TA002", "TA003", "TA004", "TA005", "TA006", "TA007", "TA008"]) {
    const m = mensagemErroTecnicosAdicionais({ code: c, message: "raw" });
    assert.ok(m.length > 10 && !m.includes("raw") && !m.includes(c), `${c}: ${m}`);
  }
  assert.match(mensagemErroTecnicosAdicionais({ code: "TA005" }), /no máximo 4/);
  assert.equal(mensagemErroTecnicosAdicionais({ code: "42501", message: "permission denied" }), "Erro inesperado ao gravar os técnicos adicionais.");
  assert.equal(mensagemErroTecnicosAdicionais(null), "Erro inesperado ao gravar os técnicos adicionais.");
  assert.equal(
    avisoFalhaTecnicosAdicionais({ code: "TA004" }),
    "A OS foi salva, mas os técnicos adicionais não foram gravados: Um dos técnicos escolhidos não é funcionário ativo desta loja. Abra a OS e salve de novo.",
  );
});

test("freio: hoje só admin", () => {
  assert.equal(OS_TECNICOS_ADICIONAIS_PARA_TODOS, false);
  assert.equal(tecnicosAdicionaisOSVisivelPara({ isAdmin: true }), true);
  assert.equal(tecnicosAdicionaisOSVisivelPara({ isAdmin: false }), false);
});
