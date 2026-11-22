// deno run --allow-read --allow-write --allow-run --allow-env scripts/testes-crm-leads/mutantes-feedback.ts
//
// Mutantes das ações pagantes_contato e contato_registrar da Edge Function
// crm-leads: cada um é aplicado numa CÓPIA dos arquivos (pasta temporária; o
// repositório não é tocado) e os testes Deno têm que FALHAR. Mutante vivo =
// teste fraco. As regras de elegibilidade têm mutantes próprios no PGlite
// (scripts/crm-leads/teste-pglite-feedback.mjs --mutantes).

const raiz = new URL("../../", import.meta.url);
const ARQUIVOS = [
  "supabase/functions/crm-leads/contrato.ts",
  "supabase/functions/crm-leads/handler.ts",
  "supabase/functions/crm-leads/telefone.ts",
  "scripts/testes-crm-leads/feedbackPagantes.test.ts",
  "scripts/testes-crm-leads/funcao.test.ts",
];
const TESTES = ["scripts/testes-crm-leads/feedbackPagantes.test.ts", "scripts/testes-crm-leads/funcao.test.ts"];

interface Mutante { nome: string; arquivo: string; de: string; para: string }
const CONTRATO = "supabase/functions/crm-leads/contrato.ts";
const HANDLER = "supabase/functions/crm-leads/handler.ts";

