// deno test --no-check --allow-read scripts/testes-apresentacao-plano/
// Textos e números da tela de Plano no computador (src/lib/planos/apresentacaoPlano.ts),
// conferidos contra o catálogo real (src/types/plano.ts).
import { assertEquals } from "jsr:@std/assert@1";
import {
  descontoAnual,
  descricaoPlano,
  formatarPercentual,
  limparRecurso,
  nomePlanoAtual,
  periodoDoPlano,
  seloPlanoAtual,
  textoLimiteArmazenamento,
  textoVencimentoPlano,
} from "../../src/lib/planos/apresentacaoPlano.ts";
import { partesDataHoraBrasilia } from "../../src/lib/dataBrasilia.ts";
import { PLANOS } from "../../src/types/plano.ts";

const dataISO = (i: string) => partesDataHoraBrasilia(i).data;

Deno.test("nome: catálogo, fora do catálogo e vazio", () => {
  assertEquals(nomePlanoAtual("intermediario_mensal", PLANOS), "Plano Intermediário");
  assertEquals(nomePlanoAtual("profissional_ultra_anual", PLANOS), "Plano Ultra");
  assertEquals(nomePlanoAtual("free", PLANOS), "Plano Free");
  assertEquals(nomePlanoAtual("admin", PLANOS), "Plano Admin");
  assertEquals(nomePlanoAtual("trial", PLANOS), "Período de Teste");
  assertEquals(nomePlanoAtual("demonstracao", PLANOS), "Demonstração");
  assertEquals(nomePlanoAtual("outro_plano", PLANOS), "outro plano");
  assertEquals(nomePlanoAtual(null, PLANOS), "");
});

Deno.test("selo: cada plano e ciclo, com acento e sem caixa alta", () => {
  assertEquals(seloPlanoAtual("basico_mensal", PLANOS), "Básico Mensal");
  assertEquals(seloPlanoAtual("basico_anual", PLANOS), "Básico Anual");
  assertEquals(seloPlanoAtual("intermediario_mensal", PLANOS), "Intermediário Mensal");
  assertEquals(seloPlanoAtual("intermediario_anual", PLANOS), "Intermediário Anual");
  assertEquals(seloPlanoAtual("profissional_mensal", PLANOS), "Profissional Mensal");
  assertEquals(seloPlanoAtual("profissional_anual", PLANOS), "Profissional Anual");
  assertEquals(seloPlanoAtual("profissional_ultra_mensal", PLANOS), "Ultra Mensal");
  assertEquals(seloPlanoAtual("profissional_ultra_anual", PLANOS), "Ultra Anual");
});

Deno.test("selo: fora do catálogo pago fica o texto de sempre", () => {
  assertEquals(seloPlanoAtual("free", PLANOS), "FREE");
  assertEquals(seloPlanoAtual("admin", PLANOS), "ADMIN");
  assertEquals(seloPlanoAtual("trial", PLANOS), "TRIAL");
  assertEquals(seloPlanoAtual("demonstracao", PLANOS), "DEMONSTRACAO");
  assertEquals(seloPlanoAtual("plano_novo_mensal", PLANOS), "PLANO NOVO MENSAL");
});

Deno.test("selo: vencido prevalece", () => {
  assertEquals(seloPlanoAtual("free", PLANOS, true), "PLANO VENCIDO");
  assertEquals(seloPlanoAtual("intermediario_mensal", PLANOS, true), "PLANO VENCIDO");
});

Deno.test("descrição: mensal e anual iguais, Free sem descrição", () => {
  assertEquals(descricaoPlano("basico_mensal"), "Para quem está começando");
  assertEquals(descricaoPlano("basico_anual"), "Para quem está começando");
  assertEquals(descricaoPlano("profissional_mensal"), "Para operações maiores");
  assertEquals(descricaoPlano("profissional_ultra_anual"), "Para redes e múltiplas filiais");
  assertEquals(descricaoPlano("free"), undefined);
});

Deno.test("descrição: os textos são os da landing", async () => {
  const landing = await Deno.readTextFile(new URL("../../src/components/landing-v4/components/Planos.tsx", import.meta.url));
  for (const chave of ["basico_mensal", "intermediario_mensal", "profissional_mensal", "profissional_ultra_mensal"]) {
    assertEquals(landing.includes(`publico: "${descricaoPlano(chave)}"`), true, chave);
  }
});

