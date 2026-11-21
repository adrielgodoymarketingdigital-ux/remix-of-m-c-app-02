// deno test --no-check --allow-read scripts/testes-crm-leads/
// Fase 1D do card "Funil do WhatsApp": degrau "Em teste agora", "Teste acabou
// sem pagar", texto de ajuda dos 14 dias, nomes das colunas iguais aos da
// migration, função nova inexistente = card exatamente como antes (sem aviso,
// sem nova tentativa) e colunas das 2 funções do funil iguais às da 1C.
// Dados fictícios.
import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  TEXTO_TESTE_14_DIAS,
  classificarErroFunil,
  etapasFunil,
  normalizarSituacaoTeste,
} from "../../src/lib/marketing/funilWhatsApp.ts";

const raiz = new URL("../../", import.meta.url);
const ler = (p: string) => Deno.readTextFileSync(new URL(p, raiz));
const semComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'])\/\/.*$/gm, "$1");
const CARD = semComentarios(ler("src/components/admin/marketing/CardFunilWhatsApp.tsx"));
const HOOK = semComentarios(ler("src/hooks/useAdminCrmFunil.ts"));
const MIG = ler("supabase/migrations/20261121140000_crm_leads_1d_teste.sql");
const MIG_1C = ler("supabase/migrations/20261121130000_crm_leads_1c_direcao_primeiro_contato.sql");

const retornoDe = (sql: string, fn: string) => {
  const i = sql.indexOf(`FUNCTION public.${fn}(`);
  const a = sql.indexOf("RETURNS TABLE(", i) + 14;
  return sql.slice(a, sql.indexOf("\n)", a)).split(",").map((c) => c.trim().split(/\s+/)[0]);
};

const FUNIL = { conversas: 40, conversas_anuncio: 30, ja_clientes: 2, cadastros: 10, testes: 10, assinantes: 1 };
const TESTE = { emTesteAgora: 7, acabouSemPagar: 2, cancelados: 3, assinantes: 1 };

// ---------------------------------------------------------------- normalização
Deno.test("normalização: nomes das colunas = RETURNS TABLE da migration 1D; só contagens", () => {
  const colunas = retornoDe(MIG, "admin_crm_funil_teste");
  assertEquals(colunas, ["teste_ativo_agora", "teste_acabou_sem_pagar", "teste_cancelado", "assinantes"]);
  const linha = Object.fromEntries(colunas.map((c, k) => [c, String(k + 3)]));
  const s = normalizarSituacaoTeste([{ ...linha, telefone: "+5511990000001", email: "ficticio@exemplo.invalid" }]);
  assertEquals(s, { emTesteAgora: 3, acabouSemPagar: 4, cancelados: 5, assinantes: 6 });
  assert(!JSON.stringify(s).includes("99000") && !JSON.stringify(s).includes("@"));
  assertEquals(normalizarSituacaoTeste(null), { emTesteAgora: 0, acabouSemPagar: 0, cancelados: 0, assinantes: 0 });
  assertEquals(normalizarSituacaoTeste({ teste_ativo_agora: 4 }).emTesteAgora, 4);
});

Deno.test("funções do funil: mesmas colunas de retorno da 1C (card antigo continua funcionando)", () => {
  for (const fn of ["admin_crm_funil", "admin_crm_funil_por_anuncio"]) {
    assertEquals(retornoDe(MIG, fn), retornoDe(MIG_1C, fn), fn);
    assert(retornoDe(MIG, fn).includes("testes"), `${fn} mantém a coluna testes`);
  }
});

// ---------------------------------------------------------------- degraus
Deno.test("sem a função nova: 4 degraus, exatamente como antes", () => {
  const e = etapasFunil(FUNIL, null);
  assertEquals(e.map((x) => x.titulo), ["Conversas iniciadas", "Cadastraram", "Iniciaram teste", "Assinantes pagos"]);
  assertEquals(e.map((x) => x.valor), [40, 10, 10, 1]);
  assertEquals(e.map((x) => x.detalhe), ["30 de anúncio · 2 já eram clientes", "25% das conversas", "100% dos cadastros", "10% dos cadastros"]);
  assertEquals(etapasFunil(FUNIL, undefined).length, 4);
});

