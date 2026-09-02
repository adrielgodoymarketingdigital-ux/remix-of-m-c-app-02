/**
 * FASE 2 — Medição (SOMENTE LEITURA). Nada é escrito no banco.
 *
 * Responde:
 *   R1 — OS entregues (3m / 6m) de técnico COM "Comissão por Tipo de Serviço"
 *        cujo comissao_calculada_snapshot é NULL e sem os_tecnicos: hoje o
 *        fallback de exibição paga os.total × %; pós-Fase-2 pagam 0.
 *   R2 — OS em que o técnico é só os_tecnico (não é o funcionario_id da OS):
 *        hoje useComissoes ignora; pós-Fase-2 (query única) passam a contar.
 *   R4 — técnicos com config de Tipo de Serviço E escopo servicos_os/tudo no
 *        cargo/legado (a parte de OS deles migra pro snapshot; o escopo de OS
 *        é ignorado).
 *   + delta "Comissões a Pagar" por conta: Sistema A hoje vs pós-Fase-2
 *        (snapshot), no mês atual e nos 2 anteriores.
 *
 *   node scripts/fase2-impacto/analisar.mjs
 *   node scripts/fase2-impacto/analisar.mjs scripts/fase2-impacto/raw.json
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { comissaoOsDoSnapshot as comissaoOsDoSnapshotReal } from "../../src/lib/comissao/comissaoOsDoSnapshot.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SQL_FILE = join(__dirname, "extrair.sql");
const brl = (n) => (n == null ? "—" : (n < 0 ? "-" : "") + "R$ " + Math.abs(n).toFixed(2));
const EPS = 0.005;
const ym = (s) => (s ? String(s).slice(0, 7) : null); // YYYY-MM (UTC) — ver caveat no relatório

// ---------------------------------------------------------------------------
function parseRaw(txt) {
  txt = String(txt).trim();
  const start = txt.search(/[[{]/);
  if (start > 0) txt = txt.slice(start);
  let parsed = JSON.parse(txt);
  if (parsed && !Array.isArray(parsed) && parsed.rows) {
    const d = parsed.rows[0]?.data ?? parsed.rows;
    parsed = typeof d === "string" ? JSON.parse(d) : d;
  }
  if (typeof parsed === "string") parsed = JSON.parse(parsed);
  return parsed;
}

const arg = process.argv[2];
let db;
if (arg) {
  console.log(`Lendo ${arg} ...`);
  db = parseRaw(readFileSync(arg, "utf8"));
} else {
  console.log("Rodando: supabase db query --linked -f extrair.sql  (somente leitura) ...");
  const out = execFileSync("supabase", ["db", "query", "--linked", "-f", SQL_FILE], {
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
  });
  db = parseRaw(out);
  writeFileSync(join(__dirname, "raw.json"), JSON.stringify(db, null, 2));
  console.log(
    `  → funcionarios=${db.funcionarios.length} os=${db.os.length} os_tecnicos=${db.os_tecnicos.length} vendas=${db.vendas.length}. Cópia em raw.json`,
  );
}

const funcionarios = db.funcionarios || [];
const cfgTipo = db.comissoes_tipo_servico || [];
const OS = db.os || [];
const OT = db.os_tecnicos || [];
const VENDAS = db.vendas || [];

const funcById = new Map(funcionarios.map((f) => [f.id, f]));
// config (funcionario, tipo_servico) -> {tipo, valor}
const cfgPorFuncTipo = new Map(
  cfgTipo.map((c) => [`${c.funcionario_id}:${c.tipo_servico_id}`, { tipo: c.comissao_tipo, valor: Number(c.comissao_valor) }]),
);
// os_tecnicos por (funcionario, os)
const otPorFuncOS = new Map();
for (const t of OT) {
  const k = `${t.funcionario_id}:${t.os_id}`;
  if (!otPorFuncOS.has(k)) otPorFuncOS.set(k, []);
  otPorFuncOS.get(k).push(t);
}
// os_tecnicos por funcionario -> Set de os_id
const osIdsPorFunc = new Map();
for (const t of OT) {
  if (!osIdsPorFunc.has(t.funcionario_id)) osIdsPorFunc.set(t.funcionario_id, new Set());
  osIdsPorFunc.get(t.funcionario_id).add(t.os_id);
}
const osById = new Map(OS.map((o) => [o.id, o]));

const isEntregueExato = (o) => o.status === "entregue"; // igual ao .in("status",["entregue"]) do useComissoes
const isEntregueNorm = (o) => (o.status || "").trim().toLowerCase() === "entregue";
const campoDataFunc = (f) => (f.base_comissao === "entrega" ? "data_saida" : "created_at");

// --- Sistema A (cópia de useComissoes.calcularComissaoEscopo/calcularComissao) ---
function calcularComissaoEscopo(escopo, tipo, valor, vP, vD, tS, qV, qOS) {
  let base = 0, quantidade = 0;
  switch (escopo) {
    case "vendas_produtos": base = vP; quantidade = qV; break;
    case "vendas_dispositivos": base = vD; quantidade = qV; break;
    case "vendas_todos": base = vP + vD; quantidade = qV; break;
    case "servicos_os": base = tS; quantidade = qOS; break;
    case "tudo": default: base = vP + vD + tS; quantidade = qV + qOS; break;
  }
  return tipo === "porcentagem" ? base * (valor / 100) : quantidade * valor;
}
/** devolve { total, parteVendas, parteOS } — parte* zerando o outro lado (algebricamente idêntico) */
function sistemaA(f, vP, vD, tS, qV, qOS) {
  const run = (vp, vd, ts, qv, qos) => {
    const porCargo = f.comissoes_por_cargo && Object.keys(f.comissoes_por_cargo).length > 0 ? f.comissoes_por_cargo : null;
    if (porCargo) {
      let t = 0;
      for (const cfg of Object.values(porCargo)) {
        if (!cfg.tipo || !cfg.valor) continue;
        t += calcularComissaoEscopo(cfg.escopo, cfg.tipo, Number(cfg.valor), vp, vd, ts, qv, qos);
      }
      return t;
    }
    if (!f.comissao_tipo || !f.comissao_valor) return 0;
    return calcularComissaoEscopo(f.comissao_escopo || "tudo", f.comissao_tipo, Number(f.comissao_valor), vp, vd, ts, qv, qos);
  };
  return {
    total: run(vP, vD, tS, qV, qOS),
    parteVendas: run(vP, vD, 0, qV, 0),
    parteOS: run(0, 0, tS, 0, qOS),
  };
}

