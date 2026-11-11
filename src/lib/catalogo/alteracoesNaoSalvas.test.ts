// deno test -A --no-check src/lib/catalogo/alteracoesNaoSalvas.test.ts
// "Alterações não salvas" do Salvar único (catálogo + link + publicação). Dados fictícios.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assinaturaEstado,
  canonico,
  estadoBotaoSalvar,
  podeSalvar,
  temAlteracoes,
  type EstadoSalvavelCatalogo,
} from "./alteracoesNaoSalvas.ts";

const config = () => ({
  templateId: "tecnologico",
  textos: { tituloCapa: "Catálogo", subtituloCapa: "Celulares", textoPreco: "A partir de" },
  mostrarPrecos: true,
  itensPerPage: 6,
  corPrimariaPersonalizada: undefined as string | undefined,
  itensSelecionadosIds: undefined as string[] | undefined,
  categoriasCatalogo: [{ id: "c1", nome: "Capas", cor: "#f00", itemIds: ["a", "b"] }],
  textoBotaoWhatsApp: "WhatsApp",
});

const estado = (mudar?: (c: ReturnType<typeof config>) => void, extra?: Partial<EstadoSalvavelCatalogo>): EstadoSalvavelCatalogo => {
  const c = config();
  mudar?.(c);
  return { catalogo: c, slug: "minha-loja", ativo: true, ...extra };
};

test("mesmo estado = sem alterações", () => {
  assert.equal(temAlteracoes(assinaturaEstado(estado()), estado()), false);
});

test("ordem das chaves não importa (o jsonb do banco reordena)", () => {
  const original = estado();
  const c = config();
  const invertido = Object.fromEntries(Object.entries(c).reverse());
  assert.equal(temAlteracoes(assinaturaEstado(original), { ...original, catalogo: invertido }), false);
});

test("undefined, null e lista vazia contam como ausentes", () => {
  const base = assinaturaEstado(estado());
  assert.equal(temAlteracoes(base, estado((c) => { c.itensSelecionadosIds = []; })), false);
  assert.equal(temAlteracoes(base, estado((c) => { (c as Record<string, unknown>).itensSelecionadosIds = null; })), false);
  assert.equal(temAlteracoes(base, estado((c) => { delete (c as Record<string, unknown>).corPrimariaPersonalizada; })), false);
});

test("texto vazio é alteração (título vazio cai no nome da loja)", () => {
  const base = assinaturaEstado(estado());
  assert.equal(temAlteracoes(base, estado((c) => { c.textos.tituloCapa = ""; })), true);
});

test("mudanças reais aparecem", () => {
  const base = assinaturaEstado(estado());
  assert.equal(temAlteracoes(base, estado((c) => { c.templateId = "escuro"; })), true);
  assert.equal(temAlteracoes(base, estado((c) => { c.mostrarPrecos = false; })), true);
  assert.equal(temAlteracoes(base, estado((c) => { c.itensPerPage = 8; })), true);
  assert.equal(temAlteracoes(base, estado((c) => { c.itensSelecionadosIds = ["a"]; })), true);
  assert.equal(temAlteracoes(base, estado((c) => { c.textoBotaoWhatsApp = "Chamar"; })), true);
  assert.equal(temAlteracoes(base, estado((c) => { c.categoriasCatalogo[0].itemIds.push("z"); })), true);
});

test("ícone novo na categoria é alteração", () => {
  const base = assinaturaEstado(estado());
  assert.equal(temAlteracoes(base, estado((c) => { (c.categoriasCatalogo[0] as Record<string, unknown>).icone = "cable"; })), true);
});

test("ordem dentro de listas importa (é a ordem salva)", () => {
  const base = assinaturaEstado(estado());
  assert.equal(temAlteracoes(base, estado((c) => { c.categoriasCatalogo[0].itemIds = ["b", "a"]; })), true);
});

test("marcar e desmarcar o mesmo item volta a 'tudo salvo'", () => {
  const base = assinaturaEstado(estado());
  const marcado = estado((c) => { c.itensSelecionadosIds = ["a"]; });
  assert.equal(temAlteracoes(base, marcado), true);
  assert.equal(temAlteracoes(base, estado((c) => { c.itensSelecionadosIds = []; })), false);
});

test("link e publicação entram no mesmo Salvar", () => {
  const base = assinaturaEstado(estado());
  assert.equal(temAlteracoes(base, estado(undefined, { slug: "outra-loja" })), true);
  assert.equal(temAlteracoes(base, estado(undefined, { ativo: false })), true);
  assert.equal(temAlteracoes(base, estado(undefined, { slug: "  minha-loja " })), false); // espaços nas pontas
});

test("original ausente (ainda carregando) = sem alterações", () => {
  assert.equal(temAlteracoes(null, estado()), false);
  assert.equal(temAlteracoes(undefined, estado()), false);
});

test("canonico: ordena chaves, tira ausentes e não mexe em primitivos", () => {
  assert.deepEqual(canonico({ b: 1, a: { d: undefined, c: [] , e: "" } }), { a: { e: "" }, b: 1 });
  assert.equal(JSON.stringify(canonico({ b: 1, a: 2 })), '{"a":2,"b":1}');
  assert.equal(canonico("x"), "x");
  assert.equal(canonico(0), 0);
  assert.equal(canonico(false), false);
  assert.equal(canonico(Number.NaN), null);
  assert.deepEqual(canonico([1, undefined, { b: 2, a: 1 }]), [1, null, { a: 1, b: 2 }]);
});

test("botão: Salvando, Salvar ou Tudo salvo", () => {
  assert.equal(estadoBotaoSalvar(true, false), "salvar");
  assert.equal(estadoBotaoSalvar(false, false), "tudo_salvo");
  assert.equal(estadoBotaoSalvar(true, true), "salvando");
  assert.equal(estadoBotaoSalvar(false, true), "salvando");
  assert.equal(podeSalvar(true, false), true);
  assert.equal(podeSalvar(false, false), false);
  assert.equal(podeSalvar(true, true), false);
});
