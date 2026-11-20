// deno run --allow-read --allow-write --allow-run --allow-env scripts/testes-crm-leads/mutantes-1b.ts
//
// Mutantes do card "Funil do WhatsApp": cada um é aplicado numa CÓPIA dos
// arquivos (pasta temporária; o repositório não é tocado) e os testes Deno
// têm que FALHAR. Mutante vivo = teste fraco.

const raiz = new URL("../../", import.meta.url);
const ARQUIVOS = [
  "src/lib/marketing/custoWhatsApp.ts",
  "src/lib/marketing/funilWhatsApp.ts",
  "src/components/admin/marketing/CardFunilWhatsApp.tsx",
  "src/components/admin/marketing/GastoInformadoWhatsApp.tsx",
  "src/hooks/useAdminCrmFunil.ts",
  "supabase/migrations/20261121120020_crm_leads_3_funil_admin.sql",
  "scripts/testes-crm-leads/funilWhatsApp.test.ts",
  "scripts/testes-crm-leads/custoWhatsApp.test.ts",
];
const TESTES = ["scripts/testes-crm-leads/funilWhatsApp.test.ts", "scripts/testes-crm-leads/custoWhatsApp.test.ts"];

interface Mutante { nome: string; arquivo: string; de: string; para: string }

const MUTANTES: Mutante[] = [
  {
    nome: "tirar o aviso de amostra pequena",
    arquivo: "src/lib/marketing/funilWhatsApp.ts",
    de: "return ehAmostraPequena(conversas, assinantes) ? TEXTO_AMOSTRA_PEQUENA : null;",
    para: "return null;",
  },
  {
    nome: "tirar a divisão por zero do custo (custoPor)",
    arquivo: "src/lib/marketing/custoWhatsApp.ts",
    de: "if (gastoCentavos === null || !Number.isFinite(gastoCentavos) || quantidade <= 0) return null;",
    para: "if (gastoCentavos === null) return null;",
  },
  {
    nome: "tirar a proteção de Infinity/NaN na formatação",
    arquivo: "src/lib/marketing/funilWhatsApp.ts",
    de: "if (c === null || c === undefined || !Number.isFinite(c)) return \"—\";",
    para: "if (c === null || c === undefined) return \"—\";",
  },
  {
    nome: "não reconhecer função inexistente (estado não ativado)",
    arquivo: "src/lib/marketing/funilWhatsApp.ts",
    de: "if ([\"PGRST202\", \"PGRST205\", \"42883\", \"42P01\"].includes(code)) return \"nao_ativado\";",
    para: "",
  },
  {
    nome: "mensagem genérica para sobreposição de gasto",
    arquivo: "src/lib/marketing/funilWhatsApp.ts",
    de: "if (code === \"23P01\" || msg.includes(\"sobrepõe\")) {",
    para: "if (false) {",
  },
  {
    nome: "limite da amostra em 29 conversas",
    arquivo: "src/lib/marketing/custoWhatsApp.ts",
    de: "export const AMOSTRA_MIN_CONVERSAS = 30;",
    para: "export const AMOSTRA_MIN_CONVERSAS = 29;",
  },
  {
    nome: "limite da amostra em 4 assinantes",
    arquivo: "src/lib/marketing/custoWhatsApp.ts",
    de: "export const AMOSTRA_MIN_ASSINANTES = 5;",
    para: "export const AMOSTRA_MIN_ASSINANTES = 4;",
  },
  {
    nome: "card loga no console",
    arquivo: "src/components/admin/marketing/CardFunilWhatsApp.tsx",
    de: "  const hoje = dataBrasiliaISO();",
    para: "  const hoje = dataBrasiliaISO();\n  console.log(\"funil\");",
  },
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

const base = await Deno.makeTempDir({ prefix: "mut-1b-" });
await copiar(base);
if (!(await rodar(base))) {
  console.error("FALHA: os testes não passam nem sem mutação");
  Deno.exit(1);
}
console.log("OK    testes passam na cópia sem mutação");

let vivos = 0;
for (const m of MUTANTES) {
  const dir = await Deno.makeTempDir({ prefix: "mut-1b-" });
  await copiar(dir, m);
  const passou = await rodar(dir);
  if (passou) vivos++;
  console.log(`${passou ? "VIVO!" : "MORTO"} ${m.nome}`);
  await Deno.remove(dir, { recursive: true });
}
await Deno.remove(base, { recursive: true });
console.log(vivos === 0 ? `\nTODOS OS ${MUTANTES.length} MUTANTES MORTOS` : `\n${vivos} MUTANTE(S) VIVO(S)`);
Deno.exit(vivos ? 1 : 0);