// --- wrapper sobre o helper REAL do app (src/lib/comissao/comissaoOsDoSnapshot.ts) ---
function comissaoOsDoSnapshot(o, funcId) {
  return comissaoOsDoSnapshotReal({
    status: o.status,
    comissao_calculada_snapshot: o.comissao_calculada_snapshot,
    tecnicosDoFuncionario: otPorFuncOS.get(`${funcId}:${o.id}`) || [],
  }) || 0;
}

// ===========================================================================
// R4 — config de Tipo de Serviço + escopo de OS no cargo/legado
// ===========================================================================
function escopoDeOS(f) {
  const porCargo = f.comissoes_por_cargo && Object.keys(f.comissoes_por_cargo).length > 0 ? f.comissoes_por_cargo : null;
  const out = [];
  if (porCargo) {
    for (const [cargo, cfg] of Object.entries(porCargo)) {
      if (cfg.tipo && Number(cfg.valor) > 0 && (cfg.escopo === "servicos_os" || cfg.escopo === "tudo")) {
        out.push(`cargo "${cargo}": ${cfg.escopo} ${cfg.tipo === "porcentagem" ? cfg.valor + "%" : "R$ " + cfg.valor}`);
      }
    }
  } else if (f.comissao_tipo && Number(f.comissao_valor) > 0) {
    const esc = f.comissao_escopo || "tudo";
    if (esc === "servicos_os" || esc === "tudo") {
      out.push(`legado: ${esc} ${f.comissao_tipo === "porcentagem" ? f.comissao_valor + "%" : "R$ " + f.comissao_valor}`);
    }
  }
  return out;
}
const R4 = funcionarios
  .filter((f) => f.tem_config_tipo_servico)
  .map((f) => ({ f, escopos: escopoDeOS(f) }))
  .filter((x) => x.escopos.length > 0);

// ===========================================================================
// R1 — snapshot NULL + sem os_tecnicos, técnico COM config
// ===========================================================================
const now = new Date();
const lim3 = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
const lim6 = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());

