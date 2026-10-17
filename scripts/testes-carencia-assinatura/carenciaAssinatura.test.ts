// deno test --no-check scripts/testes-carencia-assinatura/
// Carência de 3 dias depois do vencimento (src/lib/carenciaAssinatura.ts).
// Caso real (out/2026): cliente com cartão bloqueado NO DIA do vencimento —
// a cobrança falhou, o webhook gravou past_due e o app bloqueava na hora.
import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  DIAS_CARENCIA,
  carenciaEsgotada,
  dentroDaCarencia,
  fimDaCarencia,
  fimDaCarenciaPagamentoAtrasado,
  pagamentoAtrasadoEmCarencia,
  vencimentoDaCobrancaAtrasada,
} from "../../src/lib/carenciaAssinatura.ts";

const MIN = 60 * 1000;
const HORA = 60 * MIN;
const DIA = 24 * HORA;

// Vencimento 17/10 às 09:00 de Brasília
const VENCE = new Date("2026-10-17T12:00:00Z");
const depois = (ms: number) => new Date(VENCE.getTime() + ms);
const iso = (d: Date) => d.toISOString();

/** Renovação mensal de cartão que falhou de madrugada no dia do vencimento. */
function pastDue(extra: Record<string, unknown> = {}) {
  return {
    plano_tipo: "intermediario_mensal",
    status: "past_due",
    data_fim: iso(VENCE),
    updated_at: "2026-10-17T09:00:00Z", // falha gravada às 06:00 de Brasília
    ...extra,
  };
}

Deno.test("DIAS_CARENCIA é 3", () => {
  assertEquals(DIAS_CARENCIA, 3);
});

Deno.test("fim da carência: 17/10 09:00 → 20/10 09:00 (Brasília)", () => {
  assertEquals(iso(fimDaCarencia(iso(VENCE))!), "2026-10-20T12:00:00.000Z");
});

Deno.test("dentroDaCarencia: data nula ou inválida = false (continua bloqueando)", () => {
  assertEquals(dentroDaCarencia(null, VENCE), false);
  assertEquals(dentroDaCarencia(undefined, VENCE), false);
  assertEquals(dentroDaCarencia("lixo", VENCE), false);
});

Deno.test("carenciaEsgotada (status active): sem data confia no status, como antes", () => {
  assertEquals(carenciaEsgotada(null, depois(10 * DIA)), false);
  assertEquals(carenciaEsgotada("lixo", depois(10 * DIA)), false);
  assertEquals(carenciaEsgotada(iso(VENCE), depois(2 * DIA + 23 * HORA)), false);
  assertEquals(carenciaEsgotada(iso(VENCE), depois(3 * DIA + MIN)), true);
});

Deno.test("past_due 1h depois do vencimento: liberado", () => {
  assertEquals(pagamentoAtrasadoEmCarencia(pastDue(), depois(HORA)), true);
});

Deno.test("past_due 2 dias e 23h depois: liberado", () => {
  assertEquals(pagamentoAtrasadoEmCarencia(pastDue(), depois(2 * DIA + 23 * HORA)), true);
});

Deno.test("past_due 3 dias e 1 minuto depois: bloqueado", () => {
  assertEquals(pagamentoAtrasadoEmCarencia(pastDue(), depois(3 * DIA + MIN)), false);
});

Deno.test("unpaid segue a mesma regra", () => {
  assertEquals(pagamentoAtrasadoEmCarencia(pastDue({ status: "unpaid" }), depois(HORA)), true);
  assertEquals(pagamentoAtrasadoEmCarencia(pastDue({ status: "unpaid" }), depois(3 * DIA + MIN)), false);
});

Deno.test("past_due sem data_fim: bloqueado", () => {
  assertEquals(pagamentoAtrasadoEmCarencia(pastDue({ data_fim: null }), depois(HORA)), false);
  assertEquals(fimDaCarenciaPagamentoAtrasado(pastDue({ data_fim: null })), null);
});

Deno.test("falha da renovação até 2 dias ANTES do data_fim (fevereiro) não encurta a carência", () => {
  const falha = depois(-2 * DIA);
  const ass = pastDue({ updated_at: iso(falha) });
  assertEquals(iso(vencimentoDaCobrancaAtrasada(ass)!), iso(VENCE));
  assertEquals(pagamentoAtrasadoEmCarencia(ass, depois(2 * DIA + 23 * HORA)), true);
});

