// deno run --allow-read --allow-write --allow-run --allow-env scripts/testes-crm-leads/mutantes-1c.ts
//
// Mutantes da fase 1C do card "Funil do WhatsApp" (linha "Fora do funil", ID do anúncio): cada um é aplicado numa CÓPIA dos
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
  "supabase/migrations/20261121130000_crm_leads_1c_direcao_primeiro_contato.sql",
  "scripts/testes-crm-leads/funil1c.test.ts",
  "scripts/testes-crm-leads/funilWhatsApp.test.ts",
  "scripts/testes-crm-leads/custoWhatsApp.test.ts",
];
const TESTES = ["scripts/testes-crm-leads/funil1c.test.ts", "scripts/testes-crm-leads/funilWhatsApp.test.ts", "scripts/testes-crm-leads/custoWhatsApp.test.ts"];

interface Mutante { nome: string; arquivo: string; de: string; para: string }

const MUTANTES: Mutante[] = [
  {
    nome: "linha 'Fora do funil' nunca aparece",
    arquivo: "src/lib/marketing/funilWhatsApp.ts",
    de: "if (!f || (f.lojaChamouPrimeiro === 0 && f.desconhecidos === 0)) return null;",
    para: "return null;",
  },
  {
    nome: "linha 'Fora do funil' aparece mesmo com 0 e 0",
    arquivo: "src/lib/marketing/funilWhatsApp.ts",
    de: "if (!f || (f.lojaChamouPrimeiro === 0 && f.desconhecidos === 0)) return null;",
    para: "if (!f) return null;",
  },
  {
    nome: "coluna da função nova com nome errado",
    arquivo: "src/lib/marketing/funilWhatsApp.ts",
    de: "lerInteiro(r.direcao_desconhecida)",
    para: "lerInteiro(r.desconhecidos)",
  },
  {
    nome: "card mostra o erro da função nova",
    arquivo: "src/components/admin/marketing/CardFunilWhatsApp.tsx",
    de: "            {textoFora && excluidos.data && (",
    para: "            {excluidos.isError && <p>Erro</p>}\n            {textoFora && excluidos.data && (",
  },
  {
    nome: "função nova com nova tentativa quando não existe",
    arquivo: "src/hooks/useAdminCrmFunil.ts",
    de: "    queryKey: [\"admin-crm-funil-excluidos\", intervalo?.inicio, intervalo?.fim],\n    enabled: habilitado && intervalo !== null,\n    staleTime: 5 * 60 * 1000,\n    refetchOnWindowFocus: false,\n    retry: naoRepetirSeNaoAtivado,",
    para: "    queryKey: [\"admin-crm-funil-excluidos\", intervalo?.inicio, intervalo?.fim],\n    enabled: habilitado && intervalo !== null,\n    staleTime: 5 * 60 * 1000,\n    refetchOnWindowFocus: false,\n    retry: 3,",
  },
  {
    nome: "tirar o ID do anúncio da tabela",
    arquivo: "src/components/admin/marketing/CardFunilWhatsApp.tsx",
    de: "{l.adId && <IdAnuncio id={l.adId} />}",
    para: "",
  },
  {
    nome: "tirar o texto 'conversa iniciada'",
    arquivo: "src/lib/marketing/funilWhatsApp.ts",
    de: "export const TEXTO_CONVERSA_INICIADA = \"Conversa iniciada = o cliente escreveu primeiro.\";",
    para: "export const TEXTO_CONVERSA_INICIADA = \"\";",
  },
  {
    nome: "singular errado",
    arquivo: "src/lib/marketing/funilWhatsApp.ts",
    de: "n === 1 ? \"começou\" : \"começaram\"",
    para: "\"começaram\"",
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

const base = await Deno.makeTempDir({ prefix: "mut-1c-" });
await copiar(base);
if (!(await rodar(base))) {
  console.error("FALHA: os testes não passam nem sem mutação");
  Deno.exit(1);
}
console.log("OK    testes passam na cópia sem mutação");

let vivos = 0;
for (const m of MUTANTES) {
  const dir = await Deno.makeTempDir({ prefix: "mut-1c-" });
  await copiar(dir, m);
  const passou = await rodar(dir);
  if (passou) vivos++;
  console.log(`${passou ? "VIVO!" : "MORTO"} ${m.nome}`);
  await Deno.remove(dir, { recursive: true });
}
await Deno.remove(base, { recursive: true });
console.log(vivos === 0 ? `\nTODOS OS ${MUTANTES.length} MUTANTES MORTOS` : `\n${vivos} MUTANTE(S) VIVO(S)`);
Deno.exit(vivos ? 1 : 0);
