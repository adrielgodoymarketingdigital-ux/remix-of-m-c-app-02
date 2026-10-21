// deno test --no-check --allow-read scripts/testes-marketing-origens/
// Painel Marketing (src/lib/marketing/origens.ts): a RPC admin_mkt_origens
// devolve uma linha por fonte/meio/campanha/conteúdo; a tela reagrupa por
// fonte, campanha ou conteúdo, soma totais e calcula pagantes ÷ cadastros.
import { assertEquals } from "jsr:@std/assert@1";
import {
  agruparOrigens,
  formatarConversao,
  taxaConversao,
  totalOrigens,
  type LinhaOrigem,
} from "../../src/lib/marketing/origens.ts";

function linha(fonte: string, campanha: string, conteudo: string, n: [number, number, number, number, number]): LinhaOrigem {
  const [cadastros, testes, pagantes, pix, cartao] = n;
  return {
    fonte, meio: "cpc", campanha, conteudo,
    cadastros, testes_iniciados: testes, pagantes,
    receita_pix_centavos: pix, receita_cartao_estimada_centavos: cartao, receita_centavos: pix + cartao,
  };
}

const LINHAS: LinhaOrigem[] = [
  linha("facebook", "black", "ad1", [10, 6, 2, 3990, 7990]),
  linha("facebook", "black", "ad2", [5, 2, 1, 0, 1990]),
  linha("instagram", "black", "ad1", [4, 1, 0, 0, 0]),
  linha("google", "busca", "sem origem", [12, 3, 3, 11970, 0]),
  linha("sem origem", "sem origem", "sem origem", [7, 0, 0, 0, 0]),
];

Deno.test("agrupa por campanha somando fontes e conteúdos, ordenado por cadastros", () => {
  assertEquals(agruparOrigens(LINHAS, "campanha"), [
    { chave: "black", cadastros: 19, testes: 9, pagantes: 3, receitaPixCentavos: 3990, receitaCartaoEstimadaCentavos: 9980, receitaCentavos: 13970 },
    { chave: "busca", cadastros: 12, testes: 3, pagantes: 3, receitaPixCentavos: 11970, receitaCartaoEstimadaCentavos: 0, receitaCentavos: 11970 },
    { chave: "sem origem", cadastros: 7, testes: 0, pagantes: 0, receitaPixCentavos: 0, receitaCartaoEstimadaCentavos: 0, receitaCentavos: 0 },
  ]);
});

Deno.test("agrupa por fonte", () => {
  assertEquals(agruparOrigens(LINHAS, "fonte").map((g) => [g.chave, g.cadastros]), [
    ["facebook", 15], ["google", 12], ["sem origem", 7], ["instagram", 4],
  ]);
});

Deno.test("agrupa por conteúdo/anúncio; empate de cadastros desempata pelo nome", () => {
  const linhas = [linha("x", "c", "zeta", [3, 0, 0, 0, 0]), linha("y", "c", "alfa", [3, 0, 0, 0, 0]), ...LINHAS];
  assertEquals(agruparOrigens(linhas, "conteudo").map((g) => [g.chave, g.cadastros]), [
    ["sem origem", 19], ["ad1", 14], ["ad2", 5], ["alfa", 3], ["zeta", 3],
  ]);
});

Deno.test("aceita bigint como string (PostgREST)", () => {
  const l: LinhaOrigem = { ...linha("meta", "c", "a", [0, 0, 0, 0, 0]), cadastros: "8", pagantes: "2", receita_centavos: "3980", receita_pix_centavos: "3980" };
  const [g] = agruparOrigens([l], "fonte");
  assertEquals([g.cadastros, g.pagantes, g.receitaCentavos], [8, 2, 3980]);
});

Deno.test("total soma todas as linhas e bate com a soma dos grupos", () => {
  const total = totalOrigens(LINHAS);
  assertEquals(total, { cadastros: 38, testes: 12, pagantes: 6, receitaPixCentavos: 15960, receitaCartaoEstimadaCentavos: 9980, receitaCentavos: 25940 });
  for (const ag of ["fonte", "campanha", "conteudo"] as const) {
    assertEquals(agruparOrigens(LINHAS, ag).reduce((s, g) => s + g.cadastros, 0), total.cadastros);
  }
  assertEquals(totalOrigens([]).cadastros, 0);
});

Deno.test("conversão = pagantes ÷ cadastros, sem divisão por zero", () => {
  assertEquals(taxaConversao(3, 12), 25);
  assertEquals(taxaConversao(0, 7), 0);
  assertEquals(taxaConversao(0, 0), null);
  assertEquals(formatarConversao(taxaConversao(1, 3)), "33,3%");
  assertEquals(formatarConversao(taxaConversao(0, 7)), "0,0%");
  assertEquals(formatarConversao(null), "—");
});