const r1 = [];
let r1ExcluidoDataSaidaNula = 0; // entrega + data_saida null → já invisível hoje E pós
for (const o of OS) {
  if (!isEntregueNorm(o)) continue;
  if (o.is_teste === true) continue;
  const f = funcById.get(o.funcionario_id);
  if (!f || !f.tem_config_tipo_servico) continue;
  if (o.comissao_calculada_snapshot != null) continue;
  const ots = otPorFuncOS.get(`${o.funcionario_id}:${o.id}`) || [];
  if (ots.length > 0) continue; // resolvido por os_tecnicos, não por fallback
  const campo = campoDataFunc(f);
  if (campo === "data_saida" && o.data_saida == null) { r1ExcluidoDataSaidaNula++; continue; }
  const d = new Date(o[campo]);
  // valor que o fallback de exibição pagaria hoje (resolverComissaoOS passo 3)
  let fallback = 0;
  if (o.total && o.tipo_servico_id) {
    const cfg = cfgPorFuncTipo.get(`${o.funcionario_id}:${o.tipo_servico_id}`);
    if (cfg && cfg.valor > 0) fallback = cfg.tipo === "porcentagem" ? Number(o.total) * (cfg.valor / 100) : cfg.valor;
  }
  r1.push({
    owner_email: o.owner_user_id ? funcById.get(o.funcionario_id)?.owner_email : "?",
    funcionario: f.nome,
    os_id: o.id,
    data: d,
    dentro3m: d >= lim3,
    dentro6m: d >= lim6,
    total_os: Number(o.total) || 0,
    fallback_hoje: fallback,
  });
}

// ===========================================================================
// R2 — funcionário é só os_tecnico (não é o funcionario_id da OS)
// ===========================================================================
const r2 = [];
for (const [k, ots] of otPorFuncOS) {
  const [funcId, osId] = k.split(":");
  const o = osById.get(osId);
  if (!o || !isEntregueNorm(o) || o.is_teste === true) continue;
  if (o.funcionario_id === funcId) continue; // é o principal → já contava
  const f = funcById.get(funcId);
  if (!f) continue;
  const d = new Date(o[campoDataFunc(f)]);
  const val = ots.reduce((a, t) => a + (Number(t.comissao_calculada_snapshot) || 0), 0);
  r2.push({
    owner_email: f.owner_email,
    funcionario: f.nome,
    tem_config: f.tem_config_tipo_servico,
    os_id: osId,
    data: d,
    dentro3m: d >= lim3,
    dentro6m: d >= lim6,
    valor_novo: val,
  });
}

// ===========================================================================
// DELTA por conta — mês atual + 2 anteriores
// ===========================================================================
const meses = [0, 1, 2].map((i) => {
  const ref = new Date(now.getFullYear(), now.getMonth() - i, 1);
  return `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, "0")}`;
});

const deltaPorConta = new Map(); // email -> { hoje, pos, porFunc: Map }
function accConta(email, mesKey, hoje, pos, funcNome) {
  if (!deltaPorConta.has(email)) deltaPorConta.set(email, {});
  const c = deltaPorConta.get(email);
  if (!c[mesKey]) c[mesKey] = { hoje: 0, pos: 0, funcs: new Map() };
  c[mesKey].hoje += hoje;
  c[mesKey].pos += pos;
  const fm = c[mesKey].funcs;
  if (!fm.has(funcNome)) fm.set(funcNome, { hoje: 0, pos: 0 });
  fm.get(funcNome).hoje += hoje;
  fm.get(funcNome).pos += pos;
}

for (const f of funcionarios) {
  for (const mesKey of meses) {
    // vendas do mês
    const vF = VENDAS.filter((v) => v.funcionario_id === f.id && ym(v.data) === mesKey);
    const vP = vF.filter((v) => v.tipo === "produto" || v.tipo === "peca").reduce((a, v) => a + Number(v.total), 0);
    const vD = vF.filter((v) => v.tipo === "dispositivo").reduce((a, v) => a + Number(v.total), 0);
    const qV = vF.length;

    // OS do mês onde F é PRINCIPAL (o que useComissoes enxerga hoje)
    const campo = campoDataFunc(f);
    const osPrincipalMes = OS.filter((o) => o.funcionario_id === f.id && ym(o[campo]) === mesKey && isEntregueExato(o)
      && (campo !== "data_saida" || o.data_saida != null));
    const tS = osPrincipalMes.reduce((a, o) => a + Number(o.total || 0), 0);
    const qOS = osPrincipalMes.length;

    const A = sistemaA(f, vP, vD, tS, qV, qOS);
    const comissaoHoje = A.total;

    // pós-Fase-2: igual ao novo useComissoes — só OS onde F é PRINCIPAL,
    // com as linhas de os_tecnicos DELE naquela OS (paridade com o Perfil).
    let comissaoOsPos;
    if (f.tem_config_tipo_servico) {
      comissaoOsPos = osPrincipalMes.reduce((a, o) => a + comissaoOsDoSnapshot(o, f.id), 0);
    } else {
      comissaoOsPos = A.parteOS; // não tem config → Sistema A na parte de OS
    }
    const comissaoPos = comissaoOsPos + A.parteVendas;

    if (Math.abs(comissaoHoje) > EPS || Math.abs(comissaoPos) > EPS) {
      accConta(f.owner_email, mesKey, comissaoHoje, comissaoPos, f.nome);
    }
  }
}