const MUTANTES: Mutante[] = [
  // contrato
  { nome: "limite padrão 10", arquivo: CONTRATO, de: "export const LIMITE_PADRAO = 15;", para: "export const LIMITE_PADRAO = 10;" },
  { nome: "pausa padrão 90", arquivo: CONTRATO, de: "export const PAUSA_PADRAO_DIAS = 120;", para: "export const PAUSA_PADRAO_DIAS = 90;" },
  { nome: "limite aceita 51", arquivo: CONTRATO, de: "limite < 1 || limite > 50", para: "limite < 1 || limite > 51" },
  { nome: "limite aceita 0", arquivo: CONTRATO, de: "limite < 1 || limite > 50", para: "limite < 0 || limite > 50" },
  { nome: "limite aceita quebrado", arquivo: CONTRATO, de: "!Number.isInteger(limite) || ", para: "" },
  { nome: "pausa aceita 29", arquivo: CONTRATO, de: "pausa < 30 || pausa > 365", para: "pausa < 29 || pausa > 365" },
  { nome: "pausa aceita 366", arquivo: CONTRATO, de: "pausa < 30 || pausa > 365", para: "pausa < 30 || pausa > 366" },
  { nome: "campanha aceita maiúscula", arquivo: CONTRATO, de: "export const RE_CAMPANHA = /^[a-z0-9_-]{3,40}$/;", para: "export const RE_CAMPANHA = /^[a-z0-9_-]{3,40}$/i;" },
  { nome: "campanha aceita 2 letras", arquivo: CONTRATO, de: "export const RE_CAMPANHA = /^[a-z0-9_-]{3,40}$/;", para: "export const RE_CAMPANHA = /^[a-z0-9_-]{2,40}$/;" },
  { nome: "user_ids sem teto de 10", arquivo: CONTRATO, de: "p.user_ids.length < 1 || p.user_ids.length > 10", para: "p.user_ids.length < 1" },
  { nome: "user_ids sem deduplicar", arquivo: CONTRATO, de: "ids = [...new Set((p.user_ids as string[]).map((u) => u.toLowerCase()))];", para: "ids = p.user_ids as string[];" },
  { nome: "registro aceita resultado qualquer", arquivo: CONTRATO, de: "if (r.resultado !== \"enviado\" && r.resultado !== \"falhou\") return { ok: false, erro: \"resultado_invalido\" };", para: "" },
  { nome: "registro não baixa a caixa do id (duplicado escapa)", arquivo: CONTRATO, de: "valor: { user_id: r.user_id.toLowerCase(), resultado: r.resultado }", para: "valor: { user_id: r.user_id, resultado: r.resultado }" },
  { nome: "lote do registro 200", arquivo: CONTRATO, de: "export const MAX_ITENS_REGISTRO = 100;", para: "export const MAX_ITENS_REGISTRO = 200;" },
  { nome: "registro não exige itens", arquivo: CONTRATO, de: "|| acao === \"gasto_meta\" || acao === \"contato_registrar\";", para: "|| acao === \"gasto_meta\";" },
  { nome: "primeiro nome sem minúsculas no resto", arquivo: CONTRATO, de: "resto.join(\"\").toLocaleLowerCase(\"pt-BR\")", para: "resto.join(\"\")" },
  { nome: "primeiro nome sem maiúscula", arquivo: CONTRATO, de: "primeira.toLocaleUpperCase(\"pt-BR\")", para: "primeira" },
  { nome: "primeiro nome aceita sem letra", arquivo: CONTRATO, de: "if (!/\\p{L}/u.test(palavra)) return \"\";", para: "if (palavra === \"\") return \"\";" },
  { nome: "celular BR aceita fixo", arquivo: CONTRATO, de: "/^\\+55[1-9]{2}9\\d{8}$/", para: "/^\\+55[1-9]{2}\\d{8,9}$/" },
  // handler
  { nome: "handler não confere o telefone do banco", arquivo: HANDLER, de: "|| typeof o.telefone !== \"string\" || !ehCelularBrasil(o.telefone)", para: "|| typeof o.telefone !== \"string\"" },
  { nome: "handler não corta no limite", arquivo: HANDLER, de: "            if (itens.length >= p.valor.limite) break;\n", para: "" },
  { nome: "handler manda o nome cru", arquivo: HANDLER, de: "primeiro_nome: primeiroNome(o.primeira_palavra)", para: "primeiro_nome: String(o.primeira_palavra ?? \"\")" },
  { nome: "handler ignora a pausa pedida", arquivo: HANDLER, de: "p_pausa_dias: p.valor.pausa_dias,", para: "p_pausa_dias: 120," },
  { nome: "handler ignora user_ids", arquivo: HANDLER, de: "            p_user_ids: p.valor.user_ids,\n", para: "            p_user_ids: null,\n" },
  { nome: "resposta sem excluidos_por_pausa", arquivo: HANDLER, de: "return json(200, { ok: true, itens, total_elegiveis: total, excluidos_por_pausa: pausa });", para: "return json(200, { ok: true, itens, total_elegiveis: total });" },
  { nome: "log da lista leva os itens", arquivo: HANDLER, de: "itens: itens.length, total_elegiveis: total,", para: "itens, total_elegiveis: total," },
  { nome: "log da lista leva a campanha", arquivo: HANDLER, de: "limite: p.valor.limite, pausa_dias: p.valor.pausa_dias,", para: "campanha: p.valor.campanha, limite: p.valor.limite, pausa_dias: p.valor.pausa_dias," },
  { nome: "registro sem validar a campanha", arquivo: HANDLER, de: "if (typeof campanha !== \"string\" || !RE_CAMPANHA.test(campanha)) return json(400, { erro: \"campanha_invalida\" });", para: "" },
  { nome: "registro sem duplicado no lote", arquivo: HANDLER, de: "if (vistos.has(r.valor.user_id)) { rejeitadas.push({ indice: i, erro: \"duplicado_no_lote\" }); return; }", para: "" },
  { nome: "registro devolve o índice do banco", arquivo: HANDLER, de: "for (const r of banco.rejeitadas ?? []) rejeitadas.push({ indice: mapa[r.indice], erro: r.erro });\n          rejeitadas.sort((a, b) => a.indice - b.indice);\n          log(\"[crm-leads] contato_registrar\"",
    para: "for (const r of banco.rejeitadas ?? []) rejeitadas.push({ indice: r.indice, erro: r.erro });\n          rejeitadas.sort((a, b) => a.indice - b.indice);\n          log(\"[crm-leads] contato_registrar\"" },
  { nome: "registro chama o banco com lote vazio", arquivo: HANDLER, de: "          if (validas.length > 0) {\n            banco = await chamar(db, \"crm_contato_registrar\"", para: "          if (true) {\n            banco = await chamar(db, \"crm_contato_registrar\"" },
  { nome: "registro sem inalterados na resposta", arquivo: HANDLER, de: "            inalterados: banco.inalterados, rejeitadas,\n          });", para: "            rejeitadas,\n          });" },
  { nome: "413 do registro com max errado", arquivo: CONTRATO, de: "acao === \"contato_registrar\" ? MAX_ITENS_REGISTRO : MAX_ITENS", para: "acao === \"contato_registrar\" ? MAX_ITENS : MAX_ITENS" },
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

const base = await Deno.makeTempDir({ prefix: "mut-feedback-" });
await copiar(base);
if (!(await rodar(base))) {
  console.error("FALHA: os testes não passam nem sem mutação");
  Deno.exit(1);
}
console.log("OK    testes passam na cópia sem mutação");

let vivos = 0;
for (const m of MUTANTES) {
  const dir = await Deno.makeTempDir({ prefix: "mut-feedback-" });
  await copiar(dir, m);
  const passou = await rodar(dir);
  if (passou) vivos++;
  console.log(`${passou ? "VIVO!" : "MORTO"} ${m.nome}`);
  await Deno.remove(dir, { recursive: true });
}
await Deno.remove(base, { recursive: true });
console.log(vivos === 0 ? `\nTODOS OS ${MUTANTES.length} MUTANTES MORTOS` : `\n${vivos} MUTANTE(S) VIVO(S)`);
Deno.exit(vivos ? 1 : 0);
