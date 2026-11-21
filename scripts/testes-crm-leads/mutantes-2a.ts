// deno run --allow-read --allow-write --allow-run --allow-env scripts/testes-crm-leads/mutantes-2a.ts
//
// Mutantes da fase 2A do card "Funil do WhatsApp" (gasto da Meta por anúncio,
// "atualizado há", conversas da Meta, função nova ausente) e da ação
// gasto_meta da Edge Function: cada um é aplicado numa CÓPIA dos arquivos
// (pasta temporária; o repositório não é tocado) e os testes Deno têm que
// FALHAR. Mutante vivo = teste fraco.

const raiz = new URL("../../", import.meta.url);
const ARQUIVOS = [
  "src/lib/marketing/custoWhatsApp.ts",
  "src/lib/marketing/funilWhatsApp.ts",
  "src/lib/marketing/gastoMetaWhatsApp.ts",
  "src/components/admin/marketing/CardFunilWhatsApp.tsx",
  "src/components/admin/marketing/GastoInformadoWhatsApp.tsx",
  "src/hooks/useAdminCrmFunil.ts",
  "supabase/migrations/20261122120000_crm_leads_2a_gasto_meta_anuncio.sql",
  "supabase/functions/crm-leads/contrato.ts",
  "supabase/functions/crm-leads/handler.ts",
  "supabase/functions/crm-leads/telefone.ts",
  "scripts/testes-crm-leads/gastoMeta2a.test.ts",
  "scripts/testes-crm-leads/gastoMeta.test.ts",
];
const TESTES = [
  "scripts/testes-crm-leads/gastoMeta2a.test.ts",
  "scripts/testes-crm-leads/gastoMeta.test.ts",
];

interface Mutante { nome: string; arquivo: string; de: string; para: string }
const LIB = "src/lib/marketing/gastoMetaWhatsApp.ts";
const CARD = "src/components/admin/marketing/CardFunilWhatsApp.tsx";
const HOOK = "src/hooks/useAdminCrmFunil.ts";
const FORM = "src/components/admin/marketing/GastoInformadoWhatsApp.tsx";
const CONTRATO = "supabase/functions/crm-leads/contrato.ts";
const HANDLER = "supabase/functions/crm-leads/handler.ts";