Deno.test("recurso: tira emoji só do começo, o resto do texto fica", () => {
  assertEquals(limparRecurso("✅ Tudo do plano Profissional"), "Tudo do plano Profissional");
  assertEquals(limparRecurso("🔜 Avaliador de Preço de Dispositivo (Em breve)"), "Avaliador de Preço de Dispositivo (Em breve)");
  assertEquals(limparRecurso("Acompanhamento de OS (Ilimitado)"), "Acompanhamento de OS (Ilimitado)");
  for (const plano of Object.values(PLANOS)) {
    for (const r of plano.recursos) assertEquals(/[✅\u{1F51C}]/u.test(limparRecurso(r)), false, r);
  }
});

Deno.test("desconto real de cada plano anual, com o preço do catálogo", () => {
  const percentual = (k: string) => formatarPercentual(descontoAnual(k, PLANOS)!.percentualDesconto);
  assertEquals(percentual("basico_anual"), "20,1%");
  assertEquals(percentual("intermediario_anual"), "20,1%");
  assertEquals(percentual("profissional_anual"), "6,3%");
  assertEquals(percentual("profissional_ultra_anual"), "15,4%");
  assertEquals(descontoAnual("intermediario_anual", PLANOS)!.valorMensalEquivalente.toFixed(2), "31.90");
  assertEquals(descontoAnual("free", PLANOS), null);
});

Deno.test("armazenamento: GB, MB e ilimitado", () => {
  assertEquals(textoLimiteArmazenamento(50), "50MB");
  assertEquals(textoLimiteArmazenamento(500), "500MB");
  assertEquals(textoLimiteArmazenamento(5000), "5GB");
  assertEquals(textoLimiteArmazenamento(50000), "50GB");
  assertEquals(textoLimiteArmazenamento(-1), "Ilimitado");
});

Deno.test("seletor abre em anual só para plano anual", () => {
  assertEquals(periodoDoPlano("profissional_anual"), "anual");
  assertEquals(periodoDoPlano("profissional_mensal"), "mensal");
  assertEquals(periodoDoPlano("free"), "mensal");
  assertEquals(periodoDoPlano(undefined), "mensal");
});

const FIM = "2026-11-25T18:00:00Z";
const cartao = { plano_tipo: "intermediario_mensal", payment_method: "credit_card", pagarme_subscription_id: "sub", data_fim: FIM, data_proxima_cobranca: FIM };
const pix = { plano_tipo: "intermediario_mensal", payment_method: "pix", data_fim: FIM, data_proxima_cobranca: FIM };

Deno.test("vencimento: cartão recorrente mostra a próxima cobrança", () => {
  assertEquals(textoVencimentoPlano(cartao, 20, dataISO), "Próxima cobrança em 25/11/2026");
});

Deno.test("vencimento: Pix e demais pagos mostram os dias", () => {
  assertEquals(textoVencimentoPlano(pix, 20, dataISO), "Vence em 25/11/2026 · faltam 20 dias");
  assertEquals(textoVencimentoPlano(pix, 1, dataISO), "Vence em 25/11/2026 · falta 1 dia");
  assertEquals(textoVencimentoPlano({ plano_tipo: "profissional_anual", payment_method: "cartao", data_fim: FIM }, 20, dataISO), "Vence em 25/11/2026 · faltam 20 dias");
  // Pix com id de cartão antigo: não é recorrente
  assertEquals(textoVencimentoPlano({ ...pix, pagarme_subscription_id: "sub" }, 20, dataISO), "Vence em 25/11/2026 · faltam 20 dias");
});

Deno.test("vencimento: data que já passou não vira 'faltam -1 dias'", () => {
  assertEquals(textoVencimentoPlano(pix, 0, dataISO), "Venceu em 25/11/2026");
  assertEquals(textoVencimentoPlano(pix, -2, dataISO), "Venceu em 25/11/2026");
  assertEquals(textoVencimentoPlano(cartao, -2, dataISO), "Venceu em 25/11/2026");
});

Deno.test("vencimento: dia de calendário é o de Brasília", () => {
  // 02:00 UTC de 26/11 ainda é 25/11 em Brasília
  assertEquals(textoVencimentoPlano({ ...pix, data_fim: "2026-11-26T02:00:00Z" }, 20, dataISO), "Vence em 25/11/2026 · faltam 20 dias");
});

Deno.test("vencimento: sem data não mostra a linha", () => {
  for (const plano_tipo of ["free", "admin", "trial", "demonstracao"]) {
    assertEquals(textoVencimentoPlano({ plano_tipo, data_fim: FIM }, 20, dataISO), null, plano_tipo);
  }
  assertEquals(textoVencimentoPlano({ plano_tipo: "profissional_mensal", data_fim: null }, null, dataISO), null);
  assertEquals(textoVencimentoPlano(null, null, dataISO), null);
});