// ===========================================================================
// RELATÓRIO
// ===========================================================================
const sum = (arr, k) => arr.reduce((a, x) => a + (typeof k === "function" ? k(x) : x[k]), 0);
const grp = (arr, kf) => { const m = new Map(); for (const x of arr) { const k = kf(x); if (!m.has(k)) m.set(k, []); m.get(k).push(x); } return m; };

console.log("\n================== FASE 2 — MEDIÇÃO (só leitura) ==================\n");
console.log(`Lojas com "Comissão por Tipo de Serviço": ${new Set(cfgTipo.map((c) => c.funcionario_id)).size} funcionário(s) em ${
  new Set(funcionarios.filter((f) => f.tem_config_tipo_servico).map((f) => f.owner_email)).size} loja(s)`);
console.log(`Caveat: buckets de mês por data UTC (fatia YYYY-MM). Diferenças de fuso podem mover poucas OS de fronteira.\n`);

// ---- R1 ----
console.log("──────────── R1 — OS de técnico COM config, snapshot NULL, sem os_tecnicos ────────────");
const r1_3 = r1.filter((x) => x.dentro3m);
const r1_6 = r1.filter((x) => x.dentro6m);
const r1_3pos = r1_3.filter((x) => x.fallback_hoje > EPS);
const r1_6pos = r1_6.filter((x) => x.fallback_hoje > EPS);
console.log(`  (na janela pela data do funcionário: criação, ou entrega c/ data_saida preenchida)`);
console.log(`  Últimos 3 meses: ${r1_3.length} OS  | dessas, fallback paga algo hoje: ${r1_3pos.length} OS = ${brl(sum(r1_3, "fallback_hoje"))}  → pós-Fase-2: R$ 0,00`);
console.log(`  Últimos 6 meses: ${r1_6.length} OS  | dessas, fallback paga algo hoje: ${r1_6pos.length} OS = ${brl(sum(r1_6, "fallback_hoje"))}  → pós-Fase-2: R$ 0,00`);
console.log(`  Ignoradas (técnico base=entrega + data_saida NULL → já invisíveis hoje E pós): ${r1ExcluidoDataSaidaNula} OS`);
if (r1_6.length) {
  console.log("  por conta (6m):");
  for (const [email, arr] of grp(r1_6, (x) => x.owner_email)) {
    const a3 = arr.filter((x) => x.dentro3m);
    console.log(`    ${String(email).padEnd(38)} 6m: ${String(arr.length).padStart(3)} OS / fallback ${brl(sum(arr, "fallback_hoje"))}   3m: ${a3.length} OS / ${brl(sum(a3, "fallback_hoje"))}`);
  }
  const comValor = r1_6.filter((x) => x.fallback_hoje > EPS).sort((a, b) => b.fallback_hoje - a.fallback_hoje);
  console.log(`  as ${comValor.length} OS que hoje pagam algo via fallback (todas somem pós-Fase-2):`);
  for (const x of comValor.slice(0, 15)) {
    console.log(`    ${x.owner_email.padEnd(30)} ${x.funcionario.padEnd(14)} OS ${x.os_id.slice(0, 8)} total ${brl(x.total_os).padStart(9)}  fallback ${brl(x.fallback_hoje)}`);
  }
}

