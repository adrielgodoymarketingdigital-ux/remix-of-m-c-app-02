/**
 * FASE 1 — Impacto da mudança de comportamento em OS de 1 serviço só.
 * SOMENTE LEITURA. Nada é escrito no banco.
 *
 * Para CADA OS candidata (ver extrair.sql) simula os dois comportamentos:
 *   ANTIGO  = ramo `else if (funcId && tsId)` do handleSubmitOrdemServico.ts
 *             pré-Fase 1: (total da OS) × % do Tipo de Serviço do dropdown da
 *             Etapa 4 (ou valor fixo). Sem tsId ⇒ nenhum snapshot.
 *   NOVO    = calcularComissaoPorServico com 1 item: match do NOME do serviço
 *             contra os Tipos de Serviço com comissão do técnico, item a item,
 *             base preço (ou preço − custo no modo lucro), com proteção de
 *             "custo não confirmado" e desambiguação por marca.
 *
 * Usa as FUNÇÕES REAIS e puras de src/lib/ordemServico/comissaoPorTipoServico.ts.
 *
 * USO:
 *   node scripts/fase1-impacto/analisar.mjs
 *       → roda `supabase db query --linked` sozinho (precisa do projeto linkado)
 *   node scripts/fase1-impacto/analisar.mjs scripts/fase1-impacto/raw.json
 *       → usa um resultado já salvo (coluna `data` do extrair.sql)
 *
 * SAÍDA: resumo no terminal + 2 CSVs em scripts/fase1-impacto/:
 *   impacto-os.csv        → 1 linha por OS, antigo vs novo, categoria
 *   impacto-por-conta.csv → 1 linha por dono de loja, contagens agregadas
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  encontrarComissaoPorNomeServico,
  calcularComissaoDoItem,
  palavrasChaveDaMarca,
} from "../../src/lib/ordemServico/comissaoPorTipoServico.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SQL_FILE = join(__dirname, "extrair.sql");
const EPS = 0.005;
const brl = (n) => (n == null ? "—" : (n < 0 ? "-" : "") + "R$ " + Math.abs(n).toFixed(2));

// ---------------------------------------------------------------------------
// 1. carregar dados
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
  return parsed || [];
}

const arg = process.argv[2];
let linhas;
if (arg) {
  console.log(`Lendo ${arg} ...`);
  linhas = parseRaw(readFileSync(arg, "utf8"));
} else {
  console.log("Rodando: supabase db query --linked -f extrair.sql  (somente leitura) ...");
  const out = execFileSync("supabase", ["db", "query", "--linked", "-f", SQL_FILE], {
    encoding: "utf8",
    maxBuffer: 128 * 1024 * 1024,
  });
  linhas = parseRaw(out);
  writeFileSync(join(__dirname, "raw.json"), JSON.stringify(linhas, null, 2));
  console.log(`  → ${linhas.length} OS candidatas. Cópia crua salva em raw.json`);
}

if (!Array.isArray(linhas) || linhas.length === 0) {
  console.log("Nenhuma OS candidata retornada. Nada a analisar.");
  process.exit(0);
}

// ---------------------------------------------------------------------------
// 2. simular ANTIGO x NOVO
// ---------------------------------------------------------------------------
/** Ramo pré-Fase 1: (total da OS) × % do tipo do dropdown da Etapa 4. */
function simularAntigo(os) {
  const tsId = os.tipo_servico_id_etapa4;
  if (!tsId) return null; // sem tsId ⇒ nenhum snapshot era gravado
  const cfg = (os.func_configs || []).find((c) => c.tipo_servico_id === tsId);
  if (!cfg || !(Number(cfg.comissao_valor) > 0)) return null;
  const total = Number(os.total_os) || 0;
  return cfg.comissao_tipo === "porcentagem"
    ? (total > 0 ? total : 0) * (Number(cfg.comissao_valor) / 100)
    : Number(cfg.comissao_valor);
}

/**
 * Classifica COMO o match por nome resolveu (para saber quem recuperou cada
 * OS: c1 = desempate por valor idêntico, c2 = marca iphone/ipad, etc).
 * Espelha os ramos de encontrarComissaoPorNomeServico.
 */
