// deno test --no-check scripts/testes-i18n/
// Resolução do idioma, mercado/capacidades e a regra de quem tem i18n.
import { assertEquals, assertStrictEquals } from "jsr:@std/assert@1";
import { normalizarIdioma } from "../../src/lib/i18n/idiomas.ts";
import { resolverIdioma, SUBDOMINIOS_IDIOMA } from "../../src/lib/i18n/resolverIdioma.ts";
import { capacidadesDoMercado, infoMercadoDoPerfil, MERCADO_BRASIL } from "../../src/lib/i18n/mercado.ts";
import { I18N_PARA_TODOS, i18nVisivelPara } from "../../src/lib/i18n/visibilidadeI18n.ts";

Deno.test("regra: hoje só admin (I18N_PARA_TODOS = false)", () => {
  assertEquals(I18N_PARA_TODOS, false);
  assertEquals(i18nVisivelPara({ isAdmin: true }), true);
  assertEquals(i18nVisivelPara({ isAdmin: false }), false);
});

Deno.test("normalizarIdioma", () => {
  assertEquals(normalizarIdioma("es-MX"), "es");
  assertEquals(normalizarIdioma("ES_ar"), "es");
  assertEquals(normalizarIdioma("pt"), "pt-BR");
  assertEquals(normalizarIdioma("pt-PT"), "pt-BR");
  assertEquals(normalizarIdioma("en-US"), "en");
  assertEquals(normalizarIdioma("it"), "it");
  assertEquals(normalizarIdioma(" es "), "es");
  for (const v of ["fr", "de-DE", "", null, undefined, "xx"]) assertEquals(normalizarIdioma(v), null);
});

Deno.test("ordem: perfil > subdomínio > ?lang= > localStorage > navegador > pt-BR", () => {
  const sub = { es: "es" } as const;
  const todas = { perfil: "it", hostname: "es.appmec.in", parametroLang: "en", armazenado: "pt-BR", navegador: ["es-MX"], subdominios: sub };
  assertEquals(resolverIdioma(todas), "it");
  assertEquals(resolverIdioma({ ...todas, perfil: undefined }), "es");
  assertEquals(resolverIdioma({ ...todas, perfil: null, hostname: "appmec.in" }), "en");
  assertEquals(resolverIdioma({ ...todas, perfil: null, hostname: "appmec.in", parametroLang: null }), "pt-BR");
  assertEquals(resolverIdioma({ hostname: "localhost", navegador: ["fr-FR", "es-AR", "en"] }), "es");
  assertEquals(resolverIdioma({}), "pt-BR");
  // valor desconhecido numa fonte passa para a próxima
  assertEquals(resolverIdioma({ perfil: "fr", parametroLang: "zz", armazenado: "es" }), "es");
});

Deno.test("domínio principal sem preferência salva = pt-BR, mesmo com o navegador em espanhol", () => {
  for (const hostname of ["appmec.in", "www.appmec.in", "APPMEC.IN"]) {
    assertEquals(resolverIdioma({ hostname, navegador: ["es-MX"] }), "pt-BR", hostname);
    // preferência salva continua valendo no domínio principal
    assertEquals(resolverIdioma({ hostname, navegador: ["es-MX"], armazenado: "es" }), "es");
    assertEquals(resolverIdioma({ hostname, parametroLang: "en" }), "en");
    assertEquals(resolverIdioma({ hostname, perfil: "es" }), "es");
  }
  // fora do domínio principal o navegador conta
  assertEquals(resolverIdioma({ hostname: "localhost", navegador: ["es-MX"] }), "es");
  assertEquals(resolverIdioma({ hostname: "minhaloja.vercel.app", navegador: ["es-MX"] }), "es");
});

Deno.test("subdomínio só vale se configurado (hoje não há nenhum)", () => {
  assertEquals(SUBDOMINIOS_IDIOMA, {});
  assertEquals(resolverIdioma({ hostname: "es.appmec.in" }), "pt-BR");
  assertEquals(resolverIdioma({ hostname: "www.appmec.in", subdominios: { es: "es" } }), "pt-BR");
  assertEquals(resolverIdioma({ hostname: "localhost", subdominios: { localhost: "es" } }), "pt-BR");
  assertEquals(resolverIdioma({ hostname: "ES.appmec.in", subdominios: { es: "es" } }), "es");
});

Deno.test("capacidades: Brasil tudo ligado; fora do Brasil tudo desligado", () => {
  assertEquals(capacidadesDoMercado("BR"), { temFiscal: true, temPix: true, temCep: true, documentoPessoa: "CPF", mascaraTelefone: "BR" });
  for (const m of ["ES_LATAM", "EN", "IT"] as const) {
    assertEquals(capacidadesDoMercado(m), { temFiscal: false, temPix: false, temCep: false, documentoPessoa: "documento", mascaraTelefone: "internacional" });
  }
});

Deno.test("perfil → mercado; sem perfil = o mesmo objeto MERCADO_BRASIL", () => {
  assertStrictEquals(infoMercadoDoPerfil(null), MERCADO_BRASIL);
  assertStrictEquals(infoMercadoDoPerfil(undefined), MERCADO_BRASIL);
  assertEquals(MERCADO_BRASIL, {
    idioma: "pt-BR", mercado: "BR", moeda: "BRL", pais: "BR", fuso: "America/Sao_Paulo", capacidades: capacidadesDoMercado("BR"),
  });
  // padrões da etapa 1 = Brasil
  assertEquals(infoMercadoDoPerfil({ idioma: "pt-BR", mercado: "BR", pais: "BR", moeda: "BRL", fuso_horario: "America/Sao_Paulo" }), MERCADO_BRASIL);
  // conta ES_LATAM
  assertEquals(infoMercadoDoPerfil({ idioma: "es", mercado: "ES_LATAM", pais: "MX", moeda: "USD", fuso_horario: "America/Mexico_City" }), {
    idioma: "es", mercado: "ES_LATAM", moeda: "USD", pais: "MX", fuso: "America/Mexico_City", capacidades: capacidadesDoMercado("ES_LATAM"),
  });
  // admin brasileiro que só trocou o idioma: mercado continua BR (moeda, fuso, capacidades)
  const soIdioma = infoMercadoDoPerfil({ idioma: "es", mercado: "BR", pais: "BR", moeda: "BRL", fuso_horario: "America/Sao_Paulo" });
  assertEquals(soIdioma, { ...MERCADO_BRASIL, idioma: "es" });
  // coluna inválida cai no padrão dela
  assertEquals(infoMercadoDoPerfil({ idioma: "fr", mercado: "XX", pais: "brasil", moeda: "real", fuso_horario: "Lua/Base" }), MERCADO_BRASIL);
});