Deno.test("retentativas DEPOIS do vencimento não estendem a carência", () => {
  // A Pagar.me tenta de novo e cada falha regrava updated_at
  const ass = pastDue({ updated_at: iso(depois(2 * DIA)) });
  assertEquals(iso(fimDaCarenciaPagamentoAtrasado(ass)!), "2026-10-20T12:00:00.000Z");
  assertEquals(pagamentoAtrasadoEmCarencia(ass, depois(3 * DIA + MIN)), false);
});

Deno.test("data_fim muito no futuro com past_due (1ª cobrança de cartão falhou): teto a partir da falha", () => {
  // Assinatura nova nasce com data_fim = hoje + 30 dias e a cobrança pendente
  const falha = new Date("2026-10-01T12:00:00Z");
  const ass = pastDue({ data_fim: "2026-10-31T12:00:00Z", updated_at: iso(falha) });
  // Carência acaba 2 + 3 dias depois da falha, não em 03/11
  assertEquals(iso(fimDaCarenciaPagamentoAtrasado(ass)!), "2026-10-06T12:00:00.000Z");
  assertEquals(pagamentoAtrasadoEmCarencia(ass, new Date("2026-10-06T11:59:00Z")), true);
  assertEquals(pagamentoAtrasadoEmCarencia(ass, new Date("2026-10-06T12:01:00Z")), false);
  assertEquals(pagamentoAtrasadoEmCarencia(ass, new Date("2026-10-20T12:00:00Z")), false);
});

Deno.test("nunca passa de data_fim + 3 dias, qualquer que seja o updated_at", () => {
  for (const offset of [-30 * DIA, -2 * DIA, 0, 5 * DIA, 60 * DIA]) {
    const fim = fimDaCarenciaPagamentoAtrasado(pastDue({ updated_at: iso(depois(offset)) }))!;
    assert(fim.getTime() <= VENCE.getTime() + 3 * DIA, `offset ${offset / DIA}d`);
  }
});

Deno.test("sem updated_at: vale só o data_fim", () => {
  assertEquals(iso(fimDaCarenciaPagamentoAtrasado(pastDue({ updated_at: null }))!), "2026-10-20T12:00:00.000Z");
});

Deno.test("trial expirado continua bloqueado (a função não se aplica)", () => {
  for (const plano_tipo of ["trial", "demonstracao", "free"]) {
    assertEquals(pagamentoAtrasadoEmCarencia(pastDue({ plano_tipo }), depois(HORA)), false, plano_tipo);
  }
  assertEquals(
    pagamentoAtrasadoEmCarencia({ plano_tipo: "trial", status: "trialing", data_fim: iso(VENCE) }, depois(HORA)),
    false,
  );
});

Deno.test("outros status não ganham carência por aqui (canceled, incomplete_expired, active)", () => {
  for (const status of ["canceled", "incomplete_expired", "active", "trialing"]) {
    assertEquals(pagamentoAtrasadoEmCarencia(pastDue({ status }), depois(HORA)), false, status);
  }
});

Deno.test("bloqueio do admin: a função ignora — a prioridade é dos hooks, que checam o bloqueio antes", () => {
  // useVerificacaoAcesso.isUsuarioAtivo (passo 1.5) e useAssinatura.limites
  // (bloqueadoPorAdmin) decidem o bloqueio ANTES de consultar a carência. Aqui
  // só garante que a função não "desbloqueia" nada sozinha: ela não lê esses
  // campos, então o resultado é o mesmo com ou sem bloqueio.
  const comBloqueio = pastDue({ bloqueado_admin: true, bloqueado_tipo: "indeterminado" });
  assertEquals(
    pagamentoAtrasadoEmCarencia(comBloqueio, depois(HORA)),
    pagamentoAtrasadoEmCarencia(pastDue(), depois(HORA)),
  );
});

Deno.test("sem assinatura: false", () => {
  assertEquals(pagamentoAtrasadoEmCarencia(null, VENCE), false);
});