function classificarMatch(nome, tipos, mapa, marca) {
  const n = nome.trim().toLowerCase();
  const cands = tipos.filter((t) => {
    const tn = t.nome.trim().toLowerCase();
    return tn.length > 0 && (n.includes(tn) || tn.includes(n));
  });
  if (cands.length === 0) return "sem_candidato";
  if (cands.length === 1) return "unico";
  const exatos = cands.filter((t) => t.nome.trim().toLowerCase() === n);
  if (exatos.length === 1) return "exato";
  let pool = exatos.length > 1 ? exatos : cands;
  const pk = palavrasChaveDaMarca(marca);
  if (pk.length > 0) {
    const comMarca = pool.filter((t) => pk.some((p) => t.nome.trim().toLowerCase().includes(p)));
    if (comMarca.length === 1) return "marca";
    if (comMarca.length > 1) pool = comMarca;
  }
  const cfgs = pool.map((t) => mapa.get(t.id)).filter(Boolean);
  if (cfgs.length === pool.length && cfgs.length > 0) {
    const ref = cfgs[0];
    if (cfgs.every((c) => c.comissao_tipo === ref.comissao_tipo && Number(c.comissao_valor) === Number(ref.comissao_valor))) {
      return "c1_valor_identico";
    }
  }
  return "ambiguo_real";
}

/**
 * Match da FASE 1 ORIGINAL (antes de B/c1/c2): marca-família só reconhece
 * "apple" literal, sem desempate por valor idêntico, sem fallback do
 * formulário. Serve para isolar quem cada melhoria recuperou.
 */
function matchFase1(nome, tipos, mapa, marca) {
  const n = nome.trim().toLowerCase();
  const cands = tipos.filter((t) => {
    const tn = t.nome.trim().toLowerCase();
    return tn.length > 0 && (n.includes(tn) || tn.includes(n));
  });
  if (cands.length === 0) return { config: undefined, ambiguo: false };
  if (cands.length === 1) return { config: mapa.get(cands[0].id), ambiguo: false };
  const exatos = cands.filter((t) => t.nome.trim().toLowerCase() === n);
  if (exatos.length === 1) return { config: mapa.get(exatos[0].id), ambiguo: false };
  const pool = exatos.length > 1 ? exatos : cands;
  const m = (marca || "").trim().toLowerCase();
  const pk = !m ? [] : m === "apple" ? ["iphone", "apple", "ios", "ipad"] : ["android", m];
  if (pk.length > 0) {
    const comMarca = pool.filter((t) => pk.some((p) => t.nome.trim().toLowerCase().includes(p)));
    if (comMarca.length === 1) return { config: mapa.get(comMarca[0].id), ambiguo: false };
  }
  return { config: undefined, ambiguo: true };
}

function simularNovoFase1Original(os) {
  const s = os.servico;
  if (!s || !s.nome) return { valor: null };
  const configs = os.func_configs || [];
  const tipos = configs.map((c) => ({ id: c.tipo_servico_id, nome: c.nome }));
  const mapa = new Map(
    configs.map((c) => [c.tipo_servico_id, { tipo_servico_id: c.tipo_servico_id, comissao_tipo: c.comissao_tipo, comissao_valor: Number(c.comissao_valor) }]),
  );
  const r = matchFase1(s.nome, tipos, mapa, os.dispositivo_marca);
  if (r.ambiguo || !r.config || !(r.config.comissao_valor > 0)) return { valor: null };
  const calc = calcularComissaoDoItem(
    { preco: Number(s.preco) || 0, custo: s.peca_valor ?? s.custo, custoConfirmado: s.custo_confirmado },
    r.config,
    os.comissao_calculo === "lucro" ? "lucro" : "faturamento",
  );
  return { valor: calc.custoNaoConfirmado ? null : calc.valor };
}