const MUTANTES: Mutante[] = [
  // card / lib
  { nome: "soma a Meta por campanha junto", arquivo: LIB,
    de: "  const gasto = fonte === \"automatico\" ? g.gastoAutoCentavos + g.gastoManualEfetivoCentavos",
    para: "  const gasto = fonte === \"automatico\" ? g.gastoAutoCentavos + g.gastoManualEfetivoCentavos + f.gasto_meta_centavos" },
  { nome: "automático sem o informado efetivo", arquivo: LIB,
    de: "  const gasto = fonte === \"automatico\" ? g.gastoAutoCentavos + g.gastoManualEfetivoCentavos",
    para: "  const gasto = fonte === \"automatico\" ? g.gastoAutoCentavos" },
  { nome: "sem a função nova não volta ao cálculo antigo", arquivo: LIB, de: "  if (!g) {\n    const c = calcularCustosWhatsApp(f);", para: "  if (!g && false) {\n    const c = calcularCustosWhatsApp(f);" },
  { nome: "fonte automática exige gasto > 0 (dia zerado vira 'manual')", arquivo: LIB, de: "g.diasAuto > 0 ? \"automatico\"", para: "g.gastoAutoCentavos > 0 ? \"automatico\"" },
  { nome: "tabela usa o informado bruto da linha antiga", arquivo: LIB, de: "    const inf = g?.gastoManualEfetivoCentavos ?? 0;", para: "    const inf = l.gastoInformadoCentavos || (g?.gastoManualEfetivoCentavos ?? 0);" },
  { nome: "anúncio com gasto e sem conversa some da tabela", arquivo: LIB, de: "  return [...linhas.map((l) => comGasto(l, porAd.get(l.adId))), ...semConversa];", para: "  return linhas.map((l) => comGasto(l, porAd.get(l.adId)));" },
  { nome: "minutos arredondados para cima", arquivo: LIB, de: "Math.floor((agoraMs - t) / 60_000)", para: "Math.ceil((agoraMs - t) / 60_000)" },
  { nome: "coluna da função nova com nome errado", arquivo: LIB, de: "lerInteiro(r.gasto_manual_efetivo_centavos),\n    lancamentosManuaisEfetivos", para: "lerInteiro(r.gasto_manual_centavos),\n    lancamentosManuaisEfetivos" },
  { nome: "texto de ajuda sem o atraso da Meta", arquivo: LIB, de: "A Meta leva de minutos a algumas horas para fechar os números, ", para: "" },
  { nome: "card ignora o gasto da 2A", arquivo: CARD, de: "custosComGastoAutomatico(funil.data, gasto.data)", para: "custosComGastoAutomatico(funil.data, undefined)" },
  { nome: "card mostra o erro da função nova", arquivo: CARD,
    de: "            {gasto.data && gasto.data.diasAuto > 0 && (",
    para: "            {gasto.isError && <p>Erro no gasto</p>}\n            {gasto.data && gasto.data.diasAuto > 0 && (" },
  { nome: "ajuda do gasto aparece sem a função nova", arquivo: CARD,
    de: "            {gasto.data && (\n              <p className=\"text-xs text-muted-foreground -mt-2\" data-testid=\"ajuda-gasto-meta\">",
    para: "            {true && (\n              <p className=\"text-xs text-muted-foreground -mt-2\" data-testid=\"ajuda-gasto-meta\">" },
  { nome: "coluna 'Conversas (Meta)' sem a função nova", arquivo: CARD,
    de: "{comMetaPorAnuncio && <TableHead className=\"text-right\">Conversas (Meta)</TableHead>}", para: "<TableHead className=\"text-right\">Conversas (Meta)</TableHead>" },
  { nome: "aviso do informado ignorado sempre visível", arquivo: FORM, de: "{comGastoAutomatico && (", para: "{true && (" },
  { nome: "função nova com nova tentativa quando não existe", arquivo: HOOK,
    de: "    queryKey: [\"admin-crm-funil-gasto\", intervalo?.inicio, intervalo?.fim],\n    enabled: habilitado && intervalo !== null,\n    staleTime: 5 * 60 * 1000,\n    refetchOnWindowFocus: false,\n    retry: naoRepetirSeNaoAtivado,",
    para: "    queryKey: [\"admin-crm-funil-gasto\", intervalo?.inicio, intervalo?.fim],\n    enabled: habilitado && intervalo !== null,\n    staleTime: 5 * 60 * 1000,\n    refetchOnWindowFocus: false,\n    retry: 3," },
  { nome: "função nova chamada antes do funil responder", arquivo: HOOK,
    de: "    queryKey: [\"admin-crm-funil-gasto-anuncio\", intervalo?.inicio, intervalo?.fim],\n    enabled: habilitado && intervalo !== null,",
    para: "    queryKey: [\"admin-crm-funil-gasto-anuncio\", intervalo?.inicio, intervalo?.fim],\n    enabled: intervalo !== null," },
  { nome: "informar gasto não recarrega o gasto da 2A", arquivo: HOOK, de: "    qc.invalidateQueries({ queryKey: [\"admin-crm-funil-gasto\"] }),\n", para: "" },
  // Edge Function
  { nome: "Edge aceita gasto quebrado", arquivo: CONTRATO, de: "!Number.isInteger(v) || ", para: "" },
  { nome: "Edge aceita data no futuro distante", arquivo: CONTRATO, de: "dia > diaISO(hojeISO, 1)", para: "dia > diaISO(hojeISO, 30)" },
  { nome: "Edge com lote de 200 no gasto", arquivo: CONTRATO, de: "export const MAX_ITENS_GASTO = 100;", para: "export const MAX_ITENS_GASTO = 200;" },
  { nome: "Edge sem checar duplicado no lote", arquivo: HANDLER, de: "if (vistos.has(chave)) {", para: "if (false) {" },
  { nome: "Edge loga o corpo", arquivo: HANDLER, de: "recebidos: env.itens.length, inseridos: banco.inseridos, atualizados: banco.atualizados, rejeitados: rejeitadas.length,\n          });",
    para: "recebidos: env.itens.length, inseridos: banco.inseridos, atualizados: banco.atualizados, rejeitados: rejeitadas.length, itens: validas,\n          });" },
  { nome: "Edge perde o índice original da rejeição do banco", arquivo: HANDLER, de: "rejeitadas.push({ indice: mapa[r.indice], erro: r.erro });\n          rejeitadas.sort((a, b) => a.indice - b.indice);\n          log(\"[crm-leads] gasto_meta\"",
    para: "rejeitadas.push({ indice: r.indice, erro: r.erro });\n          rejeitadas.sort((a, b) => a.indice - b.indice);\n          log(\"[crm-leads] gasto_meta\"" },
  { nome: "Edge aceita campaign_id fora do formato", arquivo: CONTRATO, de: "if (typeof g.campaign_id !== \"string\" || !RE_ID.test(g.campaign_id))", para: "if (typeof g.campaign_id !== \"string\")" },
];

async function rodar(dir: string): Promise<boolean> {
  const p = new Deno.Command("deno", {
    args: ["test", "--no-check", "--allow-read", ...TESTES],
    cwd: dir, stdout: "null", stderr: "null",
  });
  return (await p.output()).success;
}

async function copiar(dir: string, mut?: Mutante) {
  for (const a of ARQUIVOS) {
    const destino = `${dir}/${a}`;
    await Deno.mkdir(destino.slice(0, destino.lastIndexOf("/")), { recursive: true });
    let texto = await Deno.readTextFile(new URL(a, raiz));
    if (mut && mut.arquivo === a) {
      if (!texto.includes(mut.de)) throw new Error(`mutante "${mut.nome}" não achou o trecho em ${a}`);
      texto = texto.replace(mut.de, mut.para);
    }
    await Deno.writeTextFile(destino, texto);
  }
}

const base = await Deno.makeTempDir({ prefix: "mut-2a-" });
await copiar(base);
if (!(await rodar(base))) {
  console.error("FALHA: os testes não passam nem sem mutação");
  Deno.exit(1);
}
console.log("OK    testes passam na cópia sem mutação");

let vivos = 0;
for (const m of MUTANTES) {
  const dir = await Deno.makeTempDir({ prefix: "mut-2a-" });
  await copiar(dir, m);
  const passou = await rodar(dir);
  if (passou) vivos++;
  console.log(`${passou ? "VIVO!" : "MORTO"} ${m.nome}`);
  await Deno.remove(dir, { recursive: true });
}
await Deno.remove(base, { recursive: true });
console.log(vivos === 0 ? `\nTODOS OS ${MUTANTES.length} MUTANTES MORTOS` : `\n${vivos} MUTANTE(S) VIVO(S)`);
Deno.exit(vivos ? 1 : 0);
