// TZ=UTC deno test --no-check scripts/testes-conta-paga/
// TZ=Asia/Tokyo deno test --no-check scripts/testes-conta-paga/
// Roda a função real de src/lib/financeiro/pagamentoDoCadastro.ts (decisão de
// criarConta). Caso real: IFix Pro (out/2026) — conta "twste" cadastrada com
// Status = Pago ficou sem data_pagamento e sem pagamentos_contas, fora do Extrato.
import { assertEquals } from "jsr:@std/assert@1";
import { pagamentoDoCadastro } from "../../src/lib/financeiro/pagamentoDoCadastro.ts";

// 00:30 UTC de 05/10 = 21h30 de 04/10 em Brasília (o horário do bug de fuso).
const NOITE = new Date("2026-10-05T00:30:00Z");
const AJUSTE_PENDENTE = { status: "pendente", valor_pago: 0, data_pagamento: null };

Deno.test(`fuso da máquina: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`, () => {});

Deno.test("conta a pagar cadastrada como Pago: pendente + pagamento do total, dia de Brasília", () => {
  assertEquals(
    pagamentoDoCadastro({ tipo: "pagar", valor: 50, status: "pago", valor_pago: 0 }, NOITE),
    {
      ajustesConta: AJUSTE_PENDENTE,
      pagamento: { valor: 50, data: "2026-10-04", forma: null, observacao: "Quitação" },
    },
  );
});

Deno.test("conta a receber cadastrada como Recebido: pagamento do total, com a forma informada", () => {
  assertEquals(
    pagamentoDoCadastro({ tipo: "receber", valor: 120.5, status: "recebido", forma_pagamento: "pix" }, NOITE),
    {
      ajustesConta: AJUSTE_PENDENTE,
      pagamento: { valor: 120.5, data: "2026-10-04", forma: "pix", observacao: "Quitação" },
    },
  );
});

Deno.test("entrada que cobre o total (o diálogo já manda status pago): quita pelo total com a forma da entrada", () => {
  assertEquals(
    pagamentoDoCadastro(
      { tipo: "pagar", valor: 100, status: "pago", valor_pago: 100, forma_pagamento_entrada: "dinheiro" },
      NOITE,
    ),
    {
      ajustesConta: AJUSTE_PENDENTE,
      pagamento: { valor: 100, data: "2026-10-04", forma: "dinheiro", observacao: "Quitação" },
    },
  );
});

Deno.test("entrada parcial: pagamento só da entrada; a conta continua com saldo", () => {
  assertEquals(
    pagamentoDoCadastro(
      { tipo: "receber", valor: 300, status: "pendente", valor_pago: 120, forma_pagamento_entrada: "debito" },
      NOITE,
    ),
    {
      ajustesConta: AJUSTE_PENDENTE,
      pagamento: { valor: 120, data: "2026-10-04", forma: "debito", observacao: "Entrada" },
    },
  );
});

Deno.test("forma da entrada tem prioridade sobre a forma da conta", () => {
  const r = pagamentoDoCadastro(
    { tipo: "pagar", valor: 80, status: "pendente", valor_pago: 30, forma_pagamento: "pix", forma_pagamento_entrada: "credito" },
    NOITE,
  );
  assertEquals(r.pagamento?.forma, "credito");
});

Deno.test("pendente sem entrada: nenhum pagamento e a conta é inserida como veio", () => {
  assertEquals(pagamentoDoCadastro({ tipo: "pagar", valor: 50, status: "pendente", valor_pago: 0 }, NOITE), {
    ajustesConta: {},
    pagamento: null,
  });
  assertEquals(pagamentoDoCadastro({ tipo: "receber", valor: 50, status: "pendente" }, NOITE).pagamento, null);
});

Deno.test("data do pagamento é sempre o dia de Brasília (bordas de dia e de mês)", () => {
  const base = { tipo: "pagar" as const, valor: 10, status: "pago" as const };
  assertEquals(pagamentoDoCadastro(base, new Date("2026-10-05T02:59:59Z")).pagamento?.data, "2026-10-04");
  assertEquals(pagamentoDoCadastro(base, new Date("2026-10-05T03:00:00Z")).pagamento?.data, "2026-10-05");
  assertEquals(pagamentoDoCadastro(base, new Date("2026-11-01T01:00:00Z")).pagamento?.data, "2026-10-31");
});