// ---- R2 ----
console.log("\n──────────── R2 — OS onde o técnico é só os_tecnico (hoje ignorado) ────────────");
const r2_3 = r2.filter((x) => x.dentro3m);
const r2_6 = r2.filter((x) => x.dentro6m);
console.log(`  Últimos 3 meses: ${r2_3.length} (OS×técnico)  | comissão NOVA que passaria a contar: ${brl(sum(r2_3, "valor_novo"))}`);
console.log(`  Últimos 6 meses: ${r2_6.length} (OS×técnico)  | comissão NOVA: ${brl(sum(r2_6, "valor_novo"))}`);
if (r2_6.length) {
  console.log("  por conta (6m):");
  for (const [email, arr] of grp(r2_6, (x) => x.owner_email)) {
    const a3 = arr.filter((x) => x.dentro3m);
    console.log(`    ${String(email).padEnd(38)} 6m: ${String(arr.length).padStart(3)} / ${brl(sum(arr, "valor_novo"))}   3m: ${a3.length} / ${brl(sum(a3, "valor_novo"))}`);
  }
  console.log("  amostra:");
  for (const x of r2_6.slice(0, 10)) {
    console.log(`    ${x.funcionario.padEnd(24)} OS ${x.os_id.slice(0, 8)} +${brl(x.valor_novo)}  (tem_config=${x.tem_config})`);
  }
} else {
  console.log("  (nenhuma — ninguém é atribuído só via 'Técnicos por Serviço')");
}

// ---- R4 ----
console.log("\n──────────── R4 — técnico COM config de Tipo de Serviço E escopo de OS (servicos_os/tudo) ────────────");
if (R4.length === 0) {
  console.log("  (nenhum — a parte de OS de quem tem config não colide com escopo de cargo)");
} else {
  for (const { f, escopos } of R4) {
    console.log(`  ${f.nome} — ${f.owner_email} ${f.ativo ? "" : "(inativo)"}`);
    for (const e of escopos) console.log(`      ${e}`);
  }
  console.log("  → nesses, a parte de OS passa a vir do snapshot; o escopo de OS do cargo é ignorado.");
}

// ---- DELTA ----
console.log("\n──────────── DELTA 'Comissões a Pagar' — hoje (Sistema A) × pós-Fase-2 (snapshot) ────────────");
console.log(`  meses: ${meses.join(", ")}  (mês atual + 2 anteriores)\n`);
for (const [email, porMes] of deltaPorConta) {
  let algo = false;
  const linhas = [];
  for (const mesKey of meses) {
    const m = porMes[mesKey];
    if (!m) continue;
    const d = m.pos - m.hoje;
    linhas.push(`    ${mesKey}:  hoje ${brl(m.hoje).padStart(11)}   pós ${brl(m.pos).padStart(11)}   Δ ${(d >= 0 ? "+" : "") + brl(d)}`);
    if (Math.abs(d) > EPS) algo = true;
    // por funcionário só quando há diferença
    for (const [fn, fv] of m.funcs) {
      const fd = fv.pos - fv.hoje;
      if (Math.abs(fd) > EPS) linhas.push(`        · ${fn.padEnd(24)} hoje ${brl(fv.hoje).padStart(10)}  pós ${brl(fv.pos).padStart(10)}  Δ ${(fd >= 0 ? "+" : "") + brl(fd)}`);
    }
  }
  console.log(`  ${email}${algo ? "" : "   (sem mudança)"}`);
  linhas.forEach((l) => console.log(l));
}

// ---- CSVs ----
function csv(arr, cols) {
  const esc = (v) => { if (v == null) return ""; const s = String(v).replace(/"/g, '""'); return /[",\n;]/.test(s) ? `"${s}"` : s; };
  return [cols.join(","), ...arr.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}
writeFileSync(join(__dirname, "r1-snapshot-null.csv"), csv(r1.map((x) => ({ ...x, data: x.data.toISOString() })),
  ["owner_email", "funcionario", "os_id", "data", "dentro3m", "dentro6m", "total_os", "fallback_hoje"]));
writeFileSync(join(__dirname, "r2-os-tecnico-only.csv"), csv(r2.map((x) => ({ ...x, data: x.data.toISOString() })),
  ["owner_email", "funcionario", "tem_config", "os_id", "data", "dentro3m", "dentro6m", "valor_novo"]));
const deltaRows = [];
for (const [email, porMes] of deltaPorConta) for (const mesKey of meses) {
  const m = porMes[mesKey]; if (!m) continue;
  deltaRows.push({ owner_email: email, mes: mesKey, hoje: m.hoje.toFixed(2), pos: m.pos.toFixed(2), delta: (m.pos - m.hoje).toFixed(2) });
}
writeFileSync(join(__dirname, "delta-por-conta.csv"), csv(deltaRows, ["owner_email", "mes", "hoje", "pos", "delta"]));

console.log("\nCSVs: scripts/fase2-impacto/{r1-snapshot-null,r2-os-tecnico-only,delta-por-conta}.csv");
console.log("Nenhuma escrita no banco foi feita.\n");
