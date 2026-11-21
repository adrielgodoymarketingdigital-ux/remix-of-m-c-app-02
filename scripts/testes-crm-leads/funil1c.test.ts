// deno test --no-check --allow-read scripts/testes-crm-leads/
// Fase 1C do card "Funil do WhatsApp": linha "Fora do funil" (texto, plural,
// esconder sem dado), nomes das colunas iguais aos da migration, função nova
// inexistente = "nao_ativado" (só esconde a linha), ID do anúncio na tabela
// e texto de ajuda. Dados fictícios.
import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  TEXTO_CONVERSA_INICIADA,
  classificarErroFunil,
  detalheForaDoFunil,
  normalizarForaDoFunil,
  normalizarLinhasAnuncio,
  textoForaDoFunil,
} from "../../src/lib/marketing/funilWhatsApp.ts";

const raiz = new URL("../../", import.meta.url);
const ler = (p: string) => Deno.readTextFileSync(new URL(p, raiz));
const semComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'])\/\/.*$/gm, "$1");
const CARD = semComentarios(ler("src/components/admin/marketing/CardFunilWhatsApp.tsx"));
const HOOK = semComentarios(ler("src/hooks/useAdminCrmFunil.ts"));
const MIG = ler("supabase/migrations/20261121130000_crm_leads_1c_direcao_primeiro_contato.sql");

// ---------------------------------------------------------------- linha "Fora do funil"
Deno.test("fora do funil: texto pedido (plural)", () => {
  assertEquals(
    textoForaDoFunil({ lojaChamouPrimeiro: 14, lojaChamouPrimeiroComCadastro: 12, desconhecidos: 0 }),
    "Fora do funil: 14 começaram por mensagem da loja (boas-vindas automáticas), 0 desconhecidos",
  );
  assertEquals(
    textoForaDoFunil({ lojaChamouPrimeiro: 1234, lojaChamouPrimeiroComCadastro: 0, desconhecidos: 3 }),
    "Fora do funil: 1.234 começaram por mensagem da loja (boas-vindas automáticas), 3 desconhecidos",
  );
});

Deno.test("fora do funil: singular", () => {
  assertEquals(
    textoForaDoFunil({ lojaChamouPrimeiro: 1, lojaChamouPrimeiroComCadastro: 1, desconhecidos: 1 }),
    "Fora do funil: 1 começou por mensagem da loja (boas-vindas automáticas), 1 desconhecido",
  );
});

Deno.test("fora do funil: sem dado ou ninguém fora = não mostra", () => {
  assertEquals(textoForaDoFunil(null), null);
  assertEquals(textoForaDoFunil(undefined), null);
  assertEquals(textoForaDoFunil({ lojaChamouPrimeiro: 0, lojaChamouPrimeiroComCadastro: 0, desconhecidos: 0 }), null);
  assert(textoForaDoFunil({ lojaChamouPrimeiro: 0, lojaChamouPrimeiroComCadastro: 0, desconhecidos: 2 }) !== null);
});

Deno.test("fora do funil: detalhe traz os ligados a cadastro", () => {
  assert(detalheForaDoFunil({ lojaChamouPrimeiro: 14, lojaChamouPrimeiroComCadastro: 12, desconhecidos: 0 }).includes("12 já tinham cadastro"));
});

Deno.test("normalização: nomes das colunas = RETURNS TABLE da migration 1C; só contagens", () => {
  const i = MIG.indexOf("FUNCTION public.admin_crm_funil_excluidos(");
  const ret = MIG.slice(MIG.indexOf("RETURNS TABLE(", i) + 14, MIG.indexOf(")", MIG.indexOf("RETURNS TABLE(", i)));
  const colunas = ret.split(",").map((c) => c.trim().split(/\s+/)[0]);
  assertEquals(colunas, ["loja_chamou_primeiro", "loja_chamou_primeiro_com_cadastro", "direcao_desconhecida"]);
  const linha = Object.fromEntries(colunas.map((c, k) => [c, String(k + 5)]));
  const f = normalizarForaDoFunil([{ ...linha, telefone: "+5511990000001", nome: "Lead Ficticio" }]);
  assertEquals(f, { lojaChamouPrimeiro: 5, lojaChamouPrimeiroComCadastro: 6, desconhecidos: 7 });
  assert(!JSON.stringify(f).includes("99000"));
  assertEquals(normalizarForaDoFunil(null), { lojaChamouPrimeiro: 0, lojaChamouPrimeiroComCadastro: 0, desconhecidos: 0 });
  assertEquals(normalizarForaDoFunil({ loja_chamou_primeiro: 2 }).lojaChamouPrimeiro, 2);
});

// ---------------------------------------------------------------- função nova ainda não existe
Deno.test("função nova inexistente (código antes do SQL) = 'nao_ativado', sem nova tentativa", () => {
  assertEquals(classificarErroFunil({ code: "PGRST202", message: "Could not find the function public.admin_crm_funil_excluidos(p_fim, p_inicio) in the schema cache" }), "nao_ativado");
  assertEquals(classificarErroFunil({ code: "42883", message: "function public.admin_crm_funil_excluidos(date, date) does not exist" }), "nao_ativado");
  const bloco = HOOK.slice(HOOK.indexOf("export function useAdminCrmFunilExcluidos"), HOOK.indexOf("export function useAdminCrmGastos"));
  assert(bloco.includes("retry: naoRepetirSeNaoAtivado"), "sem nova tentativa");
  assert(bloco.includes("enabled: habilitado && intervalo !== null"), "só depois do funil responder");
  assert(bloco.includes("throw erroDe(error)"), "erro classificado");
});

Deno.test("card: erro da função nova nunca aparece; a linha só existe com dado", () => {
  assert(!/excluidos\.(error|isError|failureReason|status)/.test(CARD), "o card não olha o erro da função nova");
  assert(CARD.includes("const textoFora = excluidos.data ? textoForaDoFunil(excluidos.data) : null;"));
  assert(/\{textoFora && excluidos\.data && \(/.test(CARD), "linha condicionada ao dado");
  assert(!/excluidos[^;\n]*refetch/.test(CARD), "sem botão de tentar de novo para a linha");
});

// ---------------------------------------------------------------- ID do anúncio e ajuda
Deno.test("tabela por anúncio: ID com botão copiar só nas linhas com anúncio", () => {
  assert(CARD.includes("{l.adId && <IdAnuncio id={l.adId} />}"));
  assert(CARD.includes("navigator.clipboard.writeText(id)"));
  assert(/aria-label=\{`Copiar ID do anúncio \$\{id\}`\}/.test(CARD));
  assert(/className="truncate font-mono/.test(CARD), "ID longo não estoura a coluna");
  const [semAnuncio] = normalizarLinhasAnuncio([{ ad_id: "", conversas: 3 }]);
  assertEquals([semAnuncio.adId, semAnuncio.titulo], ["", "Sem anúncio (orgânico / link direto)"]);
});

Deno.test("texto de ajuda: conversa iniciada = o cliente escreveu primeiro", () => {
  assertEquals(TEXTO_CONVERSA_INICIADA, "Conversa iniciada = o cliente escreveu primeiro.");
  assert(CARD.includes("{TEXTO_CONVERSA_INICIADA}"));
  assert(CARD.includes("Sem anúncio") === false, "rótulo 'Sem anúncio' continua vindo da lib, não duplicado no card");
});
