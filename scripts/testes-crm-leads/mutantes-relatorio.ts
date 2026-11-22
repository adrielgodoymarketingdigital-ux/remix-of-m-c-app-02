// deno run --allow-read --allow-write --allow-run --allow-env scripts/testes-crm-leads/mutantes-relatorio.ts
//
// Mutantes da ação relatorio_marketing da Edge Function crm-leads: cada um é
// aplicado numa CÓPIA dos arquivos (pasta temporária; o repositório não é
// tocado) e os testes Deno têm que FALHAR. Mutante vivo = teste fraco.
// (As regras de número estão no SQL; os mutantes dele ficam em
// scripts/crm-leads/teste-pglite-relatorio.mjs --mutantes.)

const raiz = new URL("../../", import.meta.url);
const ARQUIVOS = [
  "supabase/functions/_shared/dataBrasilia.ts",
  "supabase/functions/crm-leads/contrato.ts",
  "supabase/functions/crm-leads/handler.ts",
  "supabase/functions/crm-leads/relatorio.ts",
  "supabase/functions/crm-leads/telefone.ts",
  "scripts/testes-crm-leads/relatorioMarketing.test.ts",
];
const TESTES = ["scripts/testes-crm-leads/relatorioMarketing.test.ts"];

interface Mutante { nome: string; arquivo: string; de: string; para: string }
const REL = "supabase/functions/crm-leads/relatorio.ts";
const HANDLER = "supabase/functions/crm-leads/handler.ts";

const MUTANTES: Mutante[] = [
  { nome: "semana começa no domingo", arquivo: REL, de: "getUTCDay() + 6) % 7; // segunda = 0", para: "getUTCDay() + 7) % 7; // segunda = 0" },
  { nome: "semana anterior inclui a semana corrente", arquivo: REL, de: "inicio: somarDias(segunda, -7), fim: somarDias(segunda, -1)", para: "inicio: somarDias(hojeISO, -7), fim: somarDias(hojeISO, -1)" },
  { nome: "mês anterior = últimos 30 dias", arquivo: REL, de: "return { ok: true, periodo, inicio: `${fim.slice(0, 8)}01`, fim };", para: "return { ok: true, periodo, inicio: somarDias(fim, -29), fim };" },
  { nome: "mês anterior termina hoje", arquivo: REL, de: "const fim = somarDias(`${hojeISO.slice(0, 8)}01`, -1);", para: "const fim = hojeISO;" },
  { nome: "aceita data futura", arquivo: REL, de: "if (fim > hojeISO) return { ok: false, erro: \"data_futura\" };", para: "" },
  { nome: "limite de 401 dias", arquivo: REL, de: "export const MAX_DIAS_RELATORIO = 400;", para: "export const MAX_DIAS_RELATORIO = 401;" },
  { nome: "aceita 30/02", arquivo: REL, de: "return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === s;", para: "return Number.isFinite(t);" },
  { nome: "aceita período invertido", arquivo: REL, de: "if (fim < inicio) return { ok: false, erro: \"periodo_invertido\" };", para: "" },
  { nome: "personalizado sem as duas datas vira semana", arquivo: REL, de: "if (inicio === undefined || fim === undefined) return { ok: false, erro: \"datas_obrigatorias\" };", para: "if (inicio === undefined || fim === undefined) return periodoRelatorio({ periodo: \"semana_anterior\" }, hojeISO);" },
  { nome: "semana aceita datas soltas", arquivo: REL, de: "  if (periodo === \"semana_anterior\") {\n    if (temDatas) return { ok: false, erro: \"datas_so_no_personalizado\" };", para: "  if (periodo === \"semana_anterior\") {" },
  { nome: "resposta repassa o banco inteiro", arquivo: HANDLER, de: "const rel = montarRelatorioMarketing(bruto);", para: "const rel = { ...montarRelatorioMarketing(bruto), ...(bruto as Record<string, unknown>) };" },
  { nome: "por anúncio repassa a linha inteira", arquivo: REL, de: "      return {\n        ad_id: adId,", para: "      return {\n        ...a,\n        ad_id: adId," },
  { nome: "aceita número negativo do banco", arquivo: REL, de: "const int = (v: unknown): number => (typeof v === \"number\" && Number.isSafeInteger(v) && v >= 0 ? v : 0);", para: "const int = (v: unknown): number => (typeof v === \"number\" ? v : 0);" },
  { nome: "custo nulo vira 0", arquivo: REL, de: "const intOuNull = (v: unknown): number | null => (typeof v === \"number\" && Number.isSafeInteger(v) && v >= 0 ? v : null);", para: "const intOuNull = (v: unknown): number | null => (typeof v === \"number\" && Number.isSafeInteger(v) && v >= 0 ? v : 0);" },
  { nome: "sem o período anterior na resposta", arquivo: REL, de: "    cadastros: { ...cadastros(c), anterior: cadastros(c.anterior) },", para: "    cadastros: cadastros(c)," },
  { nome: "fonte desconhecida passa", arquivo: REL, de: "? g.fonte as typeof FONTES[number] : \"nenhum\";", para: "? g.fonte as typeof FONTES[number] : String(g.fonte) as \"nenhum\";" },
  { nome: "log leva a resposta", arquivo: HANDLER, de: "log(\"[crm-leads] relatorio_marketing\", { periodo: per.periodo, dias: rel.periodo.dias, anuncios: rel.por_anuncio.length });",
    para: "log(\"[crm-leads] relatorio_marketing\", { periodo: per.periodo, dias: rel.periodo.dias, anuncios: rel.por_anuncio.length, rel });" },
  { nome: "hoje em UTC no lugar de Brasília", arquivo: "supabase/functions/_shared/dataBrasilia.ts", de: "  return toBrasilia(instant).toISOString().split(\"T\")[0];", para: "  return instant.toISOString().split(\"T\")[0];" },
];

async function rodar(dir: string): Promise<boolean> {
  const p = new Deno.Command("deno", { args: ["test", "--no-check", "--allow-read", ...TESTES], cwd: dir, stdout: "null", stderr: "null" });
  return (await p.output()).success;
}

async function copiar(dir: string, mut?: Mutante) {
  for (const a of ARQUIVOS) {
    const destino = `${dir}/${a}`;
    await Deno.mkdir(destino.slice(0, destino.lastIndexOf("/")), { recursive: true });
    let texto = await Deno.readTextFile(new URL(a, raiz));
    if (mut && mut.arquivo === a) {
      if (!texto.includes(mut.de)) throw new Error(`mutante "${mut.nome}" não achou o trecho em ${a}`);
      texto = texto.replace(mut.de, () => mut.para);
    }
    await Deno.writeTextFile(destino, texto);
  }
}

const base = await Deno.makeTempDir({ prefix: "mut-rel-" });
await copiar(base);
if (!(await rodar(base))) {
  console.error("FALHA: os testes não passam nem sem mutação");
  Deno.exit(1);
}
console.log("OK    testes passam na cópia sem mutação");

let vivos = 0;
for (const m of MUTANTES) {
  const dir = await Deno.makeTempDir({ prefix: "mut-rel-" });
  await copiar(dir, m);
  const passou = await rodar(dir);
  if (passou) vivos++;
  console.log(`${passou ? "VIVO!" : "MORTO"} ${m.nome}`);
  await Deno.remove(dir, { recursive: true });
}
await Deno.remove(base, { recursive: true });
console.log(vivos === 0 ? `\nTODOS OS ${MUTANTES.length} MUTANTES MORTOS` : `\n${vivos} MUTANTE(S) VIVO(S)`);
Deno.exit(vivos ? 1 : 0);
