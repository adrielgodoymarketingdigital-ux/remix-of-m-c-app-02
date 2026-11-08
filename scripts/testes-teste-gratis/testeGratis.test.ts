// deno test --no-check scripts/testes-teste-gratis/
// Contador do teste grátis do cadastro e selo "Em teste até" do painel admin.
import { assertEquals } from "jsr:@std/assert@1";
import {
  calcularTempoRestanteTeste,
  LIMITE_HORAS_CONTADOR_EM_DIAS,
  PRAZO_TESTE_CADASTRO_DIAS,
  rotuloTesteGratisAdmin,
} from "../../src/lib/testeGratis.ts";

const H = 60 * 60 * 1000;
const AGORA = Date.parse("2026-11-08T15:00:00.000Z");
const fimDaqui = (ms: number) => new Date(AGORA + ms).toISOString();

Deno.test("constantes", () => {
  assertEquals(PRAZO_TESTE_CADASTRO_DIAS, 14);
  assertEquals(LIMITE_HORAS_CONTADOR_EM_DIAS, 48);
});

Deno.test("contador: 14 dias (cadastro novo) mostra dias", () => {
  assertEquals(
    calcularTempoRestanteTeste(fimDaqui(PRAZO_TESTE_CADASTRO_DIAS * 24 * H), AGORA),
    { tipo: "dias", dias: 14, horas: 0 },
  );
  // 13 dias e 4h e alguns minutos: arredonda para baixo
  assertEquals(
    calcularTempoRestanteTeste(fimDaqui((13 * 24 + 4) * H + 59 * 60 * 1000), AGORA),
    { tipo: "dias", dias: 13, horas: 4 },
  );
});

Deno.test("contador: 49h mostra 2 dias e 1h", () => {
  assertEquals(calcularTempoRestanteTeste(fimDaqui(49 * H), AGORA), { tipo: "dias", dias: 2, horas: 1 });
});

Deno.test("contador: exatamente 48h ainda é relógio; 48h e 1s vira dias", () => {
  assertEquals(calcularTempoRestanteTeste(fimDaqui(48 * H), AGORA), {
    tipo: "relogio", horas: 48, minutos: 0, segundos: 0,
  });
  assertEquals(calcularTempoRestanteTeste(fimDaqui(48 * H + 1000), AGORA), { tipo: "dias", dias: 2, horas: 0 });
});

Deno.test("contador: 47h é relógio", () => {
  assertEquals(calcularTempoRestanteTeste(fimDaqui(47 * H), AGORA), {
    tipo: "relogio", horas: 47, minutos: 0, segundos: 0,
  });
});

Deno.test("contador: teste de 24h de hoje continua igual (relógio)", () => {
  assertEquals(calcularTempoRestanteTeste(fimDaqui(24 * H), AGORA), {
    tipo: "relogio", horas: 24, minutos: 0, segundos: 0,
  });
  assertEquals(calcularTempoRestanteTeste(fimDaqui(23 * H + 59 * 60 * 1000 + 59 * 1000 + 999), AGORA), {
    tipo: "relogio", horas: 23, minutos: 59, segundos: 59,
  });
});

Deno.test("contador: 1h", () => {
  assertEquals(calcularTempoRestanteTeste(fimDaqui(H), AGORA), {
    tipo: "relogio", horas: 1, minutos: 0, segundos: 0,
  });
});

Deno.test("contador: 0 e valor passado = expirado", () => {
  assertEquals(calcularTempoRestanteTeste(fimDaqui(0), AGORA), { tipo: "expirado" });
  assertEquals(calcularTempoRestanteTeste(fimDaqui(-1), AGORA), { tipo: "expirado" });
  assertEquals(calcularTempoRestanteTeste(fimDaqui(-30 * 24 * H), AGORA), { tipo: "expirado" });
});

Deno.test("contador: ausente ou inválido = não mostra", () => {
  assertEquals(calcularTempoRestanteTeste(null, AGORA), { tipo: "invalido" });
  assertEquals(calcularTempoRestanteTeste(undefined, AGORA), { tipo: "invalido" });
  assertEquals(calcularTempoRestanteTeste("", AGORA), { tipo: "invalido" });
  assertEquals(calcularTempoRestanteTeste("não é data", AGORA), { tipo: "invalido" });
});

Deno.test("contador: mesmo instante com offsets diferentes dá o mesmo resultado (fuso não importa)", () => {
  const utc = "2026-11-22T15:00:00.000Z";
  const brasilia = "2026-11-22T12:00:00-03:00";
  const tokyo = "2026-11-23T00:00:00+09:00";
  const esperado = calcularTempoRestanteTeste(utc, AGORA);
  assertEquals(esperado, { tipo: "dias", dias: 14, horas: 0 });
  assertEquals(calcularTempoRestanteTeste(brasilia, AGORA), esperado);
  assertEquals(calcularTempoRestanteTeste(tokyo, AGORA), esperado);
  // formato que o PostgREST devolve (timestamptz com +00:00 e microssegundos)
  assertEquals(calcularTempoRestanteTeste("2026-11-22T15:00:00.123456+00:00", AGORA), esperado);
});

Deno.test("selo admin: free com fim no futuro", () => {
  assertEquals(rotuloTesteGratisAdmin("free", fimDaqui(14 * 24 * H), AGORA), "Em teste até 22/11");
  assertEquals(rotuloTesteGratisAdmin("free", fimDaqui(H), AGORA), "Em teste até 08/11");
});

Deno.test("selo admin: dia e mês em Brasília, não em UTC", () => {
  // 01:30 UTC do dia 23 = 22:30 do dia 22 em Brasília
  assertEquals(rotuloTesteGratisAdmin("free", "2026-11-23T01:30:00Z", AGORA), "Em teste até 22/11");
  // virada de ano
  assertEquals(rotuloTesteGratisAdmin("free", "2027-01-01T02:00:00Z", AGORA), "Em teste até 31/12");
});

Deno.test("selo admin: sem selo (mostra o plano como sempre)", () => {
  assertEquals(rotuloTesteGratisAdmin("free", null, AGORA), null);
  assertEquals(rotuloTesteGratisAdmin("free", undefined, AGORA), null);
  assertEquals(rotuloTesteGratisAdmin("free", fimDaqui(0), AGORA), null);
  assertEquals(rotuloTesteGratisAdmin("free", fimDaqui(-H), AGORA), null);
  assertEquals(rotuloTesteGratisAdmin("free", "lixo", AGORA), null);
  // só plano free: pagante/trial com free_trial_ends_at antigo no futuro não ganha selo
  assertEquals(rotuloTesteGratisAdmin("profissional_mensal", fimDaqui(H), AGORA), null);
  assertEquals(rotuloTesteGratisAdmin("trial", fimDaqui(H), AGORA), null);
  assertEquals(rotuloTesteGratisAdmin(null, fimDaqui(H), AGORA), null);
});
