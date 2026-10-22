// deno test supabase/functions/fiscal-config-salvar/
// Corpo da gravação da configuração fiscal: só a lista fixa de campos; texto
// vazio vira null; formatos conferidos no servidor.
import { assertEquals } from "jsr:@std/assert@1";
import { validarCorpo } from "./validarCorpo.ts";

const ok = (corpo: unknown) => {
  const r = validarCorpo(corpo);
  if (!r.ok) throw new Error(`esperava ok, veio erro: ${r.erro}`);
  return r.dados;
};
const erro = (corpo: unknown) => {
  const r = validarCorpo(corpo);
  if (r.ok) throw new Error(`esperava erro, veio ok: ${JSON.stringify(r.dados)}`);
  return r.erro;
};

Deno.test("aceita os 6 campos e normaliza (CNAE só dígitos, série NFS-e maiúscula)", () => {
  assertEquals(ok({
    regime_tributario: "simples_nacional",
    cnae: "9511-8/00",
    codigo_ibge_municipio: "3550308",
    serie_nfse: "a1",
    serie_nfe: "1",
    serie_nfce: "001",
  }), {
    regime_tributario: "simples_nacional",
    cnae: "9511800",
    codigo_ibge_municipio: "3550308",
    serie_nfse: "A1",
    serie_nfe: "1",
    serie_nfce: "001",
  });
});

Deno.test("texto vazio ou só espaços vira null; null continua null; corpo vazio é válido", () => {
  assertEquals(ok({ cnae: "", serie_nfe: "   ", regime_tributario: null }), { cnae: null, serie_nfe: null, regime_tributario: null });
  assertEquals(ok({}), {});
});

Deno.test("recusa qualquer campo fora da lista, inclusive os forçados pelo servidor", () => {
  for (const extra of ["user_id", "empresa_id", "ambiente", "ativo", "spedy_company_id", "certificado_status", "id"]) {
    assertEquals(erro({ cnae: "9511800", [extra]: "x" }), `Campos não permitidos: ${extra}.`, extra);
  }
  assertEquals(erro({ ambiente: "producao", ativo: true }), "Campos não permitidos: ambiente, ativo.");
});

Deno.test("recusa corpo que não é objeto", () => {
  for (const corpo of [null, [], "texto", 42, true]) {
    assertEquals(erro(corpo), "Corpo inválido: envie um objeto JSON.", JSON.stringify(corpo));
  }
});

Deno.test("recusa valor que não é texto nem null", () => {
  assertEquals(erro({ serie_nfe: 1 }), "Série da NF-e: envie texto ou null.");
  assertEquals(erro({ regime_tributario: { a: 1 } }), "Regime tributário: envie texto ou null.");
});

Deno.test("formatos: regime, CNAE, IBGE e séries", () => {
  assertEquals(erro({ regime_tributario: "isento" }).startsWith("Regime tributário: deve ser um de"), true);
  assertEquals(erro({ cnae: "123" }), "CNAE: deve ter 7 dígitos.");
  assertEquals(erro({ cnae: "95118OO" }), "CNAE: deve ter 7 dígitos.");
  assertEquals(erro({ codigo_ibge_municipio: "355030" }), "Código IBGE do município: deve ter 7 dígitos.");
  assertEquals(erro({ codigo_ibge_municipio: "3550-308" }), "Código IBGE do município: deve ter 7 dígitos.");
  assertEquals(erro({ serie_nfe: "1000" }), "Série da NF-e: use de 1 a 3 dígitos.");
  assertEquals(erro({ serie_nfce: "A" }), "Série da NFC-e: use de 1 a 3 dígitos.");
  assertEquals(erro({ serie_nfse: "RPS-1" }), "Série da NFS-e: use até 5 letras ou números.");
});