/** calcularComissaoPorServico() com 1 item — B + c1 + c2 — usando as funções reais. */
function simularNovo(os) {
  const s = os.servico;
  if (!s || !s.nome) return { valor: null, motivo: "sem_servico", via: "sem_servico" };
  const configs = os.func_configs || [];
  const tiposComComissao = configs.map((c) => ({ id: c.tipo_servico_id, nome: c.nome }));
  const mapa = new Map(
    configs.map((c) => [
      c.tipo_servico_id,
      { tipo_servico_id: c.tipo_servico_id, comissao_tipo: c.comissao_tipo, comissao_valor: Number(c.comissao_valor) },
    ]),
  );
  const r = encontrarComissaoPorNomeServico(s.nome, tiposComComissao, mapa, os.dispositivo_marca);
  const matchPorNomeResolveu = !!r.config && !r.ambiguo;

  // Fallback B — só 1 serviço (aqui é sempre 1) + tipo da Etapa 4 com config > 0
  const fb = os.tipo_servico_id_etapa4 ? mapa.get(os.tipo_servico_id_etapa4) : undefined;
  const usarFallback = !matchPorNomeResolveu && !!fb && Number(fb.comissao_valor) > 0;

  let config;
  let via;
  if (matchPorNomeResolveu) {
    config = r.config;
    via = "match_nome:" + classificarMatch(s.nome, tiposComComissao, mapa, os.dispositivo_marca);
  } else if (usarFallback) {
    config = fb;
    via = "fallback_formulario";
  } else if (r.ambiguo) {
    return { valor: null, motivo: "ambiguo", via: "ambiguo_real" };
  } else {
    return { valor: null, motivo: "sem_config", via: "sem_config" };
  }

  if (!(config.comissao_valor > 0)) return { valor: null, motivo: "config_zero", via };
  const calc = calcularComissaoDoItem(
    { preco: Number(s.preco) || 0, custo: s.peca_valor ?? s.custo, custoConfirmado: s.custo_confirmado },
    config,
    os.comissao_calculo === "lucro" ? "lucro" : "faturamento",
  );
  if (calc.custoNaoConfirmado) return { valor: null, motivo: "custo_nao_confirmado", via };
  return { valor: calc.valor, motivo: "ok", via };
}

function categoria(oldVal, newVal) {
  const oN = oldVal == null;
  const nN = newVal == null;
  if (oN && nN) return "AMBOS_NULL";
  if (!oN && nN) return "NOVO_NULL_ANTES_TINHA_VALOR";
  if (oN && !nN) return "NOVO_TEM_VALOR_ANTES_NULL";
  return Math.abs(oldVal - newVal) <= EPS ? "VALOR_IGUAL" : "VALOR_MUDOU";
}

const rows = linhas.map((os) => {
  const antigoSim = simularAntigo(os);
  const stored = os.stored_snapshot == null ? null : Number(os.stored_snapshot);
  const novo = simularNovo(os);
  const nomeTipoEtapa4 =
    (os.func_configs || []).find((c) => c.tipo_servico_id === os.tipo_servico_id_etapa4)?.nome || "";
  return {
    owner_email: os.owner_email,
    owner_user_id: os.owner_user_id,
    numero_os: os.numero_os,
    os_id: os.os_id,
    created_at: os.created_at,
    status: os.status,
    is_teste: !!os.is_teste,
    has_os_tecnicos: !!os.has_os_tecnicos,
    funcionario_nome: os.funcionario_nome,
    comissao_calculo: os.comissao_calculo,
    dispositivo_marca: os.dispositivo_marca || "",
    total_os: os.total_os == null ? null : Number(os.total_os),
    servico_nome: os.servico?.nome ?? "",
    servico_preco: os.servico?.preco == null ? null : Number(os.servico.preco),
    servico_custo: (os.servico?.peca_valor ?? os.servico?.custo) == null ? null : Number(os.servico?.peca_valor ?? os.servico?.custo),
    servico_custo_confirmado: !!os.servico?.custo_confirmado,
    tipo_etapa4_nome: nomeTipoEtapa4,
    tipo_etapa4_tem_config: !!(os.func_configs || []).some((c) => c.tipo_servico_id === os.tipo_servico_id_etapa4),
    stored_snapshot: stored,
    antigo_simulado: antigoSim,
    novo: novo.valor,
    novo_motivo: novo.motivo,
    novo_via: novo.via,
    novo_fase1_original: simularNovoFase1Original(os).valor,
    // categoria "real" = o que está gravado hoje (base de pagamento) x novo
    cat_stored: categoria(stored, novo.valor),
    // categoria de controle = antigo re-simulado x novo (pega snapshot obsoleto)
    cat_sim: categoria(antigoSim, novo.valor),
    stored_vs_sim_divergem: (stored == null) !== (antigoSim == null) || (stored != null && antigoSim != null && Math.abs(stored - antigoSim) > EPS),
  };
});

// ---------------------------------------------------------------------------
// 3. resumo no terminal
// ---------------------------------------------------------------------------
const reais = rows.filter((r) => !r.is_teste);
const semMultiTec = reais.filter((r) => !r.has_os_tecnicos);

function tally(arr, key) {
  const m = {};
  for (const r of arr) m[r[key]] = (m[r[key]] || 0) + 1;
  return m;
}
function pct(n, d) { return d === 0 ? "0%" : ((n / d) * 100).toFixed(1) + "%"; }

