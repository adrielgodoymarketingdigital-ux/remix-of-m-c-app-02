#!/usr/bin/env node
/**
 * Script para criar os 6 planos de assinatura na Pagar.me via API.
 *
 * USO:
 *   1. Pegue sua Secret Key no painel Pagar.me:
 *      Dashboard → Configurações → Chaves → Secret Key
 *      (use sk_test_... para testar, sk_live_... para produção)
 *
 *   2. Rode o script:
 *      PAGARME_SECRET_KEY=sk_test_xxxxx node scripts/criar-planos-pagarme.mjs
 *
 *   3. Copie os plan_id retornados no final e cole em:
 *      - src/config/planos-catalogo.ts
 *      - supabase/functions/_shared/planos-config.ts
 */

const SECRET_KEY = process.env.PAGARME_SECRET_KEY;

if (!SECRET_KEY) {
  console.error("❌ ERRO: variável PAGARME_SECRET_KEY não definida.");
  console.error("   Use: PAGARME_SECRET_KEY=sk_test_xxx node scripts/criar-planos-pagarme.mjs");
  process.exit(1);
}

const API_URL = "https://api.pagar.me/core/v5/plans";

// Definição dos 6 planos (valores em centavos)
const PLANOS = [
  { key: "basico_mensal",        name: "Básico Mensal",        price: 1990,  interval: "month", interval_count: 1 },
  { key: "intermediario_mensal", name: "Intermediário Mensal", price: 3990,  interval: "month", interval_count: 1 },
  { key: "profissional_mensal",  name: "Profissional Mensal",  price: 7990,  interval: "month", interval_count: 1 },
  { key: "basico_anual",         name: "Básico Anual",         price: 19080, interval: "year",  interval_count: 1 },
  { key: "intermediario_anual",  name: "Intermediário Anual",  price: 38280, interval: "year",  interval_count: 1 },
  { key: "profissional_anual",   name: "Profissional Anual",   price: 89880, interval: "year",  interval_count: 1 },
];

function authHeader(secret) {
  return "Basic " + Buffer.from(secret + ":").toString("base64");
}

async function criarPlano(plano) {
  const body = {
    name: plano.name,
    description: `Assinatura ${plano.name} — App MEC`,
    interval: plano.interval,
    interval_count: plano.interval_count,
    billing_type: "prepaid",
    payment_methods: ["credit_card", "pix"],
    installments: [1],
    minimum_price: plano.price,
    currency: "BRL",
    statement_descriptor: "APPMEC",
    items: [
      {
        name: plano.name,
        quantity: 1,
        pricing_scheme: {
          scheme_type: "unit",
          price: plano.price,
        },
      },
    ],
  };

  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      Authorization: authHeader(SECRET_KEY),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`[${res.status}] ${JSON.stringify(data)}`);
  }
  return data;
}

async function main() {
  console.log(`\n🚀 Criando ${PLANOS.length} planos na Pagar.me...\n`);
  console.log(`   Ambiente: ${SECRET_KEY.startsWith("sk_test_") ? "TESTE 🧪" : "PRODUÇÃO 🔴"}\n`);

  const resultados = {};

  for (const plano of PLANOS) {
    process.stdout.write(`   → ${plano.name.padEnd(28)} `);
    try {
      const created = await criarPlano(plano);
      resultados[plano.key] = created.id;
      console.log(`✅  ${created.id}`);
    } catch (err) {
      console.log(`❌  ${err.message}`);
      resultados[plano.key] = null;
    }
  }

  console.log("\n────────────────────────────────────────────────────────");
  console.log("📋 COPIE E COLE em src/config/planos-catalogo.ts");
  console.log("   e em supabase/functions/_shared/planos-config.ts:");
  console.log("────────────────────────────────────────────────────────\n");

  console.log("export const PAGARME_PLAN_IDS: Record<PlanoTipoPago, string> = {");
  for (const p of PLANOS) {
    const id = resultados[p.key] ?? "ERRO_AO_CRIAR";
    console.log(`  ${p.key}: "${id}",`);
  }
  console.log("};\n");

  const falhas = Object.values(resultados).filter((v) => !v).length;
  if (falhas > 0) {
    console.log(`⚠️  ${falhas} plano(s) falharam — revise os erros acima.`);
    process.exit(1);
  }
  console.log("✨ Todos os planos criados com sucesso!\n");
}

main().catch((err) => {
  console.error("\n💥 Erro fatal:", err);
  process.exit(1);
});