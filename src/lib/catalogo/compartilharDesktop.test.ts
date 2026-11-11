// deno test -A --no-check src/lib/catalogo/compartilharDesktop.test.ts
// Dados fictícios.
import { test } from "node:test";
import assert from "node:assert/strict";
import type { ItemCatalogo } from "../../types/catalogo-item.ts";
import {
  linkPendente,
  linkPublicoSalvo,
  publicarSemLink,
  resumoPdf,
  seloDoLink,
  situacaoDoCampo,
} from "./compartilharDesktop.ts";
import { itensParaPdf } from "./itensParaPdf.ts";

const item = (id: string, extra: Partial<ItemCatalogo> = {}): ItemCatalogo =>
  ({ id, tipo_item: "produto", nome: id, preco: 10, fotos: [], quantidade: 1, created_at: "2026-10-01T12:00:00Z", exibir_no_catalogo: true, ...extra }) as ItemCatalogo;

test("selo: publicado só com o SALVO ativo e link válido", () => {
  assert.equal(seloDoLink({ slugSalvo: "loja-ficticia", ativoSalvo: true }), "publicado");
  assert.equal(seloDoLink({ slugSalvo: "loja-ficticia", ativoSalvo: false }), "rascunho");
  assert.equal(seloDoLink({ slugSalvo: "", ativoSalvo: true }), "rascunho");
  assert.equal(seloDoLink({ slugSalvo: "ab", ativoSalvo: true }), "rascunho");
});

test("situação do campo do link", () => {
  const base = { slugSalvo: "loja-ficticia", conferindo: false, disponivel: null };
  assert.equal(situacaoDoCampo({ ...base, slug: "" }), "sem_link");
  assert.equal(situacaoDoCampo({ ...base, slug: "  " }), "sem_link");
  assert.equal(situacaoDoCampo({ ...base, slug: "ab" }), "curto");
  assert.equal(situacaoDoCampo({ ...base, slug: "loja-ficticia" }), "salvo");
  assert.equal(situacaoDoCampo({ ...base, slug: "nova-loja", conferindo: true }), "conferindo");
  assert.equal(situacaoDoCampo({ ...base, slug: "nova-loja" }), "conferindo"); // ainda sem resposta
  assert.equal(situacaoDoCampo({ ...base, slug: "nova-loja", disponivel: true }), "disponivel");
  assert.equal(situacaoDoCampo({ ...base, slug: "outra-loja", disponivel: false }), "em_uso");
});

test("publicar sem link e mudança pendente", () => {
  assert.equal(publicarSemLink({ slug: "", ativo: true }), true);
  assert.equal(publicarSemLink({ slug: "ab", ativo: true }), true);
  assert.equal(publicarSemLink({ slug: "abc", ativo: true }), false);
  assert.equal(publicarSemLink({ slug: "", ativo: false }), false);
  const salvo = { slugSalvo: "loja", ativoSalvo: true };
  assert.equal(linkPendente({ ...salvo, slug: "loja", ativo: true }), false);
  assert.equal(linkPendente({ ...salvo, slug: " loja ", ativo: true }), false);
  assert.equal(linkPendente({ ...salvo, slug: "loja2", ativo: true }), true);
  assert.equal(linkPendente({ ...salvo, slug: "loja", ativo: false }), true);
});

test("copiar/abrir/compartilhar usam o link SALVO", () => {
  assert.equal(linkPublicoSalvo("https://app.invalid", "loja-ficticia"), "https://app.invalid/c/loja-ficticia");
  assert.equal(linkPublicoSalvo("https://app.invalid", ""), null);
  assert.equal(linkPublicoSalvo("https://app.invalid", null), null);
  assert.equal(linkPublicoSalvo("https://app.invalid", "ab"), null);
});

test("resumo do PDF: mesmo número do itensParaPdf; ocultos e vendidos contam como 'de fora'", () => {
  const itens = [
    item("p1"),
    item("p2", { exibir_no_catalogo: false }),
    item("d1", { tipo_item: "dispositivo", vendido: true }),
    item("d2", { tipo_item: "dispositivo" }),
    item("p1"), // repetido
  ];
  const todos = resumoPdf(itens, []);
  assert.deepEqual(todos, { entram: 2, ficamDeFora: 2, comSelecao: false });
  assert.equal(todos.entram, itensParaPdf(itens, []).length);
  const marcados = resumoPdf(itens, ["p1", "p2"]);
  assert.deepEqual(marcados, { entram: 1, ficamDeFora: 1, comSelecao: true });
  assert.equal(marcados.entram, itensParaPdf(itens, ["p1", "p2"]).length);
  assert.deepEqual(resumoPdf([], []), { entram: 0, ficamDeFora: 0, comSelecao: false });
  assert.deepEqual(resumoPdf([item("p2", { exibir_no_catalogo: false })], []), { entram: 0, ficamDeFora: 1, comSelecao: false });
});