console.log("\n================ FASE 1 — IMPACTO DA MUDANÇA (OS de 1 serviço) ================\n");
console.log(`OS candidatas (60d, 1 serviço, técnico com Comissão por Tipo de Serviço): ${rows.length}`);
console.log(`  • de teste (is_teste = true), excluídas do resto: ${rows.length - reais.length}`);
console.log(`  • reais: ${reais.length}   (com os_tecnicos/multi-técnico: ${reais.length - semMultiTec.length})`);
console.log(`\nAs OS com os_tecnicos não têm impacto de PAGAMENTO (o Perfil lê os_tecnicos,`);
console.log(`não o snapshot da OS). Números-chave abaixo = OS reais SEM os_tecnicos (${semMultiTec.length}).\n`);

console.log("── Categoria (snapshot GRAVADO hoje  ×  novo comportamento) ──");
const catS = tally(semMultiTec, "cat_stored");
for (const k of ["VALOR_IGUAL", "VALOR_MUDOU", "NOVO_NULL_ANTES_TINHA_VALOR", "NOVO_TEM_VALOR_ANTES_NULL", "AMBOS_NULL"]) {
  console.log(`  ${k.padEnd(30)} ${String(catS[k] || 0).padStart(4)}  (${pct(catS[k] || 0, semMultiTec.length)})`);
}

const chave = semMultiTec.filter((r) => r.cat_stored === "NOVO_NULL_ANTES_TINHA_VALOR");
console.log(`\n── #3 do pedido: OS que HOJE têm valor gravado e no novo viram null: ${chave.length} ──`);
console.log("   motivo do null no novo comportamento:");
const mot = tally(chave, "novo_motivo");
for (const k of Object.keys(mot).sort((a, b) => mot[b] - mot[a])) {
  console.log(`     ${k.padEnd(24)} ${String(mot[k]).padStart(4)}`);
}
const somaPerdida = chave.reduce((a, r) => a + (r.stored_snapshot || 0), 0);
console.log(`   R$ hoje gravado nessas OS (deixaria de ser calculado até revisão): ${brl(somaPerdida)}`);

// --- Recuperação: as OS que a FASE 1 ORIGINAL zerava (o "91"), como B+c1+c2 as trata agora ---
const zeravaNaFase1 = semMultiTec.filter(
  (r) => r.stored_snapshot != null && r.novo_fase1_original == null,
);
console.log(`\n── Recuperação B + c1 + c2 sobre as OS que a Fase 1 original zerava (${zeravaNaFase1.length}) ──`);
const viaTally = tally(zeravaNaFase1, "novo_via");
const rotulo = {
  "match_nome:c1_valor_identico": "c1  — desempate por valor idêntico (duplicatas)",
  "match_nome:marca": "c2  — desempate por marca (iphone/ipad = Apple)",
  "match_nome:unico": "match por nome (passou a casar sozinho)",
  "match_nome:exato": "match por nome exato",
  fallback_formulario: "B   — fallback do Tipo de Serviço do formulário",
  sem_config: "AINDA sem config (nome não casa, sem tipo no form)",
  ambiguo_real: "AINDA ambíguo de verdade (valores diferentes)",
  custo_nao_confirmado: "bloqueado por custo não confirmado (modo lucro)",
};
for (const k of Object.keys(viaTally).sort((a, b) => viaTally[b] - viaTally[a])) {
  const rs = zeravaNaFase1.filter((r) => r.novo_via === k).reduce((a, r) => a + (r.stored_snapshot || 0), 0);
  console.log(`   ${(rotulo[k] || k).padEnd(48)} ${String(viaTally[k]).padStart(4)}   (${brl(rs)})`);
}
const recuperadas = zeravaNaFase1.filter((r) => r.novo != null).length;
const aindaQuebradas = zeravaNaFase1.length - recuperadas;
console.log(`   ---`);
console.log(`   RECUPERADAS (voltam a calcular comissão): ${recuperadas} / ${zeravaNaFase1.length}`);
console.log(`   AINDA problemáticas: ${aindaQuebradas}  (${pct(aindaQuebradas, zeravaNaFase1.length)})`);

console.log("\n── VALOR_MUDOU: quanto muda ──");
const mud = semMultiTec.filter((r) => r.cat_stored === "VALOR_MUDOU");
const deltas = mud.map((r) => r.novo - r.stored_snapshot);
const up = deltas.filter((d) => d > 0), down = deltas.filter((d) => d < 0);
console.log(`  OS: ${mud.length}   sobe: ${up.length} (Σ +${brl(up.reduce((a, b) => a + b, 0))})   desce: ${down.length} (Σ ${brl(down.reduce((a, b) => a + b, 0))})`);
console.log(`  swing líquido no total pago: ${brl(deltas.reduce((a, b) => a + b, 0))}`);

