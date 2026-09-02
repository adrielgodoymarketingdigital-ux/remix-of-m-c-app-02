/**
 * FASE 2 — Regressão do helper comissaoOsDoSnapshot (fonte ÚNICA da comissão
 * de OS, usada pelo card "Comissões a Pagar" e pelo Perfil de Desempenho).
 *
 * Usa a função REAL de src/lib/comissao/comissaoOsDoSnapshot.ts.
 *
 *   node scripts/fase2-comissao-unificada/testes-regressao.mjs
 */
import {
  comissaoOsDoSnapshot,
  isOSComissionavel,
} from "../../src/lib/comissao/comissaoOsDoSnapshot.ts";

const brl = (n) => (n === null ? "null" : "R$ " + Number(n).toFixed(2));
let falhas = 0;
const check = (nome, cond, detalhe = "") => {
  const ok = !!cond;
  if (!ok) falhas++;
  console.log(`   [${ok ? "PASS" : "FALHA"}] ${nome}${detalhe ? "  — " + detalhe : ""}`);
};
const eq = (a, b) => (a === null && b === null) || (a !== null && b !== null && Math.abs(a - b) < 1e-9);

console.log("\n=== FASE 2 — comissaoOsDoSnapshot (helper único) ===\n");

// ---------------------------------------------------------------------------
console.log("isOSComissionavel");
check('"entregue" → true', isOSComissionavel("entregue") === true);
check('" Entregue " (trim+lower) → true', isOSComissionavel(" Entregue ") === true);
check('"em_andamento" → false', isOSComissionavel("em_andamento") === false);
check("null → false", isOSComissionavel(null) === false);

// ---------------------------------------------------------------------------
console.log("\nOS não entregue → 0 (não null)");
{
  const r = comissaoOsDoSnapshot({ status: "em_andamento", comissao_calculada_snapshot: 50, tecnicosDoFuncionario: [] });
  check("retorna 0", eq(r, 0), brl(r));
}

// ---------------------------------------------------------------------------
console.log("\nEntregue, sem os_tecnicos");
{
  const comSnap = comissaoOsDoSnapshot({ status: "entregue", comissao_calculada_snapshot: 42.5, tecnicosDoFuncionario: [] });
  check("snapshot presente → esse valor", eq(comSnap, 42.5), brl(comSnap));

  const semSnap = comissaoOsDoSnapshot({ status: "entregue", comissao_calculada_snapshot: null, tecnicosDoFuncionario: [] });
  check("snapshot null → null (Perfil mostra '—', soma trata como 0)", semSnap === null, brl(semSnap));

  const snapZero = comissaoOsDoSnapshot({ status: "entregue", comissao_calculada_snapshot: 0, tecnicosDoFuncionario: [] });
  check("snapshot 0 → 0 (não null)", eq(snapZero, 0), brl(snapZero));
}

// ---------------------------------------------------------------------------
console.log("\nEntregue, COM os_tecnicos (soma as linhas, ignora snapshot do nível-OS)");
{
  const r = comissaoOsDoSnapshot({
    status: "entregue",
    comissao_calculada_snapshot: 999, // deve ser IGNORADO
    tecnicosDoFuncionario: [
      { comissao_calculada_snapshot: 10 },
      { comissao_calculada_snapshot: 5.5 },
    ],
  });
  check("Σ os_tecnicos = 15,50 (não 999)", eq(r, 15.5), brl(r));

  const comNull = comissaoOsDoSnapshot({
    status: "entregue",
    comissao_calculada_snapshot: 30,
    tecnicosDoFuncionario: [{ comissao_calculada_snapshot: 8 }, { comissao_calculada_snapshot: null }],
  });
  check("linha null conta como 0 → 8,00", eq(comNull, 8), brl(comNull));

  const todasNull = comissaoOsDoSnapshot({
    status: "entregue",
    comissao_calculada_snapshot: 30,
    tecnicosDoFuncionario: [{ comissao_calculada_snapshot: null }, { comissao_calculada_snapshot: null }],
  });
  check("todas as linhas null → 0 (não null: foram calculadas, deu 0)", eq(todasNull, 0), brl(todasNull));
}

// ---------------------------------------------------------------------------
console.log("\nSem dupla contagem: uma OS resolve por UM caminho só");
{
  // Simula a soma que useComissoes/Perfil fazem: por OS, um único valor.
  const osComTecnicos = { status: "entregue", comissao_calculada_snapshot: 20, tecnicosDoFuncionario: [{ comissao_calculada_snapshot: 12 }] };
  const total = comissaoOsDoSnapshot(osComTecnicos);
  check("OS com os_tecnicos: total = 12 (só os_tecnicos), nunca 12+20", eq(total, 12), brl(total));
}

// ---------------------------------------------------------------------------
console.log(`\n${falhas === 0 ? "✅ TODOS OS TESTES PASSARAM" : `❌ ${falhas} FALHA(S)`}\n`);
process.exit(falhas === 0 ? 0 : 1);