Deno.test("com a função nova: 'Em teste agora', 'Teste acabou sem pagar' e 'Assinantes pagos'", () => {
  const e = etapasFunil(FUNIL, TESTE);
  assertEquals(e.map((x) => x.titulo), ["Conversas iniciadas", "Cadastraram", "Em teste agora", "Teste acabou sem pagar", "Assinantes pagos"]);
  assertEquals(e.map((x) => x.valor), [40, 10, 7, 2, 1]);
  assertEquals(e[2].detalhe, "70% dos cadastros · 10 com teste no total");
  assertEquals(e[3].detalhe, "3 cancelaram o teste");
  assertEquals(e[4].detalhe, "10% dos cadastros");
  assert(!e.some((x) => x.titulo === "Iniciaram teste"));
  assertEquals(new Set(e.map((x) => x.id)).size, 5, "ids únicos (key do React)");
});

Deno.test("singular, zero cadastros e números grandes", () => {
  assertEquals(etapasFunil(FUNIL, { ...TESTE, cancelados: 1 })[3].detalhe, "1 cancelou o teste");
  assertEquals(etapasFunil(FUNIL, { ...TESTE, cancelados: 0 })[3].detalhe, "0 cancelaram o teste");
  const zero = etapasFunil({ ...FUNIL, cadastros: 0, testes: 0, assinantes: 0 }, { emTesteAgora: 0, acabouSemPagar: 0, cancelados: 0, assinantes: 0 });
  assertEquals(zero[2].detalhe, "— dos cadastros · 0 com teste no total");
  assert(!/NaN|Infinity/.test(JSON.stringify(zero)));
  assertEquals(etapasFunil({ ...FUNIL, testes: 1234 }, TESTE)[2].detalhe.endsWith("1.234 com teste no total"), true);
});

// ---------------------------------------------------------------- ajuda
Deno.test("texto de ajuda dos 14 dias, sempre no card", () => {
  assertEquals(TEXTO_TESTE_14_DIAS, "Todo cadastro novo recebe 14 dias de teste; o retorno do anúncio só aparece quando o teste acaba.");
  assert(CARD.includes('data-testid="ajuda-teste">{TEXTO_TESTE_14_DIAS}</p>'));
});

// ---------------------------------------------------------------- função nova ainda não existe
Deno.test("função nova inexistente (código antes do SQL) = 'nao_ativado', sem nova tentativa, só depois do funil", () => {
  assertEquals(classificarErroFunil({ code: "PGRST202", message: "Could not find the function public.admin_crm_funil_teste(p_fim, p_inicio) in the schema cache" }), "nao_ativado");
  assertEquals(classificarErroFunil({ code: "42883", message: "function public.admin_crm_funil_teste(date, date) does not exist" }), "nao_ativado");
  const i = HOOK.indexOf("export function useAdminCrmFunilTeste");
  const bloco = HOOK.slice(i, HOOK.indexOf("\n}\n", i));
  assert(i > 0 && bloco.includes('"admin_crm_funil_teste" as never'), "chama a função nova");
  assert(bloco.includes("retry: naoRepetirSeNaoAtivado"), "sem nova tentativa");
  assert(bloco.includes("enabled: habilitado && intervalo !== null"), "só depois do funil responder");
  assert(bloco.includes("throw erroDe(error)") && bloco.includes("return normalizarSituacaoTeste(data);"), "erro classificado e dado normalizado");
});

Deno.test("card: erro da função nova nunca aparece; degraus novos só com dado", () => {
  assert(!/\bteste\.(error|isError|failureReason|status|refetch)/.test(CARD), "o card não olha o erro da função nova");
  assert(CARD.includes("const teste = useAdminCrmFunilTeste(consulta, ativo);"));
  assert(CARD.includes("etapasFunil(funil.data, teste.data)"), "degraus vêm de etapasFunil com o dado (undefined = como antes)");
  assert(CARD.includes('etapas.length === 5 ? "lg:grid-cols-5" : "lg:grid-cols-4"'), "grade de 5 só com os degraus novos");
  assert(!/Iniciaram teste|Em teste agora|Teste acabou sem pagar/.test(CARD), "rótulos só na lib (um lugar)");
});
