// deno run --allow-read --allow-write --allow-run --allow-env scripts/testes-crm-leads/mutantes-1d.ts
//
// Mutantes da fase 1D do card "Funil do WhatsApp" (degraus do teste, ajuda dos
// 14 dias, função nova ausente): cada um é aplicado numa CÓPIA dos arquivos
// (pasta temporária; o repositório não é tocado) e os testes Deno têm que
// FALHAR. Mutante vivo = teste fraco.

const raiz = new URL("../../", import.meta.url);
const ARQUIVOS = [
  "src/lib/marketing/custoWhatsApp.ts",
  "src/lib/marketing/funilWhatsApp.ts",
  "src/components/admin/marketing/CardFunilWhatsApp.tsx",
  "src/components/admin/marketing/GastoInformadoWhatsApp.tsx",
  "src/hooks/useAdminCrmFunil.ts",
  "supabase/migrations/20261121120020_crm_leads_3_funil_admin.sql",
  "supabase/migrations/20261121130000_crm_leads_1c_direcao_primeiro_contato.sql",
  "supabase/migrations/20261121140000_crm_leads_1d_teste.sql",
  "scripts/testes-crm-leads/funil1d.test.ts",
  "scripts/testes-crm-leads/funil1c.test.ts",
  "scripts/testes-crm-leads/funilWhatsApp.test.ts",
  "scripts/testes-crm-leads/custoWhatsApp.test.ts",
];
const TESTES = [
  "scripts/testes-crm-leads/funil1d.test.ts",
  "scripts/testes-crm-leads/funil1c.test.ts",
  "scripts/testes-crm-leads/funilWhatsApp.test.ts",
  "scripts/testes-crm-leads/custoWhatsApp.test.ts",
];

interface Mutante { nome: string; arquivo: string; de: string; para: string }
const LIB = "src/lib/marketing/funilWhatsApp.ts";
const CARD = "src/components/admin/marketing/CardFunilWhatsApp.tsx";
const HOOK = "src/hooks/useAdminCrmFunil.ts";

const MUTANTES: Mutante[] = [
  { nome: "degraus novos nunca aparecem (ignora a situação do teste)", arquivo: LIB, de: "  if (!teste) {", para: "  if (true) {" },
  { nome: "'Em teste agora' mostra o total com teste", arquivo: LIB, de: "valor: teste.emTesteAgora,", para: "valor: f.testes," },
  { nome: "'Teste acabou sem pagar' mostra os cancelados", arquivo: LIB, de: "valor: teste.acabouSemPagar,", para: "valor: teste.cancelados," },
  { nome: "coluna da função nova com nome errado", arquivo: LIB, de: "lerInteiro(r.teste_ativo_agora)", para: "lerInteiro(r.ativo_agora)" },
  { nome: "sem a função nova o degrau muda de nome", arquivo: LIB, de: "titulo: \"Iniciaram teste\"", para: "titulo: \"Em teste agora\"" },
  { nome: "singular errado", arquivo: LIB, de: "c === 1 ? \"cancelou\" : \"cancelaram\"", para: "\"cancelaram\"" },
  { nome: "tirar o texto dos 14 dias", arquivo: LIB, de: "\"Todo cadastro novo recebe 14 dias de teste; o retorno do anúncio só aparece quando o teste acaba.\"", para: "\"\"" },
  { nome: "card não mostra a ajuda dos 14 dias", arquivo: CARD,
    de: "            <p className=\"text-xs text-muted-foreground -mt-2\" data-testid=\"ajuda-teste\">{TEXTO_TESTE_14_DIAS}</p>\n", para: "" },
  { nome: "card ignora o dado da função nova", arquivo: CARD, de: "etapasFunil(funil.data, teste.data)", para: "etapasFunil(funil.data, null)" },
  { nome: "card mostra o erro da função nova", arquivo: CARD,
    de: "            <div className={`grid grid-cols-2 gap-3",
    para: "            {teste.isError && <p>Erro no teste</p>}\n            <div className={`grid grid-cols-2 gap-3" },
  { nome: "função nova com nova tentativa quando não existe", arquivo: HOOK,
    de: "    queryKey: [\"admin-crm-funil-teste\", intervalo?.inicio, intervalo?.fim],\n    enabled: habilitado && intervalo !== null,\n    staleTime: 5 * 60 * 1000,\n    refetchOnWindowFocus: false,\n    retry: naoRepetirSeNaoAtivado,",
    para: "    queryKey: [\"admin-crm-funil-teste\", intervalo?.inicio, intervalo?.fim],\n    enabled: habilitado && intervalo !== null,\n    staleTime: 5 * 60 * 1000,\n    refetchOnWindowFocus: false,\n    retry: 3," },
  { nome: "função nova chamada antes do funil responder", arquivo: HOOK,
    de: "    queryKey: [\"admin-crm-funil-teste\", intervalo?.inicio, intervalo?.fim],\n    enabled: habilitado && intervalo !== null,",
    para: "    queryKey: [\"admin-crm-funil-teste\", intervalo?.inicio, intervalo?.fim],\n    enabled: intervalo !== null," },
  { nome: "migration muda as colunas do funil", arquivo: "supabase/migrations/20261121140000_crm_leads_1d_teste.sql",
    de: "  testes bigint,\n  assinantes bigint,\n  opt_outs bigint,", para: "  testes_iniciados bigint,\n  assinantes bigint,\n  opt_outs bigint," },
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

const base = await Deno.makeTempDir({ prefix: "mut-1d-" });
await copiar(base);
if (!(await rodar(base))) {
  console.error("FALHA: os testes não passam nem sem mutação");
  Deno.exit(1);
}
console.log("OK    testes passam na cópia sem mutação");

let vivos = 0;
for (const m of MUTANTES) {
  const dir = await Deno.makeTempDir({ prefix: "mut-1d-" });
  await copiar(dir, m);
  const passou = await rodar(dir);
  if (passou) vivos++;
  console.log(`${passou ? "VIVO!" : "MORTO"} ${m.nome}`);
  await Deno.remove(dir, { recursive: true });
}
await Deno.remove(base, { recursive: true });
console.log(vivos === 0 ? `\nTODOS OS ${MUTANTES.length} MUTANTES MORTOS` : `\n${vivos} MUTANTE(S) VIVO(S)`);
Deno.exit(vivos ? 1 : 0);