console.log("\n── Controle: snapshot GRAVADO vs ANTIGO re-simulado (detecta snapshot obsoleto) ──");
console.log(`  OS onde divergem: ${semMultiTec.filter((r) => r.stored_vs_sim_divergem).length} / ${semMultiTec.length}`);
console.log("  (se alto, o 'antes' verdadeiro é o snapshot gravado, não a re-simulação)");

// ---------------------------------------------------------------------------
// 4. agrupamento por conta
// ---------------------------------------------------------------------------
const porConta = new Map();
for (const r of semMultiTec) {
  const k = r.owner_email || r.owner_user_id;
  if (!porConta.has(k)) porConta.set(k, { email: k, owner_user_id: r.owner_user_id, total: 0, novo_null: 0, valor_mudou: 0, valor_igual: 0, novo_ganha: 0, rs_afetado: 0 });
  const a = porConta.get(k);
  a.total++;
  if (r.cat_stored === "NOVO_NULL_ANTES_TINHA_VALOR") { a.novo_null++; a.rs_afetado += r.stored_snapshot || 0; }
  else if (r.cat_stored === "VALOR_MUDOU") { a.valor_mudou++; a.rs_afetado += Math.abs(r.novo - r.stored_snapshot); }
  else if (r.cat_stored === "VALOR_IGUAL") a.valor_igual++;
  else if (r.cat_stored === "NOVO_TEM_VALOR_ANTES_NULL") a.novo_ganha++;
}
const contas = [...porConta.values()].sort((a, b) => (b.novo_null + b.valor_mudou) - (a.novo_null + a.valor_mudou));

console.log("\n── Por conta (dono da loja) — ordenado por nº de OS afetadas (null + mudou) ──");
console.log("  " + "email".padEnd(38) + "cand  null  mudou  igual  ganha   R$ afetado");
for (const c of contas.slice(0, 40)) {
  console.log(
    "  " +
    String(c.email).padEnd(38) +
    String(c.total).padStart(4) +
    String(c.novo_null).padStart(6) +
    String(c.valor_mudou).padStart(7) +
    String(c.valor_igual).padStart(7) +
    String(c.novo_ganha).padStart(7) +
    "   " + brl(c.rs_afetado),
  );
}
if (contas.length > 40) console.log(`  ... e mais ${contas.length - 40} contas (ver impacto-por-conta.csv)`);
const contasAfetadas = contas.filter((c) => c.novo_null + c.valor_mudou > 0);
console.log(`\n  contas com ao menos 1 OS afetada: ${contasAfetadas.length} de ${contas.length}`);

// ---------------------------------------------------------------------------
// 5. CSVs
// ---------------------------------------------------------------------------
function toCsv(arr, cols) {
  const esc = (v) => {
    if (v == null) return "";
    const s = String(v).replace(/"/g, '""');
    return /[",\n;]/.test(s) ? `"${s}"` : s;
  };
  return [cols.join(","), ...arr.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}

const colsOS = [
  "owner_email", "numero_os", "os_id", "created_at", "status", "is_teste", "has_os_tecnicos",
  "funcionario_nome", "comissao_calculo", "dispositivo_marca", "total_os",
  "servico_nome", "servico_preco", "servico_custo", "servico_custo_confirmado",
  "tipo_etapa4_nome", "tipo_etapa4_tem_config",
  "stored_snapshot", "antigo_simulado", "novo_fase1_original", "novo", "novo_motivo", "novo_via",
  "cat_stored", "cat_sim", "stored_vs_sim_divergem",
];
writeFileSync(join(__dirname, "impacto-os.csv"), toCsv(rows, colsOS));

const colsConta = ["email", "owner_user_id", "total", "novo_null", "valor_mudou", "valor_igual", "novo_ganha", "rs_afetado"];
writeFileSync(join(__dirname, "impacto-por-conta.csv"), toCsv(contas.map((c) => ({ ...c, rs_afetado: c.rs_afetado.toFixed(2) })), colsConta));

console.log("\nCSVs escritos:");
console.log("  scripts/fase1-impacto/impacto-os.csv        (1 linha por OS)");
console.log("  scripts/fase1-impacto/impacto-por-conta.csv (1 linha por conta)");
console.log("\nFim. Nenhuma escrita no banco foi feita.\n");
