// deno test -A --no-check src/lib/catalogo/gravacaoCatalogoDesktop.test.ts
// Salvar único do Catálogo no computador: o que grava e quando recusa. Dados fictícios.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  formatarLink,
  linkDoNomeDaLoja,
  linkMudou,
  montarGravacao,
  precisaConferirLink,
  resultadoGravacao,
} from "./gravacaoCatalogoDesktop.ts";

const CONFIG = { templateId: "escuro", textos: { tituloCapa: "Loja" }, corPrimariaPersonalizada: undefined };
const SALVO = { slug: "minha-loja", ativo: true };

test("só a config mudou: grava só catalogo_config", () => {
  const g = montarGravacao(SALVO, { catalogo: CONFIG, slug: "minha-loja", ativo: true }, null);
  assert.equal(g.ok, true);
  if (!g.ok) return;
  assert.deepEqual(Object.keys(g.dados), ["catalogo_config"]);
  assert.deepEqual(g.dados.catalogo_config, { templateId: "escuro", textos: { tituloCapa: "Loja" } }); // undefined some
  assert.notEqual(g.dados.catalogo_config, CONFIG); // cópia, não a referência
});

test("loja sem link que só trocou o template: não grava slug vazio", () => {
  const g = montarGravacao({ slug: null, ativo: false }, { catalogo: CONFIG, slug: "", ativo: false }, null);
  assert.equal(g.ok, true);
  if (g.ok) assert.deepEqual(Object.keys(g.dados), ["catalogo_config"]);
});

test("link novo disponível: grava o slug sem espaços", () => {
  const g = montarGravacao(SALVO, { catalogo: CONFIG, slug: " outra-loja ", ativo: true }, true);
  assert.equal(g.ok, true);
  if (g.ok) {
    assert.equal(g.dados.catalogo_slug, "outra-loja");
    assert.equal("catalogo_ativo" in g.dados, false);
  }
});

test("link novo: curto, em uso ou ainda conferindo não grava", () => {
  assert.deepEqual(montarGravacao(SALVO, { catalogo: CONFIG, slug: "ab", ativo: false }, true), { ok: false, erro: "link_curto" });
  assert.deepEqual(montarGravacao(SALVO, { catalogo: CONFIG, slug: "", ativo: false }, null), { ok: false, erro: "link_curto" });
  assert.deepEqual(montarGravacao(SALVO, { catalogo: CONFIG, slug: "usada", ativo: true }, false), { ok: false, erro: "link_em_uso" });
  assert.deepEqual(montarGravacao(SALVO, { catalogo: CONFIG, slug: "nova-loja", ativo: true }, null), { ok: false, erro: "conferindo_link" });
});

test("link igual ao salvo não depende da conferência (mesmo se ela disse 'em uso')", () => {
  const g = montarGravacao(SALVO, { catalogo: CONFIG, slug: "minha-loja", ativo: true }, false);
  assert.equal(g.ok, true);
});

test("publicar e despublicar gravam catalogo_ativo", () => {
  const pub = montarGravacao({ slug: "minha-loja", ativo: false }, { catalogo: CONFIG, slug: "minha-loja", ativo: true }, null);
  assert.equal(pub.ok && pub.dados.catalogo_ativo, true);
  const despub = montarGravacao(SALVO, { catalogo: CONFIG, slug: "minha-loja", ativo: false }, null);
  assert.equal(despub.ok && despub.dados.catalogo_ativo, false);
  assert.equal(despub.ok && "catalogo_slug" in despub.dados, false);
});

test("publicar sem link não grava", () => {
  assert.deepEqual(montarGravacao({ slug: "", ativo: false }, { catalogo: CONFIG, slug: "", ativo: true }, null), { ok: false, erro: "publicar_sem_link" });
});

test("ativo nulo no banco conta como não publicado", () => {
  const g = montarGravacao({ slug: "minha-loja", ativo: null }, { catalogo: CONFIG, slug: "minha-loja", ativo: false }, null);
  assert.equal(g.ok && "catalogo_ativo" in g.dados, false);
});

test("linkMudou e precisaConferirLink", () => {
  assert.equal(linkMudou(SALVO, "minha-loja "), false);
  assert.equal(linkMudou({ slug: null, ativo: false }, ""), false);
  assert.equal(linkMudou(SALVO, "outra"), true);
  assert.equal(precisaConferirLink(SALVO, "outra"), true);
  assert.equal(precisaConferirLink(SALVO, "ou"), false);
  assert.equal(precisaConferirLink(SALVO, "minha-loja"), false);
});

test("0 linhas atualizadas = sem permissão", () => {
  assert.equal(resultadoGravacao([{ id: "x" }]), "ok");
  assert.equal(resultadoGravacao([]), "sem_permissao");
  assert.equal(resultadoGravacao(null), "sem_permissao");
  assert.equal(resultadoGravacao(undefined), "sem_permissao");
});

test("formatarLink igual ao campo antigo", () => {
  assert.equal(formatarLink("Loja do Zé  Celular!"), "lojadozecelular");
  assert.equal(formatarLink("a--b---c"), "a-b-c");
  assert.equal(formatarLink("x".repeat(40)).length, 30);
});

test("linkDoNomeDaLoja igual ao 'Gerar automático' antigo", () => {
  assert.equal(linkDoNomeDaLoja("Méc Assistência & Cia"), "mec-assistencia-cia");
  assert.equal(linkDoNomeDaLoja("  !!  "), "minha-loja");
  assert.equal(linkDoNomeDaLoja(null), "minha-loja");
});
