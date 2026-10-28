// deno test supabase/functions/webhook-n8n-cadastro/telefone.test.ts
// Números inventados para o teste.
import { assertEquals } from "jsr:@std/assert@1";
import { formatarTelefoneN8n, type RegiaoUsuario } from "./telefone.ts";

// Cópia literal da regra antiga do index.ts (antes da etapa P0).
const legado = (telefone: string) =>
  telefone.replace(/\D/g, "").startsWith("55")
    ? telefone.replace(/\D/g, "")
    : "55" + telefone.replace(/\D/g, "");

const BR: RegiaoUsuario = { mercado: "BR", pais: "BR" };
const REGIOES_BR: Array<[string, RegiaoUsuario]> = [
  ["perfil BR", BR],
  ["perfil não lido (null)", null],
  ["perfil sem as colunas", {}],
  ["colunas nulas", { mercado: null, pais: null }],
];

// Brasil: com e sem 55, com DDD, parênteses, hífen, espaços e lixo
const CASOS_BR = [
  "11987654321",
  "5511987654321",
  "(11) 98765-4321",
  "(11)98765-4321",
  "11 98765-4321",
  "55 (11) 98765-4321",
  "55 11 98765 4321",
  "+55 11 98765-4321",
  "+55 (21) 3456-7890",
  "2134567890",
  "(21) 3456-7890",
  "  11987654321  ",
  "011987654321",
  "55",
  "5",
  "",
  "abc",
  "11.98765.4321",
];

Deno.test("Brasil: byte a byte igual à regra antiga, em toda região tratada como BR", () => {
  for (const [rotulo, regiao] of REGIOES_BR) {
    for (const tel of CASOS_BR) {
      assertEquals(formatarTelefoneN8n(tel, regiao), legado(tel), `${rotulo}: "${tel}"`);
    }
  }
});

Deno.test("Brasil: resultados esperados escritos à mão", () => {
  const esperado: Array<[string, string]> = [
    ["11987654321", "5511987654321"],
    ["5511987654321", "5511987654321"],
    ["(11) 98765-4321", "5511987654321"],
    ["55 (11) 98765-4321", "5511987654321"],
    ["+55 11 98765-4321", "5511987654321"],
    ["(21) 3456-7890", "552134567890"],
  ];
  for (const [tel, saida] of esperado) assertEquals(formatarTelefoneN8n(tel, BR), saida, tel);
});

Deno.test("número com + e outro código de país: sem o 55, mesmo em conta BR", () => {
  const casos: Array<[string, string]> = [
    ["+52 55 1234 5678", "525512345678"], // México
    ["+52 1 55 1234 5678", "5215512345678"],
    ["+57 300 123 4567", "573001234567"], // Colômbia
    ["+54 9 11 2345-6789", "5491123456789"], // Argentina
    ["+56 9 8765 4321", "56987654321"], // Chile
    ["+51 987 654 321", "51987654321"], // Peru
    ["+591 7123 4567", "59171234567"], // Bolívia
    ["+1 (305) 555-0100", "13055550100"],
    ["  +52 55 1234 5678", "525512345678"],
  ];
  for (const [rotulo, regiao] of REGIOES_BR) {
    for (const [tel, saida] of casos) {
      assertEquals(formatarTelefoneN8n(tel, regiao), saida, `${rotulo}: "${tel}"`);
    }
  }
});

Deno.test("conta fora do BR: nunca prefixa 55, com ou sem +", () => {
  const regioes: RegiaoUsuario[] = [
    { mercado: "ES_LATAM", pais: "BR" }, // cadastro ?intl=1 hoje (país pelo DEFAULT)
    { mercado: "ES_LATAM", pais: "MX" },
    { mercado: "BR", pais: "MX" },
    { mercado: "ES_LATAM", pais: null },
    { mercado: "EN" },
    { pais: "CO" },
  ];
  const casos: Array<[string, string]> = [
    ["52 55 1234 5678", "525512345678"],
    ["+52 55 1234 5678", "525512345678"],
    ["57 300 123 4567", "573001234567"],
    ["(56) 9 8765-4321", "56987654321"],
    ["54 9 11 2345 6789", "5491123456789"],
    ["51 987 654 321", "51987654321"],
    ["55 1234 5678", "5512345678"], // número local da Cidade do México
    ["+55 11 98765-4321", "5511987654321"],
  ];
  for (const regiao of regioes) {
    for (const [tel, saida] of casos) {
      assertEquals(formatarTelefoneN8n(tel, regiao), saida, `${JSON.stringify(regiao)}: "${tel}"`);
    }
  }
});

Deno.test("conta BR com número sem +: regra antiga (o 55 entra)", () => {
  for (const tel of ["52 55 1234 5678", "57 300 123 4567", "1 305 555 0100"]) {
    assertEquals(formatarTelefoneN8n(tel, BR), legado(tel), tel);
    assertEquals(formatarTelefoneN8n(tel, BR).startsWith("55"), true, tel);
  }
});
