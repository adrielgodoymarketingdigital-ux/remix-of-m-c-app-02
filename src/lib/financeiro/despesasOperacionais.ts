/**
 * Quais contas a pagar pagas entram no "custo operacional" (e portanto abatem
 * o lucro líquido) em useRelatorios — calcularCustosOperacionais e
 * calcularEvolucaoMensal.
 *
 * Ficam de fora:
 * - Taxa de Cartão: tratada à parte (calcularTaxasCartao).
 * - Contas vinculadas a OS e peças de OS (por texto): o custo já entra no
 *   custo direto de produtos/peças/serviços.
 * - Compra de mercadoria para estoque (compra_estoque = true): é saída de
 *   caixa, mas o custo só entra no lucro na venda, via vendas.custo_unitario.
 *   Só `true` exclui — campo ausente (antes da migration), false ou null
 *   mantêm o comportamento antigo.
 *
 * Taxa de Cartão e os_numero também são filtrados na consulta ao banco; a
 * repetição aqui não muda o resultado e deixa a regra completa num lugar só.
 * O filtro de compra_estoque fica SÓ aqui (nunca na consulta), para a ordem
 * entre migration e deploy não importar.
 *
 * Arquivo sem imports: roda direto no Deno (scripts/testes-compra-estoque/).
 */

export const CATEGORIA_TAXA_CARTAO = "Taxa de Cartão";

export interface ContaParaDespesa {
  nome?: string | null;
  descricao?: string | null;
  categoria?: string | null;
  os_numero?: string | null;
  compra_estoque?: boolean | null;
}

export function ehDespesaOperacional(conta: ContaParaDespesa): boolean {
  if (conta.compra_estoque === true) return false;
  if (conta.categoria === CATEGORIA_TAXA_CARTAO) return false;

  const nome = String(conta.nome || "");
  const descricao = String(conta.descricao || "");

  const vinculadaOS = Boolean(conta.os_numero);
  const pecaPorNome = /^peça\s*:/i.test(nome);
  const pecaPorDescricao = /utilizada no servi[çc]o/i.test(descricao);
  const pecaPorPadraoOS = /\(OS\s*\d+/i.test(nome) && /peça/i.test(nome);

  return !(vinculadaOS || pecaPorNome || pecaPorDescricao || pecaPorPadraoOS);
}
