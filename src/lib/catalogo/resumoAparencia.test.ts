// deno test -A --no-check src/lib/catalogo/resumoAparencia.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { TEMPLATES_PADRAO } from "../../types/catalogo.ts";
import {
  cabecalhoEmUso,
  cartoesEmUso,
  coresDoTemplate,
  coresEmUso,
  escolherTemplate,
  logoEmUso,
  templateEmUso,
} from "./resumoAparencia.ts";

const T = TEMPLATES_PADRAO;

test("template em uso: o salvo; id desconhecido ou vazio cai no primeiro", () => {
  assert.equal(templateEmUso(T, "vibrante").id, "vibrante");
  assert.equal(templateEmUso(T, "nao-existe").id, TEMPLATES_PADRAO[0].id);
  assert.equal(templateEmUso(T, undefined).id, TEMPLATES_PADRAO[0].id);
});

test("os 6 templates continuam com os mesmos ids", () => {
  assert.deepEqual(
    TEMPLATES_PADRAO.map((t) => t.id),
    ["tecnologico", "minimalista", "vibrante", "natureza", "profissional", "escuro"],
  );
});

test("cores em uso: do template quando não há personalizada", () => {
  const c = coresEmUso(T, { templateId: "natureza" });
  assert.deepEqual(
    c.map((x) => [x.chave, x.hex, x.personalizada]),
    [
      ["primaria", "#059669", false],
      ["cabecalho", "#059669", false],
      ["fundo", "#F0FDF4", false],
      ["texto", "#064E3B", false],
    ],
  );
});

test("cores em uso: personalizadas mandam; cabeçalho herda a primária personalizada (regra do CatalogoOnline)", () => {
  const c = coresEmUso(T, { templateId: "tecnologico", corPrimariaPersonalizada: "#ff0000" });
  assert.equal(c[0].hex, "#ff0000");
  assert.equal(c[1].hex, "#ff0000");
  assert.equal(c[1].personalizada, true);
  const d = coresEmUso(T, { templateId: "tecnologico", corPrimariaPersonalizada: "#ff0000", corHeaderPersonalizada: "#00ff00" });
  assert.equal(d[1].hex, "#00ff00");
  // "" (o X da aba Visual) volta para o template
  const e = coresEmUso(T, { templateId: "tecnologico", corFundoPersonalizada: "" });
  assert.equal(e[2].hex, "#FFFFFF");
  assert.equal(e[2].personalizada, false);
});

test("bolinhas: primária, secundária e destaque do template", () => {
  assert.deepEqual(coresDoTemplate(templateEmUso(T, "profissional")), ["#1E3A8A", "#D97706", "#D97706"]);
});

test("cabeçalho: imagem manda; 'imagem' sem imagem vira cor sólida", () => {
  assert.equal(cabecalhoEmUso({ imagemFundoUrl: "https://x/y.png", estiloHeader: "minimalista" }), "imagem");
  assert.equal(cabecalhoEmUso({ estiloHeader: "imagem" }), "simples");
  assert.equal(cabecalhoEmUso({ estiloHeader: "gradiente" }), "gradiente");
  assert.equal(cabecalhoEmUso({ estiloHeader: "minimalista" }), "minimalista");
  assert.equal(cabecalhoEmUso({ estiloHeader: "simples" }), "simples");
});

test("logo: oculto > próprio > da loja > nenhum", () => {
  assert.equal(logoEmUso({ mostrarLogo: false, logoPersonalizadoUrl: "a" }, "b"), "oculto");
  assert.equal(logoEmUso({ logoPersonalizadoUrl: "a" }, "b"), "proprio");
  assert.equal(logoEmUso({}, "b"), "loja");
  assert.equal(logoEmUso({ mostrarLogo: true }, null), "nenhum");
});

test("cartões: padrões do CatalogoOnline", () => {
  assert.deepEqual(cartoesEmUso({}), { borda: "arredondada", sombra: "media", espacamento: "normal" });
  assert.deepEqual(cartoesEmUso({ bordaCards: "quadrada", sombraCards: "nenhuma", espacamentoCards: "amplo" }), {
    borda: "quadrada",
    sombra: "nenhuma",
    espacamento: "amplo",
  });
});

test("escolher template só troca o templateId e preserva o resto", () => {
  const antes = { templateId: "tecnologico", corPrimariaPersonalizada: "#123456", textoBotaoWhatsApp: "Comprar" };
  const depois = escolherTemplate(antes, "escuro");
  assert.deepEqual(depois, { templateId: "escuro", corPrimariaPersonalizada: "#123456", textoBotaoWhatsApp: "Comprar" });
  assert.equal(antes.templateId, "tecnologico");
});
